// Supabase Configuration
const SUPABASE_URL = 'https://wxxhulztrxmjqftxcetp.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind4eGh1bHp0cnhtanFmdHhjZXRwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzgyNjY5MTAsImV4cCI6MjA1Mzg0MjkxMH0.ETQGR2SNbAcY2fgIjPUb9cDcPLmHHshZjjMF7e0YHGM';

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
            .maybeSingle(); // از maybeSingle استفاده می‌کنیم تا اگر کاربری نبود null برگرداند
            
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
        const { data, error } = await supabaseClient
            .from('users')
            .insert([{
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
            }])
            .select()
            .single();
        
        if (error) {
            console.error('❌ Error creating user:', error);
            return null;
        }
        
        console.log('✅ User created in database:', data.email);
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
        
        console.log('✅ User updated in database:', userId);
        return true;
    } catch (error) {
        console.error('🚨 Error in updateUser:', error);
        return false;
    }
}

// ============ توابع بازی ============
async function getGameData(userId) {
    try {
        // ابتدا چک می‌کنیم کاربر در دیتابیس وجود دارد
        const userData = await getUserById(userId);
        
        if (!userData) {
            console.log('👤 User not found in database, checking local storage');
            
            // از localStorage استفاده کن
            const localData = localStorage.getItem(`sodmax_game_${userId}`);
            if (localData) {
                console.log('📱 Using local storage data');
                return JSON.parse(localData);
            }
            
            // داده پیش‌فرض
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
        
        console.log('✅ Game data loaded from database');
        return {
            sodBalance: userData.sod_balance || 1000000,
            usdtBalance: userData.usdt_balance || 0,
            todayEarnings: 0,
            miningPower: userData.mining_power || 10,
            userLevel: userData.level || 1,
            usdtProgress: userData.usdt_progress || 1000000,
            totalMined: userData.total_mined || 0
        };
    } catch (error) {
        console.error('🚨 Error in getGameData:', error);
        
        // استفاده از localStorage
        const localData = localStorage.getItem(`sodmax_game_${userId}`);
        if (localData) {
            console.log('📱 Using local storage as fallback');
            return JSON.parse(localData);
        }
        
        return null;
    }
}

async function saveGameData(userId, gameData) {
    try {
        // همیشه در localStorage ذخیره کن
        localStorage.setItem(`sodmax_game_${userId}`, JSON.stringify(gameData));
        
        // تلاش برای ذخیره در دیتابیس
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
            console.error('❌ Error saving to database (using local storage):', error.message);
            return false;
        }
        
        console.log('✅ Game data saved to database');
        return true;
    } catch (error) {
        console.error('🚨 Error in saveGameData:', error);
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
                description: transaction.description
            }]);
        
        if (error) {
            console.error('❌ Error adding transaction:', error);
            
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
            console.error('❌ Error getting transactions from database:', error);
            
            // از localStorage استفاده کن
            const transactions = JSON.parse(localStorage.getItem(`sodmax_transactions_${userId}`) || '[]');
            return transactions.slice(0, limit);
        }
        
        return data || [];
    } catch (error) {
        console.error('🚨 Error in getTransactions:', error);
        
        // از localStorage استفاده کن
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
            console.error('❌ Error getting sale plans from database:', error.message);
            
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
        
        // بازگشت داده‌های پیش‌فرض
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
}

// ============ توابع کمکی ============
async function checkDatabaseConnection() {
    try {
        const { data, error } = await supabaseClient
            .from('sale_plans')
            .select('count')
            .limit(1);
        
        if (error) {
            console.error('❌ Database connection failed:', error.message);
            return false;
        }
        
        console.log('✅ Database connection successful');
        return true;
    } catch (error) {
        console.error('🚨 Error checking database connection:', error);
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

// تست اتصال به دیتابیس
setTimeout(async () => {
    const isConnected = await checkDatabaseConnection();
    if (isConnected) {
        console.log('🎉 Database is ready!');
    } else {
        console.log('⚠️ Using local storage mode');
    }
}, 1000);

// Export برای استفاده در سایر فایل‌ها
window.supabaseService = supabaseService;
window.supabaseClient = supabaseClient;
