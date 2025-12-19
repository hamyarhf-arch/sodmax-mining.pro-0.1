// js/ui.js - نسخه کامل و اصلاح‌شده
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
        const maxAttempts = 20;
        
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
            // سعی می‌کنیم بعداً دوباره چک کنیم
            setTimeout(() => this.init(), 1000);
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
        try {
            const userData = localStorage.getItem('sodmax_user');
            if (userData) {
                const user = JSON.parse(userData);
                console.log('📱 Found user in localStorage:', user.email);
                
                // کاربر را تنظیم می‌کنیم
                this.authService.currentUser = user;
                this.authService.userVerified = true;
                
                // مستقیماً برنامه اصلی را نشان می‌دهیم
                await this.showMainApp(user);
                this.isUserVerified = true;
                return;
            }
        } catch (error) {
            console.error('❌ Error loading user from localStorage:', error);
        }
        
        // اگر کاربری در localStorage نبود، از auth service چک می‌کنیم
        try {
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
        } catch (error) {
            console.error('❌ Error checking auth state:', error);
            this.showLogin();
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
                const displayName = user.user_metadata?.full_name || 
                                   (user.user_metadata && user.user_metadata.full_name) || 
                                   user.email.split('@')[0];
                userNameElement.textContent = displayName;
            }
            
            // مقداردهی اولیه بازی
            if (this.gameService && this.gameService.initialize) {
                try {
                    await this.gameService.initialize(user.id);
                    console.log('✅ Game initialized successfully');
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
            
            // ریست فرم‌ها
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
            console.log('✅ Found login form');
            loginForm.addEventListener('submit', (e) => this.handleLoginSubmit(e));
        } else {
            console.warn('⚠️ Login form not found!');
        }
        
        // فرم ثبت‌نام
        const registerForm = document.getElementById('registerForm');
        if (registerForm) {
            console.log('✅ Found register form');
            registerForm.addEventListener('submit', (e) => this.handleRegister(e));
        } else {
            console.warn('⚠️ Register form not found!');
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
        } else {
            // پیدا کردن دکمه با متن
            const allButtons = document.querySelectorAll('button');
            allButtons.forEach(btn => {
                if (btn.textContent.includes('افزایش قدرت') || btn.innerHTML.includes('افزایش قدرت')) {
                    btn.removeAttribute('onclick');
                    btn.addEventListener('click', () => this.handleBoostMining());
                    console.log('✅ Boost mining button found by text');
                }
            });
        }
        
        // دکمه خرید SOD
        const buySodBtn = document.querySelector('button[onclick*="showSODSale"]');
        if (buySodBtn) {
            buySodBtn.removeAttribute('onclick');
            buySodBtn.addEventListener('click', () => this.showSODSale());
            console.log('✅ Buy SOD button bound');
        } else {
            // پیدا کردن دکمه خرید SOD
            const allButtons = document.querySelectorAll('button');
            allButtons.forEach(btn => {
                if (btn.textContent.includes('خرید SOD') || btn.innerHTML.includes('خرید SOD')) {
                    btn.removeAttribute('onclick');
                    btn.addEventListener('click', () => this.showSODSale());
                    console.log('✅ Buy SOD button found by text');
                }
            });
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
        console.log('🔑 Login form submitted');
        
        const emailInput = document.getElementById('loginEmail');
        const passwordInput = document.getElementById('loginPassword');
        
        if (!emailInput || !passwordInput) {
            console.error('❌ Login form inputs not found');
            this.showNotification('❌', 'خطا در فرم ورود');
            return;
        }
        
        const emailValue = emailInput.value ? emailInput.value.trim() : '';
        const passwordValue = passwordInput.value ? passwordInput.value : '';
        
        console.log('📧 Login attempt for:', emailValue);
        
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
            
            console.log('🔑 Login result:', result);
            
            if (result.success) {
                this.showNotification('✅', result.message || 'ورود موفقیت‌آمیز بود!');
                
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
                if (passwordInput) {
                    passwordInput.value = '';
                }
            }
        } catch (error) {
            console.error('🚨 Error in handleLoginSubmit:', error);
            this.showNotification('❌', 'خطای غیرمنتظره در ورود: ' + (error.message || 'خطای نامشخص'));
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
        console.log('📝 Register form submitted');
        
        // پیدا کردن المان‌های فرم با بررسی وجود آن‌ها
        const fullNameInput = document.getElementById('fullName');
        const emailInput = document.getElementById('email');
        const passwordInput = document.getElementById('password');
        const confirmPasswordInput = document.getElementById('confirmPassword');
        const referralCodeInput = document.getElementById('referralCode');
        
        // دیباگ: چک کردن المان‌ها
        console.log('🔍 Form elements found:', {
            fullName: !!fullNameInput,
            email: !!emailInput,
            password: !!passwordInput,
            confirmPassword: !!confirmPasswordInput,
            referralCode: !!referralCodeInput
        });
        
        // اعتبارسنجی وجود المان‌ها
        if (!fullNameInput || !emailInput || !passwordInput || !confirmPasswordInput) {
            console.error('❌ Some form elements are missing!');
            this.showNotification('❌', 'خطا در فرم ثبت‌نام. لطفاً صفحه را refresh کنید.');
            return;
        }
        
        const fullNameValue = fullNameInput.value ? fullNameInput.value.trim() : '';
        const emailValue = emailInput.value ? emailInput.value.trim() : '';
        const passwordValue = passwordInput.value ? passwordInput.value : '';
        const confirmPasswordValue = confirmPasswordInput.value ? confirmPasswordInput.value : '';
        const referralCodeValue = referralCodeInput ? (referralCodeInput.value ? referralCodeInput.value.trim() : '') : '';
        
        console.log('📝 Form values:', {
            fullName: fullNameValue,
            email: emailValue,
            passwordLength: passwordValue.length,
            confirmPasswordLength: confirmPasswordValue.length,
            referralCode: referralCodeValue
        });
        
        // اعتبارسنجی مقادیر
        if (!fullNameValue || !emailValue || !passwordValue || !confirmPasswordValue) {
            this.showNotification('❌', 'لطفاً تمام فیلدهای ضروری را پر کنید');
            return;
        }
        
        if (passwordValue !== confirmPasswordValue) {
            this.showNotification('❌', 'رمز عبور و تکرار آن مطابقت ندارند');
            
            // هایلایت کردن فیلدهای رمز عبور
            if (passwordInput) passwordInput.style.borderColor = 'var(--error)';
            if (confirmPasswordInput) confirmPasswordInput.style.borderColor = 'var(--error)';
            
            setTimeout(() => {
                if (passwordInput) passwordInput.style.borderColor = '';
                if (confirmPasswordInput) confirmPasswordInput.style.borderColor = '';
            }, 3000);
            
            return;
        }
        
        if (passwordValue.length < 6) {
            this.showNotification('❌', 'رمز عبور باید حداقل ۶ کاراکتر باشد');
            
            if (passwordInput) passwordInput.style.borderColor = 'var(--error)';
            
            setTimeout(() => {
                if (passwordInput) passwordInput.style.borderColor = '';
            }, 3000);
            
            return;
        }
        
        if (!this.isValidEmail(emailValue)) {
            this.showNotification('❌', 'لطفاً یک ایمیل معتبر وارد کنید');
            
            if (emailInput) emailInput.style.borderColor = 'var(--error)';
            
            setTimeout(() => {
                if (emailInput) emailInput.style.borderColor = '';
            }, 3000);
            
            return;
        }
        
        this.showNotification('⏳', 'در حال ایجاد حساب کاربری...');
        
        // غیرفعال کردن دکمه
        const submitBtn = e.target.querySelector('button[type="submit"]');
        const originalBtnText = submitBtn ? submitBtn.innerHTML : '';
        
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> در حال ثبت‌نام...';
        }
        
        try {
            console.log('📤 Sending registration request...');
            
            // چک کردن auth service
            if (!this.authService) {
                console.error('❌ Auth service is null!');
                throw new Error('سرویس احراز هویت در دسترس نیست');
            }
            
            const result = await this.authService.signUp(
                emailValue,
                passwordValue,
                fullNameValue,
                referralCodeValue
            );
            
            console.log('📥 Registration response:', result);
            
            if (result.success) {
                this.showNotification('✅', result.message || 'ثبت‌نام موفقیت‌آمیز بود!');
                
                // پاک کردن فرم
                if (fullNameInput) fullNameInput.value = '';
                if (emailInput) emailInput.value = '';
                if (passwordInput) passwordInput.value = '';
                if (confirmPasswordInput) confirmPasswordInput.value = '';
                if (referralCodeInput) referralCodeInput.value = '';
                
                // اگر کاربر بلافاصله لاگین شد
                if (this.authService.isUserVerified()) {
                    console.log('🎉 User verified immediately');
                    setTimeout(() => {
                        const user = this.authService.getCurrentUser();
                        if (user) {
                            console.log('🚀 Showing main app for:', user.email);
                            this.showMainApp(user);
                        }
                    }, 1500);
                } else if (result.message && result.message.includes('ایمیل')) {
                    // اگر نیاز به تأیید ایمیل دارد
                    console.log('📧 Email confirmation required');
                    setTimeout(() => {
                        this.showNotification('📧', 'لطفاً ایمیل خود را برای تأیید بررسی کنید.');
                        // برگشت به صفحه لاگین
                        if (window.switchAuthTab) {
                            window.switchAuthTab('login');
                        }
                    }, 2000);
                } else {
                    // حالت دیگر - کاربر لاگین شده است
                    console.log('👤 User should be logged in');
                    setTimeout(() => {
                        const user = this.authService.getCurrentUser();
                        if (user) {
                            this.showMainApp(user);
                        } else {
                            this.showNotification('ℹ️', 'لطفاً با ایمیل و رمز عبور وارد شوید');
                            if (window.switchAuthTab) {
                                window.switchAuthTab('login');
                            }
                        }
                    }, 2000);
                }
            } else {
                console.error('❌ Registration failed:', result.error);
                this.showNotification('❌', result.error || 'خطا در ثبت‌نام');
                
                // هایلایت کردن فیلد ایمیل در صورت خطای تکراری
                if (result.error && result.error.includes('قبلاً')) {
                    if (emailInput) emailInput.style.borderColor = 'var(--error)';
                    setTimeout(() => {
                        if (emailInput) emailInput.style.borderColor = '';
                    }, 5000);
                }
            }
        } catch (error) {
            console.error('🚨 Error in handleRegister:', error);
            this.showNotification('❌', 'خطای غیرمنتظره در ثبت‌نام: ' + (error.message || 'خطای نامشخص'));
        } finally {
            // فعال کردن دکمه
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalBtnText || '<i class="fas fa-user-plus"></i> ایجاد حساب کاربری';
            }
        }
    }
    
    async handleLogout() {
        console.log('👋 Logout requested');
        
        if (!this.authService) {
            this.showNotification('❌', 'سرویس احراز هویت در دسترس نیست');
            return;
        }
        
        // توقف استخراج خودکار
        if (this.autoMiningInterval) {
            clearInterval(this.autoMiningInterval);
            this.autoMiningInterval = null;
        }
        
        // توقف auto mining در game service
        if (this.gameService && this.gameService.getGameData) {
            const gameData = this.gameService.getGameData();
            if (gameData.autoMining && this.gameService.toggleAutoMining) {
                try {
                    await this.gameService.toggleAutoMining();
                } catch (error) {
                    console.warn('⚠️ Error stopping auto mining:', error);
                }
            }
        }
        
        const result = await this.authService.signOut();
        
        if (result.success) {
            this.showNotification('👋', result.message || 'خروج موفقیت‌آمیز بود!');
            this.showLogin();
        } else {
            this.showNotification('❌', result.error || 'خطا در خروج');
        }
    }
    
    async handleMining() {
        console.log('⛏️ Mining clicked');
        
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
                    const newLevel = this.gameService.getUserLevel ? this.gameService.getUserLevel() : 1;
                    this.showNotification('⭐', `سطح شما ارتقاء یافت! سطح ${newLevel}`);
                }
            }
            
        } catch (error) {
            console.error('❌ Error in mining:', error);
            this.showNotification('❌', error.message || 'خطا در استخراج');
        }
    }
    
    async handleClaimUSDT() {
        console.log('💰 Claim USDT clicked');
        
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
        console.log('⚡ Boost mining clicked');
        
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
        console.log('🤖 Toggle auto mining clicked');
        
        if (!this.authService || !this.authService.isUserVerified()) {
            this.showNotification('❌', 'ابتدا ثبت‌نام و وارد شوید');
            this.showLogin();
            return;
        }
        
        if (!this.gameService) {
            this.showNotification('❌', 'سرویس بازی در دسترس نیست');
            return;
        }
        
        const gameData = this.gameService.getGameData ? this.gameService.getGameData() : null;
        const autoMineBtn = document.getElementById('autoMineBtn');
        
        if (!gameData) {
            this.showNotification('❌', 'داده‌های بازی در دسترس نیست');
            return;
        }
        
        try {
            if (!gameData.autoMining) {
                // فعال کردن استخراج خودکار
                
                // چک کردن موجودی
                if (gameData.sodBalance < 10000) {
                    this.showNotification('⚠️', 'برای استخراج خودکار حداقل ۱۰,۰۰۰ SOD نیاز دارید.');
                    return;
                }
                
                if (autoMineBtn) {
                    autoMineBtn.innerHTML = '<i class="fas fa-pause"></i> توقف خودکار';
                    autoMineBtn.classList.remove('btn-primary');
                    autoMineBtn.classList.add('btn-warning');
                }
                
                this.showNotification('🤖', 'استخراج خودکار فعال شد!');
                
                // تغییر وضعیت در game service
                if (this.gameService.toggleAutoMining) {
                    await this.gameService.toggleAutoMining();
                }
                
                // شروع انیمیشن استخراج خودکار
                this.startAutoMiningAnimation();
                
                // شروع UI auto mining interval
                this.startUIAutoMining();
                
            } else {
                // غیرفعال کردن استخراج خودکار
                if (autoMineBtn) {
                    autoMineBtn.innerHTML = '<i class="fas fa-robot"></i> استخراج خودکار';
                    autoMineBtn.classList.remove('btn-warning');
                    autoMineBtn.classList.add('btn-primary');
                }
                
                this.showNotification('⏸️', 'استخراج خودکار متوقف شد.');
                
                // توقف در game service
                if (this.gameService.toggleAutoMining) {
                    await this.gameService.toggleAutoMining();
                }
                
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
        if (!email || typeof email !== 'string') return false;
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
        
        if (!notification || !notificationTitle || !notificationMessage) {
            console.warn('⚠️ Notification elements not found');
            // Fallback: استفاده از alert
            alert(`${title}: ${message}`);
            return;
        }
        
        notificationTitle.textContent = title;
        notificationMessage.textContent = message;
        
        notification.classList.add('show');
        
        setTimeout(() => {
            notification.classList.remove('show');
        }, 4000);
    }
    
    async updateGameUI() {
        if (!this.gameService) {
            console.warn('⚠️ Game service not available for UI update');
            return;
        }
        
        const gameData = this.gameService.getGameData ? this.gameService.getGameData() : null;
        if (!gameData) {
            console.warn('⚠️ Game data not available for UI update');
            return;
        }
        
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
        const styleId = 'mining-effect-styles';
        if (!document.getElementById(styleId)) {
            const style = document.createElement('style');
            style.id = styleId;
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
        const styleId = 'auto-mining-styles';
        if (!document.getElementById(styleId)) {
            const style = document.createElement('style');
            style.id = styleId;
            style.textContent = `
                .auto-mining {
                    animation: pulseGlow 1.5s infinite alternate !important;
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
        if (!salePlansGrid) {
            console.warn('⚠️ Sale plans grid not found');
            return;
        }
        
        try {
            let plans = [];
            
            // سعی می‌کنیم از دیتابیس بگیریم
            if (this.supabaseService && this.supabaseService.getSalePlans) {
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
                        <h3 class="sale-plan-name">${plan.name || `پنل ${plan.id}`}</h3>
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
        console.log('🛒 Buying SOD plan:', planId);
        
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
        if (!transactionsList) {
            console.warn('⚠️ Transactions list not found');
            return;
        }
        
        try {
            let transactions = [];
            
            // سعی می‌کنیم از دیتابیس بگیریم
            const user = this.authService ? this.authService.getCurrentUser() : null;
            if (user && this.supabaseService && this.supabaseService.getTransactions) {
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
                const date = transaction.created_at ? new Date(transaction.created_at).toLocaleString('fa-IR') : 'نامشخص';
                
                row.innerHTML = `
                    <div class="transaction-type">
                        <div class="transaction-icon">${icon}</div>
                        <div style="flex: 1;">
                            <div style="font-weight: bold;">${this.getTransactionTypeText(transaction.type)}</div>
                            <div style="color: var(--text-secondary); font-size: 12px;">
                                ${date}
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
            'withdrawal': '💳',
            'deposit': '💵',
            'reward': '🎁'
        };
        
        return icons[type] || '📝';
    }
    
    getTransactionTypeText(type) {
        const texts = {
            'mining': 'استخراج دستی',
            'usdt_reward': 'پاداش USDT',
            'purchase': 'خرید پنل',
            'boost': 'افزایش قدرت',
            'withdrawal': 'برداشت USDT',
            'deposit': 'واریز',
            'reward': 'پاداش'
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
