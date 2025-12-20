// js/game.js - نسخه فقط Supabase
class GameService {
    constructor() {
        console.log('🎮 GameService (Supabase-Only) initializing...');
        
        this.gameData = null;
        this.userId = null;
        this.autoMineInterval = null;
        this.boostTimeout = null;
        this.isOnline = true;
        
        this.init();
    }
    
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
    
    // 1. مقداردهی اولیه بازی برای کاربر
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
                await this.saveToDatabase();
            }
            
            // شروع auto-save (هر 30 ثانیه)
            this.startAutoSave();
            
            console.log('✅ Game initialized from Supabase:', {
                sod: this.gameData.sodBalance,
                usdt: this.gameData.usdtBalance,
                level: this.gameData.userLevel
            });
            
            return this.gameData;
            
        } catch (error) {
            console.error('❌ Game initialization error:', error);
            this.gameData = this.getDefaultGameData();
            return this.gameData;
        }
    }
    
    // 2. داده‌های پیش‌فرض بازی
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
    
    // 3. استخراج دستی
    async manualMine() {
        if (!this.userId || !this.gameData) {
            throw new Error('بازی مقداردهی نشده است');
        }
        
        try {
            let earned = this.gameData.miningPower;
            
            // اعمال بوست
            if (this.gameData.boostActive) {
                earned *= 3;
            }
            
            // آپدیت داده‌های بازی
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
            
            // شانس ارتقاء سطح (3%)
            if (Math.random() < 0.03) {
                await this.levelUp();
            }
            
            console.log('⛏️ Mined:', earned, 'SOD');
            
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
    
    // 4. بررسی پاداش USDT
    async checkUSDT() {
        if (this.gameData.usdtProgress >= 10000000) {
            const usdtEarned = 0.01;
            
            this.gameData.usdtBalance += usdtEarned;
            this.gameData.usdtProgress -= 10000000;
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
            
            return {
                usdtEarned,
                newBalance: this.gameData.usdtBalance
            };
        }
        
        return null;
    }
    
    // 5. ارتقاء سطح
    async levelUp() {
        this.gameData.userLevel++;
        this.gameData.miningPower = 10 * this.gameData.userLevel;
        this.gameData.lastUpdated = new Date().toISOString();
        
        await this.saveToDatabase();
        
        console.log('⭐ Level up to:', this.gameData.userLevel);
        
        return this.gameData.userLevel;
    }
    
  // 6. افزایش قدرت استخراج - نسخه اصلاح شده
async boostMining() {
    // بررسی محدودیت بوست
    if (this.gameData.boostActive) {
        throw new Error('در حال حاضر بوست فعال است. لطفاً صبر کنید.');
    }
    
    // بررسی تعداد بوست‌های روزانه
    const today = new Date().toISOString().split('T')[0];
    const boostCountToday = await window.supabaseService.getDailyBoostCount(this.userId, today);
    
    const maxDailyBoosts = 3; // حداکثر 3 بوست در روز
    if (boostCountToday >= maxDailyBoosts) {
        throw new Error(`امکان استفاده از بوست بیش از ${maxDailyBoosts} بار در روز وجود ندارد`);
    }
    
    // بررسی هزینه
    const boostCost = 5000; // هزینه ثابت
    if (this.gameData.sodBalance < boostCost) {
        throw new Error(`موجودی SOD کافی نیست (نیاز: ${boostCost.toLocaleString()} SOD)`);
    }
    
    // کسر هزینه
    this.gameData.sodBalance -= boostCost;
    this.gameData.boostActive = true;
    this.gameData.miningPower = 10 * this.gameData.userLevel * 3; // افزایش ۳ برابری
    this.gameData.lastUpdated = new Date().toISOString();
    
    await this.saveToDatabase();
    
    // ثبت تراکنش
    await window.supabaseService.addTransactionToDB(this.userId, {
        type: 'boost',
        amount: -boostCost,
        currency: 'SOD',
        description: 'خرید قدرت استخراج'
    });
    
    // ثبت استفاده از بوست
    await window.supabaseService.recordBoostUsage(this.userId);
    
    // غیرفعال کردن بوست بعد از 30 دقیقه
    if (this.boostTimeout) {
        clearTimeout(this.boostTimeout);
    }
    
    this.boostTimeout = setTimeout(async () => {
        this.gameData.boostActive = false;
        this.gameData.miningPower = 10 * this.gameData.userLevel; // بازگشت به حالت عادی
        this.gameData.lastUpdated = new Date().toISOString();
        await this.saveToDatabase();
        console.log('⏰ Boost expired');
    }, 30 * 60 * 1000); // 30 دقیقه
    
    console.log('⚡ Mining power boosted 3x for 30 minutes');
    
    return {
        success: true,
        duration: 30,
        multiplier: 3,
        remainingBoosts: maxDailyBoosts - boostCountToday - 1
    };
}
    
    // 7. دریافت پاداش USDT
    async claimUSDT() {
        if (this.gameData.usdtBalance <= 0) {
            throw new Error('پاداش USDT برای دریافت وجود ندارد');
        }
        
        const usdtToClaim = this.gameData.usdtBalance;
        
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
        
        return usdtToClaim;
    }
    
    // 8. استخراج خودکار
    async toggleAutoMining() {
        this.gameData.autoMining = !this.gameData.autoMining;
        
        if (this.gameData.autoMining) {
            console.log('🤖 Auto mining started');
            
            // چک کردن موجودی
            if (this.gameData.sodBalance < 10000) {
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
                }
            }, 3000); // هر 3 ثانیه
            
        } else {
            console.log('⏸️ Auto mining stopped');
            if (this.autoMineInterval) {
                clearInterval(this.autoMineInterval);
                this.autoMineInterval = null;
            }
        }
        
        await this.saveToDatabase();
        return this.gameData.autoMining;
    }
    
    // 9. خرید پنل SOD
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
        
        return {
            success: true,
            sodReceived: totalSOD,
            planName: plan.name,
            newBalance: this.gameData.sodBalance
        };
    }
    
    // 10. ذخیره در دیتابیس
    async saveToDatabase() {
        if (!this.userId || !this.gameData || !this.isOnline) {
            console.log('⚠️ Cannot save to database');
            return false;
        }
        
        try {
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
    
    // 11. auto-save
    startAutoSave() {
        // هر 30 ثانیه ذخیره خودکار
        setInterval(async () => {
            if (this.userId && this.gameData) {
                await this.saveToDatabase();
                console.log('⏰ Auto-saved game state');
            }
        }, 30000);
    }
    
    // 12. توقف همه فعالیت‌ها
    stopAllActivities() {
        if (this.autoMineInterval) {
            clearInterval(this.autoMineInterval);
            this.autoMineInterval = null;
        }
        
        if (this.boostTimeout) {
            clearTimeout(this.boostTimeout);
            this.boostTimeout = null;
        }
        
        console.log('🛑 All game activities stopped');
    }
    
    // 13. GETTERS برای UI
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
    
    // 14. فرمت اعداد
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
