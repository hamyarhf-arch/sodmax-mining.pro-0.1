// Supabase Configuration
const SUPABASE_URL = 'https://wxxhulztrxmjqftxcetp.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind4eGh1bHp0cnhtanFmdHhjZXRwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzgyNjY5MTAsImV4cCI6MjA1Mzg0MjkxMH0.ETQGR2SNbAcY2fgIjPUb9cDcPLmHHshZjjMF7e0YHGM';

// Initialize Supabase client - فقط یک بار
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

console.log('✅ Supabase initialized');

// ============ توابع کاربران ============
async function getUserByEmail(email) {
    try {
        const { data, error } = await supabaseClient
            .from('users')
            .select('*')
            .eq('email', email)
            .single();
        
        if (error) {
            console.error('❌ Error getting user:', error);
            return null;
        }
        
        return data;
    } catch (error) {
        console.error('🚨 Error in getUserByEmail:', error);
        return null;
    }
}

async function createUser(userData) {
    try {
        const { data, error } = await supabaseClient
            .from('users')
            .insert([{
                email: userData.email,
                full_name: userData.fullName,
                referral_code: userData.referralCode || '',
                created_at: new Date().toISOString(),
                level: 1,
                sod_balance: 1000000,
                usdt_balance: 0,
                mining_power: 10,
                total_mined: 0,
                usdt_progress: 1000000,
                last_login: new Date().toISOString()
            }])
            .select()
            .single();
        
        if (error) {
            console.error('❌ Error creating user:', error);
            return null;
        }
        
        console.log('✅ User created:', data.email);
        return data;
    } catch (error) {
        console.error('🚨 Error in createUser:', error);
        return null;
    }
}

async function updateUser(userId, updateData) {
    try {
        const { error } = await supabaseClient
            .from('users')
            .update({
                ...updateData,
                last_updated: new Date().toISOString()
            })
            .eq('id', userId);
        
        if (error) {
            console.error('❌ Error updating user:', error);
            return false;
        }
        
        console.log('✅ User updated:', userId);
        return true;
    } catch (error) {
        console.error('🚨 Error in updateUser:', error);
        return false;
    }
}

// ============ توابع بازی ============
async function getGameData(userId) {
    try {
        // ابتدا بررسی می‌کنیم کاربر در جدول users وجود دارد
        const { data: userData, error: userError } = await supabaseClient
            .from('users')
            .select('*')
            .eq('id', userId)
            .single();
        
        if (userError) {
            console.error('❌ User not found in users table:', userError);
            
            // اگر کاربر وجود ندارد، از localStorage استفاده کن
            const localData = localStorage.getItem(`sodmax_game_${userId}`);
            if (localData) {
                console.log('📱 Using local storage data');
                return JSON.parse(localData);
            }
            
            return null;
        }
        
        // اگر کاربر وجود دارد، داده‌های بازی را از users بردار
        if (userData) {
            console.log('✅ Game data loaded from users table');
            return {
                sodBalance: userData.sod_balance || 0,
                usdtBalance: userData.usdt_balance || 0,
                todayEarnings: 0, // ریست روزانه
                miningPower: userData.mining_power || 10,
                userLevel: userData.level || 1,
                usdtProgress: userData.usdt_progress || 0,
                totalMined: userData.total_mined || 0,
                lastLogin: userData.last_login,
                createdAt: userData.created_at
            };
        }
        
        return null;
    } catch (error) {
        console.error('🚨 Error in getGameData:', error);
        return null;
    }
}

async function saveGameData(userId, gameData) {
    try {
        // ابتدا بررسی می‌کنیم کاربر وجود دارد
        const { data: userExists } = await supabaseClient
            .from('users')
            .select('id')
            .eq('id', userId)
            .single();
        
        if (!userExists) {
            console.error('❌ User does not exist in database');
            
            // ذخیره در localStorage به عنوان فالبک
            localStorage.setItem(`sodmax_game_${userId}`, JSON.stringify(gameData));
            console.log('📱 Game data saved to local storage');
            return true;
        }
        
        // آپدیت داده‌های بازی در جدول users
        const { error } = await supabaseClient
            .from('users')
            .update({
                sod_balance: gameData.sodBalance,
                usdt_balance: gameData.usdtBalance,
                mining_power: gameData.miningPower,
                level: gameData.userLevel,
                usdt_progress: gameData.usdtProgress,
                total_mined: gameData.totalMined,
                last_updated: new Date().toISOString()
            })
            .eq('id', userId);
        
        if (error) {
            console.error('❌ Error saving game data:', error);
            
            // ذخیره در localStorage به عنوان فالبک
            localStorage.setItem(`sodmax_game_${userId}`, JSON.stringify(gameData));
            console.log('📱 Game data saved to local storage as fallback');
            return false;
        }
        
        console.log('✅ Game data saved to database');
        return true;
    } catch (error) {
        console.error('🚨 Error in saveGameData:', error);
        
        // ذخیره در localStorage به عنوان فالبک
        localStorage.setItem(`sodmax_game_${userId}`, JSON.stringify(gameData));
        console.log('📱 Game data saved to local storage due to error');
        return false;
    }
}

// ============ توابع تراکنش‌ها ============
async function addTransaction(userId, transaction) {
    try {
        const { error } = await supabaseClient
            .from('transactions')
            .insert([{
                user_id: userId,
                type: transaction.type,
                amount: transaction.amount,
                currency: transaction.currency,
                description: transaction.description,
                created_at: new Date().toISOString()
            }]);
        
        if (error) {
            console.error('❌ Error adding transaction:', error);
            return false;
        }
        
        console.log('✅ Transaction added');
        return true;
    } catch (error) {
        console.error('🚨 Error in addTransaction:', error);
        return false;
    }
}

async function getTransactions(userId, limit = 20) {
    try {
        const { data, error } = await supabaseClient
            .from('transactions')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(limit);
        
        if (error) {
            console.error('❌ Error getting transactions:', error);
            return [];
        }
        
        return data || [];
    } catch (error) {
        console.error('🚨 Error in getTransactions:', error);
        return [];
    }
}

// ============ توابع پنل‌های فروش ============
async function getSalePlans() {
    try {
        const { data, error } = await supabaseClient
            .from('sale_plans')
            .select('*')
            .order('price', { ascending: true });
        
        if (error) {
            console.error('❌ Error getting sale plans:', error);
            
            // داده‌های پیش‌فرض
            return [
                {
                    id: 1,
                    name: "پنل استارتر",
                    price: 1,
                    sod_amount: 5000000,
                    features: ["۵,۰۰۰,۰۰۰ SOD", "هدیه ۵۰۰,۰۰۰ SOD اضافی", "قدرت استخراج +۵٪"],
                    popular: false,
                    discount: 0
                },
                {
                    id: 2,
                    name: "پنل پرو",
                    price: 5,
                    sod_amount: 30000000,
                    features: ["۳۰,۰۰۰,۰۰۰ SOD", "هدیه ۳,۰۰۰,۰۰۰ SOD اضافی", "قدرت استخراج +۱۵٪"],
                    popular: true,
                    discount: 10
                },
                {
                    id: 3,
                    name: "پنل پلاتینیوم",
                    price: 15,
                    sod_amount: 100000000,
                    features: ["۱۰۰,۰۰۰,۰۰۰ SOD", "هدیه ۱۰,۰۰۰,۰۰۰ SOD اضافی", "قدرت استخراج +۳۰٪"],
                    popular: false,
                    discount: 15
                },
                {
                    id: 4,
                    name: "پنل الماس",
                    price: 50,
                    sod_amount: 500000000,
                    features: ["۵۰۰,۰۰۰,۰۰۰ SOD", "هدیه ۵۰,۰۰۰,۰۰۰ SOD اضافی", "قدرت استخراج +۵۰٪"],
                    popular: false,
                    discount: 20
                }
            ];
        }
        
        return data || [];
    } catch (error) {
        console.error('🚨 Error in getSalePlans:', error);
        return [];
    }
}

// ============ Export functions ============
const supabaseService = {
    // User functions
    getUserByEmail,
    createUser,
    updateUser,
    
    // Game functions
    getGameData,
    saveGameData,
    
    // Transaction functions
    addTransaction,
    getTransactions,
    
    // Sale plans
    getSalePlans,
    
    // Supabase client for auth
    client: supabaseClient
};

console.log('✅ Supabase service loaded');

// Export برای استفاده در سایر فایل‌ها
window.supabaseService = supabaseService;
window.supabaseClient = supabaseClient;
