// UI Service for SODmAX Pro
class UIService {
    constructor() {
        this.gameService = window.gameService;
        this.authService = window.authService;
        this.supabaseService = window.supabaseService;
        
        this.initializeUI();
    }
    
    initializeUI() {
        // چک کردن وضعیت احراز هویت
        this.checkAuthState();
        
        // بایند کردن events
        this.bindEvents();
        
        // بارگذاری پنل‌های فروش
        this.loadSalePlans();
        
        console.log('✅ UI initialized');
    }
    
    async checkAuthState() {
        const user = await this.authService.handleAuthStateChange();
        
        if (user) {
            this.showMainApp(user);
        } else {
            this.showLogin();
        }
    }
    
    async showMainApp(user) {
        console.log('👋 Welcome:', user.email);
        
        // مخفی کردن صفحه لاگین
        document.getElementById('registerOverlay').style.display = 'none';
        document.getElementById('mainContainer').style.display = 'block';
        
        // نمایش اطلاعات کاربر
        document.getElementById('userEmail').textContent = user.email;
        
        // مقداردهی اولیه بازی
        await this.gameService.initialize(user.id);
        
        // آپدیت UI
        this.updateGameUI();
        
        // بارگذاری تراکنش‌ها
        this.loadTransactions();
    }
    
    showLogin() {
        document.getElementById('registerOverlay').style.display = 'flex';
        document.getElementById('mainContainer').style.display = 'none';
    }
    
    bindEvents() {
        // فرم ثبت نام/ورود
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
        
        // دکمه افزایش قدرت
        const boostBtn = document.querySelector('button[onclick*="boostMining"]');
        if (boostBtn) {
            boostBtn.addEventListener('click', () => this.handleBoostMining());
        }
        
        // دکمه خرید SOD
        const buySodBtn = document.querySelector('button[onclick*="showSODSale"]');
        if (buySodBtn) {
            buySodBtn.addEventListener('click', () => this.showSODSale());
        }
        
        console.log('✅ UI events bound');
    }
    
    async handleRegister(e) {
        e.preventDefault();
        
        const fullName = document.getElementById('fullName').value.trim();
        const email = document.getElementById('email').value.trim();
        const referralCode = document.getElementById('referralCode').value.trim();
        
        if (!fullName || !email) {
            this.showNotification('❌', 'لطفاً نام و ایمیل را وارد کنید');
            return;
        }
        
        // تولید رمز عبور تصادفی
        const password = this.generatePassword();
        
        this.showNotification('⏳', 'در حال ثبت نام...');
        
        const result = await this.authService.signUp(email, password, fullName, referralCode);
        
        if (result.success) {
            this.showNotification('✅', 'ثبت نام موفق! اکنون وارد شوید.');
            
            // تلاش برای ورود خودکار
            setTimeout(async () => {
                const loginResult = await this.authService.signIn(email, password);
                if (loginResult.success) {
                    this.showMainApp(loginResult.data.user);
                }
            }, 1000);
        } else {
            this.showNotification('❌', result.error || 'خطا در ثبت نام');
        }
    }
    
    generatePassword() {
        return Math.random().toString(36).slice(-10) + 'Aa1!';
    }
    
    handleMining() {
        if (!this.authService.getCurrentUser()) {
            this.showNotification('❌', 'ابتدا وارد شوید');
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
        if (!this.authService.getCurrentUser()) {
            this.showNotification('❌', 'ابتدا وارد شوید');
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
        if (!this.authService.getCurrentUser()) {
            this.showNotification('❌', 'ابتدا وارد شوید');
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
        const autoMineBtn = document.getElementById('autoMineBtn');
        const gameData = this.gameService.getGameData();
        
        if (gameData.sodBalance < 1000000) {
            this.showNotification('⚠️', 'برای استخراج خودکار حداقل ۱ میلیون SOD نیاز دارید.');
            return;
        }
        
        if (gameData.autoMining) {
            this.gameService.stopAutoMining();
            autoMineBtn.innerHTML = '<i class="fas fa-robot"></i> استخراج خودکار';
            autoMineBtn.style.background = '';
            this.showNotification('⏸️', 'استخراج خودکار متوقف شد.');
        } else {
            this.gameService.startAutoMining();
            autoMineBtn.innerHTML = '<i class="fas fa-pause"></i> توقف خودکار';
            autoMineBtn.style.background = 'var(--error)';
            this.showNotification('🤖', 'استخراج خودکار فعال شد.');
        }
        
        this.updateGameUI();
    }
    
    updateGameUI() {
        const gameData = this.gameService.getGameData();
        const format = this.gameService.formatNumber.bind(this.gameService);
        
        // موجودی‌ها
        document.getElementById('sodBalance').innerHTML = format(gameData.sodBalance) + ' <span>SOD</span>';
        document.getElementById('usdtBalance').innerHTML = gameData.usdtBalance.toFixed(4) + ' <span>USDT</span>';
        
        // آمار
        document.getElementById('todayEarnings').textContent = format(gameData.todayEarnings) + ' SOD';
        document.getElementById('miningPower').textContent = gameData.miningPower + 'x';
        document.getElementById('clickReward').textContent = '+' + gameData.miningPower + ' SOD';
        document.getElementById('userLevel').textContent = gameData.userLevel;
        
        // پاداش USDT
        document.getElementById('availableUSDT').textContent = gameData.usdtBalance.toFixed(4) + ' USDT';
        
        const progressPercent = (gameData.usdtProgress / 10000000) * 100;
        document.getElementById('progressFill').style.width = progressPercent + '%';
        document.getElementById('progressText').textContent = format(gameData.usdtProgress) + ' / ۱۰,۰۰۰,۰۰۰ SOD (۰.۰۱ USDT)';
        
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
    
    async loadSalePlans() {
        try {
            const plans = await this.supabaseService.getSalePlans();
            const grid = document.getElementById('salePlansGrid');
            
            if (!grid) return;
            
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
                    
                    <button class="btn ${plan.popular ? 'btn-warning' : 'btn-primary'}" onclick="uiService.handleBuyPlan(${plan.id})">
                        <i class="fas fa-shopping-cart"></i>
                        خرید پنل
                    </button>
                `;
                
                grid.appendChild(card);
            });
        } catch (error) {
            console.error('❌ Error loading sale plans:', error);
        }
    }
    
    async handleBuyPlan(planId) {
        // پیاده‌سازی خرید پنل
        this.showNotification('🛒', 'سیستم خرید به زودی فعال می‌شود...');
    }
    
    async loadTransactions() {
        const user = this.authService.getCurrentUser();
        if (!user) return;
        
        try {
            const transactions = await this.supabaseService.getTransactions(user.id, 10);
            const list = document.getElementById('transactionsList');
            
            if (!list) return;
            
            list.innerHTML = '';
            
            transactions.forEach(transaction => {
                const row = document.createElement('div');
                row.className = 'transaction-row';
                
                const date = new Date(transaction.created_at).toLocaleString('fa-IR');
                
                row.innerHTML = `
                    <div class="transaction-type">
                        <div class="transaction-icon">
                            ${transaction.type === 'mining' ? '⛏️' : 
                              transaction.type === 'purchase' ? '🛒' : 
                              transaction.type === 'withdrawal' ? '💰' : '📝'}
                        </div>
                        <div style="flex: 1;">
                            <div style="font-weight: bold;">
                                ${transaction.type === 'mining' ? 'استخراج' : 
                                 transaction.type
