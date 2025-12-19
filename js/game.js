// js/game.js - نسخه اصلاح شده
class GameService {
    constructor() {
        console.log('🎮 GameService initializing...');
        
        this.supabaseService = null;
        this.authService = null;
        this.gameData = this.loadGameFromStorage();
        this.autoSaveInterval = null;
        this.autoMineInterval = null; // اضافه شد
        this.isOnline = true;
        
        // منتظر می‌مانیم تا سرویس‌ها لود شوند
        this.init();
    }
    
    async init() {
        let attempts = 0;
        const maxAttempts = 15;
        
        // منتظر می‌مانیم تا سرویس‌ها لود شوند
        while (attempts < maxAttempts) {
            if (window.supabaseService && window.authService) {
                this.supabaseService = window.supabaseService;
                this.authService = window.authService;
                console.log('✅ Services loaded in GameService');
                break;
            }
            await new Promise(resolve => setTimeout(resolve, 200));
            attempts++;
        }
        
        if (!this.supabaseService || !this.authService) {
            console.warn('⚠️ Services not fully loaded, using offline mode');
            this.isOnline = false;
        } else {
            // تست اتصال
            const connection = await this.supabaseService.checkDatabaseConnection();
            this.isOnline = connection.connected;
            console.log(this.isOnline ? '🌐 Online mode' : '📴 Offline mode');
        }
        
        // اگر کاربر لاگین کرده، بازی را از دیتابیس لود کن
        const user = this.getCurrentUser();
        if (user) {
            await this.loadGameFromDatabase(user.id);
        }
        
        this.startAutoSave();
        console.log('✅ GameService initialized');
    }
    
    getCurrentUser() {
        if (this.authService) {
            return this.authService.getCurrentUser();
        }
        return null;
    }
    
    loadGameFromStorage() {
        try {
            const user = this.getCurrentUser();
            if (user) {
                const saved = localStorage.getItem(`sodmax_game_${user.id}`);
                if (saved) {
                    const data = JSON.parse(saved);
                    console.log('📱 Game loaded from localStorage');
                    return data;
                }
            }
            
            // بارگذاری قدیمی (برای backward compatibility)
            const oldSaved = localStorage.getItem('sodmax_game');
            if (oldSaved) {
                const data = JSON.parse(oldSaved);
                console.log('📱 Game loaded from old localStorage');
                return data;
            }
        } catch (error) {
            console.warn('Failed to load game from storage:', error);
        }
        
        // داده‌های پیش‌فرض
        console.log('🎮 Using default game data');
        return {
            sodBalance: 1000000,
            usdtBalance: 0,
            todayEarnings: 0,
            miningPower: 10,
            userLevel: 1,
            usdtProgress: 1000000,
            autoMining: false,
            boostActive: false,
            totalMined: 0,
            lastUpdated: new Date().toISOString()
        };
    }
    
    saveGameToStorage() {
        try {
            const user = this.getCurrentUser();
            if (user) {
                localStorage.setItem(`sodmax_game_${user.id}`, JSON.stringify(this.gameData));
            } else {
                localStorage.setItem('sodmax_game', JSON.stringify(this.gameData));
            }
            console.log('💾 Game saved to localStorage');
        } catch (error) {
            console.error('Failed to save game to storage:', error);
        }
    }
    
    async loadGameFromDatabase(userId) {
        if (!this.isOnline || !this.supabaseService || !userId) {
            console.log('ℹ️ Skipping database load (offline or no userId)');
            return false;
        }
        
        try {
            const data = await this.supabaseService.getGameData(userId);
            if (data) {
                this.gameData = {
                    sodBalance: data.sodBalance || 1000000,
                    usdtBalance: data.usdtBalance || 0,
                    todayEarnings: data.todayEarnings || 0,
                    miningPower: data.miningPower || 10,
                    userLevel: data.userLevel || 1,
                    usdtProgress: data.usdtProgress || 1000000,
                    autoMining: false,
                    boostActive: false,
                    totalMined: data.totalMined || 0,
                    lastUpdated: new Date().toISOString()
                };
                
                this.saveGameToStorage();
                console.log('✅ Game loaded from database');
                return true;
            }
        } catch (error) {
            console.warn('Failed to load game from database:', error);
        }
        
        return false;
    }
    
    async saveGameToDatabase() {
        const user = this.getCurrentUser();
        if (!this.isOnline || !this.supabaseService || !user) {
            console.log('ℹ️ Skipping database save (offline or no user)');
            return false;
        }
        
        try {
            const success = await this.supabaseService.saveGameData(user.id, this.gameData);
            if (success) {
                console.log('💾 Game saved to database');
            } else {
                console.log('ℹ️ Game saved to localStorage only');
            }
            return success;
        } catch (error) {
            console.warn('Failed to save game to database:', error);
            this.isOnline = false;
            return false;
        }
    }
    
    startAutoSave() {
        // هر 30 ثانیه ذخیره خودکار
        if (this.autoSaveInterval) {
            clearInterval(this.autoSaveInterval);
        }
        
        this.autoSaveInterval = setInterval(async () => {
            const user = this.getCurrentUser();
            if (user) {
                this.saveGameToStorage();
                await this.saveGameToDatabase();
                console.log('⏰ Auto-saved game');
            }
        }, 30000);
        
        console.log('🔄 Auto-save started (30s intervals)');
    }
    
    stopAutoSave() {
        if (this.autoSaveInterval) {
            clearInterval(this.autoSaveInterval);
            this.autoSaveInterval = null;
            console.log('⏹️ Auto-save stopped');
        }
    }
    
    // ========== منطق بازی ==========
    async initialize(userId) {
        console.log('🎮 Initializing game for user:', userId);
        
        // لود از دیتابیس
        await this.loadGameFromDatabase(userId);
        
        // ذخیره اولیه
        this.saveGameToStorage();
        await this.saveGameToDatabase();
        
        console.log('✅ Game initialized');
        return this.gameData;
    }
    
    async manualMine() {
        const user = this.getCurrentUser();
        if (!user) {
            throw new Error('User not logged in');
        }
        
        let earned = this.gameData.miningPower;
        
        // اعمال بوست
        if (this.gameData.boostActive) {
            earned *= 3;
        }
        
        // آپدیت داده‌ها
        this.gameData.sodBalance += earned;
        this.gameData.totalMined += earned;
        this.gameData.todayEarnings += earned;
        this.gameData.usdtProgress += earned;
        this.gameData.lastUpdated = new Date().toISOString();
        
        // ذخیره
        this.saveGameToStorage();
        
        // لاگ تراکنش (با try-catch برای جلوگیری از خطا)
        if (this.supabaseService) {
            try {
                await this.supabaseService.addTransaction(user.id, {
                    type: 'mining',
                    amount: earned,
                    currency: 'SOD',
                    description: 'استخراج دستی'
                });
            } catch (error) {
                console.warn('⚠️ Could not save transaction to database:', error.message);
                // ادامه می‌دهیم حتی اگر تراکنش ذخیره نشد
            }
        }
        
        // بررسی پاداش USDT
        const usdtResult = await this.checkUSDT();
        
        // شانس ارتقاء سطح (کاهش یافته از 0.85 به 0.97)
        if (Math.random() > 0.97) {
            const newLevel = await this.levelUp();
            console.log('⭐ Level up to:', newLevel);
        }
        
        console.log('⛏️ Mined:', earned, 'SOD');
        
        return {
            earned,
            usdtResult,
            gameData: this.gameData
        };
    }
    
    async autoMine() {
        if (!this.gameData.autoMining) return null;
        
        try {
            const result = await this.manualMine();
            return result;
        } catch (error) {
            console.error('❌ Auto mining error:', error);
            return null;
        }
    }
    
    // تابع جدید برای toggle auto mining
    async toggleAutoMining() {
        this.gameData.autoMining = !this.gameData.autoMining;
        
        if (this.gameData.autoMining) {
            console.log('🤖 Auto mining started');
            
            // چک کردن موجودی برای استخراج خودکار
            if (this.gameData.sodBalance < 10000) {
                this.gameData.autoMining = false;
                throw new Error('برای استخراج خودکار حداقل ۱۰,۰۰۰ SOD نیاز دارید.');
            }
            
            // شروع استخراج خودکار
            if (this.autoMineInterval) {
                clearInterval(this.autoMineInterval);
            }
            
            this.autoMineInterval = setInterval(async () => {
                if (!this.gameData.autoMining) {
                    clearInterval(this.autoMineInterval);
                    this.autoMineInterval = null;
                    return;
                }
                
                await this.autoMine();
            }, 3000); // هر 3 ثانیه
            
        } else {
            console.log('⏸️ Auto mining stopped');
            if (this.autoMineInterval) {
                clearInterval(this.autoMineInterval);
                this.autoMineInterval = null;
            }
        }
        
        this.saveGameToStorage();
        return this.gameData.autoMining;
    }
    
    async checkUSDT() {
        if (this.gameData.usdtProgress >= 10000000) {
            const usdtEarned = 0.01;
            
            this.gameData.usdtBalance += usdtEarned;
            this.gameData.usdtProgress -= 10000000;
            this.gameData.lastUpdated = new Date().toISOString();
            
            // ذخیره
            this.saveGameToStorage();
            
            // لاگ تراکنش
            const user = this.getCurrentUser();
            if (user && this.supabaseService) {
                try {
                    await this.supabaseService.addTransaction(user.id, {
                        type: 'usdt_reward',
                        amount: usdtEarned,
                        currency: 'USDT',
                        description: 'پاداش استخراج'
                    });
                } catch (error) {
                    console.warn('⚠️ Could not save USDT transaction:', error.message);
                }
            }
            
            console.log('💰 USDT reward:', usdtEarned);
            
            return {
                usdtEarned,
                levelUp: Math.random() > 0.97
            };
        }
        
        return null;
    }
    
    async levelUp() {
        this.gameData.userLevel++;
        this.gameData.miningPower = 10 * this.gameData.userLevel;
        this.gameData.lastUpdated = new Date().toISOString();
        
        this.saveGameToStorage();
        await this.saveGameToDatabase();
        
        console.log('📈 Level up to:', this.gameData.userLevel);
        
        return this.gameData.userLevel;
    }
    
    async handleBoostMining() {
        if (this.gameData.sodBalance < 5000) {
            throw new Error('Not enough SOD');
        }
        
        this.gameData.sodBalance -= 5000;
        this.gameData.boostActive = true;
        this.gameData.miningPower *= 3;
        this.gameData.lastUpdated = new Date().toISOString();
        
        this.saveGameToStorage();
        await this.saveGameToDatabase();
        
        // لاگ تراکنش
        const user = this.getCurrentUser();
        if (user && this.supabaseService) {
            try {
                await this.supabaseService.addTransaction(user.id, {
                    type: 'boost',
                    amount: -5000,
                    currency: 'SOD',
                    description: 'خرید قدرت استخراج'
                });
            } catch (error) {
                console.warn('⚠️ Could not save boost transaction:', error.message);
            }
        }
        
        // غیرفعال کردن بوست بعد از 30 دقیقه
        setTimeout(() => {
            this.gameData.boostActive = false;
            this.gameData.miningPower = 10 * this.gameData.userLevel;
            this.gameData.lastUpdated = new Date().toISOString();
            this.saveGameToStorage();
            this.saveGameToDatabase();
            console.log('⏰ Boost expired');
        }, 30 * 60 * 1000);
        
        console.log('⚡ Mining power boosted');
        
        return true;
    }
    
    async claimUSDT() {
        if (this.gameData.usdtBalance <= 0) {
            throw new Error('No USDT to claim');
        }
        
        const usdtToClaim = this.gameData.usdtBalance;
        const sodNeeded = usdtToClaim * 1000000000;
        
        if (this.gameData.sodBalance < sodNeeded) {
            throw new Error('Not enough SOD for conversion');
        }
        
        this.gameData.usdtBalance = 0;
        this.gameData.sodBalance -= sodNeeded;
        this.gameData.lastUpdated = new Date().toISOString();
        
        this.saveGameToStorage();
        await this.saveGameToDatabase();
        
        // لاگ تراکنش
        const user = this.getCurrentUser();
        if (user && this.supabaseService) {
            try {
                await this.supabaseService.addTransaction(user.id, {
                    type: 'withdrawal',
                    amount: usdtToClaim,
                    currency: 'USDT',
                    description: 'برداشت USDT'
                });
            } catch (error) {
                console.warn('⚠️ Could not save withdrawal transaction:', error.message);
            }
        }
        
        console.log('💸 USDT claimed:', usdtToClaim);
        
        return usdtToClaim;
    }
    
    // ========== توابع کمکی ==========
    formatNumber(num) {
        if (num >= 1000000000) return (num / 1000000000).toFixed(2) + 'B';
        if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
        if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
        return Math.floor(num).toLocaleString('fa-IR');
    }
    
    // ========== GETTERS ==========
    getGameData() {
        return { ...this.gameData };
    }
    
    getSODBalance() {
        return this.gameData.sodBalance;
    }
    
    getUSDTBalance() {
        return this.gameData.usdtBalance;
    }
    
    getMiningPower() {
        return this.gameData.miningPower;
    }
    
    getUserLevel() {
        return this.gameData.userLevel;
    }
    
    getUSDTProgress() {
        return this.gameData.usdtProgress;
    }
    
    getTodayEarnings() {
        return this.gameData.todayEarnings;
    }
    
    getAutoMiningStatus() {
        return this.gameData.autoMining;
    }
    
    // برای ریست روزانه
    resetDailyEarnings() {
        this.gameData.todayEarnings = 0;
        this.gameData.lastUpdated = new Date().toISOString();
        this.saveGameToStorage();
        console.log('🔄 Daily earnings reset');
    }
    
    // تابع خرید پنل
    async buySODPlan(planId) {
        const user = this.getCurrentUser();
        if (!user) {
            throw new Error('User not logged in');
        }
        
        // دریافت اطلاعات پنل
        let salePlans = [];
        if (this.supabaseService) {
            salePlans = await this.supabaseService.getSalePlans();
        }
        
        // اگر نتوانستیم از دیتابیس بگیریم، از پیش‌فرض استفاده می‌کنیم
        if (!salePlans || salePlans.length === 0) {
            salePlans = [
                { id: 1, name: "پنل استارتر", price: 1, sod_amount: 5000000, discount: 0 },
                { id: 2, name: "پنل پرو", price: 5, sod_amount: 30000000, discount: 10 },
                { id: 3, name: "پنل پلاتینیوم", price: 15, sod_amount: 100000000, discount: 15 },
                { id: 4, name: "پنل الماس", price: 50, sod_amount: 500000000, discount: 20 }
            ];
        }
        
        const plan = salePlans.find(p => p.id === planId);
        if (!plan) {
            throw new Error('Plan not found');
        }
        
        // محاسبه SOD با در نظر گرفتن تخفیف
        const bonusSOD = Math.floor(plan.sod_amount * (plan.discount / 100));
        const totalSOD = plan.sod_amount + bonusSOD;
        
        // آپدیت موجودی (در نسخه واقعی اینجا باید پرداخت انجام شود)
        this.gameData.sodBalance += totalSOD;
        this.gameData.lastUpdated = new Date().toISOString();
        
        this.saveGameToStorage();
        await this.saveGameToDatabase();
        
        // لاگ تراکنش
        if (this.supabaseService) {
            try {
                await this.supabaseService.addTransaction(user.id, {
                    type: 'purchase',
                    amount: totalSOD,
                    currency: 'SOD',
                    description: `خرید پنل ${plan.name || `ID: ${plan.id}`}`
                });
            } catch (error) {
                console.warn('⚠️ Could not save purchase transaction:', error.message);
            }
        }
        
        console.log('🛒 Plan purchased:', totalSOD, 'SOD');
        
        return {
            success: true,
            sodReceived: totalSOD,
            newBalance: this.gameData.sodBalance
        };
    }
}

// ایجاد نمونه global
window.gameService = new GameService();
console.log('✅ Game service instance created');

// Wait for everything to load
setTimeout(() => {
    console.log('🎮 Game service ready');
}, 1500);
