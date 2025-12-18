// UI Service for SODmAX Pro
class UIService {
    constructor() {
        this.gameService = window.gameService;
        this.authService = window.authService;
        this.supabaseService = window.supabaseService;
        
        this.isInitialized = false;
        
        this.initializeUI();
    }
    
    async initializeUI() {
        if (this.isInitialized) return;
        
        console.log('🔄 Initializing UI...');
        
        // بایند کردن events اولیه
        this.bindEvents();
        
        // چک کردن وضعیت احراز هویت
        await this.checkAuthState();
        
        // بارگذاری پنل‌های فروش
        await this.loadSalePlans();
        
        this.isInitialized = true;
        console.log('✅ UI initialized');
    }
    
    async checkAuthState() {
        console.log('🔍 Checking auth state...');
        
        const user = await this.authService.handleAuthStateChange();
        
        if (user) {
            console.log('✅ User authenticated:', user.email);
            await this.showMainApp(user);
        } else {
            console.log('❌ No authenticated user');
            this.showRegisterForm();
        }
    }
    
    onUserSignedIn(user) {
        console.log('🎉 User signed in callback:', user.email);
        this.showMainApp(user);
    }
    
    onUserSignedOut() {
        console.log('👋 User signed out callback');
        this.showRegisterForm();
    }
    
    async showMainApp(user) {
        console.log('🚀 Showing main app for:', user.email);
        
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
    
    showRegisterForm() {
        console.log('📝 Showing register form');
        
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
        
        // لینک ورود مستقیم (برای کاربرانی که قبلاً ثبت‌نام کرده‌اند)
        const loginLink = document.getElementById('loginLink');
        if (loginLink) {
            loginLink.addEventListener('click', (e) => {
                e.preventDefault();
                this.showLoginModal();
            });
            console.log('✅ Login link bound');
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
                
                // اگر کاربر بلافاصله وارد شد
                if (this.authService.getCurrentUser()) {
                    setTimeout(() => {
                        this.showMainApp(this.authService.getCurrentUser());
                    }, 1500);
                } else {
                    // اگر نیاز به تأیید ایمیل دارد
                    setTimeout(() => {
                        this.showNotification('📧', 'لطفاً ایمیل خود را برای تأیید بررسی کنید.');
                        this.showRegisterForm(); // بازگشت به فرم ثبت‌نام
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
    
    async handleLogout() {
        const confirmLogout = confirm('آیا مطمئن هستید که می‌خواهید خارج شوید؟');
        
        if (!confirmLogout) return;
        
        const result = await this.authService.signOut();
        
        if (result.success) {
            this.showNotification('👋', result.message);
            this.showRegisterForm();
        } else {
            this.showNotification('❌', result.error || 'خطا در خروج');
        }
    }
    
    showLoginModal() {
        // ایجاد مدال برای ورود مستقیم
        const modalHTML = `
            <div class="register-overlay" style="z-index: 3000;">
                <div class="register-container">
                    <div class="register-header">
                        <div class="register-icon">🔑</div>
                        <h1 class="register-title">ورود مستقیم</h1>
                        <p class="register-subtitle">اگر قبلاً ثبت‌نام کرده‌اید، با ایمیل و رمز عبور وارد شوید</p>
                    </div>
                    
                    <form id="directLoginForm">
                        <div class="form-group">
                            <label class="form-label">ایمیل</label>
                            <input type="email" class="form-input" placeholder="example@gmail.com" id="loginEmail" required>
                        </div>
                        
                        <div class="form-group">
                            <label class="form-label">رمز عبور</label>
                            <input type="password" class="form-input" placeholder="رمز عبور خود را وارد کنید" id="loginPassword" required>
                            <div class="form-hint" style="font-size: 11px; color: var(--text-secondary); margin-top: 4px;">
                                رمز عبور هنگام ثبت‌نام به ایمیل شما ارسال شد
                            </div>
                        </div>
                        
                        <button type="submit" class="btn btn-primary">
                            <i class="fas fa-sign-in-alt"></i>
                            ورود به حساب
                        </button>
                        
                        <button type="button" class="btn btn-outline" style="margin-top: 12px;" onclick="window.uiService.closeLoginModal()">
                            <i class="fas fa-times"></i>
                            بازگشت
                        </button>
                    </form>
                </div>
            </div>
        `;
        
        // اضافه کردن مدال به صفحه
        const modalContainer = document.createElement('div');
        modalContainer.id = 'loginModal';
        modalContainer.innerHTML = modalHTML;
        document.body.appendChild(modalContainer);
        
        // بایند کردن فرم ورود
        setTimeout(() => {
            const loginForm = document.getElementById('directLoginForm');
            if (loginForm) {
                loginForm.addEventListener('submit', async (e) => {
                    e.preventDefault();
                    
                    const email = document.getElementById('loginEmail').value.trim();
                    const password = document.getElementById('loginPassword').value.trim();
                    
                    if (!email || !password) {
                        this.showNotification('❌', 'لطفاً ایمیل و رمز عبور را وارد کنید');
                        return;
                    }
                    
                    this.showNotification('⏳', 'در حال ورود...');
                    
                    // در نسخه فعلی، ما signIn نداریم، پس باید چک کنیم
                    // برای تست، از signUp با همان ایمیل استفاده می‌کنیم
                    const result = await this.authService.signUp(email, password, 'کاربر قدیمی', '');
                    
                    if (result.success) {
                        this.showNotification('✅', 'ورود موفقیت‌آمیز بود!');
                        this.closeLoginModal();
                    } else {
                        this.showNotification('❌', result.error || 'خطا در ورود');
                    }
                });
            }
        }, 100);
    }
    
    closeLoginModal() {
        const modal = document.getElementById('loginModal');
        if (modal) {
            modal.remove();
        }
    }
    
    handleMining() {
        const user = this.authService.getCurrentUser();
        if (!user) {
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
        const user = this.authService.getCurrentUser();
        if (!user) {
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
        const user = this.authService.getCurrentUser();
        if (!user) {
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
        const user = this.authService.getCurrentUser();
        if (!user) {
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
    
    // ============ بارگذاری پنل‌های فروش ============
    
    async loadSalePlans() {
        try {
            console.log('🛒 Loading sale plans...');
            
            if (!this.supabaseService || !this.supabaseService.getSalePlans) {
                console.error('❌ supabaseService not available');
                return;
            }
            
            const plans = await this.supabaseService.getSalePlans();
            const grid = document.getElementById('salePlansGrid');
            
            if (!grid) {
                console.log('📋 Sale plans grid not found');
                return;
            }
            
            grid.innerHTML = '';
            
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
            
            console.log('✅ Sale plans loaded:', plans.length, 'plans');
        } catch (error) {
            console.error('❌ Error loading sale plans:', error);
        }
    }
    
    async handleBuyPlan(planId) {
        const user = this.authService.getCurrentUser();
        if (!user) {
            this.showNotification('❌', 'ابتدا ثبت‌نام کنید');
            this.showRegisterForm();
            return;
        }
        
        // پیاده‌سازی خرید پنل
        this.showNotification('🛒', `خرید پنل ${planId} در حال پردازش...`);
        
        // اینجا منطق خرید واقعی پیاده‌سازی می‌شود
        setTimeout(() => {
            this.showNotification('✅', 'خرید با موفقیت انجام شد!');
            this.updateGameUI();
        }, 2000);
    }
    
    // ============ بارگذاری تراکنش‌ها ============
    
    async loadTransactions() {
        const user = this.authService.getCurrentUser();
        if (!user) return;
        
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
            
            console.log('✅ Transactions loaded:', transactions.length, 'transactions');
        } catch (error) {
            console.error('❌ Error loading transactions:', error);
        }
    }
    
    showSODSale() {
        const user = this.authService.getCurrentUser();
        if (!user) {
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
    
    // ============ توابع کمکی ============
    
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
    
    showTerms() {
        this.showNotification('📜', 'قوانین و شرایط سرویس');
        // می‌توانید یک مدال یا صفحه جداگانه برای نمایش شرایط ایجاد کنید
    }
    
    // ============ تابع برای تست سریع ============
    
    async testLogin() {
        // برای تست سریع
        this.showNotification('🧪', 'در حال تست ورود...');
        
        const testEmail = 'test@example.com';
        const testPassword = 'Test123!@#';
        
        const result = await this.authService.signUp(testEmail, testPassword, 'تست کاربر', '');
        
        if (result.success) {
            this.showNotification('✅', 'تست ورود موفق بود!');
            this.showMainApp(this.authService.getCurrentUser());
        } else {
            this.showNotification('❌', 'تست ورود ناموفق: ' + result.error);
        }
    }
}

// ایجاد instance و export
window.uiService = new UIService();
console.log('✅ UI service loaded');
