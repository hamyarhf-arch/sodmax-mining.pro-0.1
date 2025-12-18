// app.js - تمام کدها در یک فایل
console.log('🚀 Loading SODmAX Pro...');

// ============================================
// PART 1: SUPABASE CONFIGURATION
// ============================================

// صبر کن تا کتابخانه Supabase لود شود
if (!window.supabase) {
    console.error('❌ Supabase library not loaded!');
} else {
    console.log('✅ Supabase library loaded');
}

// ایجاد کلاینت Supabase
const SUPABASE_URL = 'https://wxxhulztrxmjqftxcetp.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind4eGh1bHp0cnhtanFmdHhjZXRwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYwNzEwNDcsImV4cCI6MjA4MTY0NzA0N30.iC6Ief8aF-zw66RQRSnLxA-BmAjChQj9xy4HkJpGOA4';

let supabaseClient = null;
try {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    console.log('✅ Supabase client created');
    
    // تست اتصال
    supabaseClient.from('users').select('count', { count: 'exact', head: true })
        .then(({ count, error }) => {
            if (error) {
                console.warn('⚠️ Connection test warning:', error.message);
                console.log('ℹ️ Tables might not exist yet - this is OK for now');
            } else {
                console.log(`✅ Connected! Users table has ${count} records`);
            }
        });
} catch (error) {
    console.error('❌ Failed to create Supabase client:', error);
}

// ============================================
// PART 2: GAME DATA AND FUNCTIONS
// ============================================

let userData = {
    isRegistered: false,
    fullName: "",
    email: "",
    userId: null,
    referralCode: ""
};

let gameData = {
    sodBalance: 1000000,
    usdtBalance: 0,
    todayEarnings: 0,
    miningPower: 10,
    userLevel: 1,
    usdtProgress: 1000000,
    autoMining: false,
    boostActive: false,
    totalMined: 0
};

// ============================================
// PART 3: SUPABASE SERVICE FUNCTIONS
// ============================================

const SupabaseService = {
    // ثبت کاربر
    async registerUser(userData) {
        if (!supabaseClient) {
            console.error('Supabase client not initialized');
            return { success: false, error: 'Database not connected' };
        }
        
        try {
            console.log('📝 Attempting to register:', userData.email);
            
            // ابتدا بررسی کن کاربر وجود دارد
            const { data: existingUser, error: checkError } = await supabaseClient
                .from('users')
                .select('*')
                .eq('email', userData.email)
                .maybeSingle();
            
            if (checkError && checkError.code !== 'PGRST116') {
                throw checkError;
            }
            
            if (existingUser) {
                console.log('👤 User already exists:', existingUser);
                return {
                    success: true,
                    data: existingUser,
                    userId: existingUser.user_id,
                    message: 'User already exists'
                };
            }
            
            // ایجاد کاربر جدید
            const userId = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            
            const { data, error } = await supabaseClient
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
                console.error('❌ Insert error:', error);
                return { success: false, error: error.message };
            }
            
            console.log('✅ User registered successfully:', data);
            
            // تلاش برای ایجاد داده بازی (اگر جدول وجود داشته باشد)
            try {
                const gameData = {
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
                
                await supabaseClient
                    .from('game_data')
                    .insert([gameData]);
                    
                console.log('✅ Game data created for user:', userId);
            } catch (gameError) {
                console.warn('⚠️ Could not create game data (table might not exist):', gameError.message);
                // این خطا قابل قبول است
            }
            
            return {
                success: true,
                data: data,
                userId: userId
            };
            
        } catch (error) {
            console.error('❌ Registration error:', error);
            return { success: false, error: error.message };
        }
    },
    
    // ذخیره داده بازی
    async saveGameData(userId, gameData) {
        if (!supabaseClient) return { success: false, error: 'No connection' };
        
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
            
            const { error } = await supabaseClient
                .from('game_data')
                .upsert(dataToSave, { onConflict: 'user_id' });
            
            if (error) {
                console.warn('⚠️ Save warning (table might not exist):', error.message);
                return { success: false, error: error.message };
            }
            
            return { success: true };
            
        } catch (error) {
            console.warn('⚠️ Save error:', error.message);
            return { success: false, error: error.message };
        }
    },
    
    // بارگذاری داده بازی
    async loadGameData(userId) {
        if (!supabaseClient) {
            return { 
                success: true, 
                data: {
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
        
        try {
            const { data, error } = await supabaseClient
                .from('game_data')
                .select('*')
                .eq('user_id', userId)
                .maybeSingle();
            
            if (error) {
                console.warn('⚠️ Load warning:', error.message);
                // برگرداندن داده پیش‌فرض
                return { 
                    success: true, 
                    data: {
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
            
            if (!data) {
                // داده‌ای وجود ندارد، ایجاد کن
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
            console.warn('⚠️ Load error:', error.message);
            return { 
                success: true, 
                data: {
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
    },
    
    // افزودن تراکنش
    async addTransaction(transactionData) {
        if (!supabaseClient) return { success: false, error: 'No connection' };
        
        try {
            const { error } = await supabaseClient
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
                console.warn('⚠️ Transaction log warning:', error.message);
            }
            
            return { success: true };
            
        } catch (error) {
            console.warn('⚠️ Transaction log error:', error.message);
            return { success: false, error: error.message };
        }
    }
};

// ============================================
// PART 4: UI FUNCTIONS
// ============================================

function showNotification(title, message) {
    const notification = document.getElementById('notification');
    const titleEl = document.getElementById('notificationTitle');
    const messageEl = document.getElementById('notificationMessage');
    
    if (notification && titleEl && messageEl) {
        titleEl.textContent = title;
        messageEl.textContent = message;
        
        notification.classList.add('show');
        
        setTimeout(() => {
            notification.classList.remove('show');
        }, 4000);
    }
    
    console.log(`📢 ${title}: ${message}`);
}

function formatNumber(num) {
    if (num >= 1000000000) return (num / 1000000000).toFixed(2) + 'B';
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return Math.floor(num).toLocaleString('fa-IR');
}

function updateUI() {
    // موجودی‌ها
    const sodBalance = document.getElementById('sodBalance');
    const usdtBalance = document.getElementById('usdtBalance');
    
    if (sodBalance) {
        sodBalance.innerHTML = formatNumber(gameData.sodBalance) + ' <span>SOD</span>';
    }
    
    if (usdtBalance) {
        usdtBalance.innerHTML = gameData.usdtBalance.toFixed(4) + ' <span>USDT</span>';
    }
    
    // آمار
    const todayEarnings = document.getElementById('todayEarnings');
    const miningPower = document.getElementById('miningPower');
    const clickReward = document.getElementById('clickReward');
    const userLevel = document.getElementById('userLevel');
    
    if (todayEarnings) {
        todayEarnings.textContent = formatNumber(gameData.todayEarnings) + ' SOD';
    }
    
    if (miningPower) {
        miningPower.textContent = gameData.miningPower + 'x';
    }
    
    if (clickReward) {
        clickReward.textContent = '+' + gameData.miningPower + ' SOD';
    }
    
    if (userLevel) {
        userLevel.textContent = gameData.userLevel;
    }
    
    // پاداش USDT
    const availableUSDT = document.getElementById('availableUSDT');
    const progressFill = document.getElementById('progressFill');
    const progressText = document.getElementById('progressText');
    
    if (availableUSDT) {
        availableUSDT.textContent = gameData.usdtBalance.toFixed(4) + ' USDT';
    }
    
    if (progressFill) {
        const progressPercent = (gameData.usdtProgress / 10000000) * 100;
        progressFill.style.width = progressPercent + '%';
    }
    
    if (progressText) {
        progressText.textContent = formatNumber(gameData.usdtProgress) + ' / ۱۰,۰۰۰,۰۰۰ SOD (۰.۰۱ USDT)';
    }
}

function hideRegister() {
    const registerOverlay = document.getElementById('registerOverlay');
    const mainContainer = document.getElementById('mainContainer');
    
    if (registerOverlay) registerOverlay.style.display = 'none';
    if (mainContainer) mainContainer.style.display = 'block';
}

function showRegister() {
    const registerOverlay = document.getElementById('registerOverlay');
    const mainContainer = document.getElementById('mainContainer');
    
    if (registerOverlay) registerOverlay.style.display = 'flex';
    if (mainContainer) mainContainer.style.display = 'none';
}

// ============================================
// PART 5: GAME LOGIC
// ============================================

async function handleRegistration(e) {
    e.preventDefault();
    
    const fullName = document.getElementById('fullName').value.trim();
    const email = document.getElementById('email').value.trim();
    const referralCode = document.getElementById('referralCode').value.trim();
    
    if (!fullName || !email) {
        showNotification('❌', 'لطفاً نام و ایمیل را وارد کنید');
        return;
    }
    
    showNotification('⏳', 'در حال ثبت نام...');
    
    try {
        const result = await SupabaseService.registerUser({
            fullName,
            email,
            referralCode
        });
        
        if (!result.success) {
            showNotification('❌', 'خطا در ثبت نام: ' + result.error);
            return;
        }
        
        // ذخیره اطلاعات کاربر
        userData = {
            isRegistered: true,
            fullName,
            email,
            userId: result.userId || result.data.user_id,
            referralCode
        };
        
        // ذخیره در localStorage
        localStorage.setItem('sodmax_user', JSON.stringify(userData));
        
        // لاگ تراکنش هدیه
        await SupabaseService.addTransaction({
            userId: userData.userId,
            type: 'bonus',
            amount: 1000000,
            currency: 'SOD',
            description: 'سکه هدیه ثبت نام'
        });
        
        showNotification('✅', `ثبت نام موفق! خوش آمدید ${fullName}!`);
        
        setTimeout(() => {
            hideRegister();
            updateUI();
        }, 1000);
        
    } catch (error) {
        console.error('Registration error:', error);
        showNotification('❌', 'خطا در ثبت نام');
    }
}

async function manualMine() {
    if (!userData.isRegistered) {
        showNotification('❌', 'ابتدا ثبت نام کنید');
        return;
    }
    
    const earned = gameData.miningPower;
    
    // آپدیت داده‌ها
    gameData.sodBalance += earned;
    gameData.totalMined += earned;
    gameData.todayEarnings += earned;
    gameData.usdtProgress += earned;
    
    // ذخیره در Supabase
    if (userData.userId) {
        await SupabaseService.saveGameData(userData.userId, gameData);
        
        await SupabaseService.addTransaction({
            userId: userData.userId,
            type: 'mining',
            amount: earned,
            currency: 'SOD',
            description: 'استخراج دستی'
        });
    }
    
    // آپدیت UI
    updateUI();
    
    // بررسی پاداش USDT
    if (gameData.usdtProgress >= 10000000) {
        const usdtEarned = 0.01;
        gameData.usdtBalance += usdtEarned;
        gameData.usdtProgress -= 10000000;
        
        showNotification('🎉', `${usdtEarned.toFixed(4)} USDT دریافت کردید!`);
        
        // شانس ارتقاء سطح
        if (Math.random() > 0.85) {
            gameData.userLevel++;
            gameData.miningPower = 10 * gameData.userLevel;
            showNotification('⭐', `سطح شما به ${gameData.userLevel} ارتقاء یافت!`);
        }
        
        // ذخیره تغییرات
        if (userData.userId) {
            await SupabaseService.saveGameData(userData.userId, gameData);
        }
    }
}

// ============================================
// PART 6: EVENT HANDLERS
// ============================================

function bindEvents() {
    // ثبت نام
    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        registerForm.addEventListener('submit', handleRegistration);
    }
    
    // کلیک استخراج
    const minerCore = document.getElementById('minerCore');
    if (minerCore) {
        minerCore.addEventListener('click', manualMine);
    }
    
    // دریافت پاداش
    const claimBtn = document.getElementById('claimUSDTBtn');
    if (claimBtn) {
        claimBtn.addEventListener('click', () => {
            if (gameData.usdtBalance > 0) {
                showNotification('💰', `${gameData.usdtBalance.toFixed(4)} USDT قابل برداشت است`);
            } else {
                showNotification('💰', 'هنوز USDT پاداش دریافت نکرده‌اید');
            }
        });
    }
    
    // استخراج خودکار
    const autoMineBtn = document.getElementById('autoMineBtn');
    if (autoMineBtn) {
        autoMineBtn.addEventListener('click', () => {
            showNotification('🤖', 'استخراج خودکار در حال توسعه است');
        });
    }
    
    // افزایش قدرت
    const boostBtn = document.querySelector('[onclick="boostMining()"]');
    if (boostBtn) {
        boostBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (gameData.sodBalance >= 5000) {
                gameData.sodBalance -= 5000;
                gameData.boostActive = true;
                gameData.miningPower *= 3;
                
                showNotification('⚡', 'قدرت استخراج ۳ برابر شد! (۳۰ دقیقه)');
                updateUI();
                
                setTimeout(() => {
                    gameData.boostActive = false;
                    gameData.miningPower = 10 * gameData.userLevel;
                    showNotification('⏰', 'زمان افزایش قدرت به پایان رسید.');
                    updateUI();
                }, 30 * 60 * 1000);
            } else {
                showNotification('⚠️', 'برای افزایش قدرت به ۵۰۰۰ SOD نیاز دارید.');
            }
        });
    }
    
    // خرید SOD
    const buySODBtn = document.querySelector('[onclick="showSODSale()"]');
    if (buySODBtn) {
        buySODBtn.addEventListener('click', (e) => {
            e.preventDefault();
            showNotification('🛒', 'فروشگاه SOD در حال توسعه است');
        });
    }
    
    console.log('✅ Event listeners bound');
}

// ============================================
// PART 7: INITIALIZATION
// ============================================

function init() {
    console.log('🎮 Initializing SODmAX Pro...');
    
    bindEvents();
    
    // بررسی ثبت نام قبلی
    const savedUser = localStorage.getItem('sodmax_user');
    if (savedUser) {
        try {
            userData = JSON.parse(savedUser);
            console.log('👤 Found saved user:', userData);
            
            if (userData.userId) {
                // بارگذاری داده‌های بازی
                SupabaseService.loadGameData(userData.userId)
                    .then(result => {
                        if (result.success && result.data) {
                            gameData = {
                                sodBalance: result.data.sod_balance || 1000000,
                                usdtBalance: result.data.usdt_balance || 0,
                                todayEarnings: result.data.today_earnings || 0,
                                miningPower: result.data.mining_power || 10,
                                userLevel: result.data.user_level || 1,
                                usdtProgress: result.data.usdt_progress || 1000000,
                                autoMining: false,
                                boostActive: false,
                                totalMined: result.data.total_mined || 0
                            };
                        }
                        
                        hideRegister();
                        updateUI();
                        showNotification('👋', `خوش آمدید ${userData.fullName}!`);
                    })
                    .catch(error => {
                        console.warn('Could not load game data:', error);
                        hideRegister();
                        updateUI();
                    });
            } else {
                showRegister();
            }
            
        } catch (error) {
            console.error('Error loading saved user:', error);
            showRegister();
        }
    } else {
        showRegister();
    }
    
    // نمایش وضعیت اتصال
    if (supabaseClient) {
        console.log('✅ Database: Connected to Supabase');
    } else {
        console.warn('⚠️ Database: Using localStorage only');
    }
    
    console.log('✅ SODmAX Pro ready!');
}

// ============================================
// PART 8: START THE APP
// ============================================

// منتظر لود شدن کامل صفحه
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

// توابع گلوبال برای استفاده در HTML
window.boostMining = function() {
    if (gameData.sodBalance >= 5000) {
        gameData.sodBalance -= 5000;
        gameData.boostActive = true;
        gameData.miningPower *= 3;
        
        showNotification('⚡', 'قدرت استخراج ۳ برابر شد! (۳۰ دقیقه)');
        updateUI();
        
        setTimeout(() => {
            gameData.boostActive = false;
            gameData.miningPower = 10 * gameData.userLevel;
            showNotification('⏰', 'زمان افزایش قدرت به پایان رسید.');
            updateUI();
        }, 30 * 60 * 1000);
    } else {
        showNotification('⚠️', 'برای افزایش قدرت به ۵۰۰۰ SOD نیاز دارید.');
    }
};

window.showSODSale = function() {
    showNotification('🛒', 'فروشگاه SOD در حال توسعه است');
};

window.supabaseService = SupabaseService;
