// js/supabase.js - نسخه ساده شده

// فقط اگر قبلاً لود نشده
if (!window.supabaseClient) {
    const SUPABASE_URL = 'https://wxxhulztrxmjqftxcetp.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind4eGh1bHp0cnhtanFmdHhjZXRwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYwNzEwNDcsImV4cCI6MjA4MTY0NzA0N30.iC6Ief8aF-zw66RQRSnLxA-BmAjChQj9xy4HkJpGOA4';
    
    window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    console.log('✅ Supabase client initialized');
}

// ============ سرویس اصلی (همون نسخه قبلی) ============
if (!window.supabaseService) {
    window.supabaseService = {
        // توابع کاربران
        async getUserByEmail(email) {
            try {
                const { data, error } = await window.supabaseClient
                    .from('users')
                    .select('*')
                    .eq('email', email)
                    .maybeSingle();
                
                if (error) {
                    console.error('❌ Error getting user by email:', error);
                    return null;
                }
                
                return data;
            } catch (error) {
                console.error('🚨 Exception:', error);
                return null;
            }
        },

        async getUserById(userId) {
            try {
                const { data, error } = await window.supabaseClient
                    .from('users')
                    .select('*')
                    .eq('id', userId)
                    .maybeSingle();
                    
                if (error) {
                    console.error('❌ Error getting user by ID:', error);
                    return null;
                }
                
                return data;
            } catch (error) {
                console.error('🚨 Exception:', error);
                return null;
            }
        },

        async createUser(userData) {
            try {
                const existingUser = await this.getUserByEmail(userData.email);
                if (existingUser) return existingUser;
                
                const newUser = {
                    id: userData.id,
                    email: userData.email,
                    full_name: userData.fullName || userData.email.split('@')[0],
                    referral_code: userData.referralCode || '',
                    level: 1,
                    sod_balance: 1000000,
                    usdt_balance: 0,
                    mining_power: 10,
                    total_mined: 0,
                    usdt_progress: 1000000,
                    last_login: new Date().toISOString()
                };
                
                const { data, error } = await window.supabaseClient
                    .from('users')
                    .insert([newUser])
                    .select()
                    .single();
                
                if (error) {
                    console.error('❌ Error creating user:', error);
                    return null;
                }
                
                console.log('✅ User created successfully');
                return data;
            } catch (error) {
                console.error('🚨 Exception:', error);
                return null;
            }
        },

        // توابع بازی
        async getGameData(userId) {
            try {
                const userData = await this.getUserById(userId);
                
                if (userData) {
                    return {
                        sodBalance: userData.sod_balance || 1000000,
                        usdtBalance: Number(userData.usdt_balance) || 0,
                        todayEarnings: 0,
                        miningPower: userData.mining_power || 10,
                        userLevel: userData.level || 1,
                        usdtProgress: userData.usdt_progress || 1000000,
                        totalMined: userData.total_mined || 0
                    };
                }
                
                return {
                    sodBalance: 1000000,
                    usdtBalance: 0,
                    todayEarnings: 0,
                    miningPower: 10,
                    userLevel: 1,
                    usdtProgress: 1000000,
                    totalMined: 0
                };
            } catch (error) {
                console.error('🚨 Exception:', error);
                return {
                    sodBalance: 1000000,
                    usdtBalance: 0,
                    todayEarnings: 0,
                    miningPower: 10,
                    userLevel: 1,
                    usdtProgress: 1000000,
                    totalMined: 0
                };
            }
        },

        async saveGameData(userId, gameData) {
            try {
                localStorage.setItem(`sodmax_game_${userId}`, JSON.stringify(gameData));
                
                const updateData = {
                    sod_balance: gameData.sodBalance,
                    usdt_balance: gameData.usdtBalance,
                    mining_power: gameData.miningPower,
                    level: gameData.userLevel,
                    usdt_progress: gameData.usdtProgress,
                    total_mined: gameData.totalMined,
                    last_updated: new Date().toISOString()
                };
                
                const { error } = await window.supabaseClient
                    .from('users')
                    .update(updateData)
                    .eq('id', userId);
                
                if (error) {
                    console.warn('⚠️ Database update failed:', error.message);
                    return false;
                }
                
                return true;
            } catch (error) {
                console.error('🚨 Exception:', error);
                return false;
            }
        },

        // توابع تراکنش‌ها
        async addTransaction(userId, transaction) {
            try {
                const { error } = await window.supabaseClient
                    .from('transactions')
                    .insert([{
                        user_id: userId,
                        type: transaction.type,
                        amount: transaction.amount,
                        currency: transaction.currency,
                        description: transaction.description || ''
                    }]);
                
                if (error) {
                    console.warn('⚠️ Could not save transaction:', error.message);
                    return false;
                }
                
                return true;
            } catch (error) {
                console.error('🚨 Exception:', error);
                return false;
            }
        },

        async getTransactions(userId, limit = 20) {
            try {
                const { data, error } = await window.supabaseClient
                    .from('transactions')
                    .select('*')
                    .eq('user_id', userId)
                    .order('created_at', { ascending: false })
                    .limit(limit);
                
                if (error) {
                    console.warn('⚠️ Could not get transactions:', error.message);
                    return [];
                }
                
                return data || [];
            } catch (error) {
                console.error('🚨 Exception:', error);
                return [];
            }
        },

        // توابع پنل‌های فروش
        async getSalePlans() {
            try {
                const { data, error } = await window.supabaseClient
                    .from('sale_plans')
                    .select('*')
                    .order('price', { ascending: true });
                
                if (error) {
                    console.warn('⚠️ Could not get sale plans:', error.message);
                    return this.getDefaultSalePlans();
                }
                
                return data || this.getDefaultSalePlans();
            } catch (error) {
                console.error('🚨 Exception:', error);
                return this.getDefaultSalePlans();
            }
        },

        getDefaultSalePlans() {
            return [
                { id: 1, name: "پنل استارتر", price: 1, sod_amount: 5000000, discount: 0 },
                { id: 2, name: "پنل پرو", price: 5, sod_amount: 30000000, discount: 10 },
                { id: 3, name: "پنل پلاتینیوم", price: 15, sod_amount: 100000000, discount: 15 },
                { id: 4, name: "پنل الماس", price: 50, sod_amount: 500000000, discount: 20 }
            ];
        },

        // ============ توابع ادمین (اضافه شده) ============
        
        // تنظیمات بازی
        async getGameSettings() {
            try {
                const { data, error } = await window.supabaseClient
                    .from('game_settings')
                    .select('*');
                
                if (error) {
                    console.error('❌ Error getting game settings:', error);
                    return {};
                }
                
                const settings = {};
                if (data) {
                    data.forEach(setting => {
                        settings[setting.setting_key] = {
                            value: setting.setting_value,
                            description: setting.description
                        };
                    });
                }
                
                return settings;
            } catch (error) {
                console.error('🚨 Exception:', error);
                return {};
            }
        },

        async updateGameSetting(key, value) {
            try {
                const { error } = await window.supabaseClient
                    .from('game_settings')
                    .update({ 
                        setting_value: value,
                        updated_at: new Date().toISOString()
                    })
                    .eq('setting_key', key);
                
                if (error) {
                    console.error('❌ Error updating setting:', error);
                    return false;
                }
                
                return true;
            } catch (error) {
                console.error('🚨 Exception:', error);
                return false;
            }
        },

        // مأموریت‌ها
        async getMissions() {
            try {
                const { data, error } = await window.supabaseClient
                    .from('missions')
                    .select('*')
                    .order('order_index');
                
                if (error) {
                    console.error('❌ Error getting missions:', error);
                    return [];
                }
                
                return data || [];
            } catch (error) {
                console.error('🚨 Exception:', error);
                return [];
            }
        },

        // مدیریت کاربران
        async getAllUsers(limit = 100, offset = 0) {
            try {
                const { data, error } = await window.supabaseClient
                    .from('users')
                    .select('*')
                    .order('created_at', { ascending: false })
                    .range(offset, offset + limit - 1);
                
                if (error) {
                    console.error('❌ Error getting all users:', error);
                    return [];
                }
                
                return data || [];
            } catch (error) {
                console.error('🚨 Exception:', error);
                return [];
            }
        },

        async getUserCount() {
            try {
                const { count, error } = await window.supabaseClient
                    .from('users')
                    .select('*', { count: 'exact', head: true });
                
                if (error) {
                    console.error('❌ Error getting user count:', error);
                    return 0;
                }
                
                return count || 0;
            } catch (error) {
                console.error('🚨 Exception:', error);
                return 0;
            }
        },

        async updateUserData(userId, userData) {
            try {
                const { error } = await window.supabaseClient
                    .from('users')
                    .update(userData)
                    .eq('id', userId);
                
                if (error) {
                    console.error('❌ Error updating user data:', error);
                    return false;
                }
                
                return true;
            } catch (error) {
                console.error('🚨 Exception:', error);
                return false;
            }
        },

        // تست اتصال
        async checkDatabaseConnection() {
            try {
                const { data, error } = await window.supabaseClient
                    .from('sale_plans')
                    .select('id')
                    .limit(1);
                
                if (error) {
                    console.error('❌ Database connection test failed:', error.message);
                    return {
                        connected: false,
                        message: error.message
                    };
                }
                
                return {
                    connected: true,
                    message: 'Connected to Supabase'
                };
            } catch (error) {
                console.error('🚨 Exception:', error);
                return {
                    connected: false,
                    message: error.message
                };
            }
        }
    };
    
    console.log('✅ Supabase service loaded successfully');
}
