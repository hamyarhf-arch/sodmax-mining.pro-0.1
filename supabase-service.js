// supabase-service.js - نسخه ساده شده
(function() {
    // صبر کن تا supabase لود شود
    const initService = () => {
        if (!window.supabaseClient) {
            console.log('⏳ Waiting for Supabase client...');
            setTimeout(initService, 100);
            return;
        }
        
        class SupabaseService {
            constructor() {
                this.supabase = window.supabaseClient;
                console.log('✅ SupabaseService initialized');
            }
            
            // ========== کاربران ==========
            async registerUser(userData) {
                try {
                    console.log('📝 Registering user:', userData.email);
                    
                    // بررسی وجود کاربر
                    const { data: existingUser } = await this.supabase
                        .from('users')
                        .select('*')
                        .eq('email', userData.email)
                        .single();
                    
                    if (existingUser) {
                        console.log('👤 User already exists:', existingUser);
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
                    
                    if (error) {
                        console.error('❌ Registration error:', error);
                        return { success: false, error: error.message };
                    }
                    
                    console.log('✅ User registered:', data);
                    
                    // ایجاد رکورد game_data
                    await this.createInitialGameData(userId);
                    
                    return {
                        success: true,
                        data: data,
                        userId: userId
                    };
                    
                } catch (error) {
                    console.error('❌ Registration error:', error);
                    return { success: false, error: error.message };
                }
            }
            
            async createInitialGameData(userId) {
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
                    
                    const { error } = await this.supabase
                        .from('game_data')
                        .insert([initialData]);
                    
                    if (error) {
                        console.warn('⚠️ Could not create game data:', error.message);
                        // اگر جدول وجود ندارد، این خطا می‌دهد - مشکلی نیست
                    } else {
                        console.log('✅ Initial game data created for user:', userId);
                    }
                    
                } catch (error) {
                    console.warn('⚠️ Game data creation warning:', error.message);
                }
            }
            
            async getUserByEmail(email) {
                try {
                    const { data, error } = await this.supabase
                        .from('users')
                        .select('*')
                        .eq('email', email)
                        .single();
                    
                    if (error) {
                        if (error.code === 'PGRST116') { // No rows returned
                            return { success: false, error: 'User not found' };
                        }
                        throw error;
                    }
                    
                    return { success: true, data };
                    
                } catch (error) {
                    return { success: false, error: error.message };
                }
            }
            
            // ========== بازی ==========
            async saveGameData(userId, gameData) {
                try {
                    const dataToSave = {
                        user_id: userId,
                        sod_balance: gameData.sodBalance || 0,
                        usdt_balance: gameData.usdtBalance || 0,
                        today_earnings: gameData.todayEarnings || 0,
                        mining_power: gameData.miningPower || 10,
                        user_level: gameData.userLevel || 1,
                        usdt_progress: gameData.usdtProgress || 0,
                        total_mined: gameData.totalMined || 0,
                        updated_at: new Date().toISOString()
                    };
                    
                    const { error } = await this.supabase
                        .from('game_data')
                        .upsert(dataToSave, {
                            onConflict: 'user_id'
                        });
                    
                    if (error) {
                        console.warn('⚠️ Save game data error:', error.message);
                        return { success: false, error: error.message };
                    }
                    
                    return { success: true };
                    
                } catch (error) {
                    console.warn('⚠️ Save game data error:', error.message);
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
                        // اگر داده‌ای وجود نداشت
                        return { 
                            success: true, 
                            data: {
                                user_id: userId,
                                sod_balance: 1000000,
                                usdt_balance: 0,
                                today_earnings: 0,
                                mining_power: 10,
                                user_level: 1,
                                usdt_progress: 1000000,
                                total_mined: 0
                            }
                        };
                    }
                    
                    return { success: true, data };
                    
                } catch (error) {
                    return { success: false, error: error.message };
                }
            }
            
            // ========== تراکنش‌ها ==========
            async addTransaction(transactionData) {
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
                    
                    if (error) {
                        console.warn('⚠️ Transaction log error:', error.message);
                    }
                    
                    return { success: true };
                    
                } catch (error) {
                    console.warn('⚠️ Transaction log error:', error.message);
                    return { success: false, error: error.message };
                }
            }
        }
        
        // ایجاد نمونه سرویس
        window.supabaseService = new SupabaseService();
        
        // تست سرویس
        console.log('🎮 SupabaseService ready!');
    };
    
    // شروع initialization
    initService();
})();
