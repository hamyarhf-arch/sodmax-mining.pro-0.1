// UI Service for SODmAX Pro
class UIService {
    constructor() {
        this.gameService = window.gameService;
        this.authService = window.authService;
        this.supabaseService = window.supabaseService;
        
        this.isInitialized = false;
        this.isUserVerified = false;
        
        this.initializeUI();
    }
    
    async initializeUI() {
        if (this.isInitialized) return;
        
        console.log('🔄 Initializing UI...');
        
        // بایند کردن events اولیه
        this.bindEvents();
        
        // چک کردن وضعیت احراز هویت و ثبت‌نام
        await this.checkAuthAndRegistration();
        
        // بارگذاری پنل‌های فروش
        this.loadSalePlans();
        
        this.isInitialized = true;
        console.log('✅ UI initialized');
    }
    
    async checkAuthAndRegistration() {
        console.log('🔍 Checking auth and registration...');
        
        const user = await this.authService.handleAuthStateChange();
        
        if (user && this.authService.isUserVerified()) {
            console.log('✅ User verified and registered:', user.email);
            await this.showMainApp(user);
            this.isUserVerified = true;
        } else {
            console.log('❌ User not verified or not registered');
            this.showLogin();
            this.isUserVerified = false;
        }
    }
    
    onUserVerified(user) {
        console.log('🎉 User verified callback:', user.email);
        this.isUserVerified = true;
        this.showMainApp(user);
    }
    
    onUserSignedOut() {
        console.log('👋 User signed out callback');
        this.isUserVerified = false;
        this.showLogin();
    }
    
    async showMainApp(user) {
        console.log('🚀 Showing main app for:', user.email);
        
        // مخفی کردن صفحه ثبت‌نام/ورود
        const registerOverlay = document.getElementById('registerOverlay');
        const mainContainer = document.getElementById('mainContainer');
        
        if (registerOverlay) {
            registerOverlay.style.display = 'none';
        }
        
        if (mainContainer) {
            mainContainer.style.display = 'block';
            
            // نمایش اطلاعات کاربر
            const userEmailElement = document.getElementById('userEmail');
            if (userEmailElement) {
                userEmailElement.textContent = user.email;
            }
            
            // نمایش نام کاربر
            const userNameElement = document.getElementById('userName');
            if (userNameElement) {
                userNameElement.textContent = user.user_metadata?.full_name || user.email.split('@')[0];
            }
            
            // مقداردهی اولیه بازی
            await this.gameService.initialize(user.id);
            
            // آپدیت UI
            this.updateGameUI();
            
            // بارگذاری تراکنش‌ها
            this.loadTransactions();
            
            // نمایش پیام خوش‌آمد
            setTimeout(() => {
                this.showNotification('🌟', `خوش آمدید ${user.user_metadata?.full_name || 'کاربر'}!`);
            }, 500);
        }
    }
    
    showLogin() {
        console.log('👤 Showing login/register screen');
        
        const registerOverlay = document.getElementById('registerOverlay');
        const mainContainer = document.getElementById('mainContainer');
        
        if (registerOverlay) {
            registerOverlay.style.display = 'flex';
            
            // ریست فرم
            const registerForm = document.getElementById('registerForm');
            if (registerForm) {
                registerForm.reset();
            }
        }
        
        if (mainContainer) {
            mainContainer.style.display = 'none';
        }
    }
    
    bindEvents() {
        console.log('🔗 Binding events...');
        
        // فرم ثبت‌نام/ورود
        const registerForm = document.getElementById('registerForm');
        if (registerForm) {
            registerForm.addEventListener('submit', (e) => this.handleRegister(e));
            console.log('✅ Register form bound');
        }
        
        // دکمه استخراج
        const minerCore = document.getElementById('minerCore');
        if (minerCore) {
            minerCore.addEventListener('click', () => this.handleMining());
            console.log('✅ Miner core bound');
        }
        
        // دکمه دریافت USDT
        const claimBtn = document.getElementById('claimUSDTBtn');
        if (claimBtn) {
            claimBtn.addEventListener('click', () => this.handleClaimUSDT());
            console.log('✅ Claim USDT button bound');
        }
        
        // دکمه استخراج خودکار
        const autoMineBtn = document.getElementById('autoMineBtn');
        if (autoMineBtn) {
            autoMineBtn.addEventListener('click', () => this.toggleAutoMining());
            console.log('✅ Auto mine button bound');
        }
        
        // دکمه افزایش قدرت
        const boostBtn = document.querySelector('button[onclick*="boostMining"]');
        if (boostBtn) {
            boostBtn.removeAttribute('onclick');
            boostBtn.addEventListener('click', () => this.handleBoostMining());
            console.log('✅ Boost mining button bound');
        }
        
        // دکمه خرید SOD
        const buySodBtn = document.querySelector('button[onclick*="showSODSale"]');
        if (buySodBtn) {
            buySodBtn.removeAttribute('onclick');
            buySodBtn.addEventListener('click', () => this.showSODSale());
            console.log('✅ Buy SOD button bound');
        }
        
        // دکمه خروج
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => this.handleLogout());
            console.log('✅ Logout button bound');
        }
        
        console.log('✅ All events bound');
    }
    
    async handleRegister(e) {
        e.preventDefault();
        
        const fullName = document.getElementById('fullName');
        const email = document.getElementById('email');
        const referralCode = document.getElementById('referralCode');
        
        if (!fullName || !email) {
            this.showNotification('❌', 'لطفاً نام و ایمیل را وارد کنید');
            return;
        }
        
        const fullNameValue = fullName.value.trim();
        const emailValue = email.value.trim();
        const referralCodeValue = referralCode ? referralCode.value.trim() : '';
        
        if (!fullNameValue || !emailValue) {
            this.showNotification('❌', 'لطفاً نام و ایمیل را وارد کنید');
            return;
        }
        
        // بررسی فرمت ایمیل
        if (!this.isValidEmail(emailValue)) {
            this.showNotification('❌', 'لطفاً یک ایمیل معتبر وارد کنید');
            return;
        }
        
        // تولید رمز عبور تصادفی
        const password = this.generatePassword();
        
        this.showNotification('⏳', 'در حال ثبت‌نام...');
        
        // غیرفعال کردن دکمه
        const submitBtn = e.target.querySelector('button[type="submit"]');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> در حال ثبت‌نام...';
        }
        
        try {
            const result = await this.authService.signUp(emailValue, password, fullNameValue, referralCodeValue);
            
            if (result.success) {
                this.showNotification('✅', result.message);
                
                // اگر کاربر بلافاصله وارد شده، برنامه اصلی را نشان بده
                if (this.authService.isUserVerified()) {
                    setTimeout(() => {
                        this.showMainApp(this.authService.getCurrentUser());
                    }, 1500);
                } else {
                    // اگر نیاز به تأیید ایمیل دارد، راهنمایی کن
                    setTimeout(() => {
                        this.showNotification('📧', 'لطفاً ایمیل خود را برای تأیید بررسی کنید.');
                        this.showLogin(); // بازگشت به صفحه لاگین
                    }, 2000);
                }
            } else {
                this.showNotification('❌', result.error || 'خطا در ثبت‌نام');
            }
        } finally {
            // فعال کردن دکمه
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<i class="fas fa-user-plus"></i> ثبت‌نام و شروع استخراج';
            }
        }
    }
    
    async handleLogin(email, password) {
        try {
            this.showNotification('⏳', 'در حال ورود...');
            
            const result = await this.authService.signIn(email, password);
            
            if (result.success) {
                this.showNotification('✅', result.message);
                this.showMainApp(this.authService.getCurrentUser());
            } else {
                this.showNotification('❌', result.error || 'خطا در ورود');
            }
        } catch (error) {
            this.showNotification('❌', 'خطای غیرمنتظره در ورود');
        }
    }
    
    async handleLogout() {
        const result = await this.authService.signOut();
        
        if (result.success) {
            this.showNotification('👋', result.message);
            this.showLogin();
        } else {
            this.showNotification('❌', result.error || 'خطا در خروج');
        }
    }
    
    handleMining() {
        if (!this.authService.isUserVerified()) {
            this.showNotification('❌', 'ابتدا ثبت‌نام و وارد شوید');
            this.showLogin();
            return;
        }
        
        const result = this.gameService.manualMine();
        
        // آپدیت UI
        this.updateGameUI();
        
        // نمایش افکت
        this.showMiningEffect(result.earned);
        
        // بررسی پاداش USDT
        if (result.usdtResult) {
            this.showNotification('🎉', `${result.usdtResult.usdtEarned.toFixed(4)} USDT دریافت کردید!`);
            
            if (result.usdtResult.levelUp) {
                this.showNotification('⭐', `سطح شما ارتقاء یافت!`);
            }
        }
    }
    
    // سایر توابع (handleClaimUSDT, handleBoostMining, toggleAutoMining, etc.) 
    // باید همانند قبل باشند اما با چک authService.isUserVerified()
    
    // ============ Helper functions ============
    
    isValidEmail(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    }
    
    generatePassword() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
        let password = '';
        for (let i = 0; i < 12; i++) {
            password += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return password;
    }
    
    showNotification(title, message) {
        const notification = document.getElementById('notification');
        const notificationTitle = document.getElementById('notificationTitle');
        const notificationMessage = document.getElementById('notificationMessage');
        
        if (!notification || !notificationTitle || !notificationMessage) return;
        
        notificationTitle.textContent = title;
        notificationMessage.textContent = message;
        
        notification.classList.add('show');
        
        setTimeout(() => {
            notification.classList.remove('show');
        }, 4000);
    }
    
    // بقیه توابع (updateGameUI, showMiningEffect, loadSalePlans, etc.)
    // مانند قبل باقی می‌مانند اما با چک authService.isUserVerified()
}

// ایجاد instance و export
window.uiService = new UIService();
console.log('✅ UI service loaded');
