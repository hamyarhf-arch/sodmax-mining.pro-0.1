// js/supabase.js - نسخه نهایی با تمام توابع
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
async function createUserInDB(userData) {
    try {
        const newUser = {
            id: userData.id,
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
        
        const { data, error } = await window.supabaseClient
            .from('users')
            .upsert(newUser, { onConflict: 'id' })
            .select()
            .single();
        
        if (error) throw error;
        console.log('✅ User upserted in database:', data.id);
        
        // ایجاد کیف پول برای کاربر
        await createUserWalletInDB(data.id);
        
        return data;
    } catch (error) {
        console.error('❌ Error upserting user:', error.message);
        return null;
    }
}

// 3. دریافت وضعیت کامل بازی از دیتابیس
async function getGameStateFromDB(userId) {
    try {
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

// ============ توابع کیف پول جدید ============

// 11. ایجاد کیف پول برای کاربر
async function createUserWalletInDB(userId) {
    try {
        // بررسی وجود کیف پول
        const existingWallet = await getUserWalletFromDB(userId);
        if (existingWallet) {
            console.log('✅ Wallet already exists for user:', userId);
            return existingWallet;
        }
        
        // تولید آدرس کیف پول منحصربه‌فرد
        let walletAddress;
        let isUnique = false;
        
        while (!isUnique) {
            walletAddress = 'SOD' + Math.random().toString(36).substring(2, 12).toUpperCase();
            
            // چک کردن یکتایی آدرس
            const { data, error } = await window.supabaseClient
                .from('user_wallets')
                .select('id')
                .eq('wallet_address', walletAddress)
                .maybeSingle();
            
            if (error && error.code !== 'PGRST116') throw error;
            if (!data) isUnique = true;
        }
        
        const walletData = {
            user_id: userId,
            sod_balance: 1000000,
            usdt_balance: 0,
            total_deposited_usdt: 0,
            total_withdrawn_usdt: 0,
            pending_withdrawal: 0,
            wallet_address: walletAddress,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
        
        const { data, error } = await window.supabaseClient
            .from('user_wallets')
            .insert([walletData])
            .select()
            .single();
        
        if (error) throw error;
        console.log('✅ Wallet created for user:', userId, 'Address:', walletAddress);
        return data;
    } catch (error) {
        console.error('❌ Error creating wallet:', error.message);
        return null;
    }
}

// 12. دریافت اطلاعات کیف پول
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

// 13. آپدیت کیف پول
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

// 14. ثبت تراکنش کیف پول
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

// 15. دریافت درخواست‌های برداشت
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

// 16. دریافت تنظیمات کیف پول
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

// 17. آپدیت تنظیمات کیف پول
async function updateWalletSettings(settings) {
    try {
        const updates = [];
        for (const [key, value] of Object.entries(settings)) {
            updates.push(
                window.supabaseClient
                    .from('wallet_settings')
                    .upsert({
                        setting_key: key,
                        setting_value: value,
                        updated_at: new Date().toISOString()
                    })
            );
        }
        
        await Promise.all(updates);
        return true;
    } catch (error) {
        console.error('❌ Error updating wallet settings:', error.message);
        return false;
    }
}

// 18. ایجاد درخواست برداشت
async function createWithdrawalRequest(userId, requestData) {
    try {
        const { data, error } = await window.supabaseClient
            .from('withdrawal_requests')
            .insert([{
                user_id: userId,
                amount: requestData.amount,
                currency: requestData.currency || 'USDT',
                wallet_address: requestData.walletAddress,
                network: requestData.network || 'TRC20',
                status: 'pending',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            }])
            .select()
            .single();
        
        if (error) throw error;
        return data;
    } catch (error) {
        console.error('❌ Error creating withdrawal request:', error.message);
        return null;
    }
}

// 19. آپدیت وضعیت درخواست برداشت
async function updateWithdrawalRequestStatus(requestId, status, adminNotes = '') {
    try {
        const updateData = {
            status: status,
            admin_notes: adminNotes,
            updated_at: new Date().toISOString()
        };
        
        if (status === 'completed') {
            updateData.processed_at = new Date().toISOString();
        }
        
        const { error } = await window.supabaseClient
            .from('withdrawal_requests')
            .update(updateData)
            .eq('id', requestId);
        
        if (error) throw error;
        return true;
    } catch (error) {
        console.error('❌ Error updating withdrawal request:', error.message);
        return false;
    }
}

// 20. دریافت تعداد بوست‌های روزانه
async function getDailyBoostCount(userId, date) {
    try {
        // استفاده از رنج تاریخ به جای تابع DATE()
        const startOfDay = `${date}T00:00:00.000Z`;
        const endOfDay = `${date}T23:59:59.999Z`;
        
        const { data, error } = await window.supabaseClient
            .from('boost_usage')
            .select('id')
            .eq('user_id', userId)
            .gte('created_at', startOfDay)
            .lt('created_at', endOfDay);
        
        if (error) throw error;
        return data?.length || 0;
    } catch (error) {
        console.error('❌ Error getting boost count:', error);
        return 0;
    }
}

// 21. ثبت استفاده از بوست
async function recordBoostUsage(userId) {
    try {
        const { error } = await window.supabaseClient
            .from('boost_usage')
            .insert([{
                user_id: userId,
                created_at: new Date().toISOString()
            }]);
        
        if (error) throw error;
        return true;
    } catch (error) {
        console.error('❌ Error recording boost usage:', error.message);
        return false;
    }
}

// 22. دریافت تمام تراکنش‌های کیف پول (برای ادمین)
async function getAllWalletTransactions(limit = 100, offset = 0) {
    try {
        const { data, error } = await window.supabaseClient
            .from('wallet_transactions')
            .select('*, users(email, full_name)')
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);
        
        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error('❌ Error getting all wallet transactions:', error.message);
        return [];
    }
}

// 23. دریافت تمام کیف‌پول‌ها (برای ادمین)
async function getAllWallets(limit = 100, offset = 0) {
    try {
        const { data, error } = await window.supabaseClient
            .from('user_wallets')
            .select('*, users(email, full_name)')
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);
        
        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error('❌ Error getting all wallets:', error.message);
        return [];
    }
}

// 24. افزایش موجودی کاربر (برای ادمین)
async function adminAddBalance(userId, amount, currency = 'SOD', description = '') {
    try {
        const wallet = await getUserWalletFromDB(userId);
        if (!wallet) throw new Error('کیف پول پیدا نشد');
        
        let updateData = {};
        if (currency === 'USDT') {
            updateData = {
                usdt_balance: parseFloat(wallet.usdt_balance) + parseFloat(amount)
            };
        } else {
            updateData = {
                sod_balance: parseInt(wallet.sod_balance) + parseInt(amount)
            };
        }
        
        const success = await updateUserWallet(userId, updateData);
        if (!success) throw new Error('خطا در آپدیت کیف پول');
        
        // ثبت تراکنش
        await addWalletTransactionToDB({
            userId: userId,
            type: 'admin_deposit',
            amount: parseFloat(amount),
            currency: currency,
            description: description || `افزایش موجودی توسط ادمین: ${amount} ${currency}`
        });
        
        return true;
    } catch (error) {
        console.error('❌ Admin add balance error:', error.message);
        return false;
    }
}

// 25. کاهش موجودی کاربر (برای ادمین)
async function adminDeductBalance(userId, amount, currency = 'SOD', description = '') {
    try {
        const wallet = await getUserWalletFromDB(userId);
        if (!wallet) throw new Error('کیف پول پیدا نشد');
        
        // بررسی موجودی کافی
        if (currency === 'USDT' && parseFloat(wallet.usdt_balance) < parseFloat(amount)) {
            throw new Error('موجودی کافی نیست');
        }
        
        if (currency === 'SOD' && parseInt(wallet.sod_balance) < parseInt(amount)) {
            throw new Error('موجودی کافی نیست');
        }
        
        let updateData = {};
        if (currency === 'USDT') {
            updateData = {
                usdt_balance: parseFloat(wallet.usdt_balance) - parseFloat(amount)
            };
        } else {
            updateData = {
                sod_balance: parseInt(wallet.sod_balance) - parseInt(amount)
            };
        }
        
        const success = await updateUserWallet(userId, updateData);
        if (!success) throw new Error('خطا در آپدیت کیف پول');
        
        // ثبت تراکنش
        await addWalletTransactionToDB({
            userId: userId,
            type: 'admin_deduction',
            amount: -parseFloat(amount),
            currency: currency,
            description: description || `کاهش موجودی توسط ادمین: ${amount} ${currency}`
        });
        
        return true;
    } catch (error) {
        console.error('❌ Admin deduct balance error:', error.message);
        return false;
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
    
    // کیف پول
    createUserWalletInDB,
    getUserWalletFromDB,
    updateUserWallet,
    addWalletTransactionToDB,
    getWithdrawalRequestsFromDB,
    getWalletSettingsFromDB,
    updateWalletSettings,
    createWithdrawalRequest,
    updateWithdrawalRequestStatus,
    
    // بوست
    getDailyBoostCount,
    recordBoostUsage,
    
    // ادمین پیشرفته
    getAllWalletTransactions,
    getAllWallets,
    adminAddBalance,
    adminDeductBalance,
    
    // ابزارها
    testDBConnection,
    
    // دسترسی به کلاینت
    client: window.supabaseClient
};

console.log('✅ Supabase Service loaded with all functions');
