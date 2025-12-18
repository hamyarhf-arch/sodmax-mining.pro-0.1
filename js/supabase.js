// js/supabase.js
class SupabaseService {
    constructor() {
        this.supabase = null;
        this.initialized = false;
        this.init();
    }
    
    async init() {
        try {
            // بارگذاری کتابخانه Supabase اگر وجود ندارد
            if (!window.supabase) {
                console.error('Supabase library not loaded');
                return;
            }
            
            const SUPABASE_URL = 'https://wxxhulztrxmjqftxcetp.supabase.co';
            const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind4eGh1bHp0cnhtanFmdHhjZXRwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYwNzEwNDcsImV4cCI6MjA4MTY0NzA0N30.iC6Ief8aF-zw66RQRSnLxA-BmAjChQj9xy4HkJpGOA4';
            
            this.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
            this.initialized = true;
            
            console.log('✅ Supabase initialized');
            
            // تست اتصال
            await this.testConnection();
            
        } catch (error) {
            console.error('❌ Failed to initialize Supabase:', error);
        }
    }
    
    async testConnection() {
        if (!this.supabase) return;
        
        try {
            const { count, error } = await this.supabase
                .from('users')
                .select('*', { count: 'exact', head: true });
            
            if (error) {
                console.warn('⚠️ Connection test:', error.message);
            } else {
                console.log(`📊 Database connected. Total users: ${count}`);
            }
        } catch (error) {
            console.warn('⚠️ Connection test failed:', error.message);
        }
    }
    
    // ========== USER OPERATIONS ==========
    async registerUser(userData) {
        if (!this.supabase) {
            throw new Error('Database not connected');
        }
        
        try {
            // بررسی وجود کاربر
            const { data: existingUser } = await this.supabase
                .from('users')
                .select('*')
                .eq('email', userData.email)
                .single();
            
            if (existingUser) {
                return {
                    success: true,
                    data: existingUser,
                    message: 'User already exists'
                };
            }
            
            // ایجاد کاربر جدید
            const userId = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            
            const { data, error } = await this.supabase
                .from('users')
                .insert([{
                    user_id: userId,
                    full_name: userData.fullName,
                    email: userData.email,
                    referral_code: userData.referralCode || '',
                    created_at: new Date().toISOString(),
                    last_login: new Date().toISOString(),
                    is_active: true
                }])
                .select()
                .single();
            
            if (error) throw error;
            
            return {
                success: true,
                data: data,
                userId: userId
            };
            
        } catch (error) {
            console.error('Registration error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    async getUser(userId) {
        if (!this.supabase) return null;
        
        try {
            const { data, error } = await this.supabase
                .from('users')
                .select('*')
                .eq('user_id', userId)
                .single();
            
            if (error) throw error;
            return data;
        } catch (error) {
            console.warn('Get user error:', error.message);
            return null;
        }
    }
    
    async getUserByEmail(email) {
        if (!this.supabase) return null;
        
        try {
            const { data, error } = await this.supabase
                .from('users')
                .select('*')
                .eq('email', email)
                .single();
            
            if (error) throw error;
            return data;
        } catch (error) {
            console.warn('Get user by email error:', error.message);
            return null;
        }
    }
    
    // ========== GAME DATA OPERATIONS ==========
    async saveGameData(userId, gameData) {
        if (!this.supabase) return false;
        
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
            return true;
        } catch (error) {
            console.warn('Save game data error:', error.message);
            return false;
        }
    }
    
    async getGameData(userId) {
        if (!this.supabase) return null;
        
        try {
            const { data, error } = await this.supabase
                .from('game_data')
                .select('*')
                .eq('user_id', userId)
                .single();
            
            if (error) {
                // اگر داده‌ای وجود ندارد، ایجاد کن
                if (error.code === 'PGRST116') {
                    return this.createInitialGameData(userId);
                }
                throw error;
            }
            
            return data;
        } catch (error) {
            console.warn('Get game data error:', error.message);
            return null;
        }
    }
    
    async createInitialGameData(userId) {
        if (!this.supabase) return null;
        
        try {
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
            
            const { data, error } = await this.supabase
                .from('game_data')
                .insert([initialData])
                .select()
                .single();
            
            if (error) throw error;
            return data;
        } catch (error) {
            console.warn('Create game data error:', error.message);
            return null;
        }
    }
    
    // ========== TRANSACTION OPERATIONS ==========
    async addTransaction(transactionData) {
        if (!this.supabase) return false;
        
        try {
            const { error } = await this.supabase
                .from('transactions')
                .insert([{
                    user_id: transactionData.userId,
                    type: transactionData.type || 'mining',
                    amount: transactionData.amount || 0,
                    currency: transactionData.currency || 'SOD',
                    description: transactionData.description || '',
                    created_at: new Date().toISOString()
                }]);
            
            if (error) throw error;
            return true;
        } catch (error) {
            console.warn('Add transaction error:', error.message);
            return false;
        }
    }
    
    async getUserTransactions(userId, limit = 10) {
        if (!this.supabase) return [];
        
        try {
            const { data, error } = await this.supabase
                .from('transactions')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false })
                .limit(limit);
            
            if (error) throw error;
            return data || [];
        } catch (error) {
            console.warn('Get transactions error:', error.message);
            return [];
        }
    }
    
    // ========== SOD PLANS OPERATIONS ==========
    async getSODPlans() {
        if (!this.supabase) {
            // داده‌های پیش‌فرض
            return [
                {
                    id: 1,
                    name: "پنل استارتر",
                    usdt_price: 1,
                    sod_amount: 5000000,
                    features: ["۵,۰۰۰,۰۰۰ SOD", "هدیه ۵۰۰,۰۰۰ SOD اضافی", "قدرت استخراج +۵٪"],
                    is_popular: false,
                    discount: 0
                },
                // ... سایر پنل‌ها
            ];
        }
        
        try {
            const { data, error } = await this.supabase
                .from('sod_plans')
                .select('*')
                .order('usdt_price', { ascending: true });
            
            if (error) throw error;
            return data || [];
        } catch (error) {
            console.warn('Get SOD plans error:', error.message);
            return [];
        }
    }
    
    // ========== UTILITY FUNCTIONS ==========
    isConnected() {
        return this.initialized && this.supabase !== null;
    }
    
    getClient() {
        return this.supabase;
    }
}

// ایجاد نمونه global
window.SupabaseService = new SupabaseService();
