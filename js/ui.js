// js/ui.js
class UIService {
    constructor() {
        this.authService = window.AuthService;
        this.gameService = window.GameService;
        this.supabaseService = window.SupabaseService;
        this.initializeUI();
    }
    
    initializeUI() {
        this.bindEvents();
        this.updateUI();
        this.checkAuthState();
    }
    
    bindEvents() {
        // ثبت نام
        const registerForm = document.getElementById('registerForm');
        if (registerForm) {
            registerForm.addEventListener('submit', (e) => this.handleRegistration(e));
        }
        
        // استخراج
        const minerCore = document.getElementById('minerCore');
        if (minerCore) {
            minerCore.addEventListener('click', () => this.handleMining());
        }
        
        // دریافت پاداش
        const claimBtn = document.getElementById('claimUSDTBtn');
        if (claimBtn) {
            claimBtn.addEventListener('click', () => this.handleClaimUSDT());
        }
        
        // استخراج خودکار
        const autoMineBtn = document.getElementById('autoMineBtn');
        if (autoMineBtn) {
            autoMineBtn.addEventListener('click', () => this.toggleAutoMining());
        }
        
        // افزایش قدرت
        const boostBtn = document.querySelector('[onclick*="boostMining"]');
        if (boostBtn) {
            boostBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.handleBoost();
            });
        }
        
        console.log('✅ UI events bound');
    }
    
    checkAuthState() {
        if (this.authService.isLoggedIn()) {
            this.hideRegister();
            this.showNotification('👋', `خوش آمدید ${this.authService.getCurrentUser().fullName}!`);
            
            // بارگیری داده‌های بازی از دیتابیس
            this.gameService.loadGameFromDatabase().then(() => {
                this.updateUI();
            });
            
            // نمایش لینک ادمین
            const user = this.authService.getCurrentUser();
            if (user.email === "hamyarhf@gmail.com") {
                const adminLink = document.getElementById('adminLink');
                if (adminLink) adminLink.style.display = 'flex';
            }
        } else {
            this.showRegister();
        }
    }
    
    async handleRegistration(e) {
        e.preventDefault();
        
        const fullName = document.getElementById('fullName').value.trim();
        const email = document.getElementById('email').value.trim();
        const referralCode = document.getElementById('referralCode').value.trim();
        
        if (!fullName || !email) {
            this.showNotification('❌', 'لطفاً نام و ایمیل را وارد کنید');
            return;
        }
        
        this.showNotification('⏳', 'در حال ثبت نام...');
        
        const result = await this.authService.register({
            fullName,
            email,
            referralCode
        });
        
        if (result.success) {
            this.showNotification('✅', `ثبت نام موفق! خوش آمدید ${fullName}!`);
            
            setTimeout(() => {
                this.hideRegister();
                this.updateUI();
                this.showNotification('🎁', '۱,۰۰۰,۰۰۰ SOD هدیه دریافت کردید!');
            }, 1500);
        } else {
            this.showNotification('❌', 'خطا در ثبت نام: ' + result.error);
        }
    }
    
    async handleMining() {
        if (!this.authService.isLoggedIn()) {
            this.showNotification('❌', 'ابتدا ثبت نام کنید');
            return;
        }
        
        try {
            const earned = await this.gameService.mine();
            this.updateUI();
            this.createMiningEffect(earned);
            this.showNotification('⛏️', `+${this.formatNumber(earned)} SOD استخراج شد!`);
        } catch (error) {
            this.showNotification('❌', error.message);
        }
    }
    
    async handleClaimUSDT() {
        if (!this.authService.isLoggedIn()) {
            this.showNotification('❌', 'ابتدا ثبت نام کنید');
            return;
        }
        
        try {
            const usdtClaimed = await this.gameService.claimUSDT();
            this.updateUI();
            this.showNotification('💰', `${usdtClaimed.toFixed(4)} USDT دریافت شد!`);
        } catch (error) {
            this.showNotification('❌', error.message);
        }
    }
    
    async handleBoost() {
        if (!this.authService.isLoggedIn()) {
            this.showNotification('❌', 'ابتدا ثبت نام کنید');
            return;
        }
        
        try {
            await this.gameService.boost();
            this.updateUI();
            this.showNotification('⚡', 'قدرت استخراج ۳ برابر شد! (۳۰ دقیقه)');
        } catch (error) {
            this.showNotification('❌', error.message);
        }
    }
    
    toggleAutoMining() {
        const gameData = this.gameService.getGameData();
        
        if (gameData.sodBalance < 1000000) {
            this.showNotification('⚠️', 'برای استخراج خودکار حداقل ۱ میلیون SOD نیاز دارید.');
            return;
        }
        
        gameData.autoMining = !gameData.autoMining;
        const btn = document.getElementById('autoMineBtn');
        
        if (gameData.autoMining) {
            btn.innerHTML = '<i class="fas fa-pause"></i> توقف خودکار';
            btn.style.background = 'var(--error)';
            this.showNotification('🤖', 'استخراج خودکار فعال شد.');
        } else {
            btn.innerHTML = '<i class="fas fa-robot"></i> استخراج خودکار';
            btn.style.background = '';
            this.showNotification('⏸️', 'استخراج خودکار متوقف شد.');
        }
    }
    
    // ========== UI FUNCTIONS ==========
    updateUI() {
        if (!this.authService.isLoggedIn()) return;
        
        const gameData = this.gameService.getGameData();
        
        // موجودی‌ها
        document.getElementById('sodBalance').innerHTML = 
            this.formatNumber(gameData.sodBalance) + ' <span>SOD</span>';
        
        document.getElementById('usdtBalance').innerHTML = 
            gameData.usdtBalance.toFixed(4) + ' <span>USDT</span>';
        
        // آمار
        document.getElementById('todayEarnings').textContent = 
            this.formatNumber(gameData.todayEarnings) + ' SOD';
        
        document.getElementById('miningPower').textContent = 
            gameData.miningPower + 'x';
        
        document.getElementById('clickReward').textContent = 
            '+' + gameData.miningPower + ' SOD';
        
        document.getElementById('userLevel').textContent = 
            gameData.userLevel;
        
        // پاداش USDT
        document.getElementById('availableUSDT').textContent = 
            gameData.usdtBalance.toFixed(4) + ' USDT';
        
        const progressPercent = (gameData.usdtProgress / 10000000) * 100;
        document.getElementById('progressFill').style.width = progressPercent + '%';
        
        document.getElementById('progressText').textContent = 
            this.formatNumber(gameData.usdtProgress) + ' / ۱۰,۰۰۰,۰۰۰ SOD (۰.۰۱ USDT)';
    }
    
    showNotification(title, message) {
        const notification = document.getElementById('notification');
        const titleEl = document.getElementById('notificationTitle');
        const messageEl = document.getElementById('notificationMessage');
        
        if (notification && titleEl && messageEl) {
            titleEl.textContent = title;
            messageEl.textContent = message;
            
            notification.classList.add('show');
            
            setTimeout(() => {
                notification.classList.remove('show');
            }, 4000);
        }
        
        console.log(`📢 ${title}: ${message}`);
    }
    
    formatNumber(num) {
        if (num >= 1000000000) return (num / 1000000000).toFixed(2) + 'B';
        if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
        if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
        return Math.floor(num).toLocaleString('fa-IR');
    }
    
    createMiningEffect(amount) {
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
        effect.textContent = '+' + this.formatNumber(amount);
        
        document.body.appendChild(effect);
        
        setTimeout(() => effect.remove(), 1000);
    }
    
    hideRegister() {
        document.getElementById('registerOverlay').style.display = 'none';
        document.getElementById('mainContainer').style.display = 'block';
    }
    
    showRegister() {
        document.getElementById('registerOverlay').style.display = 'flex';
        document.getElementById('mainContainer').style.display = 'none';
    }
    
    showSODSale() {
        this.showNotification('🛒', 'فروشگاه SOD به زودی فعال می‌شود');
    }
}

// ایجاد نمونه global
window.UIService = new UIService();
