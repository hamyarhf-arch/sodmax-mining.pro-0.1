// js/ui.js - نسخه اصلاح شده
// UI Service for SODmAX Pro
class UIService {
    constructor() {
        console.log('🎨 UIService initializing...');
        
        this.gameService = null;
        this.authService = null;
        this.supabaseService = null;
        
        this.isInitialized = false;
        this.isUserVerified = false;
        this.autoMiningInterval = null;
        
        // منتظر می‌مانیم تا سرویس‌ها لود شوند
        this.init();
    }
    
    async init() {
        console.log('🔄 Waiting for services to load...');
        
        // منتظر می‌مانیم تا سرویس‌ها لود شوند
        let attempts = 0;
        const maxAttempts = 15;
        
        while (attempts < maxAttempts) {
            if (window.gameService && window.authService && window.supabaseService) {
                this.gameService = window.gameService;
                this.authService = window.authService;
                this.supabaseService = window.supabaseService;
                console.log('✅ All services loaded in UI');
                break;
            }
            await new Promise(resolve => setTimeout(resolve, 200));
            attempts++;
        }
        
        if (!this.gameService || !this.authService) {
            console.error('❌ Services not loaded in UI');
            return;
        }
        
        console.log('🎨 UIService starting...');
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
        
        if (!this.authService) {
            console.error('❌ Auth service not available');
            this.showLogin();
            return;
        }
        
        // ابتدا چک می‌کنیم آیا کاربر در localStorage ذخیره شده
        const localUser = localStorage.getItem('sodmax_user');
        if (localUser) {
            try {
                const user = JSON.parse(localUser);
                console.log('📱 Found user in localStorage:', user.email);
                
                // چک می‌کنیم آیا احراز هویت معتبر است
                const authUser = await this.authService.handleAuthStateChange();
                if (authUser && this.authService.isUserVerified()) {
                    await this.showMainApp(authUser);
                    this.isUserVerified = true;
                    return;
                }
            } catch (error) {
                console.error('❌ Error loading user from localStorage:', error);
            }
        }
        
        // اگر کاربری در localStorage نبود یا معتبر نبود
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
            if (this.gameService && this.gameService.initialize) {
                try {
                    await this.gameService.initialize(user.id);
                } catch (error) {
                    console.error('❌ Error initializing game:', error);
                    this.showNotification('⚠️', 'خطا در بارگذاری داده‌های بازی');
                }
            }
            
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
            const loginForm = document.getElementById('loginForm');
            const registerForm = document.getElementById('registerForm');
            if (loginForm) loginForm.reset();
            if (registerForm) registerForm.reset();
            
            // نمایش تب لاگین به صورت پیش‌فرض
            if (window.switchAuthTab) {
                window.switchAuthTab('login');
            }
        }
        
        if (mainContainer) {
            mainContainer.style.display = 'none';
        }
    }
    
    bindEvents() {
        console.log('🔗 Binding events...');
        
        // فرم ورود
        const loginForm = document.getElementById('loginForm');
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => this.handleLoginSubmit(e));
            console.log('✅ Login form bound');
        }
        
        // فرم ثبت‌نام
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
    
    async handleLoginSubmit(e) {
        e.preventDefault();
        
        const email = document.getElementById('loginEmail');
        const password = document.getElementById('loginPassword');
        
        if (!email || !password) {
            this.showNotification('❌', 'لطفاً ایمیل و رمز عبور را وارد کنید');
            return;
        }
        
        const emailValue = email.value.trim();
        const passwordValue = password.value.trim();
        
        if (!emailValue || !passwordValue) {
            this.showNotification('❌', 'لطفاً ایمیل و رمز عبور را وارد کنید');
            return;
        }
        
        if (!this.isValidEmail(emailValue)) {
            this.showNotification('❌', 'لطفاً یک ایمیل معتبر وارد کنید');
            return;
        }
        
        // غیرفعال کردن دکمه
        const submitBtn = e.target.querySelector('button[type="submit"]');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> در حال ورود...';
        }
        
        try {
            if (!this.authService) {
                throw new Error('سرویس احراز هویت در دسترس نیست');
            }
            
            console.log('🔑 Attempting login for:', emailValue);
            
            const result = await this.authService.signIn(emailValue, passwordValue);
            
            console.log('🔑 Login result:', result);
            
            if (result.success) {
                this.showNotification('✅', result.message);
                
                // اگر کاربر لاگین شده
                if (this.authService.isUserVerified()) {
                    setTimeout(() => {
                        const user = this.authService.getCurrentUser();
                        if (user) {
                            this.showMainApp(user);
                        }
                    }, 1000);
                }
            } else {
                this.showNotification('❌', result.error || 'خطا در ورود');
                
                // پاک کردن رمز عبور
                if (password) {
                    password.value = '';
                }
            }
        } catch (error) {
            console.error('🚨 Error in handleLoginSubmit:', error);
            this.showNotification('❌', 'خطای غیرمنتظره در ورود: ' + error.message);
        } finally {
            // فعال کردن دکمه
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> ورود به حساب';
            }
        }
    }
    
    async handleRegister(e) {
        e.preventDefault();
        
        const fullName = document.getElementById('fullName');
        const email = document.getElementById('email');
        const password = document.getElementById('password');
        const confirmPassword = document.getElementById('confirmPassword');
        const referralCode = document.getElementById('referralCode');
        
        // اعتبارسنجی
        if (!fullName.value.trim() || !email.value.trim() || !password.value) {
            this.showNotification('❌', 'لطفاً تمام فیلدهای ضروری را پر کنید');
            return;
        }
        
        if (password.value !== confirmPassword.value) {
            this.showNotification('❌', 'رمز عبور و تکرار آن مطابقت ندارند');
            return;
        }
        
        if (password.value.length < 6) {
            this.showNotification('❌', 'رمز عبور باید حداقل ۶ کاراکتر باشد');
            return;
        }
        
        if (!this.isValidEmail(email.value)) {
            this.showNotification('❌', 'لطفاً یک ایمیل معتبر وارد کنید');
            return;
        }
        
        this.showNotification('⏳', 'در حال ایجاد حساب کاربری...');
        
        // غیرفعال کردن دکمه
        const submitBtn = e.target.querySelector('button[type="submit"]');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> در حال ثبت‌نام...';
        }
        
        try {
            const result = await this.authService.signUp(
                email.value.trim(),
                password.value,
                fullName.value.trim(),
                referralCode ? referralCode.value.trim() : ''
            );
            
            if (result.success) {
                this.showNotification('✅', result.message);
                
                // پاک کردن فرم
                e.target.reset();
                
                // اگر کاربر بلافاصله لاگین شد
                if (this.authService.isUserVerified()) {
                    setTimeout(() => {
                        const user = this.authService.getCurrentUser();
                        if (user) {
                            this.showMainApp(user);
                        }
                    }, 1500);
                } else if (result.message.includes('ایمیل')) {
                    // اگر نیاز به تأیید ایمیل دارد
                    setTimeout(() => {
                        this.showNotification('📧', 'لطفاً ایمیل خود را برای تأیید بررسی کنید.');
                        // برگشت به صفحه لاگین
                        if (window.switchAuthTab) {
                            window.switchAuthTab('login');
                        }
                    }, 2000);
                }
            } else {
                this.showNotification('❌', result.error || 'خطا در ثبت‌نام');
            }
        } catch (error) {
            console.error('🚨 Error in handleRegister:', error);
            this.showNotification('❌', 'خطای غیرمنتظره در ثبت‌نام');
        } finally {
            // فعال کردن دکمه
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<i class="fas fa-user-plus"></i> ایجاد حساب کاربری';
            }
        }
    }
    
    async handleLogout() {
        if (!this.authService) {
            this.showNotification('❌', 'سرویس احراز هویت در دسترس نیست');
            return;
        }
        
        // توقف استخراج خودکار
        if (this.autoMiningInterval) {
            clearInterval(this.autoMiningInterval);
            this.autoMiningInterval = null;
        }
        
        const result = await this.authService.signOut();
        
        if (result.success) {
            this.showNotification('👋', result.message);
            this.showLogin();
        } else {
            this.showNotification('❌', result.error || 'خطا در خروج');
        }
    }
    
    async handleMining() {
        if (!this.authService || !this.authService.isUserVerified()) {
            this.showNotification('❌', 'ابتدا ثبت‌نام و وارد شوید');
            this.showLogin();
            return;
        }
        
        if (!this.gameService) {
            this.showNotification('❌', 'سرویس بازی در دسترس نیست');
            return;
        }
        
        try {
            const result = await this.gameService.manualMine();
            
            // آپدیت UI
            this.updateGameUI();
            
            // نمایش افکت (بعد از کمی تأخیر برای روان‌تر شدن)
            setTimeout(() => {
                this.showMiningEffect(result.earned);
                this.pulseMinerCore();
            }, 100);
            
            // بررسی پاداش USDT
            if (result.usdtResult) {
                this.showNotification('🎉', `${result.usdtResult.usdtEarned.toFixed(4)} USDT دریافت کردید!`);
                
                if (result.usdtResult.levelUp) {
                    this.showNotification('⭐', `سطح شما ارتقاء یافت! سطح ${this.gameService.getUserLevel()}`);
                }
            }
            
        } catch (error) {
            console.error('❌ Error in mining:', error);
            this.showNotification('❌', error.message || 'خطا در استخراج');
        }
    }
    
    async handleClaimUSDT() {
        if (!this.authService || !this.authService.isUserVerified()) {
            this.showNotification('❌', 'ابتدا ثبت‌نام و وارد شوید');
            this.showLogin();
            return;
        }
        
        if (!this.gameService) {
            this.showNotification('❌', 'سرویس بازی در دسترس نیست');
            return;
        }
        
        try {
            const usdtClaimed = await this.gameService.claimUSDT();
            this.showNotification('✅', `${usdtClaimed.toFixed(4)} USDT دریافت شد!`);
            this.updateGameUI();
        } catch (error) {
            console.error('❌ Error claiming USDT:', error);
            this.showNotification('❌', error.message || 'خطا در دریافت USDT');
        }
    }
    
    async handleBoostMining() {
        if (!this.authService || !this.authService.isUserVerified()) {
            this.showNotification('❌', 'ابتدا ثبت‌نام و وارد شوید');
            this.showLogin();
            return;
        }
        
        if (!this.gameService) {
            this.showNotification('❌', 'سرویس بازی در دسترس نیست');
            return;
        }
        
        try {
            await this.gameService.handleBoostMining();
            this.showNotification('⚡', 'قدرت استخراج ۳ برابر شد! (۳۰ دقیقه)');
            this.updateGameUI();
        } catch (error) {
            console.error('❌ Error boosting mining:', error);
            this.showNotification('❌', error.message || 'خطا در افزایش قدرت');
        }
    }
    
    async toggleAutoMining() {
        if (!this.authService || !this.authService.isUserVerified()) {
            this.showNotification('❌', 'ابتدا ثبت‌نام و وارد شوید');
            this.showLogin();
            return;
        }
        
        if (!this.gameService) {
            this.showNotification('❌', 'سرویس بازی در دسترس نیست');
            return;
        }
        
        const gameData = this.gameService.getGameData();
        const autoMineBtn = document.getElementById('autoMineBtn');
        
        try {
            if (!gameData.autoMining) {
                // فعال کردن استخراج خودکار
                
                // چک کردن موجودی
                if (gameData.sodBalance < 10000) {
                    this.showNotification('⚠️', 'برای استخراج خودکار حداقل ۱۰,۰۰۰ SOD نیاز دارید.');
                    return;
                }
                
                autoMineBtn.innerHTML = '<i class="fas fa-pause"></i> توقف خودکار';
                autoMineBtn.classList.remove('btn-primary');
                autoMineBtn.classList.add('btn-warning');
                
                this.showNotification('🤖', 'استخراج خودکار فعال شد!');
                
                // تغییر وضعیت در game service
                await this.gameService.toggleAutoMining();
                
                // شروع انیمیشن استخراج خودکار
                this.startAutoMiningAnimation();
                
                // شروع UI auto mining interval
                this.startUIAutoMining();
                
            } else {
                // غیرفعال کردن استخراج خودکار
                autoMineBtn.innerHTML = '<i class="fas fa-robot"></i> استخراج خودکار';
                autoMineBtn.classList.remove('btn-warning');
                autoMineBtn.classList.add('btn-primary');
                
                this.showNotification('⏸️', 'استخراج خودکار متوقف شد.');
                
                // توقف در game service
                await this.gameService.toggleAutoMining();
                
                // توقف انیمیشن
                this.stopAutoMiningAnimation();
                
                // توقف UI interval
                this.stopUIAutoMining();
            }
            
            this.updateGameUI();
            
        } catch (error) {
            console.error('❌ Error toggling auto mining:', error);
            this.showNotification('❌', error.message || 'خطا در تغییر وضعیت استخراج خودکار');
        }
    }
    
    startUIAutoMining() {
        // UI فقط آپدیت می‌کند، منطق استخراج در game.js است
        if (this.autoMiningInterval) {
            clearInterval(this.autoMiningInterval);
        }
        
        this.autoMiningInterval = setInterval(() => {
            this.updateGameUI();
            this.pulseMinerCore();
        }, 1000);
    }
    
    stopUIAutoMining() {
        if (this.autoMiningInterval) {
            clearInterval(this.autoMiningInterval);
            this.autoMiningInterval = null;
        }
    }
    
    async showSODSale() {
        console.log('🛒 Showing SOD sale section');
        
        // ابتدا چک می‌کنیم کاربر لاگین کرده باشد
        if (!this.authService || !this.authService.isUserVerified()) {
            this.showNotification('❌', 'ابتدا ثبت‌نام و وارد شوید');
            this.showLogin();
            return;
        }
        
        const sodSaleSection = document.getElementById('sodSaleSection');
        if (sodSaleSection) {
            sodSaleSection.style.display = 'block';
            sodSaleSection.scrollIntoView({ 
                behavior: 'smooth',
                block: 'start'
            });
        }
    }
    
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
    
    async updateGameUI() {
        if (!this.gameService) return;
        
        const gameData = this.gameService.getGameData();
        if (!gameData) return;
        
        // فرمت‌دهنده اعداد
        const formatNumber = (num) => {
            if (num >= 1000000000) return (num / 1000000000).toFixed(2) + 'B';
            if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
            if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
            return Math.floor(num).toLocaleString('fa-IR');
        };
        
        // موجودی‌ها
        const sodBalance = document.getElementById('sodBalance');
        if (sodBalance) {
            sodBalance.innerHTML = `${formatNumber(gameData.sodBalance)} <span>SOD</span>`;
        }
        
        const usdtBalance = document.getElementById('usdtBalance');
        if (usdtBalance) {
            usdtBalance.innerHTML = `${gameData.usdtBalance.toFixed(4)} <span>USDT</span>`;
        }
        
        // آمار
        const todayEarnings = document.getElementById('todayEarnings');
        if (todayEarnings) {
            todayEarnings.textContent = formatNumber(gameData.todayEarnings) + ' SOD';
        }
        
        const miningPower = document.getElementById('miningPower');
        if (miningPower) {
            miningPower.textContent = gameData.miningPower + 'x';
        }
        
        const clickReward = document.getElementById('clickReward');
        if (clickReward) {
            clickReward.textContent = '+' + gameData.miningPower + ' SOD';
        }
        
        const userLevel = document.getElementById('userLevel');
        if (userLevel) {
            userLevel.textContent = gameData.userLevel;
        }
        
        // پاداش USDT
        const availableUSDT = document.getElementById('availableUSDT');
        if (availableUSDT) {
            availableUSDT.textContent = gameData.usdtBalance.toFixed(4) + ' USDT';
        }
        
        const nextReward = document.getElementById('nextReward');
        if (nextReward) {
            nextReward.textContent = '۰.۰۱ USDT';
        }
        
        const progressPercent = (gameData.usdtProgress / 10000000) * 100;
        const progressFill = document.getElementById('progressFill');
        if (progressFill) {
            progressFill.style.width = progressPercent + '%';
        }
        
        const progressText = document.getElementById('progressText');
        if (progressText) {
            progressText.textContent = formatNumber(gameData.usdtProgress) + ' / ۱۰,۰۰۰,۰۰۰ SOD (۰.۰۱ USDT)';
        }
        
        // آپدیت دکمه استخراج خودکار
        const autoMineBtn = document.getElementById('autoMineBtn');
        if (autoMineBtn) {
            if (gameData.autoMining) {
                autoMineBtn.innerHTML = '<i class="fas fa-pause"></i> توقف خودکار';
                autoMineBtn.classList.remove('btn-primary');
                autoMineBtn.classList.add('btn-warning');
            } else {
                autoMineBtn.innerHTML = '<i class="fas fa-robot"></i> استخراج خودکار';
                autoMineBtn.classList.remove('btn-warning');
                autoMineBtn.classList.add('btn-primary');
            }
        }
    }
    
    showMiningEffect(amount) {
        // ابتدا مطمئن شویم انیمیشن در CSS وجود دارد
        const style = document.createElement('style');
        style.id = 'mining-effect-styles';
        style.textContent = `
            @keyframes miningEffect {
                0% {
                    opacity: 1;
                    transform: translate(0, 0) scale(1);
                }
                100% {
                    opacity: 0;
                    transform: translate(0, -100px) scale(1.5);
                }
            }
            
            .mining-effect {
                position: fixed;
                font-weight: 900;
                font-size: 24px;
                pointer-events: none;
                z-index: 10000;
                text-shadow: 0 0 10px var(--primary), 0 0 20px var(--primary);
                animation: miningEffect 1.5s ease-out forwards;
                user-select: none;
            }
        `;
        
        // اگر هنوز اضافه نشده، اضافه کن
        if (!document.getElementById('mining-effect-styles')) {
            document.head.appendChild(style);
        }
        
        // ایجاد المان افکت
        const effect = document.createElement('div');
        effect.className = 'mining-effect';
        effect.textContent = `+${this.formatNumber(amount)}`;
        effect.style.color = this.getRandomColor();
        
        // موقعیت‌یابی در وسط ماینر
        const minerCore = document.getElementById('minerCore');
        if (minerCore) {
            const rect = minerCore.getBoundingClientRect();
            effect.style.left = (rect.left + rect.width / 2) + 'px';
            effect.style.top = (rect.top + rect.height / 2) + 'px';
            
            document.body.appendChild(effect);
            
            // حذف المان بعد از انیمیشن
            setTimeout(() => {
                if (effect.parentNode) {
                    effect.parentNode.removeChild(effect);
                }
            }, 1500);
        }
    }
    
    // تابع helper برای رنگ‌های تصادفی
    getRandomColor() {
        const colors = [
            '#0066FF', // آبی اصلی
            '#00D4AA', // سبز
            '#FF6B35', // نارنجی
            '#FFD700', // طلایی
            '#FF4081', // صورتی
            '#7C4DFF'  // بنفش
        ];
        return colors[Math.floor(Math.random() * colors.length)];
    }
    
    // تابع پالس برای ماینر
    pulseMinerCore() {
        const minerCore = document.getElementById('minerCore');
        if (minerCore) {
            minerCore.style.transform = 'scale(0.95)';
            minerCore.style.boxShadow = 'inset 0 0 60px rgba(0, 102, 255, 0.3), 0 15px 40px rgba(0, 102, 255, 0.4)';
            
            setTimeout(() => {
                minerCore.style.transform = 'scale(1)';
                minerCore.style.boxShadow = 'inset 0 0 40px rgba(0, 102, 255, 0.1), 0 10px 30px rgba(0, 0, 0, 0.5)';
            }, 200);
        }
    }
    
    // انیمیشن استخراج خودکار
    startAutoMiningAnimation() {
        const minerCore = document.getElementById('minerCore');
        if (!minerCore) return;
        
        // اضافه کردن کلاس انیمیشن
        minerCore.classList.add('auto-mining');
        
        // اضافه کردن استایل انیمیشن
        const style = document.createElement('style');
        style.id = 'auto-mining-styles';
        style.textContent = `
            .auto-mining {
                animation: pulseGlow 1.5s infinite alternate;
            }
            
            @keyframes pulseGlow {
                0% {
                    box-shadow: inset 0 0 40px rgba(0, 102, 255, 0.2), 
                              0 10px 30px rgba(0, 0, 0, 0.5),
                              0 0 20px rgba(0, 102, 255, 0.3);
                }
                100% {
                    box-shadow: inset 0 0 60px rgba(0, 102, 255, 0.4), 
                              0 15px 40px rgba(0, 102, 255, 0.3),
                              0 0 40px rgba(0, 212, 170, 0.5);
                }
            }
        `;
        
        if (!document.getElementById('auto-mining-styles')) {
            document.head.appendChild(style);
        }
    }
    
    stopAutoMiningAnimation() {
        const minerCore = document.getElementById('minerCore');
        if (minerCore) {
            minerCore.classList.remove('auto-mining');
        }
    }
    
    formatNumber(num) {
        if (num >= 1000000000) return (num / 1000000000).toFixed(2) + 'B';
        if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
        if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
        return Math.floor(num).toLocaleString('fa-IR');
    }
    
    async loadSalePlans() {
        console.log('🛒 Loading sale plans...');
        
        const salePlansGrid = document.getElementById('salePlansGrid');
        if (!salePlansGrid) return;
        
        try {
            let plans = [];
            
            // سعی می‌کنیم از دیتابیس بگیریم
            if (this.supabaseService) {
                plans = await this.supabaseService.getSalePlans();
            }
            
            // اگر نتوانستیم، از پیش‌فرض استفاده می‌کنیم
            if (!plans || plans.length === 0) {
                console.log('ℹ️ Using default sale plans');
                plans = [
                    {
                        id: 1,
                        name: "پنل استارتر",
                        price: 1,
                        sod_amount: 5000000,
                        features: ["۵,۰۰۰,۰۰۰ SOD", "هدیه ۵۰۰,۰۰۰ SOD اضافی", "قدرت استخراج +۵٪"],
                        popular: false,
                        discount: 0
                    },
                    {
                        id: 2,
                        name: "پنل پرو",
                        price: 5,
                        sod_amount: 30000000,
                        features: ["۳۰,۰۰۰,۰۰۰ SOD", "هدیه ۳,۰۰۰,۰۰۰ SOD اضافی", "قدرت استخراج +۱۵٪"],
                        popular: true,
                        discount: 10
                    },
                    {
                        id: 3,
                        name: "پنل پلاتینیوم",
                        price: 15,
                        sod_amount: 100000000,
                        features: ["۱۰۰,۰۰۰,۰۰۰ SOD", "هدیه ۱۰,۰۰۰,۰۰۰ SOD اضافی", "قدرت استخراج +۳۰٪"],
                        popular: false,
                        discount: 15
                    },
                    {
                        id: 4,
                        name: "پنل الماس",
                        price: 50,
                        sod_amount: 500000000,
                        features: ["۵۰۰,۰۰۰,۰۰۰ SOD", "هدیه ۵۰,۰۰۰,۰۰۰ SOD اضافی", "قدرت استخراج +۵۰٪"],
                        popular: false,
                        discount: 20
                    }
                ];
            }
            
            salePlansGrid.innerHTML = '';
            
            plans.forEach(plan => {
                const card = document.createElement('div');
                card.className = `sale-plan-card ${plan.popular ? 'featured' : ''}`;
                
                const totalSOD = plan.sod_amount + Math.floor(plan.sod_amount * (plan.discount / 100));
                
                card.innerHTML = `
                    ${plan.popular ? `<div class="sale-plan-badge">پیشنهاد ویژه</div>` : ''}
                    ${plan.discount > 0 ? `<div style="position: absolute; top: 16px; right: 16px;"><span class="discount-badge">${plan.discount}% تخفیف</span></div>` : ''}
                    
                    <div class="sale-plan-header">
                        <h3 class="sale-plan-name">${plan.name}</h3>
                        <div class="sale-plan-price">${plan.price} <span>USDT</span></div>
                        <div class="sod-amount">${this.formatNumber(totalSOD)} SOD</div>
                    </div>
                    
                    <ul class="sale-plan-features">
                        ${plan.features ? plan.features.map(feature => `<li><i class="fas fa-check" style="color: var(--success);"></i> ${feature}</li>`).join('') : ''}
                    </ul>
                    
                    <button class="btn ${plan.popular ? 'btn-warning' : 'btn-primary'}" onclick="uiService.buySODPlan(${plan.id})">
                        <i class="fas fa-shopping-cart"></i>
                        خرید پنل
                    </button>
                `;
                
                salePlansGrid.appendChild(card);
            });
            
            console.log('✅ Sale plans loaded:', plans.length);
        } catch (error) {
            console.error('❌ Error loading sale plans:', error);
            salePlansGrid.innerHTML = '<p style="text-align: center; color: var(--text-secondary);">خطا در بارگذاری پنل‌ها</p>';
        }
    }
    
    async buySODPlan(planId) {
        if (!this.authService || !this.authService.isUserVerified()) {
            this.showNotification('❌', 'ابتدا ثبت‌نام و وارد شوید');
            this.showLogin();
            return;
        }
        
        if (!this.gameService) {
            this.showNotification('❌', 'سرویس بازی در دسترس نیست');
            return;
        }
        
        try {
            const result = await this.gameService.buySODPlan(planId);
            if (result.success) {
                this.showNotification('🎉', `پنل خریداری شد! ${this.formatNumber(result.sodReceived)} SOD دریافت کردید.`);
                this.updateGameUI();
            }
        } catch (error) {
            console.error('❌ Error buying SOD plan:', error);
            this.showNotification('❌', error.message || 'خطا در خرید پنل');
        }
    }
    
    async loadTransactions() {
        console.log('📋 Loading transactions...');
        
        const transactionsList = document.getElementById('transactionsList');
        if (!transactionsList) return;
        
        try {
            let transactions = [];
            
            // سعی می‌کنیم از دیتابیس بگیریم
            const user = this.authService ? this.authService.getCurrentUser() : null;
            if (user && this.supabaseService) {
                transactions = await this.supabaseService.getTransactions(user.id, 10);
            }
            
            // اگر نتوانستیم، از localStorage استفاده می‌کنیم
            if (!transactions || transactions.length === 0) {
                if (user) {
                    const localTransactions = localStorage.getItem(`sodmax_transactions_${user.id}`);
                    if (localTransactions) {
                        transactions = JSON.parse(localTransactions);
                    }
                }
            }
            
            if (transactions.length === 0) {
                transactionsList.innerHTML = `
                    <div class="transaction-row">
                        <div style="text-align: center; padding: 40px; color: var(--text-secondary);">
                            <i class="fas fa-history" style="font-size: 40px; margin-bottom: 16px;"></i>
                            <p>هنوز تراکنشی ثبت نشده است</p>
                        </div>
                    </div>
                `;
                return;
            }
            
            transactionsList.innerHTML = '';
            
            transactions.forEach(transaction => {
                const row = document.createElement('div');
                row.className = 'transaction-row';
                
                const icon = this.getTransactionIcon(transaction.type);
                const amountColor = transaction.amount >= 0 ? 'var(--success)' : 'var(--error)';
                const amountSign = transaction.amount >= 0 ? '+' : '';
                
                row.innerHTML = `
                    <div class="transaction-type">
                        <div class="transaction-icon">${icon}</div>
                        <div style="flex: 1;">
                            <div style="font-weight: bold;">${this.getTransactionTypeText(transaction.type)}</div>
                            <div style="color: var(--text-secondary); font-size: 12px;">
                                ${new Date(transaction.created_at).toLocaleString('fa-IR')}
                            </div>
                        </div>
                        <div style="font-weight: bold; color: ${amountColor};">
                            ${amountSign}${Math.abs(transaction.amount).toLocaleString('fa-IR')} ${transaction.currency}
                        </div>
                    </div>
                `;
                
                transactionsList.appendChild(row);
            });
            
            console.log('✅ Transactions loaded:', transactions.length);
        } catch (error) {
            console.error('❌ Error loading transactions:', error);
            transactionsList.innerHTML = '<p style="text-align: center; color: var(--error);">خطا در بارگذاری تراکنش‌ها</p>';
        }
    }
    
    getTransactionIcon(type) {
        const icons = {
            'mining': '⛏️',
            'usdt_reward': '💰',
            'purchase': '🛒',
            'boost': '⚡',
            'withdrawal': '💳'
        };
        
        return icons[type] || '📝';
    }
    
    getTransactionTypeText(type) {
        const texts = {
            'mining': 'استخراج دستی',
            'usdt_reward': 'پاداش USDT',
            'purchase': 'خرید پنل',
            'boost': 'افزایش قدرت',
            'withdrawal': 'برداشت USDT'
        };
        
        return texts[type] || type;
    }
}

// ایجاد instance و export
window.uiService = new UIService();
console.log('✅ UI service instance created');

// Wait for DOM to load
document.addEventListener('DOMContentLoaded', () => {
    console.log('📄 DOM loaded, UI service ready');
});
