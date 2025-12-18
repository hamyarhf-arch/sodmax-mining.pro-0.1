// UI Service for SODmAX Pro
class UIService {
    constructor() {
        this.gameService = window.gameService;
        this.authService = window.authService;
        this.supabaseService = window.supabaseService;
        
        this.isInitialized = false;
        this.currentUser = null;
        
        this.initialize();
    }
    
    async initialize() {
        if (this.isInitialized) return;
        
        console.log('🔄 Initializing UI...');
        
        // بایند کردن events
        this.bindEvents();
        
        // چک کردن وضعیت کاربر
        await this.checkUserState();
        
        this.isInitialized = true;
        console.log('✅ UI initialized');
    }
    
    async checkUserState() {
        console.log('🔍 Checking user state...');
        
        try {
            // چک کردن auth state
            const user = await this.authService.handleAuthStateChange();
            
            if (user) {
                console.log('✅ User authenticated:', user.email);
                this.currentUser = user;
                await this.showMainApp();
            } else {
                console.log('❌ No authenticated user');
                this.showRegisterForm();
            }
        } catch (error) {
            console.error('❌ Error checking user state:', error);
            this.showRegisterForm();
        }
    }
    
    bindEvents() {
        console.log('🔗 Binding events...');
        
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
        const boostBtns = document.querySelectorAll('button');
        boostBtns.forEach(btn => {
            if (btn.textContent.includes('افزایش قدرت') || btn.innerHTML.includes('fa-bolt')) {
                btn.addEventListener('click', () => this.handleBoostMining());
            }
        });
        
        // دکمه خرید SOD
        const buySodBtns = document.querySelectorAll('button');
        buySodBtns.forEach(btn => {
            if (btn.textContent.includes('خرید SOD') || btn.innerHTML.includes('fa-shopping-cart')) {
                btn.addEventListener('click', () => this.showSODSale());
            }
        });
        
        // دکمه خروج
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => this.handleLogout());
            console.log('✅ Logout button bound');
        }
        
        console.log('✅ All events bound');
    }
    
    async showMainApp() {
        if (!this.currentUser) return;
        
        console.log('🚀 Showing main app for:', this.currentUser.email);
        
        // مخفی کردن صفحه ثبت‌نام
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
                userEmailElement.textContent = this.currentUser.email;
            }
            
            // نمایش نام کاربر
            const userNameElement = document.getElementById('userName');
            if (userNameElement) {
                userNameElement.textContent = this.currentUser.user_metadata?.full_name || this.currentUser.email.split('@')[0];
            }
            
            // مقداردهی اولیه بازی
            await this.gameService.initialize(this.currentUser.id);
            
            // آپدیت UI بازی
            this.updateGameUI();
            
            // بارگذاری پنل‌های فروش
            await this.loadSalePlans();
            
            // بارگذاری تراکنش‌ها
            await this.loadTransactions();
            
            // نمایش پیام خوش‌آمد
            setTimeout(() => {
                this.showNotification('🌟', `خوش آمدید ${this.currentUser.user_metadata?.full_name || 'کاربر'}!`);
            }, 500);
        }
    }
    
    showRegisterForm() {
        console.log('📝 Showing register form');
        
        const registerOverlay = document.getElementById('registerOverlay');
        const mainContainer = document.getElementById('mainContainer');
        
        if (registerOverlay) {
            registerOverlay.style.display = 'flex';
        }
        
        if (mainContainer) {
            mainContainer.style.display = 'none';
        }
    }
    
    async handleRegister(e) {
        e.preventDefault();
        
        const fullNameInput = document.getElementById('fullName');
        const emailInput = document.getElementById('email');
        const referralCodeInput = document.getElementById('referralCode');
        
        if (!fullNameInput || !emailInput) {
            this.showNotification('❌', 'لطفاً نام و ایمیل را وارد کنید');
            return;
        }
        
        const fullName = fullNameInput.value.trim();
        const email = emailInput.value.trim();
        const referralCode = referralCodeInput ? referralCodeInput.value.trim() : '';
        
        if (!fullName || !email) {
            this.showNotification('❌', 'لطفاً نام و ایمیل را وارد کنید');
            return;
        }
        
        // بررسی فرمت ایمیل
        if (!this.isValidEmail(email)) {
            this.showNotification('❌', 'لطفاً یک ایمیل معتبر وارد کنید');
            return;
        }
        
        // تولید رمز عبور تصادفی
        const password = this.generateStrongPassword();
        
        this.showNotification('⏳', 'در حال ثبت‌نام...');
        
        // غیرفعال کردن دکمه
        const submitBtn = e.target.querySelector('button[type="submit"]');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> در حال ثبت‌نام...';
        }
        
        try {
            const result = await this.authService.signUp(email, password, fullName, referralCode);
            
            if (result.success) {
                this.showNotification('✅', result.message || 'ثبت‌نام موفقیت‌آمیز بود!');
                
                // ذخیره اطلاعات کاربر موقتاً
                localStorage.setItem('temp_email', email);
                localStorage.setItem('temp_password', password);
                
                // اگر کاربر وارد شد، برنامه اصلی را نشان بده
                if (this.authService.getCurrentUser()) {
                    this.currentUser = this.authService.getCurrentUser();
                    setTimeout(() => {
                        this.showMainApp();
                    }, 1500);
                } else {
                    // اگر نیاز به تأیید ایمیل دارد
                    this.showEmailConfirmation(email, password);
                }
            } else {
                this.showNotification('❌', result.error || 'خطا در ثبت‌نام');
            }
        } catch (error) {
            console.error('❌ Registration error:', error);
            this.showNotification('❌', 'خطای غیرمنتظره در ثبت‌نام');
        } finally {
            // فعال کردن دکمه
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<i class="fas fa-user-plus"></i> ثبت‌نام و شروع استخراج';
            }
        }
    }
    
    showEmailConfirmation(email, password) {
        // نمایش پیام تأیید ایمیل
        const confirmHTML = `
            <div class="register-overlay" style="z-index: 3000;">
                <div class="register-container">
                    <div class="register-header">
                        <div class="register-icon">📧</div>
                        <h1 class="register-title">تأیید ایمیل</h1>
                        <p class="register-subtitle">لینک تأیید به ایمیل شما ارسال شد</p>
                    </div>
                    
                    <div style="text-align: center; padding: 20px;">
                        <div style="margin-bottom: 20px;">
                            <i class="fas fa-envelope" style="font-size: 48px; color: var(--primary); margin-bottom: 20px;"></i>
                            <p style="color: var(--text-secondary); margin-bottom: 10px;">
                                لینک تأیید به آدرس زیر ارسال شد:
                            </p>
                            <p style="font-weight: bold; color: var(--primary-light);">
                                ${email}
                            </p>
                        </div>
                        
                        <div style="background: rgba(0, 102, 255, 0.1); padding: 15px; border-radius: var(--radius); margin-bottom: 20px;">
                            <p style="font-size: 12px; color: var(--text-secondary); margin-bottom: 10px;">
                                <i class="fas fa-info-circle"></i>
                                اطلاعات ورود شما:
                            </p>
                            <p style="font-size: 11px; color: var(--text-secondary); margin-bottom: 5px;">
                                <strong>ایمیل:</strong> ${email}
                            </p>
                            <p style="font-size: 11px; color: var(--text-secondary);">
                                <strong>رمز عبور:</strong> ${password}
                            </p>
                        </div>
                        
                        <div style="display: flex; gap: 10px; justify-content: center;">
                            <button class="btn btn-primary" onclick="window.uiService.checkEmailConfirmation()">
                                <i class="fas fa-sync-alt"></i>
                                بررسی تأیید
                            </button>
                            <button class="btn btn-outline" onclick="window.uiService.closeEmailConfirmation()">
                                <i class="fas fa-times"></i>
                                بستن
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // اضافه کردن به صفحه
        const confirmContainer = document.createElement('div');
        confirmContainer.id = 'emailConfirmation';
        confirmContainer.innerHTML = confirmHTML;
        document.body.appendChild(confirmContainer);
    }
    
    closeEmailConfirmation() {
        const confirmContainer = document.getElementById('emailConfirmation');
        if (confirmContainer) {
            confirmContainer.remove();
        }
        this.showRegisterForm();
    }
    
    async checkEmailConfirmation() {
        this.showNotification('⏳', 'در حال بررسی تأیید ایمیل...');
        
        const email = localStorage.getItem('temp_email');
        const password = localStorage.getItem('temp_password');
        
        if (!email || !password) {
            this.showNotification('❌', 'اطلاعات ورود پیدا نشد');
            return;
        }
        
        try {
            // تلاش برای ورود با اطلاعات ذخیره شده
            const result = await this.authService.signIn(email, password);
            
            if (result.success) {
                this.showNotification('✅', 'ایمیل تأیید شد! وارد شدید.');
                this.currentUser = this.authService.getCurrentUser();
                this.closeEmailConfirmation();
                await this.showMainApp();
            } else {
                this.showNotification('⚠️', 'ایمیل هنوز تأیید نشده است. لطفاً ایمیل خود را بررسی کنید.');
            }
        } catch (error) {
            console.error('❌ Email confirmation error:', error);
            this.showNotification('❌', 'خطا در بررسی تأیید ایمیل');
        }
    }
    
    async handleLogout() {
        const confirmLogout = confirm('آیا مطمئن هستید که می‌خواهید خارج شوید؟');
        
        if (!confirmLogout) return;
        
        try {
            const result = await this.authService.signOut();
            
            if (result.success) {
                this.showNotification('👋', result.message || 'خروج موفقیت‌آمیز بود!');
                this.currentUser = null;
                this.showRegisterForm();
            } else {
                this.showNotification('❌', result.error || 'خطا در خروج');
            }
        } catch (error) {
            console.error('❌ Logout error:', error);
            this.showNotification('❌', 'خطای غیرمنتظره در خروج');
        }
    }
    
    handleMining() {
        if (!this.currentUser) {
            this.showNotification('❌', 'ابتدا ثبت‌نام کنید');
            this.showRegisterForm();
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
    
    async handleClaimUSDT() {
        if (!this.currentUser) {
            this.showNotification('❌', 'ابتدا ثبت‌نام کنید');
            this.showRegisterForm();
            return;
        }
        
        const result = this.gameService.claimUSDT();
        
        if (result.success) {
            this.showNotification('✅', `${result.usdtClaimed.toFixed(4)} USDT دریافت شد!`);
            this.updateGameUI();
        } else {
            this.showNotification('⚠️', result.error);
        }
    }
    
    handleBoostMining() {
        if (!this.currentUser) {
            this.showNotification('❌', 'ابتدا ثبت‌نام کنید');
            this.showRegisterForm();
            return;
        }
        
        const success = this.gameService.boostMining();
        
        if (success) {
            this.showNotification('⚡', 'قدرت استخراج ۳ برابر شد! (۳۰ دقیقه)');
            this.updateGameUI();
        } else {
            this.showNotification('⚠️', 'برای افزایش قدرت به ۵۰۰۰ SOD نیاز دارید.');
        }
    }
    
    toggleAutoMining() {
        if (!this.currentUser) {
            this.showNotification('❌', 'ابتدا ثبت‌نام کنید');
            this.showRegisterForm();
            return;
        }
        
        const autoMineBtn = document.getElementById('autoMineBtn');
        const gameData = this.gameService.getGameData();
        
        if (gameData.sodBalance < 1000000) {
            this.showNotification('⚠️', 'برای استخراج خودکار حداقل ۱ میلیون SOD نیاز دارید.');
            return;
        }
        
        if (gameData.autoMining) {
            this.gameService.stopAutoMining();
            if (autoMineBtn) {
                autoMineBtn.innerHTML = '<i class="fas fa-robot"></i> استخراج خودکار';
                autoMineBtn.style.background = '';
            }
            this.showNotification('⏸️', 'استخراج خودکار متوقف شد.');
        } else {
            this.gameService.startAutoMining();
            if (autoMineBtn) {
                autoMineBtn.innerHTML = '<i class="fas fa-pause"></i> توقف خودکار';
                autoMineBtn.style.background = 'var(--error)';
            }
            this.showNotification('🤖', 'استخراج خودکار فعال شد.');
        }
        
        this.updateGameUI();
    }
    
    updateGameUI() {
        if (!this.currentUser) return;
        
        const gameData = this.gameService.getGameData();
        const format = this.gameService.formatNumber.bind(this.gameService);
        
        // موجودی‌ها
        const sodBalance = document.getElementById('sodBalance');
        const usdtBalance = document.getElementById('usdtBalance');
        
        if (sodBalance) {
            sodBalance.innerHTML = format(gameData.sodBalance) + ' <span>SOD</span>';
        }
        
        if (usdtBalance) {
            usdtBalance.innerHTML = gameData.usdtBalance.toFixed(4) + ' <span>USDT</span>';
        }
        
        // آمار
        const todayEarnings = document.getElementById('todayEarnings');
        const miningPower = document.getElementById('miningPower');
        const clickReward = document.getElementById('clickReward');
        const userLevel = document.getElementById('userLevel');
        
        if (todayEarnings) todayEarnings.textContent = format(gameData.todayEarnings) + ' SOD';
        if (miningPower) miningPower.textContent = gameData.miningPower + 'x';
        if (clickReward) clickReward.textContent = '+' + gameData.miningPower + ' SOD';
        if (userLevel) userLevel.textContent = gameData.userLevel;
        
        // پاداش USDT
        const availableUSDT = document.getElementById('availableUSDT');
        const progressFill = document.getElementById('progressFill');
        const progressText = document.getElementById('progressText');
        
        if (availableUSDT) availableUSDT.textContent = gameData.usdtBalance.toFixed(4) + ' USDT';
        
        const progressPercent = (gameData.usdtProgress / 10000000) * 100;
        if (progressFill) progressFill.style.width = progressPercent + '%';
        if (progressText) progressText.textContent = format(gameData.usdtProgress) + ' / ۱۰,۰۰۰,۰۰۰ SOD (۰.۰۱ USDT)';
        
        // آپدیت دکمه استخراج خودکار
        const autoMineBtn = document.getElementById('autoMineBtn');
        if (autoMineBtn) {
            if (gameData.autoMining) {
                autoMineBtn.innerHTML = '<i class="fas fa-pause"></i> توقف خودکار';
                autoMineBtn.style.background = 'var(--error)';
            } else {
                autoMineBtn.innerHTML = '<i class="fas fa-robot"></i> استخراج خودکار';
                autoMineBtn.style.background = '';
            }
        }
    }
    
    showMiningEffect(amount) {
        const effect = document.createElement('div');
        effect.style.cssText = `
            position: fixed;
            color: var(--primary-light);
            font-weight: 900;
            font-size: 16px;
            pointer-events: none;
            z-index: 10000;
            text-shadow: 0 0 10px var(--primary);
            animation: miningEffect 1s ease-out forwards;
        `;
        
        const core = document.getElementById('minerCore');
        if (!core) return;
        
        const rect = core.getBoundingClientRect();
        effect.style.left = rect.left + rect.width / 2 + 'px';
        effect.style.top = rect.top + rect.height / 2 + 'px';
        effect.textContent = '+' + this.gameService.formatNumber(amount);
        
        document.body.appendChild(effect);
        
        setTimeout(() => effect.remove(), 1000);
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
    
    // ============ توابع کمکی ============
    
    isValidEmail(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    }
    
    generateStrongPassword() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
        let password = '';
        for (let i = 0; i < 12; i++) {
            password += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return password;
    }
    
    // ============ بارگذاری پنل‌های فروش ============
    
    async loadSalePlans() {
        try {
            console.log('🛒 Loading sale plans...');
            
            const grid = document.getElementById('salePlansGrid');
            if (!grid) {
                console.log('📋 Sale plans grid not found');
                return;
            }
            
            // داده‌های پیش‌فرض
            const defaultPlans = [
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
            
            grid.innerHTML = '';
            
            defaultPlans.forEach(plan => {
                const card = document.createElement('div');
                card.className = `sale-plan-card ${plan.popular ? 'featured' : ''}`;
                
                const totalSOD = plan.sod_amount + Math.floor(plan.sod_amount * (plan.discount / 100));
                
                card.innerHTML = `
                    ${plan.popular ? `<div class="sale-plan-badge">پیشنهاد ویژه</div>` : ''}
                    ${plan.discount > 0 ? `<div style="position: absolute; top: 16px; right: 16px;"><span class="discount-badge">${plan.discount}% تخفیف</span></div>` : ''}
                    
                    <div class="sale-plan-header">
                        <h3 class="sale-plan-name">${plan.name}</h3>
                        <div class="sale-plan-price">${plan.price} <span>USDT</span></div>
                        <div class="sod-amount">${this.gameService.formatNumber(totalSOD)} SOD</div>
                    </div>
                    
                    <ul class="sale-plan-features">
                        ${plan.features.map(feature => `<li><i class="fas fa-check" style="color: var(--success);"></i> ${feature}</li>`).join('')}
                    </ul>
                    
                    <button class="btn ${plan.popular ? 'btn-warning' : 'btn-primary'}" data-plan-id="${plan.id}">
                        <i class="fas fa-shopping-cart"></i>
                        خرید پنل
                    </button>
                `;
                
                // اضافه کردن event listener به دکمه خرید
                const buyBtn = card.querySelector('button');
                buyBtn.addEventListener('click', () => {
                    this.handleBuyPlan(plan.id);
                });
                
                grid.appendChild(card);
            });
            
            console.log('✅ Sale plans loaded');
        } catch (error) {
            console.error('❌ Error loading sale plans:', error);
        }
    }
    
    async handleBuyPlan(planId) {
        if (!this.currentUser) {
            this.showNotification('❌', 'ابتدا ثبت‌نام کنید');
            this.showRegisterForm();
            return;
        }
        
        this.showNotification('🛒', `خرید پنل ${planId} در حال پردازش...`);
        
        // اینجا منطق خرید واقعی پیاده‌سازی می‌شود
        setTimeout(() => {
            this.showNotification('✅', 'خرید با موفقیت انجام شد!');
            this.updateGameUI();
        }, 2000);
    }
    
    // ============ بارگذاری تراکنش‌ها ============
    
    async loadTransactions() {
        if (!this.currentUser) return;
        
        try {
            const transactions = await this.gameService.getRecentTransactions(10);
            const list = document.getElementById('transactionsList');
            
            if (!list) return;
            
            list.innerHTML = '';
            
            if (transactions.length === 0) {
                list.innerHTML = `
                    <div class="transaction-row" style="text-align: center; color: var(--text-secondary);">
                        <i class="fas fa-history" style="font-size: 24px; margin-bottom: 10px;"></i>
                        <div>هنوز تراکنشی ثبت نشده است</div>
                    </div>
                `;
                return;
            }
            
            transactions.forEach(transaction => {
                const row = document.createElement('div');
                row.className = 'transaction-row';
                
                const date = new Date(transaction.created_at).toLocaleString('fa-IR');
                
                row.innerHTML = `
                    <div class="transaction-type">
                        <div class="transaction-icon">
                            ${transaction.type === 'mining' ? '⛏️' : 
                              transaction.type === 'purchase' ? '🛒' : 
                              transaction.type === 'withdrawal' ? '💰' : 
                              transaction.type === 'usdt_reward' ? '🎁' :
                              transaction.type === 'boost' ? '⚡' : '📝'}
                        </div>
                        <div style="flex: 1;">
                            <div style="font-weight: bold;">
                                ${transaction.type === 'mining' ? 'استخراج' : 
                                 transaction.type === 'purchase' ? 'خرید SOD' : 
                                 transaction.type === 'withdrawal' ? 'دریافت USDT' : 
                                 transaction.type === 'usdt_reward' ? 'پاداش USDT' :
                                 transaction.type === 'boost' ? 'افزایش قدرت' : 'تراکنش'}
                            </div>
                            <div style="color: var(--text-secondary); font-size: 12px;">${date}</div>
                            <div style="color: var(--text-secondary); font-size: 11px;">${transaction.description || ''}</div>
                        </div>
                        <div style="font-weight: bold; color: ${transaction.type === 'withdrawal' ? 'var(--accent)' : 'var(--primary-light)'};">
                            ${transaction.type === 'withdrawal' ? '-' : '+'}${transaction.amount} ${transaction.currency}
                        </div>
                    </div>
                `;
                
                list.appendChild(row);
            });
            
            console.log('✅ Transactions loaded');
        } catch (error) {
            console.error('❌ Error loading transactions:', error);
        }
    }
    
    showSODSale() {
        if (!this.currentUser) {
            this.showNotification('❌', 'ابتدا ثبت‌نام کنید');
            this.showRegisterForm();
            return;
        }
        
        const sodSaleSection = document.getElementById('sodSaleSection');
        if (!sodSaleSection) return;
        
        sodSaleSection.style.display = 'block';
        sodSaleSection.scrollIntoView({ 
            behavior: 'smooth',
            block: 'start'
        });
    }
    
    // تابع برای تست سریع
    async testQuickLogin() {
        const testEmail = `test${Date.now()}@test.com`;
        const testPassword = 'Test123!@#';
        const testName = 'تست کاربر';
        
        this.showNotification('🧪', 'در حال تست ثبت‌نام...');
        
        const result = await this.authService.signUp(testEmail, testPassword, testName, '');
        
        if (result.success) {
            this.showNotification('✅', 'تست ثبت‌نام موفق بود!');
            this.currentUser = this.authService.getCurrentUser();
            
            if (this.currentUser) {
                await this.showMainApp();
            }
        } else {
            this.showNotification('❌', 'تست ثبت‌نام ناموفق: ' + result.error);
        }
    }
}

// ایجاد instance و export
window.uiService = new UIService();
console.log('✅ UI service loaded');

// اضافه کردن تابع تست به window برای دسترسی آسان
window.testQuickLogin = () => window.uiService.testQuickLogin();
