// js/supabase.js - نسخه فقط Supabase
const SUPABASE_URL = 'https://wxxhulztrxmjqftxcetp.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind4eGh1bHp0cnhtanFmdHhjZXRwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYwNzEwNDcsImV4cCI6MjA4MTY0NzA0N30.iC6Ief8aF-zw66RQRSnLxA-BmAjChQj9xy4HkJpGOA4';

// ایجاد کلاینت
window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: true }
});

// ============ توابع اصلی فقط برای Supabase ============

// 1. دریافت اطلاعات کاربر از دیتابیس
async function getUserFromDB(email) {
    try {
        const { data, error } = await window.supabaseClient
            .from('users')
            .select('*')
            .eq('email', email)
            .maybeSingle();
        
        if (error) throw error;
        return data;
    } catch (error) {
        console.error('❌ Error getting user:', error.message);
        return null;
    }
}

// 2. ایجاد کاربر جدید در دیتابیس
// js/supabase.js - نسخه اصلاح شده تابع createUserInDB
async function createUserInDB(userData) {
    try {
        const newUser = {
            id: userData.id, // این ID از Supabase Auth می‌آید
            email: userData.email,
            full_name: userData.fullName || userData.email.split('@')[0],
            sod_balance: 1000000,
            usdt_balance: 0,
            mining_power: 10,
            level: 1,
            usdt_progress: 0,
            total_mined: 0,
            referral_code: userData.referralCode || '',
            last_login: new Date().toISOString(),
            created_at: new Date().toISOString()
        };
        
        // به جای insert از upsert استفاده کنید
        const { data, error } = await window.supabaseClient
            .from('users')
            .upsert(newUser, { onConflict: 'id' }) // اگر id تکراری بود، آپدیت کن
            .select()
            .single();
        
        if (error) throw error;
        console.log('✅ User upserted in database:', data.id);
        return data;
    } catch (error) {
        console.error('❌ Error upserting user:', error.message);
        return null;
    }
}

// 3. دریافت وضعیت کامل بازی از دیتابیس
async function getGameStateFromDB(userId) {
    try {
        // دریافت اطلاعات کاربر
        const { data: user, error: userError } = await window.supabaseClient
            .from('users')
            .select('*')
            .eq('id', userId)
            .maybeSingle();
        
        if (userError) throw userError;
        if (!user) return null;
        
        // محاسبه درآمد امروز
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const { data: todayMining, error: miningError } = await window.supabaseClient
            .from('transactions')
            .select('amount')
            .eq('user_id', userId)
            .eq('type', 'mining')
            .gte('created_at', today.toISOString());
        
        let todayEarnings = 0;
        if (!miningError && todayMining) {
            todayEarnings = todayMining.reduce((sum, t) => sum + (t.amount || 0), 0);
        }
        
        return {
            sodBalance: user.sod_balance || 1000000,
            usdtBalance: Number(user.usdt_balance) || 0,
            todayEarnings: todayEarnings,
            miningPower: user.mining_power || 10,
            userLevel: user.level || 1,
            usdtProgress: user.usdt_progress || 0,
            totalMined: user.total_mined || 0,
            autoMining: false,
            boostActive: false,
            lastUpdated: user.last_updated || new Date().toISOString()
        };
    } catch (error) {
        console.error('❌ Error getting game state:', error.message);
        return null;
    }
}

// 4. ذخیره وضعیت بازی در دیتابیس
async function saveGameStateToDB(userId, gameState) {
    try {
        const updateData = {
            sod_balance: gameState.sodBalance,
            usdt_balance: gameState.usdtBalance,
            mining_power: gameState.miningPower,
            level: gameState.userLevel,
            usdt_progress: gameState.usdtProgress,
            total_mined: gameState.totalMined,
            last_updated: new Date().toISOString()
        };
        
        const { error } = await window.supabaseClient
            .from('users')
            .update(updateData)
            .eq('id', userId);
        
        if (error) throw error;
        return true;
    } catch (error) {
        console.error('❌ Error saving game state:', error.message);
        return false;
    }
}

// 5. ثبت تراکنش در دیتابیس
async function addTransactionToDB(userId, transaction) {
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
        
        if (error) throw error;
        return true;
    } catch (error) {
        console.error('❌ Error adding transaction:', error.message);
        return false;
    }
}

// 6. دریافت تراکنش‌های کاربر
async function getUserTransactions(userId, limit = 20) {
    try {
        const { data, error } = await window.supabaseClient
            .from('transactions')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(limit);
        
        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error('❌ Error getting transactions:', error.message);
        return [];
    }
}

// 7. دریافت پنل‌های فروش
async function getSalePlansFromDB() {
    try {
        const { data, error } = await window.supabaseClient
            .from('sale_plans')
            .select('*')
            .order('price', { ascending: true });
        
        if (error) throw error;
        return data || getDefaultPlans();
    } catch (error) {
        console.error('❌ Error getting sale plans:', error.message);
        return getDefaultPlans();
    }
}

function getDefaultPlans() {
    return [
        { id: 1, name: "پنل استارتر", price: 1, sod_amount: 5000000, discount: 0, popular: false },
        { id: 2, name: "پنل پرو", price: 5, sod_amount: 30000000, discount: 10, popular: true },
        { id: 3, name: "پنل پلاتینیوم", price: 15, sod_amount: 100000000, discount: 15, popular: false },
        { id: 4, name: "پنل الماس", price: 50, sod_amount: 500000000, discount: 20, popular: false }
    ];
}

// 8. آپدیت اطلاعات کاربر (برای پنل مدیریت)
async function updateUserInDB(userId, userData) {
    try {
        const { error } = await window.supabaseClient
            .from('users')
            .update(userData)
            .eq('id', userId);
        
        if (error) throw error;
        return true;
    } catch (error) {
        console.error('❌ Error updating user:', error.message);
        return false;
    }
}

// 9. دریافت همه کاربران (برای پنل مدیریت)
async function getAllUsersFromDB(limit = 100, offset = 0) {
    try {
        const { data, error } = await window.supabaseClient
            .from('users')
            .select('*')
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);
        
        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error('❌ Error getting users:', error.message);
        return [];
    }
}

// 10. تست اتصال دیتابیس
async function testDBConnection() {
    try {
        const { data, error } = await window.supabaseClient
            .from('users')
            .select('count')
            .limit(1);
        
        return {
            connected: !error,
            message: error ? error.message : '✅ Connected to Supabase'
        };
    } catch (error) {
        return {
            connected: false,
            message: error.message
        };
    }
}

// ============ ایجاد سرویس اصلی ============
window.supabaseService = {
    // کاربران
    getUserFromDB,
    createUserInDB,
    updateUserInDB,
    getAllUsersFromDB,
    
    // بازی
    getGameStateFromDB,
    saveGameStateToDB,
    
    // تراکنش‌ها
    addTransactionToDB,
    getUserTransactions,
    
    // فروش
    getSalePlansFromDB,
    
    // ادمین
    getDefaultPlans,
    
    // ابزارها
    testDBConnection,
    
    // دسترسی به کلاینت
    client: window.supabaseClient
};

console.log('✅ Supabase Service loaded (Database-Only Mode)');
// 11. دریافت اطلاعات کیف پول
async function getUserWalletFromDB(userId) {
    try {
        const { data, error } = await window.supabaseClient
            .from('user_wallets')
            .select('*')
            .eq('user_id', userId)
            .maybeSingle();
        
        if (error) throw error;
        return data;
    } catch (error) {
        console.error('❌ Error getting user wallet:', error.message);
        return null;
    }
}

// 12. آپدیت کیف پول
async function updateUserWallet(userId, walletData) {
    try {
        const { error } = await window.supabaseClient
            .from('user_wallets')
            .update({
                ...walletData,
                updated_at: new Date().toISOString()
            })
            .eq('user_id', userId);
        
        if (error) throw error;
        return true;
    } catch (error) {
        console.error('❌ Error updating wallet:', error.message);
        return false;
    }
}

// 13. ثبت تراکنش کیف پول
async function addWalletTransactionToDB(transaction) {
    try {
        const { error } = await window.supabaseClient
            .from('wallet_transactions')
            .insert([{
                user_id: transaction.userId,
                type: transaction.type,
                amount: transaction.amount,
                currency: transaction.currency,
                payment_method: transaction.paymentMethod,
                transaction_id: transaction.transactionId,
                status: transaction.status || 'completed',
                description: transaction.description || '',
                created_at: new Date().toISOString()
            }]);
        
        if (error) throw error;
        return true;
    } catch (error) {
        console.error('❌ Error adding wallet transaction:', error.message);
        return false;
    }
}

// 14. دریافت درخواست‌های برداشت
async function getWithdrawalRequestsFromDB(status = 'pending', limit = 50) {
    try {
        const { data, error } = await window.supabaseClient
            .from('withdrawal_requests')
            .select('*, users(email, full_name)')
            .eq('status', status)
            .order('created_at', { ascending: false })
            .limit(limit);
        
        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error('❌ Error getting withdrawal requests:', error.message);
        return [];
    }
}

// 15. دریافت تنظیمات کیف پول
async function getWalletSettingsFromDB() {
    try {
        const { data, error } = await window.supabaseClient
            .from('wallet_settings')
            .select('*');
        
        if (error) throw error;
        
        const settings = {};
        if (data) {
            data.forEach(setting => {
                settings[setting.setting_key] = setting.setting_value;
            });
        }
        return settings;
    } catch (error) {
        console.error('❌ Error getting wallet settings:', error.message);
        return {};
    }
}
