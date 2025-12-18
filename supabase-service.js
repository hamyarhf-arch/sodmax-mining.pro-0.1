// supabase-service.js
class SupabaseService {
    constructor() {
        // صبر کن تا supabaseClient لود شود
        if (!window.supabaseClient) {
            throw new Error('Supabase client not loaded. Load supabase-config.js first.');
        }
        this.supabase = window.supabaseClient;
    }

    // ========== USER MANAGEMENT ==========
    async registerUser(userData) {
        try {
            const userId = this.generateUserId();
            
            const { data, error } = await this.supabase
                .from('users')
                .insert([{
                    full_name: userData.fullName,
                    email: userData.email,
                    referral_code: userData.referralCode,
                    user_id: userId,
                    created_at: new Date().toISOString(),
                    last_login: new Date().toISOString(),
                    is_active: true
                }])
                .select()
                .single();

            if (error) {
                // اگر کاربر قبلاً ثبت‌نام کرده
                if (error.code === '23505') { // کد خطای duplicate در PostgreSQL
                    const existingUser = await this.getUserByEmail(userData.email);
                    if (existingUser.success) {
                        return { 
                            success: true, 
                            data: existingUser.data,
                            message: 'User already exists' 
                        };
                    }
                }
                throw error;
            }
            
            return { success: true, data, userId };
        } catch (error) {
            console.error('Registration error:', error);
            return { success: false, error: error.message };
        }
    }

    async getUserByEmail(email) {
        try {
            const { data, error } = await this.supabase
                .from('users')
                .select('*')
                .eq('email', email)
                .single();

            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // ========== GAME DATA ==========
    async saveGameData(userId, gameData) {
        try {
            const { error } = await this.supabase
                .from('game_data')
                .upsert({
                    user_id: userId,
                    sod_balance: gameData.sodBalance || 0,
                    usdt_balance: gameData.usdtBalance || 0,
                    today_earnings: gameData.todayEarnings || 0,
                    mining_power: gameData.miningPower || 10,
                    user_level: gameData.userLevel || 1,
                    usdt_progress: gameData.usdtProgress || 0,
                    total_mined: gameData.totalMined || 0,
                    updated_at: new Date().toISOString()
                }, {
                    onConflict: 'user_id'
                });

            if (error) throw error;
            return { success: true };
        } catch (error) {
            console.error('Save game data error:', error);
            return { success: false, error: error.message };
        }
    }

    async loadGameData(userId) {
        try {
            const { data, error } = await this.supabase
                .from('game_data')
                .select('*')
                .eq('user_id', userId)
                .single();

            if (error) {
                // اگر داده‌ای وجود نداشت، رکورد جدید بساز
                if (error.code === 'PGRST116') {
                    const initialData = {
                        user_id: userId,
                        sod_balance: 1000000,
                        usdt_balance: 0,
                        today_earnings: 0,
                        mining_power: 10,
                        user_level: 1,
                        usdt_progress: 1000000,
                        total_mined: 0,
                        updated_at: new Date().toISOString()
                    };
                    
                    const { data: newData, error: insertError } = await this.supabase
                        .from('game_data')
                        .insert([initialData])
                        .select()
                        .single();
                    
                    if (insertError) throw insertError;
                    return { success: true, data: newData };
                }
                throw error;
            }
            return { success: true, data };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // ========== TRANSACTIONS ==========
    async addTransaction(transactionData) {
        try {
            const { data, error } = await this.supabase
                .from('transactions')
                .insert([{
                    user_id: transactionData.userId,
                    type: transactionData.type,
                    amount: transactionData.amount,
                    currency: transactionData.currency,
                    description: transactionData.description,
                    created_at: new Date().toISOString()
                }]);

            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            console.error('Add transaction error:', error);
            return { success: false, error: error.message };
        }
    }

    async getUserTransactions(userId, limit = 10) {
        try {
            const { data, error } = await this.supabase
                .from('transactions')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false })
                .limit(limit);

            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // ========== MINING ACTIVITY ==========
    async logMiningActivity(activityData) {
        try {
            const { data, error } = await this.supabase
                .from('mining_activities')
                .insert([{
                    user_id: activityData.userId,
                    sod_earned: activityData.sodEarned,
                    mining_power: activityData.miningPower,
                    created_at: new Date().toISOString()
                }]);

            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            console.error('Log mining activity error:', error);
            return { success: false, error: error.message };
        }
    }

    // ========== SOD SALE ==========
    async getSODPlans() {
        try {
            const { data, error } = await this.supabase
                .from('sod_plans')
                .select('*')
                .order('usdt_price', { ascending: true });

            if (error) {
                // اگر جدول وجود ندارد، داده‌های اولیه برگردان
                console.warn('sod_plans table not found, using default data');
                return { 
                    success: true, 
                    data: [
                        {
                            id: 1,
                            name: "پنل استارتر",
                            usdt_price: 1,
                            sod_amount: 5000000,
                            features: ["۵,۰۰۰,۰۰۰ SOD", "هدیه ۵۰۰,۰۰۰ SOD اضافی", "قدرت استخراج +۵٪"],
                            is_popular: false,
                            discount: 0
                        },
                        {
                            id: 2,
                            name: "پنل پرو",
                            usdt_price: 5,
                            sod_amount: 30000000,
                            features: ["۳۰,۰۰۰,۰۰۰ SOD", "هدیه ۳,۰۰۰,۰۰۰ SOD اضافی", "قدرت استخراج +۱۵٪"],
                            is_popular: true,
                            discount: 10
                        },
                        {
                            id: 3,
                            name: "پنل پلاتینیوم",
                            usdt_price: 15,
                            sod_amount: 100000000,
                            features: ["۱۰۰,۰۰۰,۰۰۰ SOD", "هدیه ۱۰,۰۰۰,۰۰۰ SOD اضافی", "قدرت استخراج +۳۰٪"],
                            is_popular: false,
                            discount: 15
                        },
                        {
                            id: 4,
                            name: "پنل الماس",
                            usdt_price: 50,
                            sod_amount: 500000000,
                            features: ["۵۰۰,۰۰۰,۰۰۰ SOD", "هدیه ۵۰,۰۰۰,۰۰۰ SOD اضافی", "قدرت استخراج +۵۰٪"],
                            is_popular: false,
                            discount: 20
                        }
                    ] 
                };
            }
            return { success: true, data };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async processSODPurchase(purchaseData) {
        try {
            const { data, error } = await this.supabase
                .from('purchases')
                .insert([{
                    user_id: purchaseData.userId,
                    plan_id: purchaseData.planId,
                    usdt_paid: purchaseData.usdtPaid || 0,
                    sod_received: purchaseData.sodReceived,
                    created_at: new Date().toISOString()
                }]);

            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            console.error('Purchase error:', error);
            return { success: false, error: error.message };
        }
    }

    // ========== UTILITY FUNCTIONS ==========
    generateUserId() {
        return 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    formatDate(date) {
        return new Date(date).toLocaleDateString('fa-IR');
    }
}

// ایجاد نمونه از سرویس فقط اگر قبلاً ایجاد نشده
if (!window.supabaseService) {
    try {
        window.supabaseService = new SupabaseService();
        console.log('✅ SupabaseService initialized successfully');
    } catch (error) {
        console.error('❌ Failed to initialize SupabaseService:', error);
    }
}
