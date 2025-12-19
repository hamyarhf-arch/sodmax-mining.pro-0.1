// Authentication functions for SODmAX Pro
class AuthService {
    constructor() {
        this.currentUser = null;
        this.userVerified = false;
        this.supabase = null;
        
        console.log('🔐 AuthService initializing...');
        this.init();
    }
    
    async init() {
        await this.waitForSupabase();
        
        this.supabase = window.supabaseClient;
        if (!this.supabase) {
            console.error('❌ Supabase client not found');
            return;
        }
        
        this.loadUserFromStorage();
        console.log('✅ AuthService initialized');
    }
    
    waitForSupabase() {
        return new Promise((resolve) => {
            let attempts = 0;
            const maxAttempts = 20;
            
            const check = () => {
                attempts++;
                if (window.supabaseClient) {
                    resolve();
                } else if (attempts < maxAttempts) {
                    setTimeout(check, 100);
                } else {
                    resolve();
                }
            };
            
            check();
        });
    }
    
    loadUserFromStorage() {
        try {
            const userData = localStorage.getItem('sodmax_user');
            if (userData) {
                this.currentUser = JSON.parse(userData);
                this.userVerified = true;
                console.log('📱 User loaded from storage:', this.currentUser?.email);
            }
        } catch (error) {
            console.error('❌ Error loading user from storage:', error);
        }
    }
    
    saveUserToStorage(user) {
        try {
            localStorage.setItem('sodmax_user', JSON.stringify(user));
        } catch (error) {
            console.error('❌ Error saving user to storage:', error);
        }
    }
    
    clearUserStorage() {
        try {
            localStorage.removeItem('sodmax_user');
        } catch (error) {
            console.error('❌ Error clearing user storage:', error);
        }
    }
    
    async signUp(email, password, fullName, referralCode = '') {
        try {
            console.log('📝 Signing up:', email);
            
            if (!this.isValidEmail(email)) {
                return { 
                    success: false, 
                    error: 'لطفاً یک ایمیل معتبر وارد کنید' 
                };
            }
            
            if (!this.supabase) {
                return { 
                    success: false, 
                    error: 'سرویس احراز هویت آماده نیست' 
                };
            }
            
            const { data, error } = await this.supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        full_name: fullName,
                        referral_code: referralCode
                    }
                }
            });
            
            if (error) {
                console.error('❌ Sign up error:', error);
                return { 
                    success: false, 
                    error: this.getErrorMessage(error) 
                };
            }
            
            console.log('✅ Sign up successful');
            
            // For demo - auto login
            if (data.user) {
                this.currentUser = data.user;
                this.userVerified = true;
                this.saveUserToStorage(data.user);
                
                // Create user in our database
                if (window.supabaseService) {
                    await window.supabaseService.createUser({
                        id: data.user.id,
                        email: data.user.email,
                        fullName: fullName,
                        referralCode: referralCode
                    });
                }
                
                return { 
                    success: true, 
                    data,
                    message: 'ثبت‌نام موفقیت‌آمیز بود! خوش آمدید.'
                };
            }
            
            return { 
                success: true, 
                data,
                message: 'ثبت‌نام موفقیت‌آمیز بود!'
            };
        } catch (error) {
            console.error('🚨 Sign up exception:', error);
            return { 
                success: false, 
                error: 'خطای غیرمنتظره در ثبت‌نام' 
            };
        }
    }
    
    async signIn(email, password) {
        try {
            console.log('🔑 Signing in:', email);
            
            if (!this.supabase) {
                return { 
                    success: false, 
                    error: 'سرویس احراز هویت آماده نیست' 
                };
            }
            
            const { data, error } = await this.supabase.auth.signInWithPassword({
                email,
                password
            });
            
            if (error) {
                console.error('❌ Sign in error:', error);
                return { 
                    success: false, 
                    error: this.getErrorMessage(error) 
                };
            }
            
            console.log('✅ Sign in successful');
            
            this.currentUser = data.user;
            this.userVerified = true;
            this.saveUserToStorage(data.user);
            
            return { 
                success: true, 
                data,
                message: 'ورود موفقیت‌آمیز بود!'
            };
        } catch (error) {
            console.error('🚨 Sign in exception:', error);
            return { 
                success: false, 
                error: 'خطای غیرمنتظره در ورود' 
            };
        }
    }
    
    async signOut() {
        try {
            if (!this.supabase) {
                this.handleSignedOut();
                return { 
                    success: true,
                    message: 'خروج موفقیت‌آمیز بود!'
                };
            }
            
            const { error } = await this.supabase.auth.signOut();
            
            if (error) {
                console.error('❌ Sign out error:', error);
            }
            
            this.handleSignedOut();
            console.log('✅ Sign out successful');
            
            return { 
                success: true,
                message: 'خروج موفقیت‌آمیز بود!'
            };
        } catch (error) {
            console.error('🚨 Sign out exception:', error);
            return { 
                success: false, 
                error: 'خطای غیرمنتظره در خروج' 
            };
        }
    }
    
    handleSignedOut() {
        this.currentUser = null;
        this.userVerified = false;
        this.clearUserStorage();
        console.log('👤 User signed out');
    }
    
    async handleAuthStateChange() {
        try {
            if (!this.supabase) {
                return null;
            }
            
            const { data: { user }, error } = await this.supabase.auth.getUser();
            
            if (error) {
                console.log('👤 Auth error:', error.message);
                return null;
            }
            
            if (user) {
                this.currentUser = user;
                this.userVerified = true;
                this.saveUserToStorage(user);
                console.log('✅ User authenticated:', user.email);
                return user;
            }
            
            return null;
        } catch (error) {
            console.error('🚨 Error in handleAuthStateChange:', error);
            return null;
        }
    }
    
    getCurrentUser() {
        return this.userVerified ? this.currentUser : null;
    }
    
    isUserVerified() {
        return this.userVerified;
    }
    
    isValidEmail(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    }
    
    getErrorMessage(error) {
        const errorMessages = {
            'User already registered': 'این ایمیل قبلاً ثبت‌نام کرده است.',
            'Invalid login credentials': 'ایمیل یا رمز عبور نادرست است.',
            'Email not confirmed': 'لطفاً ایمیل خود را تأیید کنید.',
            'Weak password': 'رمز عبور بسیار ضعیف است.',
            'User not found': 'کاربری با این ایمیل پیدا نشد.',
            'Invalid email': 'ایمیل نامعتبر است.'
        };
        
        return errorMessages[error.message] || error.message || 'خطای نامشخص';
    }
}

// Create global instance
// تابع تنظیم دکمه خروج
function setupLogoutButton() {
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            
            if (confirm('آیا مطمئن هستید که می‌خواهید از حساب خود خارج شوید؟')) {
                await logout();
            }
        });
    }
}

// تابع خروج
async function logout() {
    try {
        console.log('🚪 Logging out user:', currentUser?.email);
        
        // 1. پاک کردن localStorage
        Object.keys(localStorage).forEach(key => {
            if (key.includes('sodmax') || key.includes('supabase')) {
                localStorage.removeItem(key);
            }
        });
        
        // 2. پاک کردن sessionStorage
        sessionStorage.clear();
        
        // 3. ریست متغیرها
        currentUser = null;
        gameData = null;
        
        // 4. نمایش نوتیفیکیشن
        showNotification('👋', 'با موفقیت خارج شدید', 'success');
        
        // 5. نمایش فرم ثبت‌نام
        showRegisterOverlay();
        
        // 6. ریفرش صفحه بعد از 1 ثانیه
        setTimeout(() => {
            location.reload();
        }, 1000);
        
        return true;
    } catch (error) {
        console.error('🚨 Error logging out:', error);
        showNotification('خطا', 'خطا در خروج از حساب', 'error');
        return false;
    }
}

// اضافه کردن logout به authService
authService.logout = logout;
authService.setupLogoutButton = setupLogoutButton;

// فراخوانی setupLogoutButton وقتی DOM بارگذاری شد
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        setupLogoutButton();
    }, 1000);
});
window.authService = new AuthService();
console.log('✅ Auth service loaded');

// Check auth state on load
setTimeout(async () => {
    if (window.authService && window.authService.handleAuthStateChange) {
        await window.authService.handleAuthStateChange();
    }
}, 1000);
