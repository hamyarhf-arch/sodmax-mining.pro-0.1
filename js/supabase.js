// Supabase Configuration
const SUPABASE_URL = 'https://wxxhulztrxmjqftxcetp.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind4eGh1bHp0cnhtanFmdHhjZXRwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYwNzEwNDcsImV4cCI6MjA4MTY0NzA0N30.iC6Ief8aF-zw66RQRSnLxA-BmAjChQj9xy4HkJpGOA4';

// Initialize Supabase client
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
        storage: localStorage
    },
    db: {
        schema: 'public'
    },
    realtime: {
        params: {
            eventsPerSecond: 2
        }
    }
});

console.log('✅ Supabase initialized with URL:', SUPABASE_URL);

// ============ توابع کاربران ============
async function getUserByEmail(email) {
    try {
        const { data, error } = await supabaseClient
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
        console.error('🚨 Error in getUserByEmail:', error);
        return null;
    }
}

async function getUserById(userId) {
    try {
        const { data, error } = await supabaseClient
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
        console.error('🚨 Error in getUserById:', error);
        return null;
    }
}

async function createUser(userData) {
    try {
        console.log('📝 Creating user in database:', userData.email);
        
        // ابتدا چک می‌کنیم آیا کاربر وجود دارد
        const existingUser = await getUserByEmail(userData.email);
        if (existingUser) {
            console.log('✅ User already exists');
            return existingUser;
        }
        
        // اگر کاربر وجود ندارد، ایجاد می‌کنیم
        const { data, error } = await supabaseClient
            .from('users')
            .insert([{
                id: userData.id,
                email: userData.email,
                full_name: userData.fullName || userData.email.split('@')[0],
                referral_code: userData.referralCode || '',
                level: 1,
                sod_balance: 1000000, // هدیه ثبت‌نام
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
            
            // تلاش با ستون‌های کمتر
            const { data: simpleData, error: simpleError } = await supabaseClient
                .from('users')
                .insert([{
                    id: userData.id,
                    email: userData.email,
                    full_name: userData.fullName || userData.email.split('@')[0]
                }])
                .select()
                .single();
            
            if (simpleError) {
                console.error('❌ Simple insert also failed:', simpleError);
                return null;
            }
            console.log('✅ User created with basic info');
            return simpleData;
        }
        
        console.log('✅ User created successfully:', data.email);
        return data;
    } catch (error) {
        console.error('🚨 Error in createUser:', error);
        return null;
    }
}

async function updateUser(userId, updateData) {
    try {
        const { data, error } = await supabaseClient
            .from('users')
            .update({
                ...updateData,
                last_updated: new Date().toISOString()
            })
            .eq('id', userId)
            .select();
        
        if (error) {
            console.error('❌ Error updating user:', error.message);
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
        // ابتدا از دیتابیس می‌خوانیم
        const userData = await getUserById(userId);
        
        if (userData) {
            console.log('✅ Game data loaded from database for:', userData.email);
            
            // بررسی کن که آیا کاربر جدید است یا قدیمی
            const isNewUser = !userData.total_mined || userData.total_mined === 0;
            
            return {
                sodBalance: userData.sod_balance || (isNewUser ? 1000000 : 0),
                usdtBalance: userData.usdt_balance || 0,
                todayEarnings: 0,
                miningPower: userData.mining_power || 10,
                userLevel: userData.level || 1,
                usdtProgress: userData.usdt_progress || (isNewUser ? 1000000 : 0),
                totalMined: userData.total_mined || 0
            };
        }
        
        // اگر کاربر در دیتابیس نبود
        console.log('👤 User not in database, creating new game data');
        return {
            sodBalance: 1000000, // هدیه ثبت‌نام
            usdtBalance: 0,
            todayEarnings: 0,
            miningPower: 10,
            userLevel: 1,
            usdtProgress: 1000000, // شروع از 1 میلیون
            totalMined: 0
        };
        
    } catch (error) {
        console.error('🚨 Error in getGameData:', error);
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
}

async function saveGameData(userId, gameData) {
    try {
        console.log('💾 Saving game data for user:', userId);
        
        // همیشه در localStorage ذخیره می‌کنیم
        localStorage.setItem(`sodmax_game_${userId}`, JSON.stringify(gameData));
        
        // تلاش برای ذخیره در دیتابیس
        const updateData = {
            sod_balance: gameData.sodBalance,
            usdt_balance: gameData.usdtBalance,
            mining_power: gameData.miningPower,
            level: gameData.userLevel,
            usdt_progress: gameData.usdtProgress,
            total_mined: gameData.totalMined,
            last_updated: new Date().toISOString()
        };
        
        const { error } = await supabaseClient
            .from('users')
            .update(updateData)
            .eq('id', userId);
        
        if (error) {
            console.log('ℹ️ Database update not required or RLS issue, using localStorage only');
            console.log('📱 Saved to localStorage:', gameData.sodBalance);
            return true;
        }
        
        console.log('✅ Game data saved to database');
        return true;
    } catch (error) {
        console.error('🚨 Error in saveGameData:', error);
        console.log('📱 Saved to localStorage only');
        return false;
    }
}

// ============ توابع تراکنش‌ها ============
async function addTransaction(userId, transaction) {
    try {
        console.log('📊 Adding transaction:', transaction.type);
        
        const { error } = await supabaseClient
            .from('transactions')
            .insert([{
                user_id: userId,
                type: transaction.type,
                amount: transaction.amount,
                currency: transaction.currency,
                description: transaction.description || ''
            }]);
        
        if (error) {
            console.log('ℹ️ Could not save transaction to DB, using localStorage:', error.message);
            
            // ذخیره در localStorage
            const transactions = JSON.parse(localStorage.getItem(`sodmax_transactions_${userId}`) || '[]');
            transactions.push({
                ...transaction,
                created_at: new Date().toISOString()
            });
            localStorage.setItem(`sodmax_transactions_${userId}`, JSON.stringify(transactions));
            
            return false;
        }
        
        console.log('✅ Transaction added to database');
        return true;
    } catch (error) {
        console.error('🚨 Error in addTransaction:', error);
        
        // ذخیره در localStorage
        const transactions = JSON.parse(localStorage.getItem(`sodmax_transactions_${userId}`) || '[]');
        transactions.push({
            ...transaction,
            created_at: new Date().toISOString()
        });
        localStorage.setItem(`sodmax_transactions_${userId}`, JSON.stringify(transactions));
        
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
            console.log('ℹ️ Could not get transactions from DB, using localStorage:', error.message);
            
            // از localStorage استفاده می‌کنیم
            const transactions = JSON.parse(localStorage.getItem(`sodmax_transactions_${userId}`) || '[]');
            return transactions.slice(0, limit);
        }
        
        return data || [];
    } catch (error) {
        console.error('🚨 Error in getTransactions:', error);
        
        // از localStorage استفاده می‌کنیم
        const transactions = JSON.parse(localStorage.getItem(`sodmax_transactions_${userId}`) || '[]');
        return transactions.slice(0, limit);
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
            console.log('ℹ️ Could not get sale plans from DB, using default:', error.message);
            
            // داده‌های پیش‌فرض
            return getDefaultSalePlans();
        }
        
        console.log('✅ Sale plans loaded from database:', data.length);
        return data || getDefaultSalePlans();
    } catch (error) {
        console.error('🚨 Error in getSalePlans:', error);
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

// ============ توابع کمکی ============
async function checkDatabaseConnection() {
    try {
        const { data, error } = await supabaseClient
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
        
        console.log('✅ Database connection successful');
        return {
            connected: true,
            message: 'Connected to Supabase'
        };
    } catch (error) {
        console.error('🚨 Error checking database connection:', error);
        return {
            connected: false,
            message: error.message
        };
    }
}
// ============ توابع تنظیمات بازی ============
async function getGameSettings() {
    try {
        const { data, error } = await supabaseClient
            .from('game_settings')
            .select('*')
            .order('setting_key');
        
        if (error) {
            console.error('❌ Error getting game settings:', error);
            return getDefaultGameSettings();
        }
        
        // تبدیل به object
        const settings = {};
        data.forEach(setting => {
            settings[setting.setting_key] = {
                value: setting.setting_value,
                description: setting.description
            };
        });
        
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
        'level_up_chance': { value: '0.03', description: 'شانس ارتقاء سطح' },
        'usdt_conversion_rate': { value: '10000000', description: 'SOD برای دریافت USDT' }
    };
}

async function updateGameSetting(key, value) {
    try {
        const { error } = await supabaseClient
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
        const { data, error } = await supabaseClient
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
        const { data, error } = await supabaseClient
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
        
        const { error } = await supabaseClient
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
        const { data, error } = await supabaseClient
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
        const { error } = await supabaseClient
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

// ============ توابع کاربران ============
async function getAllUsers(limit = 100, offset = 0) {
    try {
        const { data, error } = await supabaseClient
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
        const { count, error } = await supabaseClient
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
        const { error } = await supabaseClient
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
// ============ Export functions ============
const supabaseService = {
    // User functions
    getUserByEmail,
    getUserById,
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
    
    // Helper functions
    checkDatabaseConnection,
    
    // Supabase client
    client: supabaseClient
};

console.log('✅ Supabase service loaded');

// Export برای استفاده در سایر فایل‌ها
window.supabaseService = supabaseService;
window.supabaseClient = supabaseClient;
