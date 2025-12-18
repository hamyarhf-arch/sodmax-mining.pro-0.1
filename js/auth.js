// Authentication functions for SODmAX Pro
class AuthService {
    constructor() {
        this.currentUser = null;
        this.supabase = window.supabaseClient;
        
        // چک کردن کاربر از localStorage
        this.loadUserFromStorage();
        
        // گوش دادن به تغییرات وضعیت احراز هویت
        this.supabase.auth.onAuthStateChange((event, session) => {
            console.log('🔐 Auth state changed:', event);
            
            if (event === 'SIGNED_IN' && session?.user) {
                this.handleSignedIn(session.user);
            } else if (event === 'SIGNED_OUT') {
                this.handleSignedOut();
            }
        });
    }
    
    loadUserFromStorage() {
        try {
            const userData = localStorage.getItem('sodmax_user');
            if (userData) {
                this.currentUser = JSON.parse(userData);
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
            localStorage.removeItem('sodmax_game_data');
            localStorage.removeItem('sodmax_transactions');
        } catch (error) {
            console.error('❌ Error clearing user storage:', error);
        }
    }
    
    async handleSignedIn(user) {
        console.log('👤 User signed in:', user.email);
        this.currentUser = user;
        this.saveUserToStorage(user);
        
        // ایجاد کاربر در دیتابیس ما (اگر وجود ندارد)
        await this.ensureUserInDatabase(user);
        
        // اطلاع‌رسانی به UI
        if (window.uiService) {
            window.uiService.onUserSignedIn(user);
        }
    }
    
    async ensureUserInDatabase(user) {
        try {
            // چک کردن وجود کاربر در دیتابیس
            const existingUser = await window.supabaseService.getUserByEmail(user.email);
            
            if (!existingUser) {
                console.log('👤 Creating new user in database:', user.email);
                
                // ایجاد کاربر جدید
                const createdUser = await window.supabaseService.createUser({
                    id: user.id,
                    email: user.email,
                    fullName: user.user_metadata?.full_name || user.email.split('@')[0],
                    referralCode: user.user_metadata?.referral_code || ''
                });
                
                if (createdUser) {
                    console.log('✅ User created in database');
                } else {
                    console.log('⚠️ User created in local storage only');
                }
            } else {
                console.log('✅ User already exists in database');
            }
        } catch (error) {
            console.error('🚨 Error ensuring user in database:', error);
        }
    }
    
    handleSignedOut() {
        this.currentUser = null;
        this.clearUserStorage();
        console.log('👤 User signed out and storage cleared');
        
        // اطلاع‌رسانی به UI
        if (window.uiService) {
            window.uiService.onUserSignedOut();
        }
    }
    
    async handleAuthStateChange() {
        try {
            console.log('🔐 Checking auth state...');
            
            const { data: { user }, error } = await this.supabase.auth.getUser();
            
            if (error) {
                console.log('👤 Auth error:', error.message);
                return null;
            }
            
            if (user) {
                await this.handleSignedIn(user);
                return user;
            }
            
            console.log('👤 No user found');
            return null;
        } catch (error) {
            console.error('🚨 Error in handleAuthStateChange:', error);
            return null;
        }
    }
    
    async signUp(email, password, fullName, referralCode = '') {
        try {
            console.log('📝 Signing up:', email);
            
            // اعتبارسنجی اولیه
            if (!this.isValidEmail(email)) {
                return { 
                    success: false, 
                    error: 'لطفاً یک ایمیل معتبر وارد کنید' 
                };
            }
            
            if (password.length < 6) {
                return { 
                    success: false, 
                    error: 'رمز عبور باید حداقل ۶ کاراکتر باشد' 
                };
            }
            
            // ثبت‌نام کاربر
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
            
            // اگر کاربر بلافاصله تأیید شد (در بعضی تنظیمات)
            if (data.user) {
                await this.handleSignedIn(data.user);
                return { 
                    success: true, 
                    data,
                    message: 'ثبت‌نام موفقیت‌آمیز بود!'
                };
            }
            
            // اگر نیاز به تأیید ایمیل دارد
            return { 
                success: true, 
                data,
                message: 'ثبت‌نام موفقیت‌آمیز بود! لطفاً ایمیل خود را برای تأیید بررسی کنید.'
            };
        } catch (error) {
            console.error('🚨 Sign up exception:', error);
            return { 
                success: false, 
                error: 'خطای غیرمنتظره در ثبت‌نام' 
            };
        }
    }
    
    async signOut() {
        try {
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
    
    getCurrentUser() {
        return this.currentUser;
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
            'Auth session missing': 'لطفاً دوباره وارد شوید.',
            'Network error': 'خطای شبکه. لطفاً اتصال اینترنت را بررسی کنید.'
        };
        
        return errorMessages[error.message] || error.message || 'خطای نامشخص';
    }
}

// Create global instance
window.authService = new AuthService();
console.log('✅ Auth service loaded');
