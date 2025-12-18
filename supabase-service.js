// supabase-service.js
class SupabaseService {
    constructor() {
        this.supabase = window.supabaseClient;
    }

    // ========== USER MANAGEMENT ==========
    async registerUser(userData) {
        try {
            const { data, error } = await this.supabase
                .from('users')
                .insert([{
                    full_name: userData.fullName,
                    email: userData.email,
                    referral_code: userData.referralCode,
                    user_id: this.generateUserId(),
                    created_at: new Date().toISOString(),
                    last_login: new Date().toISOString(),
                    is_active: true
                }])
                .select()
                .single();

            if (error) throw error;
            return { success: true, data };
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
            const { data, error } = await this.supabase
                .from('game_data')
                .upsert({
                    user_id: userId,
                    sod_balance: gameData.sodBalance,
                    usdt_balance: gameData.usdtBalance,
                    today_earnings: gameData.todayEarnings,
                    mining_power: gameData.miningPower,
                    user_level: gameData.userLevel,
                    usdt_progress: gameData.usdtProgress,
                    total_mined: gameData.totalMined,
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

            if (error) throw error;
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

            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async processSODPurchase(purchaseData) {
        try {
            // ذخیره خرید
            const { data, error } = await this.supabase
                .from('purchases')
                .insert([{
                    user_id: purchaseData.userId,
                    plan_id: purchaseData.planId,
                    usdt_paid: purchaseData.usdtPaid,
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

// ایجاد نمونه از سرویس
window.supabaseService = new SupabaseService();
