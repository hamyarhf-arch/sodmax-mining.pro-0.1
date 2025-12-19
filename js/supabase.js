// ============ تنظیمات Supabase ============
const SUPABASE_URL = 'https://wxxhulztrxmjqftxcetp.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind4eGh1bHp0cnhtanFmdHhjZXRwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYwNzEwNDcsImV4cCI6MjA4MTY0NzA0N30.iC6Ief8aF-zw66RQRSnLxA-BmAjChQj9xy4HkJpGOA4';

// ایجاد کلاینت (فقط یک بار)
if (!window.supabaseClient) {
    window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
            autoRefreshToken: true,
            persistSession: true,
            detectSessionInUrl: true,
            storage: localStorage
        }
    });
    console.log('✅ Supabase client initialized');
}

// ============ توابع اصلی بازی ============

async function getUserByEmail(email) {
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
}

async function createUser(userData) {
    try {
        // چک وجود کاربر
        const existingUser = await getUserByEmail(userData.email);
        if (existingUser) {
            console.log('✅ User already exists');
            return existingUser;
        }
        
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
            last_login: new Date().toISOString(),
            created_at: new Date().toISOString()
        };
        
        const { data, error } = await window.supabaseClient
            .from('users')
            .insert([newUser])
            .select()
            .single();
        
        if (error) {
            console.error('❌ Error creating user:', error.message);
            return null;
        }
        console.log('✅ User created successfully');
        return data;
    } catch (error) {
        console.error('🚨 Exception:', error);
        return null;
    }
}

async function getUserById(userId) {
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
}

async function getGameData(userId) {
    try {
        const userData = await getUserById(userId);
        
        if (userData) {
            return {
                sodBalance: userData.sod_balance || 1000000,
                usdtBalance: Number(userData.usdt_balance) || 0,
                todayEarnings: 0,
                miningPower: userData.mining_power || 10,
                userLevel: userData.level || 1,
                usdtProgress: userData.usdt_progress || 1000000,
                totalMined: userData.total_mined || 0,
                lastUpdated: new Date().toISOString()
            };
        }
        
        return {
            sodBalance: 1000000,
            usdtBalance: 0,
            todayEarnings: 0,
            miningPower: 10,
            userLevel: 1,
            usdtProgress: 1000000,
            totalMined: 0,
            lastUpdated: new Date().toISOString()
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
            totalMined: 0,
            lastUpdated: new Date().toISOString()
        };
    }
}

async function saveGameData(userId, gameData) {
    try {
        // ذخیره در localStorage
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
}

async function addTransaction(userId, transaction) {
    try {
        const { error } = await window.supabaseClient
            .from('transactions')
            .insert([{
                user_id: userId,
                type: transaction.type,
                amount: transaction.amount,
                currency: transaction.currency,
                description: transaction.description || '',
                created_at: new Date().toISOString()
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
}

async function getTransactions(userId, limit = 20) {
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
}

async function getSalePlans() {
    try {
        const { data, error } = await window.supabaseClient
            .from('sale_plans')
            .select('*')
            .order('price', { ascending: true });
        
        if (error) {
            console.warn('⚠️ Could not get sale plans:', error.message);
            return getDefaultSalePlans();
        }
        return data || getDefaultSalePlans();
    } catch (error) {
        console.error('🚨 Exception:', error);
        return getDefaultSalePlans();
    }
}

function getDefaultSalePlans() {
    return [
        { id: 1, name: "پنل استارتر", price: 1, sod_amount: 5000000, discount: 0 },
        { id: 2, name: "پنل پرو", price: 5, sod_amount: 30000000, discount: 10 },
        { id: 3, name: "پنل پلاتینیوم", price: 15, sod_amount: 100000000, discount: 15 },
        { id: 4, name: "پنل الماس", price: 50, sod_amount: 500000000, discount: 20 }
    ];
}

// ============ توابع تنظیمات بازی (برای پنل ادمین) ============
async function getGameSettings() {
    try {
        const { data, error } = await window.supabaseClient
            .from('game_settings')
            .select('*')
            .order('setting_key');
        
        if (error) {
            console.error('❌ Error getting game settings:', error);
            return getDefaultGameSettings();
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
        console.log('✅ Game settings loaded:', Object.keys(settings).length);
        return settings;
    } catch (error) {
        console.error('🚨 Error in getGameSettings:', error);
        return getDefaultGameSettings();
    }
}

function getDefaultGameSettings() {
    return {
        'mining_base_power': { value: '10', description: 'قدرت پایه استخراج' },
        'mining_auto_cost': { value: '10000', description: 'حداقل SOD برای استخراج خودکار' },
        'mining_auto_interval': { value: '3000', description: 'فاصله استخراج خودکار' },
        'mining_boost_power': { value: '3', description: 'میزان افزایش قدرت بوست' },
        'mining_boost_cost': { value: '5000', description: 'هزینه SOD برای بوست' },
        'mining_boost_duration': { value: '1800000', description: 'مدت زمان بوست' },
        'level_up_chance': { value: '0.03', description: 'شانس ارتقاء سطح' },
        'usdt_conversion_rate': { value: '10000000', description: 'SOD برای دریافت USDT' },
        'usdt_reward_amount': { value: '0.01', description: 'مقدار USDT پاداش' }
    };
}

async function updateGameSetting(key, value) {
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
        console.log('✅ Setting updated:', key, '=', value);
        return true;
    } catch (error) {
        console.error('🚨 Error in updateGameSetting:', error);
        return false;
    }
}

// ============ توابع مأموریت‌ها ============
async function getMissions() {
    try {
        const { data, error } = await window.supabaseClient
            .from('missions')
            .select('*')
            .order('order_index');
        
        if (error) {
            console.error('❌ Error getting missions:', error);
            return [];
        }
        console.log('✅ Missions loaded:', data.length);
        return data;
    } catch (error) {
        console.error('🚨 Error in getMissions:', error);
        return [];
    }
}

async function getUserMissions(userId) {
    try {
        const { data, error } = await window.supabaseClient
            .from('user_missions')
            .select(`
                *,
                missions (*)
            `)
            .eq('user_id', userId)
            .order('created_at', { ascending: false });
        
        if (error) {
            console.error('❌ Error getting user missions:', error);
            return [];
        }
        return data;
    } catch (error) {
        console.error('🚨 Error in getUserMissions:', error);
        return [];
    }
}

async function updateUserMission(userId, missionId, progress, isCompleted = false) {
    try {
        const updateData = {
            progress: progress,
            updated_at: new Date().toISOString()
        };
        if (isCompleted) {
            updateData.is_completed = true;
            updateData.completed_at = new Date().toISOString();
        }
        
        const { error } = await window.supabaseClient
            .from('user_missions')
            .update(updateData)
            .eq('user_id', userId)
            .eq('mission_id', missionId);
        
        if (error) {
            console.error('❌ Error updating user mission:', error);
            return false;
        }
        return true;
    } catch (error) {
        console.error('🚨 Error in updateUserMission:', error);
        return false;
    }
}

async function createMission(missionData) {
    try {
        const { data, error } = await window.supabaseClient
            .from('missions')
            .insert([missionData])
            .select()
            .single();
        
        if (error) {
            console.error('❌ Error creating mission:', error);
            return null;
        }
        console.log('✅ Mission created:', data.title);
        return data;
    } catch (error) {
        console.error('🚨 Error in createMission:', error);
        return null;
    }
}

async function updateMission(missionId, missionData) {
    try {
        const { error } = await window.supabaseClient
            .from('missions')
            .update(missionData)
            .eq('id', missionId);
        
        if (error) {
            console.error('❌ Error updating mission:', error);
            return false;
        }
        console.log('✅ Mission updated:', missionId);
        return true;
    } catch (error) {
        console.error('🚨 Error in updateMission:', error);
        return false;
    }
}

// ============ توابع کاربران (برای پنل ادمین) ============
async function getAllUsers(limit = 100, offset = 0) {
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
        console.error('🚨 Error in getAllUsers:', error);
        return [];
    }
}

async function getUserCount() {
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
        console.error('🚨 Error in getUserCount:', error);
        return 0;
    }
}

async function updateUserData(userId, userData) {
    try {
        const { error } = await window.supabaseClient
            .from('users')
            .update(userData)
            .eq('id', userId);
        
        if (error) {
            console.error('❌ Error updating user data:', error);
            return false;
        }
        console.log('✅ User data updated:', userId);
        return true;
    } catch (error) {
        console.error('🚨 Error in updateUserData:', error);
        return false;
    }
}

// ============ تست اتصال ============
async function checkDatabaseConnection() {
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
        console.error('🚨 Exception checking database connection:', error);
        return {
            connected: false,
            message: error.message
        };
    }
}

// ============ ایجاد آبجکت اصلی سرویس ============
// این بخش بسیار مهم است: تمام توابع باید در این آبجکت اضافه شوند
if (!window.supabaseService) {
    window.supabaseService = {
        // توابع اصلی بازی
        getUserByEmail,
        getUserById,
        createUser,
        getGameData,
        saveGameData,
        addTransaction,
        getTransactions,
        getSalePlans,
        
        // توابع پنل ادمین
        getGameSettings,
        updateGameSetting,
        getMissions,
        getUserMissions,
        updateUserMission,
        createMission,
        updateMission,
        getAllUsers,
        getUserCount,
        updateUserData,
        
        // تست اتصال
        checkDatabaseConnection,
        
        // دسترسی به کلاینت
        client: window.supabaseClient
    };
    
    console.log('✅ Supabase service loaded with ALL functions');
} else {
    console.log('⚠️ supabaseService already exists');
}
