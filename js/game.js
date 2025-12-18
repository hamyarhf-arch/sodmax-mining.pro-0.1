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
            autoMining: false
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
    
    // ============ منطق بازی ============
    
    manualMine() {
        let earned = this.gameData.miningPower;
        
        if (this.gameData.boostActive) {
            earned *= 3;
        }
        
        // آپدیت داده‌ها
        this.gameData.sodBalance += earned;
        this.gameData.totalMined += earned;
        this.gameData.todayEarnings += earned;
        this.gameData.usdtProgress += earned;
        
        // بررسی پاداش USDT
        const usdtResult = this.checkUSDT();
        
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
            
            return { usdtEarned, levelUp };
        }
        
        return null;
    }
    
    buySODPlan(plan) {
        const bonusSOD = Math.floor(plan.sod_amount * (plan.discount / 100));
        const totalSOD = plan.sod_amount + bonusSOD;
        
        this.gameData.sodBalance += totalSOD;
        
        // ثبت تراکنش
        if (this.userId) {
            window.supabaseService.addTransaction(this.userId, {
                type: 'purchase',
                amount: totalSOD,
                currency: 'SOD',
                description: `خرید پنل ${plan.name}`
            });
        }
        
        return totalSOD;
    }
    
    claimUSDT() {
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
        if (this.userId) {
            window.supabaseService.addTransaction(this.userId, {
                type: 'withdrawal',
                amount: usdtToClaim,
                currency: 'USDT',
                description: 'دریافت پاداش USDT'
            });
        }
        
        return { 
            success: true, 
            usdtClaimed: usdtToClaim,
            sodUsed: sodNeeded
        };
    }
    
    boostMining() {
        const cost = 5000;
        
        if (this.gameData.sodBalance < cost) {
            return false;
        }
        
        this.gameData.sodBalance -= cost;
        this.gameData.boostActive = true;
        this.gameData.miningPower *= 3;
        
        // توقف بوست بعد از 30 دقیقه
        setTimeout(() => {
            this.gameData.boostActive = false;
            this.gameData.miningPower = 10 * this.gameData.userLevel;
        }, 30 * 60 * 1000);
        
        return true;
    }
    
    startAutoMining() {
        if (this.autoMiningInterval) {
            clearInterval(this.autoMiningInterval);
        }
        
        this.gameData.autoMining = true;
        this.autoMiningInterval = setInterval(() => {
            this.manualMine();
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
    
    // ============ Helper functions ============
    
    formatNumber(num) {
        if (num >= 1000000000) return (num / 1000000000).toFixed(2) + 'B';
        if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
        if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
        return Math.floor(num).toLocaleString('fa-IR');
    }
    
    getGameData() {
        return { ...this.gameData };
    }
    
    setGameData(newData) {
        this.gameData = { ...this.gameData, ...newData };
    }
    
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
            autoMining: false
        };
        
        this.stopAutoSave();
        this.stopAutoMining();
    }
}

// Create global instance
window.gameService = new GameService();
console.log('✅ Game service loaded');
