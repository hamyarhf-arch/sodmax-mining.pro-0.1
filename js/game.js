// js/game.js
class GameService {
    constructor() {
        this.supabaseService = window.SupabaseService;
        this.authService = window.AuthService;
        this.gameData = this.loadGameFromStorage();
        this.autoSaveInterval = null;
        this.startAutoSave();
    }
    
    loadGameFromStorage() {
        try {
            const saved = localStorage.getItem('sodmax_game');
            if (saved) {
                const data = JSON.parse(saved);
                console.log('🎮 Loaded game from storage');
                return data;
            }
        } catch (error) {
            console.warn('Failed to load game from storage:', error);
        }
        
        // داده‌های پیش‌فرض
        return {
            sodBalance: 0,
            usdtBalance: 0,
            todayEarnings: 0,
            miningPower: 10,
            userLevel: 1,
            usdtProgress: 0,
            autoMining: false,
            boostActive: false,
            totalMined: 0
        };
    }
    
    saveGameToStorage() {
        try {
            localStorage.setItem('sodmax_game', JSON.stringify(this.gameData));
        } catch (error) {
            console.error('Failed to save game to storage:', error);
        }
    }
    
    async saveGameToDatabase() {
        const userId = this.authService.getUserId();
        if (!userId) return false;
        
        try {
            const success = await this.supabaseService.saveGameData(userId, this.gameData);
            if (success) {
                console.log('💾 Game saved to database');
            }
            return success;
        } catch (error) {
            console.warn('Failed to save game to database:', error);
            return false;
        }
    }
    
    async loadGameFromDatabase() {
        const userId = this.authService.getUserId();
        if (!userId) return false;
        
        try {
            const data = await this.supabaseService.getGameData(userId);
            if (data) {
                this.gameData = {
                    sodBalance: data.sod_balance || 1000000,
                    usdtBalance: data.usdt_balance || 0,
                    todayEarnings: data.today_earnings || 0,
                    miningPower: data.mining_power || 10,
                    userLevel: data.user_level || 1,
                    usdtProgress: data.usdt_progress || 1000000,
                    autoMining: false,
                    boostActive: false,
                    totalMined: data.total_mined || 0
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
    
    startAutoSave() {
        // هر 30 ثانیه ذخیره خودکار
        this.autoSaveInterval = setInterval(() => {
            if (this.authService.isLoggedIn()) {
                this.saveGameToStorage();
                this.saveGameToDatabase();
                console.log('⏰ Auto-saved game');
            }
        }, 30000);
    }
    
    stopAutoSave() {
        if (this.autoSaveInterval) {
            clearInterval(this.autoSaveInterval);
            this.autoSaveInterval = null;
        }
    }
    
    // ========== GAME LOGIC ==========
    async mine() {
        if (!this.authService.isLoggedIn()) {
            throw new Error('User not logged in');
        }
        
        const userId = this.authService.getUserId();
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
        
        // ذخیره
        this.saveGameToStorage();
        await this.saveGameToDatabase();
        
        // لاگ تراکنش
        await this.supabaseService.addTransaction({
            userId: userId,
            type: 'mining',
            amount: earned,
            currency: 'SOD',
            description: 'استخراج دستی'
        });
        
        // بررسی پاداش USDT
        await this.checkUSDT();
        
        // شانس ارتقاء سطح
        if (Math.random() > 0.85) {
            await this.levelUp();
        }
        
        return earned;
    }
    
    async checkUSDT() {
        if (this.gameData.usdtProgress >= 10000000) {
            const usdtEarned = 0.01;
            
            this.gameData.usdtBalance += usdtEarned;
            this.gameData.usdtProgress -= 10000000;
            
            // ذخیره
            this.saveGameToStorage();
            await this.saveGameToDatabase();
            
            // لاگ تراکنش
            const userId = this.authService.getUserId();
            await this.supabaseService.addTransaction({
                userId: userId,
                type: 'usdt_reward',
                amount: usdtEarned,
                currency: 'USDT',
                description: 'پاداش استخراج'
            });
            
            return usdtEarned;
        }
        
        return 0;
    }
    
    async levelUp() {
        this.gameData.userLevel++;
        this.gameData.miningPower = 10 * this.gameData.userLevel;
        
        this.saveGameToStorage();
        await this.saveGameToDatabase();
        
        return this.gameData.userLevel;
    }
    
    async boost() {
        if (this.gameData.sodBalance < 5000) {
            throw new Error('Not enough SOD');
        }
        
        this.gameData.sodBalance -= 5000;
        this.gameData.boostActive = true;
        this.gameData.miningPower *= 3;
        
        this.saveGameToStorage();
        await this.saveGameToDatabase();
        
        // غیرفعال کردن بوست بعد از 30 دقیقه
        setTimeout(() => {
            this.gameData.boostActive = false;
            this.gameData.miningPower = 10 * this.gameData.userLevel;
            this.saveGameToStorage();
            this.saveGameToDatabase();
            console.log('⏰ Boost expired');
        }, 30 * 60 * 1000);
        
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
        
        this.saveGameToStorage();
        await this.saveGameToDatabase();
        
        // لاگ تراکنش
        const userId = this.authService.getUserId();
        await this.supabaseService.addTransaction({
            userId: userId,
            type: 'withdrawal',
            amount: usdtToClaim,
            currency: 'USDT',
            description: 'برداشت USDT'
        });
        
        return usdtToClaim;
    }
    
    // ========== GETTERS ==========
    getGameData() {
        return { ...this.gameData }; // Return copy
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
}

// ایجاد نمونه global
window.GameService = new GameService();
