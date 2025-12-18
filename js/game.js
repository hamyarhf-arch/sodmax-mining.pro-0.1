// Game Service for SODmAX Pro
class GameService {
    constructor() {
        this.gameData = {
            sodBalance: 1000000, // هدیه ثبت نام
            usdtBalance: 0,
            todayEarnings: 0,
            miningPower: 10,
            userLevel: 1,
            usdtProgress: 1000000,
            totalMined: 0,
            boostActive: false,
            autoMining: false,
            lastMineTime: null
        };
        
        this.userId = null;
        this.autoSaveInterval = null;
        this.autoMiningInterval = null;
    }
    
    async initialize(userId) {
        this.userId = userId;
        
        // بارگذاری داده‌ها از دیتابیس
        await this.loadFromDatabase();
        
        // شروع ذخیره خودکار
        this.startAutoSave();
        
        console.log('🎮 Game service initialized for user:', userId);
        return this.gameData;
    }
    
    async loadFromDatabase() {
        if (!this.userId) return;
        
        try {
            const savedData = await window.supabaseService.getGameData(this.userId);
            
            if (savedData) {
                this.gameData = {
                    ...this.gameData,
                    sodBalance: savedData.sodBalance || 1000000,
                    usdtBalance: savedData.usdtBalance || 0,
                    miningPower: savedData.miningPower || 10,
                    userLevel: savedData.userLevel || 1,
                    usdtProgress: savedData.usdtProgress || 1000000,
                    totalMined: savedData.totalMined || 0
                };
                
                console.log('📂 Game data loaded from database');
            } else {
                console.log('📱 Using default game data');
            }
        } catch (error) {
            console.error('❌ Error loading game data:', error);
        }
    }
    
    async saveToDatabase() {
        if (!this.userId) return false;
        
        try {
            const success = await window.supabaseService.saveGameData(this.userId, this.gameData);
            
            if (success) {
                console.log('💾 Game data saved to database');
            } else {
                console.log('📱 Game data saved to local storage');
            }
            
            return success;
        } catch (error) {
            console.error('❌ Error saving game data:', error);
            return false;
        }
    }
    
    startAutoSave() {
        if (this.autoSaveInterval) {
            clearInterval(this.autoSaveInterval);
        }
        
        // ذخیره خودکار هر 30 ثانیه
        this.autoSaveInterval = setInterval(() => {
            this.saveToDatabase();
        }, 30000);
        
        console.log('⏰ Auto-save started');
    }
    
    stopAutoSave() {
        if (this.autoSaveInterval) {
            clearInterval(this.autoSaveInterval);
            this.autoSaveInterval = null;
        }
    }
    
    // ============ تابع اعتبارسنجی دسترسی ============
    
    validateUserAccess() {
        if (!this.userId) {
            console.error('❌ No user ID - access denied');
            return false;
        }
        
        // چک کردن اینکه کاربر وارد شده است
        const user = window.authService ? window.authService.getCurrentUser() : null;
        if (!user) {
            console.error('❌ No authenticated user - access denied');
            return false;
        }
        
        if (user.id !== this.userId) {
            console.error('❌ User ID mismatch - access denied');
            return false;
        }
        
        return true;
    }
    
    // ============ منطق بازی ============
    
    manualMine() {
        // چک دسترسی
        if (!this.validateUserAccess()) {
            console.error('❌ Access denied for manual mining');
            return { earned: 0, usdtResult: null };
        }
        
        let earned = this.gameData.miningPower;
        
        if (this.gameData.boostActive) {
            earned *= 3;
        }
        
        // آپدیت داده‌ها
        this.gameData.sodBalance += earned;
        this.gameData.totalMined += earned;
        this.gameData.todayEarnings += earned;
        this.gameData.usdtProgress += earned;
        this.gameData.lastMineTime = new Date().toISOString();
        
        // بررسی پاداش USDT
        const usdtResult = this.checkUSDT();
        
        // ثبت تراکنش
        this.recordTransaction('mining', earned, 'SOD', 'استخراج دستی');
        
        return { earned, usdtResult };
    }
    
    checkUSDT() {
        if (this.gameData.usdtProgress >= 10000000) {
            const usdtEarned = 0.01;
            
            this.gameData.usdtBalance += usdtEarned;
            this.gameData.usdtProgress -= 10000000;
            
            // شانس ارتقاء سطح
            let levelUp = false;
            if (Math.random() > 0.85) {
                this.gameData.userLevel++;
                this.gameData.miningPower = 10 * this.gameData.userLevel;
                levelUp = true;
            }
            
            // ثبت تراکنش USDT
            this.recordTransaction('usdt_reward', usdtEarned, 'USDT', 'پاداش استخراج');
            
            return { usdtEarned, levelUp };
        }
        
        return null;
    }
    
    buySODPlan(plan) {
        // چک دسترسی
        if (!this.validateUserAccess()) {
            console.error('❌ Access denied for buying SOD plan');
            return 0;
        }
        
        const bonusSOD = Math.floor(plan.sod_amount * (plan.discount / 100));
        const totalSOD = plan.sod_amount + bonusSOD;
        
        this.gameData.sodBalance += totalSOD;
        
        // ثبت تراکنش
        this.recordTransaction('purchase', totalSOD, 'SOD', `خرید پنل ${plan.name}`);
        
        return totalSOD;
    }
    
    claimUSDT() {
        // چک دسترسی
        if (!this.validateUserAccess()) {
            console.error('❌ Access denied for claiming USDT');
            return { success: false, error: 'دسترسی غیرمجاز' };
        }
        
        if (this.gameData.usdtBalance <= 0) {
            return { success: false, error: 'موجودی USDT کافی نیست' };
        }
        
        const usdtToClaim = this.gameData.usdtBalance;
        const sodNeeded = usdtToClaim * 1000000000;
        
        if (this.gameData.sodBalance < sodNeeded) {
            return { 
                success: false, 
                error: `موجودی SOD کافی نیست. نیاز: ${this.formatNumber(sodNeeded)} SOD`
            };
        }
        
        this.gameData.usdtBalance = 0;
        this.gameData.sodBalance -= sodNeeded;
        
        // ثبت تراکنش
        this.recordTransaction('withdrawal', usdtToClaim, 'USDT', 'دریافت پاداش USDT');
        
        return { 
            success: true, 
            usdtClaimed: usdtToClaim,
            sodUsed: sodNeeded
        };
    }
    
    boostMining() {
        // چک دسترسی
        if (!this.validateUserAccess()) {
            console.error('❌ Access denied for boost mining');
            return false;
        }
        
        const cost = 5000;
        
        if (this.gameData.sodBalance < cost) {
            return false;
        }
        
        this.gameData.sodBalance -= cost;
        this.gameData.boostActive = true;
        this.gameData.miningPower *= 3;
        
        // ثبت تراکنش
        this.recordTransaction('boost', cost, 'SOD', 'خرید افزایش قدرت');
        
        // توقف بوست بعد از 30 دقیقه
        setTimeout(() => {
            this.gameData.boostActive = false;
            this.gameData.miningPower = 10 * this.gameData.userLevel;
            
            // اطلاع‌رسانی به UI
            if (window.uiService) {
                window.uiService.showNotification('⏰', 'زمان افزایش قدرت به پایان رسید.');
                window.uiService.updateGameUI();
            }
        }, 30 * 60 * 1000);
        
        return true;
    }
    
    startAutoMining() {
        // چک دسترسی
        if (!this.validateUserAccess()) {
            console.error('❌ Access denied for auto mining');
            return false;
        }
        
        if (this.autoMiningInterval) {
            clearInterval(this.autoMiningInterval);
        }
        
        this.gameData.autoMining = true;
        this.autoMiningInterval = setInterval(() => {
            this.manualMine();
            
            // آپدیت UI
            if (window.uiService) {
                window.uiService.updateGameUI();
            }
        }, 1000);
        
        return true;
    }
    
    stopAutoMining() {
        if (this.autoMiningInterval) {
            clearInterval(this.autoMiningInterval);
            this.autoMiningInterval = null;
        }
        
        this.gameData.autoMining = false;
        return true;
    }
    
    // ============ توابع کمکی ============
    
    formatNumber(num) {
        if (num >= 1000000000) return (num / 1000000000).toFixed(2) + 'B';
        if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
        if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
        return Math.floor(num).toLocaleString('fa-IR');
    }
    
    async recordTransaction(type, amount, currency, description = '') {
        if (!this.userId) return;
        
        try {
            const transaction = {
                type,
                amount,
                currency,
                description,
                created_at: new Date().toISOString()
            };
            
            // ذخیره در Supabase
            if (window.supabaseService && window.supabaseService.addTransaction) {
                await window.supabaseService.addTransaction(this.userId, transaction);
            }
            
            // ذخیره در localStorage
            const transactions = JSON.parse(localStorage.getItem(`sodmax_transactions_${this.userId}`) || '[]');
            transactions.unshift(transaction);
            
            // فقط 50 تراکنش آخر را نگه دار
            if (transactions.length > 50) {
                transactions.length = 50;
            }
            
            localStorage.setItem(`sodmax_transactions_${this.userId}`, JSON.stringify(transactions));
            
        } catch (error) {
            console.error('❌ Error recording transaction:', error);
        }
    }
    
    async getRecentTransactions(limit = 10) {
        if (!this.userId) return [];
        
        try {
            // اول از Supabase بگیر
            if (window.supabaseService && window.supabaseService.getTransactions) {
                const transactions = await window.supabaseService.getTransactions(this.userId, limit);
                if (transactions.length > 0) {
                    return transactions;
                }
            }
            
            // اگر نبود از localStorage بگیر
            const transactions = JSON.parse(localStorage.getItem(`sodmax_transactions_${this.userId}`) || '[]');
            return transactions.slice(0, limit);
            
        } catch (error) {
            console.error('❌ Error getting transactions:', error);
            return [];
        }
    }
    
    getGameData() {
        return { ...this.gameData };
    }
    
    setGameData(newData) {
        this.gameData = { ...this.gameData, ...newData };
    }
    
    resetTodayEarnings() {
        this.gameData.todayEarnings = 0;
    }
    
    getMiningStats() {
        return {
            perClick: this.gameData.miningPower,
            perSecond: this.gameData.autoMining ? this.gameData.miningPower : 0,
            boostActive: this.gameData.boostActive,
            boostMultiplier: this.gameData.boostActive ? 3 : 1
        };
    }
    
    // تابع برای ریست کامل بازی (برای تست)
    reset() {
        this.gameData = {
            sodBalance: 1000000,
            usdtBalance: 0,
            todayEarnings: 0,
            miningPower: 10,
            userLevel: 1,
            usdtProgress: 1000000,
            totalMined: 0,
            boostActive: false,
            autoMining: false,
            lastMineTime: null
        };
        
        this.stopAutoSave();
        this.stopAutoMining();
        
        console.log('🔄 Game data reset');
    }
    
    // تابع برای اعمال پنل خرید
    applyPurchasePlan(planId) {
        // پنل‌های پیش‌فرض
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
        
        const plan = defaultPlans.find(p => p.id === planId);
        if (!plan) return 0;
        
        return this.buySODPlan(plan);
    }
    
    // تابع برای محاسبه پیشرفت USDT
    getUSDTProgress() {
        const progressPercent = (this.gameData.usdtProgress / 10000000) * 100;
        const remaining = 10000000 - this.gameData.usdtProgress;
        
        return {
            current: this.gameData.usdtProgress,
            target: 10000000,
            percent: progressPercent,
            remaining: remaining,
            nextReward: 0.01
        };
    }
    
    // تابع برای بررسی وضعیت کاربر
    getUserStatus() {
        return {
            level: this.gameData.userLevel,
            totalMined: this.gameData.totalMined,
            todayEarnings: this.gameData.todayEarnings,
            miningPower: this.gameData.miningPower,
            hasBoost: this.gameData.boostActive,
            isAutoMining: this.gameData.autoMining
        };
    }
}

// Create global instance
window.gameService = new GameService();
console.log('✅ Game service loaded');

// متدهای اضافی برای دسترسی آسان
window.gameManager = {
    // استخراج دستی
    mine: () => window.gameService.manualMine(),
    
    // دریافت پاداش USDT
    claimUSDT: () => window.gameService.claimUSDT(),
    
    // خرید پنل SOD
    buyPlan: (planId) => window.gameService.applyPurchasePlan(planId),
    
    // فعال‌سازی افزایش قدرت
    boost: () => window.gameService.boostMining(),
    
    // شروع/توقف استخراج خودکار
    toggleAutoMine: () => {
        const gameData = window.gameService.getGameData();
        if (gameData.autoMining) {
            window.gameService.stopAutoMining();
        } else {
            window.gameService.startAutoMining();
        }
    },
    
    // گرفتن اطلاعات بازی
    getGameData: () => window.gameService.getGameData(),
    
    // گرفتن تراکنش‌ها
    getTransactions: (limit) => window.gameService.getRecentTransactions(limit),
    
    // گرفتن وضعیت USDT
    getUSDTProgress: () => window.gameService.getUSDTProgress(),
    
    // گرفتن وضعیت کاربر
    getUserStatus: () => window.gameService.getUserStatus(),
    
    // ریست بازی (فقط برای توسعه)
    resetGame: () => {
        if (confirm('آیا مطمئن هستید که می‌خواهید بازی را ریست کنید؟')) {
            window.gameService.reset();
            if (window.uiService) {
                window.uiService.updateGameUI();
            }
        }
    }
};
