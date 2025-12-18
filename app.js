// app.js
class SODmAXApp {
    constructor() {
        this.supabaseService = window.supabaseService;
        this.gameData = {
            sodBalance: 0,
            usdtBalance: 0,
            todayEarnings: 0,
            miningPower: 10,
            userLevel: 1,
            usdtProgress: 0,
            autoMining: false,
            boostActive: false,
            totalMined: 0,
            userId: null
        };
        
        this.userData = {
            isRegistered: false,
            fullName: "",
            email: "",
            userId: null,
            referralCode: ""
        };
        
        this.init();
    }

    async init() {
        this.bindEvents();
        
        // بررسی لاگین قبلی
        const savedUser = localStorage.getItem('sodmax_user');
        if (savedUser) {
            this.userData = JSON.parse(savedUser);
            
            // بارگذاری داده‌های بازی از Supabase
            await this.loadUserGameData();
            
            this.hideRegister();
            this.startGame();
        } else {
            this.showRegister();
        }
    }

    bindEvents() {
        // ثبت نام
        document.getElementById('registerForm')?.addEventListener('submit', (e) => this.handleRegistration(e));
        
        // کلیک استخراج
        document.getElementById('minerCore')?.addEventListener('click', () => this.manualMine());
        
        // دریافت پاداش
        document.getElementById('claimUSDTBtn')?.addEventListener('click', () => this.claimUSDT());
        
        // استخراج خودکار
        document.getElementById('autoMineBtn')?.addEventListener('click', () => this.toggleAutoMining());
        
        // خرید SOD
        document.addEventListener('click', (e) => {
            if (e.target.closest('[data-plan-id]')) {
                const planId = e.target.closest('[data-plan-id]').getAttribute('data-plan-id');
                this.buySODPlan(parseInt(planId));
            }
        });
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
        
        // ثبت کاربر در Supabase
        const result = await this.supabaseService.registerUser({
            fullName,
            email,
            referralCode
        });
        
        if (!result.success) {
            this.showNotification('❌', 'خطا در ثبت نام: ' + result.error);
            return;
        }
        
        // ذخیره اطلاعات کاربر
        this.userData = {
            isRegistered: true,
            fullName,
            email,
            userId: result.data.user_id,
            referralCode
        };
        
        // ذخیره در localStorage
        localStorage.setItem('sodmax_user', JSON.stringify(this.userData));
        
        // تنظیم داده‌های اولیه بازی
        this.gameData = {
            sodBalance: 1000000,
            usdtBalance: 0,
            todayEarnings: 0,
            miningPower: 10,
            userLevel: 1,
            usdtProgress: 1000000,
            autoMining: false,
            boostActive: false,
            totalMined: 0,
            userId: this.userData.userId
        };
        
        // ذخیره در Supabase
        await this.supabaseService.saveGameData(this.userData.userId, this.gameData);
        
        // لاگ تراکنش
        await this.supabaseService.addTransaction({
            userId: this.userData.userId,
            type: 'bonus',
            amount: 1000000,
            currency: 'SOD',
            description: 'سکه هدیه ثبت نام'
        });
        
        this.showNotification('✅', `ثبت نام موفق! خوش آمدید ${fullName}!`);
        
        setTimeout(() => {
            this.hideRegister();
            this.startGame();
        }, 1500);
    }

    async manualMine() {
        if (!this.userData.isRegistered) {
            this.showNotification('❌', 'ابتدا ثبت نام کنید');
            return;
        }
        
        let earned = this.gameData.miningPower;
        if (this.gameData.boostActive) earned *= 3;
        
        // آپدیت داده‌ها
        this.gameData.sodBalance += earned;
        this.gameData.totalMined += earned;
        this.gameData.todayEarnings += earned;
        this.gameData.usdtProgress += earned;
        
        // ذخیره در Supabase
        await this.supabaseService.saveGameData(this.userData.userId, this.gameData);
        
        // لاگ فعالیت استخراج
        await this.supabaseService.logMiningActivity({
            userId: this.userData.userId,
            sodEarned: earned,
            miningPower: this.gameData.miningPower
        });
        
        // آپدیت UI
        this.updateUI();
        
        // بررسی پاداش USDT
        this.checkUSDT();
    }

    async checkUSDT() {
        if (this.gameData.usdtProgress >= 10000000) {
            const usdtEarned = 0.01;
            
            this.gameData.usdtBalance += usdtEarned;
            this.gameData.usdtProgress -= 10000000;
            
            // ذخیره تغییرات
            await this.supabaseService.saveGameData(this.userData.userId, this.gameData);
            
            // لاگ تراکنش
            await this.supabaseService.addTransaction({
                userId: this.userData.userId,
                type: 'usdt_reward',
                amount: usdtEarned,
                currency: 'USDT',
                description: 'پاداش استخراج'
            });
            
            this.showNotification('🎉', `${usdtEarned.toFixed(4)} USDT دریافت کردید!`);
            
            // شانس ارتقاء سطح
            if (Math.random() > 0.85) {
                this.gameData.userLevel++;
                this.gameData.miningPower = 10 * this.gameData.userLevel;
                this.showNotification('⭐', `سطح شما به ${this.gameData.userLevel} ارتقاء یافت!`);
                
                // ذخیره سطح جدید
                await this.supabaseService.saveGameData(this.userData.userId, this.gameData);
            }
        }
    }

    async buySODPlan(planId) {
        if (!this.userData.isRegistered) {
            this.showNotification('❌', 'ابتدا ثبت نام کنید');
            return;
        }
        
        // دریافت پنل‌ها
        const result = await this.supabaseService.getSODPlans();
        if (!result.success) {
            this.showNotification('❌', 'خطا در دریافت پنل‌ها');
            return;
        }
        
        const plan = result.data.find(p => p.id === planId);
        if (!plan) return;
        
        // در اینجا باید پرداخت واقعی انجام شود
        const bonusSOD = Math.floor(plan.sod_amount * (plan.discount / 100));
        const totalSOD = plan.sod_amount + bonusSOD;
        
        this.gameData.sodBalance += totalSOD;
        
        // ذخیره خرید
        await this.supabaseService.processSODPurchase({
            userId: this.userData.userId,
            planId: plan.id,
            usdtPaid: plan.usdt_price,
            sodReceived: totalSOD
        });
        
        // ذخیره داده‌های بازی
        await this.supabaseService.saveGameData(this.userData.userId, this.gameData);
        
        // لاگ تراکنش
        await this.supabaseService.addTransaction({
            userId: this.userData.userId,
            type: 'purchase',
            amount: totalSOD,
            currency: 'SOD',
            description: `خراید پنل ${plan.name}`
        });
        
        this.showNotification('🎉', `پنل ${plan.name} خریداری شد! ${this.formatNumber(totalSOD)} SOD دریافت کردید.`);
        this.updateUI();
    }

    async claimUSDT() {
        if (this.gameData.usdtBalance > 0) {
            const usdtToClaim = this.gameData.usdtBalance;
            const sodNeeded = usdtToClaim * 1000000000;
            
            if (this.gameData.sodBalance >= sodNeeded) {
                if (confirm(`آیا مایل به دریافت ${usdtToClaim.toFixed(4)} USDT هستید؟\n${this.formatNumber(sodNeeded)} SOD از موجودی کسر خواهد شد.`)) {
                    this.gameData.usdtBalance = 0;
                    this.gameData.sodBalance -= sodNeeded;
                    
                    // ذخیره تغییرات
                    await this.supabaseService.saveGameData(this.userData.userId, this.gameData);
                    
                    // لاگ تراکنش
                    await this.supabaseService.addTransaction({
                        userId: this.userData.userId,
                        type: 'withdrawal',
                        amount: usdtToClaim,
                        currency: 'USDT',
                        description: 'برداشت USDT'
                    });
                    
                    this.showNotification('✅', `${usdtToClaim.toFixed(4)} USDT دریافت شد.`);
                    this.updateUI();
                }
            } else {
                this.showNotification('⚠️', `موجودی SOD کافی نیست. نیاز: ${this.formatNumber(sodNeeded)} SOD`);
            }
        } else {
            this.showNotification('💰', 'هنوز USDT پاداش دریافت نکرده‌اید.');
        }
    }

    async loadUserGameData() {
        if (!this.userData.userId) return;
        
        const result = await this.supabaseService.loadGameData(this.userData.userId);
        if (result.success && result.data) {
            this.gameData = {
                sodBalance: result.data.sod_balance || 0,
                usdtBalance: result.data.usdt_balance || 0,
                todayEarnings: result.data.today_earnings || 0,
                miningPower: result.data.mining_power || 10,
                userLevel: result.data.user_level || 1,
                usdtProgress: result.data.usdt_progress || 0,
                autoMining: false,
                boostActive: false,
                totalMined: result.data.total_mined || 0,
                userId: this.userData.userId
            };
        }
    }

    // سایر توابع UI مانند updateUI، showNotification و ...
    // (کدهای UI مشابه قبلی)

    formatNumber(num) {
        if (num >= 1000000000) return (num / 1000000000).toFixed(2) + 'B';
        if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
        if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
        return Math.floor(num).toLocaleString('fa-IR');
    }

    showNotification(title, message) {
        // کد نمایش نوتیفیکیشن مشابه قبل
    }

    updateUI() {
        // کد آپدیت UI مشابه قبل
    }
}

// شروع برنامه
window.addEventListener('DOMContentLoaded', () => {
    window.sodmaxApp = new SODmAXApp();
});
