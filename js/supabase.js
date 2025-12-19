// js/supabase.js - نسخه کامل و کارآمد

// ============ تنظیمات Supabase ============
const SUPABASE_URL = 'https://wxxhulztrxmjqftxcetp.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind4eGh1bHp0cnhtanFmdHhjZXRwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYwNzEwNDcsImV4cCI6MjA4MTY0NzA0N30.iC6Ief8aF-zw66RQRSnLxA-BmAjChQj9xy4HkJpGOA4';

// ============ ایجاد کلاینت ============
window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
        storage: localStorage
    }
});

console.log('✅ Supabase client initialized');

// ============ توابع اصلی ============

// 1. دریافت کاربر با ایمیل
async function getUserByEmail(email) {
    try {
        const { data, error } = await window.supabaseClient
            .from('users')
            .select('*')
            .eq('email', email)
            .maybeSingle();
        
        if (error) {
            console.error('❌ Error getting user:', error);
            return null;
        }
        
        return data;
    } catch (error) {
        console.error('🚨 Exception:', error);
        return null;
    }
}

// 2. ایجاد کاربر جدید
async function createUser(userData) {
    try {
        console.log('📝 Creating user:', userData.email);
        
        // چک کردن وجود کاربر
        const existingUser = await getUserByEmail(userData.email);
        if (existingUser) {
            console.log('✅ User already exists');
            return existingUser;
        }
        
        // داده‌های کاربر جدید
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
        
        console.log('📤 Inserting user:', newUser);
        
        const { data, error } = await window.supabaseClient
            .from('users')
            .insert([newUser])
            .select()
            .single();
        
        if (error) {
            console.error('❌ Error creating user:', error.message);
            return null;
        }
        
        console.log('✅ User created successfully:', data.email);
        return data;
    } catch (error) {
        console.error('🚨 Exception in createUser:', error);
        return null;
    }
}

// 3. دریافت کاربر با ID
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

// 4. دریافت داده‌های بازی
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

// 5. ذخیره داده‌های بازی
async function saveGameData(userId, gameData) {
    try {
        // ذخیره در localStorage
        localStorage.setItem(`sodmax_game_${userId}`, JSON.stringify(gameData));
        
        // آماده کردن داده برای دیتابیس
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

// 6. اضافه کردن تراکنش
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

// 7. دریافت تراکنش‌ها
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

// 8. دریافت پنل‌های فروش
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
        {
            id: 1,
            name: "پنل استارتر",
            price: 1,
            sod_amount: 5000000,
            discount: 0
        },
        {
            id: 2,
            name: "پنل پرو",
            price: 5,
            sod_amount: 30000000,
            discount: 10
        },
        {
            id: 3,
            name: "پنل پلاتینیوم",
            price: 15,
            sod_amount: 100000000,
            discount: 15
        },
        {
            id: 4,
            name: "پنل الماس",
            price: 50,
            sod_amount: 500000000,
            discount: 20
        }
    ];
}

// ============ توابع ادمین ============

// 9. دریافت همه کاربران
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
        console.error('🚨 Exception:', error);
        return [];
    }
}

// 10. شمارش کاربران
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
        console.error('🚨 Exception:', error);
        return 0;
    }
}

// 11. دریافت تنظیمات بازی
async function getGameSettings() {
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
}

// 12. دریافت مأموریت‌ها
async function getMissions() {
    try {
        const { data, error } = await window.supabaseClient
            .from('missions')
            .select('*');
        
        if (error) {
            console.error('❌ Error getting missions:', error);
            return [];
        }
        
        return data || [];
    } catch (error) {
        console.error('🚨 Exception:', error);
        return [];
    }
}

// 13. تست اتصال
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
        console.error('🚨 Exception:', error);
        return {
            connected: false,
            message: error.message
        };
    }
}

// ============ ایجاد آبجکت سرویس ============
window.supabaseService = {
    // توابع اصلی
    getUserByEmail,
    getUserById,
    createUser,
    getGameData,
    saveGameData,
    addTransaction,
    getTransactions,
    getSalePlans,
    
    // توابع ادمین
    getAllUsers,
    getUserCount,
    getGameSettings,
    getMissions,
    
    // تست اتصال
    checkDatabaseConnection,
    
    // کلاینت
    client: window.supabaseClient
};

console.log('✅ Supabase service loaded with all functions');
