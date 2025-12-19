// js/ui.js - نسخه نهایی اصلاح‌شده
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
        
        // شروع سریع بدون انتظار
        this.init();
    }
    
    async init() {
        console.log('🎨 Starting UI initialization...');
        
        // بلافاصله سرویس‌ها را چک می‌کنیم (بدون انتظار طولانی)
        this.authService = window.authService || null;
        this.gameService = window.gameService || null;
        this.supabaseService = window.supabaseService || null;
        
        console.log('🔍 Services status:', {
            auth: !!this.authService,
            game: !!this.gameService,
            supabase: !!this.supabaseService
        });
        
        // حتی اگر سرویس‌ها ناقص باشند، UI را راه‌اندازی می‌کنیم
        setTimeout(() => {
            this.initializeUI();
        }, 500);
    }
    
    async initializeUI() {
        if (this.isInitialized) return;
        
        console.log('🔄 Initializing UI components...');
        
        try {
            // بایند کردن events اولیه
            this.bindEvents();
            
            // چک کردن وضعیت کاربر
            await this.checkUserStatus();
            
            // بارگذاری پنل‌های فروش
            this.loadSalePlans();
            
            this.isInitialized = true;
            console.log('✅ UI initialized successfully');
            
        } catch (error) {
            console.error('❌ Error in initializeUI:', error);
            // باز هم UI را نشان می‌دهیم
            this.showFallbackUI();
        }
    }
    
    async checkUserStatus() {
        console.log('👤 Checking user status...');
        
        // ابتدا از localStorage چک می‌کنیم
        try {
            const userData = localStorage.getItem('sodmax_user');
            if (userData) {
                const user = JSON.parse(userData);
                console.log('📱 Found user in localStorage:', user.email);
                
                // نمایش برنامه اصلی
                await this.showMainApp(user);
                this.isUserVerified = true;
                return;
            }
        } catch (error) {
            console.error('❌ Error loading user from storage:', error);
        }
        
        // اگر کاربری نبود، صفحه ورود نشان داده می‌شود
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
                const displayName = user.user_metadata?.full_name || 
                                   (user.user_metadata && user.user_metadata.full_name) || 
                                   user.email.split('@')[0];
                userNameElement.textContent = displayName;
            }
            
            // مقداردهی اولیه بازی
            if (this.gameService && this.gameService.initialize) {
                try {
                    await this.gameService.initialize(user.id);
                    console.log('✅ Game initialized');
                } catch (error) {
                    console.error('❌ Error initializing game:', error);
                }
            }
            
            // آپدیت UI
            this.updateGameUI();
            
            // بارگذاری تراکنش‌ها
            this.loadTransactions();
            
            // نمایش پیام خوش‌آمد
            setTimeout(() => {
                const name = user.user_metadata?.full_name || user.email.split('@')[0];
                this.showNotification('🌟', `خوش آمدید ${name}!`);
            }, 500);
        }
    }
    
    showLogin() {
        console.log('👤 Showing login/register screen');
        
        const registerOverlay = document.getElementById('registerOverlay');
        const mainContainer = document.getElementById('mainContainer');
        
        if (registerOverlay) {
            registerOverlay.style.display = 'flex';
        }
        
        if (mainContainer) {
            mainContainer.style.display = 'none';
        }
    }
    
    showFallbackUI() {
        console.log('🛡️ Showing fallback UI');
        
        // سعی می‌کنیم حداقل بخش‌های اصلی را نشان دهیم
        const mainContainer = document.getElementById('mainContainer');
        if (mainContainer) {
            mainContainer.style.display = 'block';
            this.showNotification('⚠️', 'برنامه در حالت آفلاین اجرا می‌شود');
        }
    }
    
    bindEvents() {
        console.log('🔗 Binding events...');
        
        try {
            // فرم ورود
            const loginForm = document.getElementById('loginForm');
            if (loginForm) {
                loginForm.addEventListener('submit', (e) => this.handleLoginSubmit(e));
            }
            
            // فرم ثبت‌نام
            const registerForm = document.getElementById('registerForm');
            if (registerForm) {
                registerForm.addEventListener('submit', (e) => this.handleRegister(e));
            }
            
            // دکمه استخراج
            const minerCore = document.getElementById('minerCore');
            if (minerCore) {
                minerCore.addEventListener('click', () => this.handleMining());
            }
            
            // دکمه دریافت USDT
            const claimBtn = document.getElementById('claimUSDTBtn');
            if (claimBtn) {
                claimBtn.addEventListener('click', () => this.handleClaimUSDT());
            }
            
            // دکمه استخراج خودکار
            const autoMineBtn = document.getElementById('autoMineBtn');
            if (autoMineBtn) {
                autoMineBtn.addEventListener('click', () => this.toggleAutoMining());
            }
            
            // دکمه خروج
            const logoutBtn = document.getElementById('logoutBtn');
            if (logoutBtn) {
                logoutBtn.addEventListener('click', () => this.handleLogout());
            }
            
            console.log('✅ Events bound successfully');
        } catch (error) {
            console.error('❌ Error binding events:', error);
        }
    }
    
    // بقیه متدها (handleLoginSubmit, handleRegister, handleMining, etc.)
    // مانند نسخه قبلی باقی می‌مانند اما با مدیریت خطای بهتر
    
    async handleLoginSubmit(e) {
        e.preventDefault();
        
        const emailInput = document.getElementById('loginEmail');
        const passwordInput = document.getElementById('loginPassword');
        
        if (!emailInput || !passwordInput) {
            this.showNotification('❌', 'خطا در فرم ورود');
            return;
        }
        
        const emailValue = emailInput.value.trim();
        const passwordValue = passwordInput.value;
        
        if (!emailValue || !passwordValue) {
            this.showNotification('❌', 'لطفاً ایمیل و رمز عبور را وارد کنید');
            return;
        }
        
        // غیرفعال کردن دکمه
        const submitBtn = e.target.querySelector('button[type="submit"]');
        const originalBtnText = submitBtn ? submitBtn.innerHTML : '';
        
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> در حال ورود...';
        }
        
        try {
            if (!this.authService) {
                throw new Error('سرویس احراز هویت در دسترس نیست');
            }
            
            const result = await this.authService.signIn(emailValue, passwordValue);
            
            if (result.success) {
                this.showNotification('✅', result.message || 'ورود موفقیت‌آمیز بود!');
                
                setTimeout(() => {
                    const user = this.authService.getCurrentUser();
                    if (user) {
                        this.showMainApp(user);
                    }
                }, 1000);
            } else {
                this.showNotification('❌', result.error || 'خطا در ورود');
            }
        } catch (error) {
            console.error('🚨 Error in handleLoginSubmit:', error);
            this.showNotification('❌', 'خطای غیرمنتظره در ورود');
        } finally {
            // فعال کردن دکمه
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalBtnText || '<i class="fas fa-sign-in-alt"></i> ورود به حساب';
            }
        }
    }
    
    async handleRegister(e) {
        e.preventDefault();
        
        const fullNameInput = document.getElementById('fullName');
        const emailInput = document.getElementById('email');
        const passwordInput = document.getElementById('password');
        const confirmPasswordInput = document.getElementById('confirmPassword');
        
        if (!fullNameInput || !emailInput || !passwordInput || !confirmPasswordInput) {
            this.showNotification('❌', 'خطا در فرم ثبت‌نام');
            return;
        }
        
        const fullNameValue = fullNameInput.value.trim();
        const emailValue = emailInput.value.trim();
        const passwordValue = passwordInput.value;
        const confirmPasswordValue = confirmPasswordInput.value;
        
        // اعتبارسنجی
        if (!fullNameValue || !emailValue || !passwordValue || !confirmPasswordValue) {
            this.showNotification('❌', 'لطفاً تمام فیلدها را پر کنید');
            return;
        }
        
        if (passwordValue !== confirmPasswordValue) {
            this.showNotification('❌', 'رمز عبور و تکرار آن مطابقت ندارند');
            return;
        }
        
        if (passwordValue.length < 6) {
            this.showNotification('❌', 'رمز عبور باید حداقل ۶ کاراکتر باشد');
            return;
        }
        
        // غیرفعال کردن دکمه
        const submitBtn = e.target.querySelector('button[type="submit"]');
        const originalBtnText = submitBtn ? submitBtn.innerHTML : '';
        
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> در حال ثبت‌نام...';
        }
        
        try {
            if (!this.authService) {
                throw new Error('سرویس احراز هویت در دسترس نیست');
            }
            
            const result = await this.authService.signUp(
                emailValue,
                passwordValue,
                fullNameValue
            );
            
            if (result.success) {
                this.showNotification('✅', result.message || 'ثبت‌نام موفقیت‌آمیز بود!');
                
                setTimeout(() => {
                    const user = this.authService.getCurrentUser();
                    if (user) {
                        this.showMainApp(user);
                    }
                }, 1500);
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
                submitBtn.innerHTML = originalBtnText || '<i class="fas fa-user-plus"></i> ایجاد حساب کاربری';
            }
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
            this.updateGameUI();
            
            // نمایش افکت
            this.showMiningEffect(result.earned);
            this.pulseMinerCore();
            
        } catch (error) {
            console.error('❌ Error in mining:', error);
            this.showNotification('❌', 'خطا در استخراج');
        }
    }
    
    async handleLogout() {
        if (!this.authService) {
            this.showLogin();
            return;
        }
        
        const result = await this.authService.signOut();
        
        if (result.success) {
            this.showNotification('👋', 'خروج موفقیت‌آمیز بود!');
            this.showLogin();
        } else {
            this.showNotification('❌', 'خطا در خروج');
        }
    }
    
    updateGameUI() {
        if (!this.gameService) return;
        
        const gameData = this.gameService.getGameData();
        if (!gameData) return;
        
        // فرمت‌دهنده اعداد
        const formatNumber = (num) => {
            if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
            if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
            return Math.floor(num).toLocaleString('fa-IR');
        };
        
        // آپدیت موجودی‌ها
        const sodBalance = document.getElementById('sodBalance');
        if (sodBalance) {
            sodBalance.innerHTML = `${formatNumber(gameData.sodBalance)} <span>SOD</span>`;
        }
        
        const usdtBalance = document.getElementById('usdtBalance');
        if (usdtBalance) {
            usdtBalance.innerHTML = `${gameData.usdtBalance.toFixed(4)} <span>USDT</span>`;
        }
        
        // آپدیت آمار
        const todayEarnings = document.getElementById('todayEarnings');
        if (todayEarnings) {
            todayEarnings.textContent = formatNumber(gameData.todayEarnings) + ' SOD';
        }
        
        const miningPower = document.getElementById('miningPower');
        if (miningPower) {
            miningPower.textContent = gameData.miningPower + 'x';
        }
        
        const userLevel = document.getElementById('userLevel');
        if (userLevel) {
            userLevel.textContent = gameData.userLevel;
        }
    }
    
    showNotification(title, message) {
        // پیاده‌سازی ساده notification
        alert(`${title}: ${message}`);
    }
    
    showMiningEffect(amount) {
        // پیاده‌سازی ساده افکت استخراج
        console.log(`⛏️ +${amount} SOD mined!`);
    }
    
    pulseMinerCore() {
        const minerCore = document.getElementById('minerCore');
        if (minerCore) {
            minerCore.style.transform = 'scale(0.95)';
            setTimeout(() => {
                minerCore.style.transform = 'scale(1)';
            }, 200);
        }
    }
    
    async loadSalePlans() {
        // بارگذاری پنل‌های فروش
        console.log('🛒 Loading sale plans...');
    }
    
    async loadTransactions() {
        // بارگذاری تراکنش‌ها
        console.log('📋 Loading transactions...');
    }
}

// ایجاد instance
window.uiService = new UIService();
console.log('✅ UI service loaded');

// شروع UI وقتی DOM آماده شد
document.addEventListener('DOMContentLoaded', () => {
    console.log('📄 DOM fully loaded');
});
