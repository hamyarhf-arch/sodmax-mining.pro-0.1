// js/game.js - نسخه فقط Supabase
class GameService {
    constructor() {
        console.log('🎮 GameService (Supabase-Only) initializing...');
        
        this.gameData = null;
        this.userId = null;
        this.autoMineInterval = null;
        this.boostTimeout = null;
        this.isOnline = true;
        this.lastSaveTime = null;
        this.stateChangeCallbacks = [];
        
        this.init();
    }
    
    // ثابت‌های بازی
    static CONSTANTS = {
        MAX_DAILY_BOOSTS: 3,
        BOOST_DURATION: 30 * 60 * 1000, // 30 دقیقه
        BOOST_MULTIPLIER: 3,
        BOOST_COST: 5000,
        AUTO_SAVE_INTERVAL: 30000, // 30 ثانیه
        AUTO_MINE_INTERVAL: 3000, // 3 ثانیه
        MIN_AUTO_MINING_BALANCE: 10000,
        USDT_THRESHOLD: 10000000,
        BASE_MINING_POWER: 10,
        LEVEL_UP_CHANCE: 0.03, // 3%
        USDT_REWARD: 0.01
    };
    
    async init() {
        console.log('🔄 GameService waiting for Supabase...');
        
        // منتظر Supabase سرویس
        let attempts = 0;
        while (attempts < 20) {
            if (window.supabaseService && window.authService) {
                console.log('✅ Services loaded in GameService');
                break;
            }
            await new Promise(resolve => setTimeout(resolve, 250));
            attempts++;
        }
        
        if (!window.supabaseService) {
            console.error('❌ Supabase service not available');
            this.isOnline = false;
        }
        
        console.log('🎮 GameService ready (Supabase-Only)');
    }
    
    /**
     * مقداردهی اولیه بازی برای کاربر
     * @param {string} userId - شناسه کاربر
     * @returns {Promise<Object|null>} داده‌های بازی
     */
    async initialize(userId) {
        if (!userId) {
            console.error('❌ User ID required for initialization');
            return null;
        }
        
        this.userId = userId;
        console.log('🎮 Initializing game for user:', userId);
        
        try {
            // دریافت وضعیت بازی از دیتابیس
            this.gameData = await window.supabaseService.getGameStateFromDB(userId);
            
            if (!this.gameData) {
                console.log('⚠️ No game data found, using defaults');
                this.gameData = this.getDefaultGameData();
                await this.saveToDatabase(true);
            } else {
                // اعتبارسنجی داده‌های بازی
                this.validateGameData(this.gameData);
            }
            
            // شروع auto-save
            this.startAutoSave();
            
            console.log('✅ Game initialized from Supabase:', {
                sod: this.gameData.sodBalance,
                usdt: this.gameData.usdtBalance,
                level: this.gameData.userLevel
            });
            
            this.emitStateChange(null, this.gameData);
            
            return this.gameData;
            
        } catch (error) {
            console.error('❌ Game initialization error:', error);
            this.gameData = this.getDefaultGameData();
            this.emitStateChange(null, this.gameData);
            return this.gameData;
        }
    }
    
    /**
     * داده‌های پیش‌فرض بازی
     * @returns {Object} داده‌های پیش‌فرض
     */
    getDefaultGameData() {
        return {
            sodBalance: 1000000,
            usdtBalance: 0,
            todayEarnings: 0,
            miningPower: 10,
            userLevel: 1,
            usdtProgress: 0,
            totalMined: 0,
            autoMining: false,
            boostActive: false,
            lastUpdated: new Date().toISOString()
        };
    }
    
    /**
     * استخراج دستی - کاربر با کلیک روی دکمه استخراج، SOD دریافت می‌کند
     * @returns {Promise<Object>} نتیجه استخراج شامل مقدار دریافتی و پاداش USDT
     * @throws {Error} اگر بازی مقداردهی نشده باشد
     */
    async manualMine() {
        if (!this.userId || !this.gameData) {
            throw new Error('بازی مقداردهی نشده است');
        }
        
        try {
            let earned = this.gameData.miningPower;
            
            // اعمال بوست
            if (this.gameData.boostActive) {
                earned *= GameService.CONSTANTS.BOOST_MULTIPLIER;
            }
            
            // آپدیت داده‌های بازی
            const oldState = { ...this.gameData };
            
            this.gameData.sodBalance += earned;
            this.gameData.totalMined += earned;
            this.gameData.todayEarnings += earned;
            this.gameData.usdtProgress += earned;
            this.gameData.lastUpdated = new Date().toISOString();
            
            // ذخیره در دیتابیس
            await this.saveToDatabase();
            
            // ثبت تراکنش
            await window.supabaseService.addTransactionToDB(this.userId, {
                type: 'mining',
                amount: earned,
                currency: 'SOD',
                description: 'استخراج دستی'
            });
            
            // بررسی پاداش USDT
            const usdtReward = await this.checkUSDT();
            
            // شانس ارتقاء سطح
            if (Math.random() < GameService.CONSTANTS.LEVEL_UP_CHANCE) {
                await this.levelUp();
            }
            
            console.log('⛏️ Mined:', earned, 'SOD');
            
            this.emitStateChange(oldState, this.gameData);
            
            return {
                earned,
                usdtReward,
                gameData: { ...this.gameData }
            };
            
        } catch (error) {
            console.error('❌ Mining error:', error);
            throw error;
        }
    }
    
    /**
     * بررسی پاداش USDT - هنگامی که پیشرفت USDT به آستانه مشخصی می‌رسد
     * @returns {Promise<Object|null>} پاداش USDT یا null
     */
    async checkUSDT() {
        if (this.gameData.usdtProgress >= GameService.CONSTANTS.USDT_THRESHOLD) {
            const usdtEarned = GameService.CONSTANTS.USDT_REWARD;
            const oldState = { ...this.gameData };
            
            this.gameData.usdtBalance += usdtEarned;
            this.gameData.usdtProgress -= GameService.CONSTANTS.USDT_THRESHOLD;
            this.gameData.lastUpdated = new Date().toISOString();
            
            // ذخیره در دیتابیس
            await this.saveToDatabase();
            
            // ثبت تراکنش USDT
            await window.supabaseService.addTransactionToDB(this.userId, {
                type: 'usdt_reward',
                amount: usdtEarned,
                currency: 'USDT',
                description: 'پاداش استخراج'
            });
            
            console.log('💰 USDT reward:', usdtEarned);
            
            this.emitStateChange(oldState, this.gameData);
            
            return {
                usdtEarned,
                newBalance: this.gameData.usdtBalance
            };
        }
        
        return null;
    }
    
    /**
     * ارتقاء سطح کاربر
     * @returns {Promise<number>} سطح جدید کاربر
     */
    async levelUp() {
        const oldState = { ...this.gameData };
        
        this.gameData.userLevel++;
        this.gameData.miningPower = GameService.CONSTANTS.BASE_MINING_POWER * this.gameData.userLevel;
        this.gameData.lastUpdated = new Date().toISOString();
        
        await this.saveToDatabase();
        
        console.log('⭐ Level up to:', this.gameData.userLevel);
        
        this.emitStateChange(oldState, this.gameData);
        
        return this.gameData.userLevel;
    }
    
    /**
     * افزایش قدرت استخراج (بوست)
     * @returns {Promise<Object>} نتیجه فعال‌سازی بوست
     * @throws {Error} اگر شرایط فعال‌سازی برقرار نباشد
     */
    async boostMining() {
        try {
            if (!this.userId) {
                throw new Error('کاربر لاگین نشده است');
            }
            
            // بررسی محدودیت بوست
            if (this.gameData.boostActive) {
                throw new Error('در حال حاضر بوست فعال است. لطفاً صبر کنید.');
            }
            
            // بررسی تعداد بوست‌های روزانه
            const today = new Date().toISOString().split('T')[0];
            const boostCountToday = await window.supabaseService.getDailyBoostCount(this.userId, today);
            
            if (boostCountToday >= GameService.CONSTANTS.MAX_DAILY_BOOSTS) {
                throw new Error(`امکان استفاده از بوست بیش از ${GameService.CONSTANTS.MAX_DAILY_BOOSTS} بار در روز وجود ندارد. امروز ${boostCountToday} بار استفاده کرده‌اید.`);
            }
            
            // بررسی هزینه
            if (this.gameData.sodBalance < GameService.CONSTANTS.BOOST_COST) {
                throw new Error(`موجودی SOD کافی نیست (نیاز: ${GameService.CONSTANTS.BOOST_COST.toLocaleString('fa-IR')} SOD)`);
            }
            
            const oldState = { ...this.gameData };
            
            // کسر هزینه
            this.gameData.sodBalance -= GameService.CONSTANTS.BOOST_COST;
            this.gameData.boostActive = true;
            this.gameData.miningPower = GameService.CONSTANTS.BASE_MINING_POWER * this.gameData.userLevel * GameService.CONSTANTS.BOOST_MULTIPLIER;
            this.gameData.lastUpdated = new Date().toISOString();
            
            await this.saveToDatabase();
            
            // ثبت تراکنش
            await window.supabaseService.addTransactionToDB(this.userId, {
                type: 'boost',
                amount: -GameService.CONSTANTS.BOOST_COST,
                currency: 'SOD',
                description: 'خرید قدرت استخراج (۳۰ دقیقه)'
            });
            
            // ثبت استفاده از بوست
            await window.supabaseService.recordBoostUsage(this.userId);
            
            // غیرفعال کردن بوست بعد از 30 دقیقه
            if (this.boostTimeout) {
                clearTimeout(this.boostTimeout);
            }
            
            this.boostTimeout = setTimeout(async () => {
                const timeoutOldState = { ...this.gameData };
                
                this.gameData.boostActive = false;
                this.gameData.miningPower = GameService.CONSTANTS.BASE_MINING_POWER * this.gameData.userLevel;
                this.gameData.lastUpdated = new Date().toISOString();
                await this.saveToDatabase();
                
                // نمایش نوتیفیکیشن
                if (window.uiService && window.uiService.showNotification) {
                    window.uiService.showNotification('⏰', 'زمان بوست به پایان رسید!');
                }
                
                console.log('⏰ Boost expired');
                
                this.emitStateChange(timeoutOldState, this.gameData);
            }, GameService.CONSTANTS.BOOST_DURATION);
            
            console.log('⚡ Mining power boosted 3x for 30 minutes');
            
            this.emitStateChange(oldState, this.gameData);
            
            return {
                success: true,
                duration: 30,
                multiplier: GameService.CONSTANTS.BOOST_MULTIPLIER,
                remainingBoosts: GameService.CONSTANTS.MAX_DAILY_BOOSTS - boostCountToday - 1,
                cost: GameService.CONSTANTS.BOOST_COST,
                newBalance: this.gameData.sodBalance
            };
            
        } catch (error) {
            console.error('❌ boostMining error:', error);
            throw error;
        }
    }
    
    /**
     * دریافت پاداش USDT
     * @returns {Promise<number>} مقدار USDT دریافت شده
     * @throws {Error} اگر پاداش USDT موجود نباشد
     */
    async claimUSDT() {
        if (this.gameData.usdtBalance <= 0) {
            throw new Error('پاداش USDT برای دریافت وجود ندارد');
        }
        
        const usdtToClaim = this.gameData.usdtBalance;
        const oldState = { ...this.gameData };
        
        this.gameData.usdtBalance = 0;
        this.gameData.lastUpdated = new Date().toISOString();
        
        await this.saveToDatabase();
        
        // ثبت تراکنش برداشت
        await window.supabaseService.addTransactionToDB(this.userId, {
            type: 'withdrawal',
            amount: usdtToClaim,
            currency: 'USDT',
            description: 'برداشت پاداش'
        });
        
        console.log('💸 USDT claimed:', usdtToClaim);
        
        this.emitStateChange(oldState, this.gameData);
        
        return usdtToClaim;
    }
    
    /**
     * فعال/غیرفعال کردن استخراج خودکار
     * @returns {Promise<boolean>} وضعیت جدید استخراج خودکار
     * @throws {Error} اگر موجودی کافی نباشد
     */
    async toggleAutoMining() {
        const oldState = { ...this.gameData };
        
        this.gameData.autoMining = !this.gameData.autoMining;
        
        if (this.gameData.autoMining) {
            console.log('🤖 Auto mining started');
            
            // چک کردن موجودی
            if (this.gameData.sodBalance < GameService.CONSTANTS.MIN_AUTO_MINING_BALANCE) {
                this.gameData.autoMining = false;
                throw new Error('برای استخراج خودکار حداقل ۱۰,۰۰۰ SOD نیاز دارید');
            }
            
            // شروع interval استخراج خودکار
            if (this.autoMineInterval) {
                clearInterval(this.autoMineInterval);
            }
            
            this.autoMineInterval = setInterval(async () => {
                if (!this.gameData.autoMining) {
                    clearInterval(this.autoMineInterval);
                    this.autoMineInterval = null;
                    return;
                }
                
                try {
                    await this.manualMine();
                } catch (error) {
                    console.error('❌ Auto mining error:', error);
                    // در صورت خطا، استخراج خودکار متوقف شود
                    this.gameData.autoMining = false;
                    if (this.autoMineInterval) {
                        clearInterval(this.autoMineInterval);
                        this.autoMineInterval = null;
                    }
                    await this.saveToDatabase();
                    this.emitStateChange(oldState, this.gameData);
                }
            }, GameService.CONSTANTS.AUTO_MINE_INTERVAL);
            
        } else {
            console.log('⏸️ Auto mining stopped');
            if (this.autoMineInterval) {
                clearInterval(this.autoMineInterval);
                this.autoMineInterval = null;
            }
        }
        
        await this.saveToDatabase();
        this.emitStateChange(oldState, this.gameData);
        
        return this.gameData.autoMining;
    }
    
    /**
     * خرید پنل SOD
     * @param {string} planId - شناسه پنل
     * @returns {Promise<Object>} نتیجه خرید
     * @throws {Error} اگر پنل یافت نشود یا کاربر لاگین نباشد
     */
    async buySODPlan(planId) {
        if (!this.userId) {
            throw new Error('کاربر لاگین نشده است');
        }
        
        // دریافت اطلاعات پنل
        const salePlans = await window.supabaseService.getSalePlansFromDB();
        const plan = salePlans.find(p => p.id === planId);
        
        if (!plan) {
            throw new Error('پنل مورد نظر یافت نشد');
        }
        
        // محاسبه SOD با تخفیف
        const bonusSOD = Math.floor(plan.sod_amount * (plan.discount / 100));
        const totalSOD = plan.sod_amount + bonusSOD;
        
        const oldState = { ...this.gameData };
        
        // آپدیت موجودی
        this.gameData.sodBalance += totalSOD;
        this.gameData.lastUpdated = new Date().toISOString();
        
        await this.saveToDatabase();
        
        // ثبت تراکنش خرید
        await window.supabaseService.addTransactionToDB(this.userId, {
            type: 'purchase',
            amount: totalSOD,
            currency: 'SOD',
            description: `خرید پنل ${plan.name}`
        });
        
        console.log('🛒 Plan purchased:', totalSOD, 'SOD');
        
        this.emitStateChange(oldState, this.gameData);
        
        return {
            success: true,
            sodReceived: totalSOD,
            planName: plan.name,
            newBalance: this.gameData.sodBalance
        };
    }
    
    /**
     * ذخیره در دیتابیس
     * @param {boolean} force - ذخیره اجباری بدون debounce
     * @returns {Promise<boolean>} موفقیت آمیز بودن ذخیره
     */
    async saveToDatabase(force = false) {
        if (!this.userId || !this.gameData) {
            console.log('⚠️ Cannot save to database: missing user or game data');
            return false;
        }
        
        if (!this.isOnline) {
            // ذخیره در localStorage به صورت موقت
            this.saveToLocalStorage();
            return false;
        }
        
        if (!force) {
            // Debounce: ذخیره فقط اگر 10 ثانیه از آخرین ذخیره گذشته
            const now = Date.now();
            if (this.lastSaveTime && (now - this.lastSaveTime < 10000)) {
                return false;
            }
            this.lastSaveTime = now;
        }
        
        try {
            // اعتبارسنجی داده‌ها قبل از ذخیره
            this.validateGameData(this.gameData);
            
            const success = await window.supabaseService.saveGameStateToDB(
                this.userId, 
                this.gameData
            );
            
            if (success) {
                console.log('💾 Game saved to Supabase');
            } else {
                console.log('⚠️ Failed to save to Supabase');
            }
            
            return success;
        } catch (error) {
            console.error('❌ Save error:', error);
            return false;
        }
    }
    
    /**
     * ذخیره در localStorage (برای حالت offline)
     */
    saveToLocalStorage() {
        try {
            localStorage.setItem(`game_${this.userId}`, JSON.stringify({
                ...this.gameData,
                lastSavedLocally: new Date().toISOString()
            }));
            console.log('💾 Game saved locally');
        } catch (error) {
            console.error('❌ Local storage save error:', error);
        }
    }
    
    /**
     * بازیابی از localStorage (برای حالت offline)
     */
    loadFromLocalStorage() {
        try {
            const saved = localStorage.getItem(`game_${this.userId}`);
            if (saved) {
                this.gameData = JSON.parse(saved);
                console.log('💾 Game loaded from local storage');
                return true;
            }
        } catch (error) {
            console.error('❌ Local storage load error:', error);
        }
        return false;
    }
    
    /**
     * شروع auto-save
     */
    startAutoSave() {
        // هر 30 ثانیه ذخیره خودکار
        setInterval(async () => {
            if (this.userId && this.gameData) {
                await this.saveToDatabase();
                console.log('⏰ Auto-saved game state');
            }
        }, GameService.CONSTANTS.AUTO_SAVE_INTERVAL);
    }
    
    /**
     * توقف همه فعالیت‌ها
     */
    stopAllActivities() {
        if (this.autoMineInterval) {
            clearInterval(this.autoMineInterval);
            this.autoMineInterval = null;
        }
        
        if (this.boostTimeout) {
            clearTimeout(this.boostTimeout);
            this.boostTimeout = null;
        }
        
        // حذف callback‌ها
        this.stateChangeCallbacks = [];
        
        console.log('🛑 All game activities stopped and cleaned up');
    }
    
    /**
     * اعتبارسنجی داده‌های بازی
     * @param {Object} gameData - داده‌های بازی برای اعتبارسنجی
     * @throws {Error} اگر داده‌ها نامعتبر باشند
     */
    validateGameData(gameData) {
        const requiredFields = ['sodBalance', 'usdtBalance', 'userLevel', 'miningPower'];
        
        for (const field of requiredFields) {
            if (gameData[field] === undefined || gameData[field] === null) {
                throw new Error(`فیلد ${field} الزامی است`);
            }
        }
        
        // بررسی مقادیر عددی معقول
        if (gameData.sodBalance < 0 || gameData.sodBalance > 1000000000000) {
            throw new Error('موجودی SOD خارج از محدوده مجاز است');
        }
        
        if (gameData.usdtBalance < 0 || gameData.usdtBalance > 1000000) {
            throw new Error('موجودی USDT خارج از محدوده مجاز است');
        }
        
        if (gameData.userLevel < 1 || gameData.userLevel > 1000) {
            throw new Error('سطح کاربر خارج از محدوده مجاز است');
        }
        
        return true;
    }
    
    /**
     * ثبت listener برای تغییرات state
     * @param {Function} callback - تابع callback
     */
    onStateChange(callback) {
        if (typeof callback === 'function') {
            this.stateChangeCallbacks.push(callback);
        }
    }
    
    /**
     * اطلاع‌رسانی تغییرات state
     * @param {Object|null} oldState - state قبلی
     * @param {Object} newState - state جدید
     */
    emitStateChange(oldState, newState) {
        this.stateChangeCallbacks.forEach(callback => {
            try {
                callback(oldState, newState);
            } catch (error) {
                console.error('❌ State change callback error:', error);
            }
        });
    }
    
    /**
     * آپدیت state بازی
     * @param {Object} updates - تغییرات مورد نظر
     */
    updateGameState(updates) {
        if (!this.gameData) return;
        
        const oldState = { ...this.gameData };
        this.gameData = { ...this.gameData, ...updates, lastUpdated: new Date().toISOString() };
        this.emitStateChange(oldState, this.gameData);
    }
    
    // GETTERS برای UI
    
    getGameData() {
        return this.gameData ? { ...this.gameData } : null;
    }
    
    getSODBalance() {
        return this.gameData?.sodBalance || 0;
    }
    
    getUSDTBalance() {
        return this.gameData?.usdtBalance || 0;
    }
    
    getMiningPower() {
        return this.gameData?.miningPower || 10;
    }
    
    getUserLevel() {
        return this.gameData?.userLevel || 1;
    }
    
    getUSDTProgress() {
        return this.gameData?.usdtProgress || 0;
    }
    
    getTodayEarnings() {
        return this.gameData?.todayEarnings || 0;
    }
    
    isAutoMining() {
        return this.gameData?.autoMining || false;
    }
    
    isBoostActive() {
        return this.gameData?.boostActive || false;
    }
    
    /**
     * فرمت اعداد برای نمایش در UI
     * @param {number} num - عدد ورودی
     * @returns {string} عدد فرمت شده
     */
    formatNumber(num) {
        if (!num && num !== 0) return '0';
        
        if (num >= 1000000000) return (num / 1000000000).toFixed(2) + 'B';
        if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
        if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
        return Math.floor(num).toLocaleString('fa-IR');
    }
}

// ایجاد instance جهانی
window.gameService = new GameService();
console.log('✅ Game Service loaded (Supabase-Only Mode)');
