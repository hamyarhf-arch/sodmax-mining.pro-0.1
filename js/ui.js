// js/ui.js - نسخه کامل و اصلاح شده
class UIService {
    constructor() {
        console.log('🎨 UIService (Supabase-Only) initializing...');
        
        this.gameService = null;
        this.authService = null;
        this.supabaseService = null;
        this.walletService = null;
        this.autoMiningInterval = null;
        this.isInitialized = false;
        this.userId = null;
        
        this.init();
    }
    
    async init() {
        console.log('🔄 UIService waiting for services...');
        
        // منتظر سرویس‌ها
        let attempts = 0;
        while (attempts < 30) {
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
        
        if (!this.gameService) {
            console.error('❌ GameService not available');
        }
        
        // چک کردن WalletService (اختیاری)
        if (window.walletService) {
            this.walletService = window.walletService;
            console.log('✅ WalletService loaded');
        }
        
        // بایند کردن events
        this.bindEvents();
        
        // چک کردن وضعیت auth
        await this.checkAuthState();
        
        this.isInitialized = true;
        console.log('✅ UIService ready (Supabase-Only)');
    }
    
    // 1. چک کردن وضعیت احراز هویت
    async checkAuthState() {
        const user = this.authService?.getCurrentUser();
        
        if (user && this.authService.isUserVerified()) {
            console.log('✅ User is authenticated:', user.email);
            this.userId = user.id;
            await this.showMainApp(user);
        } else {
            console.log('❌ User not authenticated, showing login');
            this.showLogin();
        }
    }
    
    // 2. نمایش اپلیکیشن اصلی
    async showMainApp(user) {
        console.log('🚀 Showing main app for:', user.email);
        
        const registerOverlay = document.getElementById('registerOverlay');
        const mainContainer = document.getElementById('mainContainer');
        
        if (registerOverlay) {
            registerOverlay.style.display = 'none';
        }
        
        if (mainContainer) {
            mainContainer.style.display = 'block';
            
            // مقداردهی اولیه بازی
            try {
                await this.gameService.initialize(user.id);
                this.userId = user.id;
            } catch (error) {
                console.error('❌ Game initialization error:', error);
                this.showNotification('⚠️', 'خطا در بارگذاری داده‌های بازی');
            }
            
            // آپدیت UI
            this.updateGameUI();
            
            // آپدیت اطلاعات کیف پول
            await this.updateWalletUI();
            
            // بارگذاری پنل‌های فروش
            this.loadSalePlans();
            
            // بارگذاری تراکنش‌ها
            this.loadTransactions();
            
            // چک کردن وضعیت ادمین
            this.checkAdminStatus(user);
            
            // نمایش پیام خوش‌آمد
            setTimeout(() => {
                this.showNotification('🌟', `خوش آمدید ${user.user_metadata?.full_name || 'کاربر'}!`);
            }, 500);
        }
    }
    
    // 3. نمایش صفحه لاگین/ثبت‌نام
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
        
        // توقف همه فعالیت‌های بازی
        if (this.gameService) {
            this.gameService.stopAllActivities();
        }
        
        // توقف UI auto mining
        this.stopUIAutoMining();
    }
    
    // 4. بایند کردن events
    bindEvents() {
        console.log('🔗 Binding events...');
        
        // فرم لاگین
        const loginForm = document.getElementById('loginForm');
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => this.handleLogin(e));
            console.log('✅ Login form bound');
        }
        
        // فرم ثبت‌نام
        const registerForm = document.getElementById('registerForm');
        if (registerForm) {
            registerForm.addEventListener('submit', (e) => this.handleRegister(e));
            console.log('✅ Register form bound');
        }
        
        // ماینر core (کلیک استخراج)
        const minerCore = document.getElementById('minerCore');
        if (minerCore) {
            minerCore.addEventListener('click', () => this.handleMining());
            console.log('✅ Miner core bound');
        }
        
        // دکمه استخراج خودکار
        const autoMineBtn = document.getElementById('autoMineBtn');
        if (autoMineBtn) {
            autoMineBtn.addEventListener('click', () => this.toggleAutoMining());
            console.log('✅ Auto mine button bound');
        }
        
        // دکمه افزایش قدرت
        const boostBtns = document.querySelectorAll('[onclick*="boostMining"], [onclick*="handleBoostMining"]');
        boostBtns.forEach(btn => {
            btn.removeAttribute('onclick');
            btn.addEventListener('click', () => this.handleBoostMining());
        });
        console.log('✅ Boost mining buttons bound');
        
        // دکمه دریافت USDT
        const claimBtn = document.getElementById('claimUSDTBtn');
        if (claimBtn) {
            claimBtn.addEventListener('click', () => this.handleClaimUSDT());
            console.log('✅ Claim USDT button bound');
        }
        
        // دکمه خرید SOD
        const buyBtns = document.querySelectorAll('[onclick*="showSODSale"], [onclick*="SODSale"]');
        buyBtns.forEach(btn => {
            btn.removeAttribute('onclick');
            btn.addEventListener('click', () => this.showSODSale());
        });
        console.log('✅ Buy SOD buttons bound');
        
        // دکمه خروج
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => this.handleLogout());
            console.log('✅ Logout button bound');
        }
        
        // دکمه‌های کیف پول
        const depositBtn = document.getElementById('depositBtn');
        if (depositBtn) {
            depositBtn.addEventListener('click', () => this.showWalletActions('deposit'));
        }
        
        const withdrawBtn = document.getElementById('withdrawBtn');
        if (withdrawBtn) {
            withdrawBtn.addEventListener('click', () => this.showWalletActions('withdraw'));
        }
        
        // دکمه بستن مودال کیف پول
        const closeWalletModalBtn = document.querySelector('.close-wallet-modal');
        if (closeWalletModalBtn) {
            closeWalletModalBtn.addEventListener('click', () => this.closeWalletModal());
        }
        
        console.log('✅ All events bound');
    }
    
    // 5. هندل لاگین
    async handleLogin(e) {
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
        
        // غیرفعال کردن دکمه
        const submitBtn = e.target.querySelector('button[type="submit"]');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> در حال ورود...';
        }
        
        try {
            const result = await this.authService.signIn(emailValue, passwordValue);
            
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
            console.error('🚨 Error in handleLogin:', error);
            this.showNotification('❌', 'خطای غیرمنتظره در ورود: ' + error.message);
        } finally {
            // فعال کردن دکمه
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> ورود به حساب';
            }
        }
    }
    
    // 6. هندل ثبت‌نام
    async handleRegister(e) {
        e.preventDefault();
        
        const fullName = document.getElementById('fullName');
        const email = document.getElementById('email');
        const password = document.getElementById('password');
        const confirmPassword = document.getElementById('confirmPassword');
        const referralCode = document.getElementById('referralCode');
        
        // اعتبارسنجی
        if (!fullName?.value.trim() || !email?.value.trim() || !password?.value) {
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
                referralCode?.value.trim() || ''
            );
            
            if (result.success) {
                this.showNotification('✅', result.message);
                e.target.reset();
                
                // اگر کاربر بلافاصله لاگین شد
                if (this.authService.isUserVerified()) {
                    setTimeout(() => {
                        const user = this.authService.getCurrentUser();
                        if (user) {
                            this.showMainApp(user);
                        }
                    }, 1500);
                }
            } else {
                this.showNotification('❌', result.error || 'خطا در ثبت‌نام');
            }
        } catch (error) {
            console.error('🚨 Register error:', error);
            this.showNotification('❌', 'خطای غیرمنتظره در ثبت‌نام');
        } finally {
            // فعال کردن دکمه
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<i class="fas fa-user-plus"></i> ایجاد حساب کاربری';
            }
        }
    }
    
    // 7. هندل استخراج
    async handleMining() {
        if (!this.authService?.isUserVerified()) {
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
            
            // نمایش افکت استخراج
            this.showMiningEffect(result.earned);
            this.pulseMinerCore();
            
            // نمایش پاداش USDT اگر بود
            if (result.usdtReward) {
                this.showNotification('🎉', `${result.usdtReward.usdtEarned.toFixed(4)} USDT دریافت کردید!`);
            }
            
        } catch (error) {
            console.error('❌ Mining error:', error);
            this.showNotification('❌', error.message || 'خطا در استخراج');
        }
    }
    
    // 8. هندل افزایش قدرت
    async handleBoostMining() {
        if (!this.authService?.isUserVerified()) {
            this.showNotification('❌', 'ابتدا ثبت‌نام و وارد شوید');
            this.showLogin();
            return;
        }
        
        try {
            await this.gameService.boostMining();
            this.showNotification('⚡', 'قدرت استخراج ۳ برابر شد! (۳۰ دقیقه)');
            this.updateGameUI();
        } catch (error) {
            console.error('❌ Boost error:', error);
            this.showNotification('❌', error.message || 'خطا در افزایش قدرت');
        }
    }
    
    // 9. هندل دریافت USDT
    async handleClaimUSDT() {
        if (!this.authService?.isUserVerified()) {
            this.showNotification('❌', 'ابتدا ثبت‌نام و وارد شوید');
            this.showLogin();
            return;
        }
        
        try {
            const usdtClaimed = await this.gameService.claimUSDT();
            this.showNotification('✅', `${usdtClaimed.toFixed(4)} USDT دریافت شد!`);
            this.updateGameUI();
        } catch (error) {
            console.error('❌ Claim USDT error:', error);
            this.showNotification('❌', error.message || 'خطا در دریافت USDT');
        }
    }
    
    // 10. toggle استخراج خودکار
    async toggleAutoMining() {
        if (!this.authService?.isUserVerified()) {
            this.showNotification('❌', 'ابتدا ثبت‌نام و وارد شوید');
            this.showLogin();
            return;
        }
        
        const autoMineBtn = document.getElementById('autoMineBtn');
        const isAutoMining = this.gameService.isAutoMining();
        
        try {
            if (!isAutoMining) {
                // فعال کردن
                autoMineBtn.innerHTML = '<i class="fas fa-pause"></i> توقف خودکار';
                autoMineBtn.classList.remove('btn-primary');
                autoMineBtn.classList.add('btn-warning');
                
                await this.gameService.toggleAutoMining();
                this.showNotification('🤖', 'استخراج خودکار فعال شد!');
                this.startAutoMiningAnimation();
                this.startUIAutoMining();
                
            } else {
                // غیرفعال کردن
                autoMineBtn.innerHTML = '<i class="fas fa-robot"></i> استخراج خودکار';
                autoMineBtn.classList.remove('btn-warning');
                autoMineBtn.classList.add('btn-primary');
                
                await this.gameService.toggleAutoMining();
                this.showNotification('⏸️', 'استخراج خودکار متوقف شد');
                this.stopAutoMiningAnimation();
                this.stopUIAutoMining();
            }
            
            this.updateGameUI();
            
        } catch (error) {
            console.error('❌ Auto mining error:', error);
            this.showNotification('❌', error.message || 'خطا در استخراج خودکار');
        }
    }
    
    // 11. نمایش فروش SOD
    async showSODSale() {
        if (!this.authService?.isUserVerified()) {
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
    
    // 12. هندل خروج
    async handleLogout() {
        try {
            const result = await this.authService.signOut();
            
            if (result.success) {
                this.showNotification('👋', result.message);
                this.showLogin();
            } else {
                this.showNotification('❌', result.error || 'خطا در خروج');
            }
        } catch (error) {
            console.error('🚨 Logout error:', error);
            this.showNotification('❌', 'خطای غیرمنتظره در خروج');
        }
    }
    
    // 13. آپدیت UI بازی
    updateGameUI() {
        if (!this.gameService) return;
        
        const gameData = this.gameService.getGameData();
        if (!gameData) return;
        
        // فرمت اعداد
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
        
        const progressPercent = Math.min((gameData.usdtProgress / 10000000) * 100, 100);
        const progressFill = document.getElementById('progressFill');
        if (progressFill) {
            progressFill.style.width = progressPercent + '%';
        }
        
        const progressText = document.getElementById('progressText');
        if (progressText) {
            progressText.textContent = `${formatNumber(gameData.usdtProgress)} / ۱۰,۰۰۰,۰۰۰ SOD (۰.۰۱ USDT)`;
        }
        
        // دکمه استخراج خودکار
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
        
        // نمایش بوست
        const boostStatus = document.querySelector('.boost-status');
        if (boostStatus) {
            boostStatus.textContent = gameData.boostActive ? 
                '⚡ فعال (۳۰ دقیقه)' : 'غیرفعال';
            boostStatus.style.color = gameData.boostActive ? 
                'var(--success)' : 'var(--text-secondary)';
        }
    }
    
    // 14. نمایش نوتیفیکیشن
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
    
    // 15. افکت استخراج
    showMiningEffect(amount) {
        const effect = document.createElement('div');
        effect.className = 'mining-effect';
        effect.textContent = `+${this.formatNumber(amount)}`;
        effect.style.color = this.getRandomColor();
        
        const minerCore = document.getElementById('minerCore');
        if (minerCore) {
            const rect = minerCore.getBoundingClientRect();
            effect.style.left = (rect.left + rect.width / 2) + 'px';
            effect.style.top = (rect.top + rect.height / 2) + 'px';
            
            document.body.appendChild(effect);
            
            setTimeout(() => {
                if (effect.parentNode) {
                    effect.parentNode.removeChild(effect);
                }
            }, 1500);
        }
    }
    
    // 16. پالس ماینر
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
    
    // 17. شروع انیمیشن استخراج خودکار
    startAutoMiningAnimation() {
        const minerCore = document.getElementById('minerCore');
        if (minerCore) {
            minerCore.classList.add('auto-mining');
        }
    }
    
    // 18. توقف انیمیشن استخراج خودکار
    stopAutoMiningAnimation() {
        const minerCore = document.getElementById('minerCore');
        if (minerCore) {
            minerCore.classList.remove('auto-mining');
        }
    }
    
    // 19. شروع UI auto mining (فقط برای آپدیت UI)
    startUIAutoMining() {
        if (this.autoMiningInterval) {
            clearInterval(this.autoMiningInterval);
        }
        
        this.autoMiningInterval = setInterval(() => {
            this.updateGameUI();
            this.pulseMinerCore();
        }, 1000);
    }
    
    // 20. توقف UI auto mining
    stopUIAutoMining() {
        if (this.autoMiningInterval) {
            clearInterval(this.autoMiningInterval);
            this.autoMiningInterval = null;
        }
    }
    
    // 21. بارگذاری پنل‌های فروش
    async loadSalePlans() {
        const salePlansGrid = document.getElementById('salePlansGrid');
        if (!salePlansGrid) return;
        
        try {
            const plans = await this.supabaseService.getSalePlansFromDB();
            
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
                        <li><i class="fas fa-check" style="color: var(--success);"></i> ${this.formatNumber(plan.sod_amount)} SOD اصلی</li>
                        <li><i class="fas fa-check" style="color: var(--success);"></i> ${this.formatNumber(Math.floor(plan.sod_amount * (plan.discount / 100)))} SOD هدیه</li>
                        <li><i class="fas fa-check" style="color: var(--success);"></i> قدرت استخراج +${plan.discount}%</li>
                    </ul>
                    
                    <button class="btn ${plan.popular ? 'btn-warning' : 'btn-primary'}" onclick="window.uiService.buySODPlan(${plan.id})">
                        <i class="fas fa-shopping-cart"></i>
                        خرید پنل
                    </button>
                `;
                
                salePlansGrid.appendChild(card);
            });
            
        } catch (error) {
            console.error('❌ Error loading sale plans:', error);
            salePlansGrid.innerHTML = '<p style="text-align: center; color: var(--text-secondary);">خطا در بارگذاری پنل‌ها</p>';
        }
    }
    
    // 22. خرید پنل SOD
    async buySODPlan(planId) {
        if (!this.authService?.isUserVerified()) {
            this.showNotification('❌', 'ابتدا ثبت‌نام و وارد شوید');
            this.showLogin();
            return;
        }
        
        try {
            const result = await this.gameService.buySODPlan(planId);
            if (result.success) {
                this.showNotification('🎉', `پنل ${result.planName} خریداری شد! ${this.formatNumber(result.sodReceived)} SOD دریافت کردید.`);
                this.updateGameUI();
            }
        } catch (error) {
            console.error('❌ Buy plan error:', error);
            this.showNotification('❌', error.message || 'خطا در خرید پنل');
        }
    }
    
    // 23. بارگذاری تراکنش‌ها
    async loadTransactions() {
        const transactionsList = document.getElementById('transactionsList');
        if (!transactionsList || !this.userId) return;
        
        try {
            const transactions = await this.supabaseService.getUserTransactions(this.userId, 10);
            
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
                    ${transaction.description ? `<div style="font-size: 12px; color: var(--text-secondary);">${transaction.description}</div>` : ''}
                `;
                
                transactionsList.appendChild(row);
            });
            
        } catch (error) {
            console.error('❌ Load transactions error:', error);
        }
    }
    
    // 24. چک کردن وضعیت ادمین
    async checkAdminStatus(user) {
        try {
            if (!user) return false;
            
            console.log('🔍 Checking admin status for:', user.email);
            
            const adminEmails = [
                'hamyarhf@gmail.com',
                'admin@sodmax.com', 
                'test@admin.com'
            ];
            
            const userEmail = user.email.toLowerCase().trim();
            const isAdmin = adminEmails.includes(userEmail);
            
            console.log('👑 Admin status:', isAdmin ? 'ADMIN' : 'USER');
            
            // نمایش یا مخفی کردن لینک ادمین
            const adminLink = document.getElementById('adminLink');
            if (adminLink) {
                if (isAdmin) {
                    adminLink.style.display = 'flex';
                    adminLink.style.background = 'rgba(255, 107, 53, 0.3)';
                    adminLink.innerHTML = `
                        <i class="fas fa-user-shield"></i>
                        <span class="nav-text">مدیریت</span>
                    `;
                    localStorage.setItem('sodmax_admin', 'true');
                } else {
                    adminLink.style.display = 'none';
                }
            }
            
            return isAdmin;
        } catch (error) {
            console.error('❌ Error in checkAdminStatus:', error);
            return false;
        }
    }
    
    // 25. نمایش اقدامات کیف پول
    async showWalletActions(action) {
        if (!this.authService?.isUserVerified()) {
            this.showNotification('❌', 'ابتدا ثبت‌نام و وارد شوید');
            this.showLogin();
            return;
        }
        
        const modal = document.getElementById('walletActionsModal');
        const title = document.getElementById('walletModalTitle');
        const content = document.getElementById('walletActionsContent');
        
        if (!modal || !title || !content) {
            console.error('❌ Wallet modal elements not found');
            return;
        }
        
        if (action === 'deposit') {
            title.textContent = '💳 شارژ کیف پول';
            content.innerHTML = `
                <div class="form-group">
                    <label class="form-label">مبلغ (USDT)</label>
                    <input type="number" id="depositAmountInput" class="form-input" placeholder="10" min="1" step="0.1" value="10">
                </div>
                
                <div class="form-group">
                    <label class="form-label">روش پرداخت</label>
                    <select id="paymentMethod" class="form-input">
                        <option value="bank_transfer">💳 انتقال بانکی</option>
                        <option value="crypto_usdt">🔗 USDT (TRC20)</option>
                        <option value="crypto_bep20">🔗 USDT (BEP20)</option>
                    </select>
                </div>
                
                <div id="paymentDetails">
                    <div class="payment-info">
                        <p>💡 پس از انتخاب روش پرداخت، اطلاعات لازم نمایش داده می‌شود.</p>
                    </div>
                </div>
                
                <button class="btn btn-success" onclick="window.uiService.processDeposit()" style="width: 100%;">
                    <i class="fas fa-credit-card"></i> ادامه پرداخت
                </button>
            `;
            
            // گوش دادن به تغییر روش پرداخت
            setTimeout(() => {
                const paymentMethod = document.getElementById('paymentMethod');
                if (paymentMethod) {
                    paymentMethod.addEventListener('change', (e) => {
                        this.showPaymentDetails(e.target.value);
                    });
                    // نمایش جزئیات پیش‌فرض
                    this.showPaymentDetails('bank_transfer');
                }
            }, 100);
            
        } else if (action === 'withdraw') {
            title.textContent = '💰 برداشت از کیف پول';
            content.innerHTML = `
                <div class="form-group">
                    <label class="form-label">مبلغ برداشت (USDT)</label>
                    <input type="number" id="withdrawAmountInput" class="form-input" placeholder="10" min="10" step="0.1" value="10">
                    <div style="font-size: 12px; color: var(--text-secondary); margin-top: 5px;">
                        حداقل برداشت: 10 USDT
                    </div>
                </div>
                
                <div class="form-group">
                    <label class="form-label">آدرس کیف پول مقصد</label>
                    <input type="text" id="withdrawWalletAddress" class="form-input" placeholder="TXXXX... یا 0x...">
                </div>
                
                <div class="form-group">
                    <label class="form-label">شبکه انتقال</label>
                    <select id="withdrawNetwork" class="form-input">
                        <option value="TRC20">TRC20 (تزریون)</option>
                        <option value="BEP20">BEP20 (بین‌بی)</option>
                    </select>
                </div>
                
                <div class="withdrawal-info">
                    <p><i class="fas fa-info-circle"></i> کارمزد برداشت: <strong>2%</strong></p>
                    <p>⏱ زمان پردازش: <strong>24 ساعت</strong></p>
                </div>
                
                <button class="btn btn-primary" onclick="window.uiService.processWithdrawal()" style="width: 100%;">
                    <i class="fas fa-paper-plane"></i> ثبت درخواست برداشت
                </button>
            `;
        }
        
        modal.style.display = 'flex';
    }
    
    // 26. نمایش جزئیات پرداخت
    async showPaymentDetails(method) {
        const detailsDiv = document.getElementById('paymentDetails');
        if (!detailsDiv) return;
        
        const amountInput = document.getElementById('depositAmountInput');
        const amount = amountInput ? parseFloat(amountInput.value) || 0 : 0;
        
        let details = '';
        
        if (method === 'bank_transfer') {
            details = `
                <div class="payment-info">
                    <h4><i class="fas fa-university"></i> اطلاعات حساب بانکی</h4>
                    <div style="margin-top: 10px;">
                        <p><strong>شماره کارت:</strong> ****-****-****-****</p>
                        <p><strong>دارنده حساب:</strong> شرکت SODmAX</p>
                        <p><strong>مبلغ:</strong> <span id="finalAmount">${amount}</span> USDT</p>
                        <p><strong>توضیحات:</strong> شماره کاربری خود را در توضیحات انتقال ذکر کنید</p>
                    </div>
                    <p style="color: var(--warning); margin-top: 15px;">
                        ⚠️ پس از واریز، فیش پرداختی را برای ما ارسال کنید.
                    </p>
                </div>
            `;
        } else if (method === 'crypto_usdt') {
            details = `
                <div class="payment-info">
                    <h4><i class="fab fa-usdt"></i> آدرس کیف پول USDT (TRC20)</h4>
                    <div style="margin-top: 10px;">
                        <p><strong>آدرس:</strong> <code style="background: rgba(0,0,0,0.3); padding: 5px; border-radius: 4px; display: inline-block; margin: 5px 0;">*****************</code></p>
                        <button class="btn btn-sm btn-outline" onclick="window.uiService.copyToClipboard('**************')" style="margin: 5px 0;">
                            <i class="fas fa-copy"></i> کپی آدرس
                        </button>
                        <p><strong>مبلغ:</strong> <span id="finalAmount">${amount}</span> USDT</p>
                        <p><strong>شبکه:</strong> TRC20 (تزریون) - حتماً انتخاب شود</p>
                    </div>
                    <p style="color: var(--warning); margin-top: 15px;">
                        ⚠️ انتقال از شبکه‌های دیگر باعث از دست رفتن موجودی می‌شود.
                    </p>
                </div>
            `;
        } else if (method === 'crypto_bep20') {
            details = `
                <div class="payment-info">
                    <h4><i class="fab fa-ethereum"></i> آدرس کیف پول USDT (BEP20)</h4>
                    <div style="margin-top: 10px;">
                        <p><strong>آدرس:</strong> <code style="background: rgba(0,0,0,0.3); padding: 5px; border-radius: 4px; display: inline-block; margin: 5px 0;">0x7a9f3b3c8d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8</code></p>
                        <button class="btn btn-sm btn-outline" onclick="window.uiService.copyToClipboard('0x7a9f3b3c8d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8')" style="margin: 5px 0;">
                            <i class="fas fa-copy"></i> کپی آدرس
                        </button>
                        <p><strong>مبلغ:</strong> <span id="finalAmount">${amount}</span> USDT</p>
                        <p><strong>شبکه:</strong> BEP20 (بین‌بی) - حتماً انتخاب شود</p>
                    </div>
                    <p style="color: var(--warning); margin-top: 15px;">
                        ⚠️ انتقال از شبکه‌های دیگر باعث از دست رفتن موجودی می‌شود.
                    </p>
                </div>
            `;
        }
        
        detailsDiv.innerHTML = details;
    }
    
    // 27. پردازش شارژ
    async processDeposit() {
        const amountInput = document.getElementById('depositAmountInput');
        const methodSelect = document.getElementById('paymentMethod');
        
        if (!amountInput || !methodSelect) {
            this.showNotification('❌', 'خطا در دریافت اطلاعات');
            return;
        }
        
        const amount = parseFloat(amountInput.value);
        const method = methodSelect.value;
        
        if (!amount || amount < 1) {
            this.showNotification('❌', 'لطفاً مبلغ معتبر وارد کنید (حداقل 1 USDT)');
            return;
        }
        
        try {
            // نمایش پیام در حال پردازش
            this.showNotification('💳', `درخواست شارژ ${amount} USDT ثبت شد...`);
            
            // بستن مودال
            this.closeWalletModal();
            
            // نمایش اطلاعات پرداخت
            let paymentInfo = '';
            if (method === 'bank_transfer') {
                paymentInfo = 'لطفاً مبلغ را به شماره کارت اعلام شده واریز کنید و فیش را ارسال نمایید.';
            } else if (method === 'crypto_usdt') {
                paymentInfo = `لطفاً ${amount} USDT را به آدرس TRC20 ارسال کنید.`;
            } else if (method === 'crypto_bep20') {
                paymentInfo = `لطفاً ${amount} USDT را به آدرس BEP20 ارسال کنید.`;
            }
            
            setTimeout(() => {
                this.showNotification('📋', `${paymentInfo} پس از تأیید، موجودی شما افزایش می‌یابد.`);
            }, 1000);
            
        } catch (error) {
            console.error('❌ Deposit error:', error);
            this.showNotification('❌', 'خطا در ثبت درخواست شارژ');
        }
    }
    
    // 28. پردازش برداشت
    async processWithdrawal() {
        const amountInput = document.getElementById('withdrawAmountInput');
        const addressInput = document.getElementById('withdrawWalletAddress');
        const networkSelect = document.getElementById('withdrawNetwork');
        
        if (!amountInput || !addressInput || !networkSelect) {
            this.showNotification('❌', 'خطا در دریافت اطلاعات');
            return;
        }
        
        const amount = parseFloat(amountInput.value);
        const address = addressInput.value.trim();
        const network = networkSelect.value;
        
        if (!amount || amount < 10) {
            this.showNotification('❌', 'حداقل برداشت 10 USDT می‌باشد');
            return;
        }
        
        if (!address || address.length < 10) {
            this.showNotification('❌', 'لطفاً آدرس کیف پول معتبر وارد کنید');
            return;
        }
        
        try {
            // استفاده از WalletService
            if (this.walletService) {
                const result = await this.walletService.requestWithdrawal(
                    this.userId,
                    amount,
                    'USDT',
                    address,
                    network
                );
                
                if (result.success) {
                    this.showNotification('✅', `درخواست برداشت ${amount} USDT ثبت شد. زمان پردازش: ${result.processingTime || '24'} ساعت`);
                    this.closeWalletModal();
                    this.updateGameUI();
                } else {
                    this.showNotification('❌', result.error || 'خطا در ثبت درخواست برداشت');
                }
            } else {
                this.showNotification('❌', 'سرویس کیف پول در دسترس نیست');
            }
        } catch (error) {
            console.error('❌ Withdrawal error:', error);
            this.showNotification('❌', error.message || 'خطا در ثبت درخواست برداشت');
        }
    }
    
    // 29. بستن مودال کیف پول
    closeWalletModal() {
        const modal = document.getElementById('walletActionsModal');
        if (modal) {
            modal.style.display = 'none';
        }
    }
    
    // 30. کپی به کلیپ‌بورد
    copyToClipboard(text) {
        navigator.clipboard.writeText(text)
            .then(() => this.showNotification('✅', 'آدرس کپی شد'))
            .catch(() => this.showNotification('❌', 'خطا در کپی کردن'));
    }
    
    // 31. آپدیت اطلاعات کیف پول در UI
    async updateWalletUI() {
        if (!this.userId || !this.walletService) return;
        
        try {
            // دریافت اطلاعات کیف پول
            const walletInfo = await this.walletService.getWalletStats(this.userId);
            if (walletInfo) {
                // آدرس کیف پول
                const walletAddressEl = document.getElementById('walletAddress');
                if (walletAddressEl) {
                    walletAddressEl.textContent = walletInfo.walletAddress || 'آدرس نامشخص';
                }
                
                // تعداد تراکنش‌ها
                const transactionCountEl = document.getElementById('walletTransactionCount');
                if (transactionCountEl) {
                    transactionCountEl.textContent = walletInfo.transactionsCount.toLocaleString('fa-IR');
                }
            }
        } catch (error) {
            console.error('❌ Error updating wallet UI:', error);
        }
    }
    
    // 32. Helper functions
    isValidEmail(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    }
    
    getRandomColor() {
        const colors = ['#0066FF', '#00D4AA', '#FF6B35', '#FFD700', '#FF4081', '#7C4DFF'];
        return colors[Math.floor(Math.random() * colors.length)];
    }
    
    formatNumber(num) {
        if (num >= 1000000000) return (num / 1000000000).toFixed(2) + 'B';
        if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
        if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
        return Math.floor(num).toLocaleString('fa-IR');
    }
    
    getTransactionIcon(type) {
        const icons = {
            'mining': '⛏️',
            'usdt_reward': '💰',
            'purchase': '🛒',
            'boost': '⚡',
            'withdrawal': '💳',
            'deposit': '💳',
            'transfer': '🔄'
        };
        return icons[type] || '📝';
    }
    
    getTransactionTypeText(type) {
        const texts = {
            'mining': 'استخراج',
            'usdt_reward': 'پاداش USDT',
            'purchase': 'خرید پنل',
            'boost': 'افزایش قدرت',
            'withdrawal': 'برداشت',
            'deposit': 'شارژ کیف پول',
            'transfer': 'انتقال'
        };
        return texts[type] || type;
    }
}

// ایجاد instance جهانی
window.uiService = new UIService();

// وقتی DOM لود شد
document.addEventListener('DOMContentLoaded', () => {
    console.log('📄 DOM loaded, UI service active');
});
