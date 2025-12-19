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
    
    async handleSignedIn(user) {
        this.currentUser = user;
        this.saveUserToStorage(user);
        console.log('👤 User signed in:', user.email);
        
        // تلاش برای ایجاد یا به‌روزرسانی کاربر در دیتابیس
        await this.ensureUserInDatabase(user);
    }
    
    handleSignedOut() {
        this.currentUser = null;
        localStorage.removeItem('sodmax_user');
        console.log('👤 User signed out');
    }
    
    async ensureUserInDatabase(user) {
        try {
            // چک کردن وجود کاربر در دیتابیس
            const existingUser = await window.supabaseService.getUserByEmail(user.email);
            
            if (!existingUser) {
                console.log('👤 Creating new user in database:', user.email);
                
                // ایجاد کاربر جدید
                const newUserData = {
                    id: user.id,
                    email: user.email,
                    fullName: user.user_metadata?.full_name || user.email.split('@')[0],
                    referralCode: user.user_metadata?.referral_code || ''
                };
                
                const createdUser = await window.supabaseService.createUser(newUserData);
                
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
    
    async handleAuthStateChange() {
        try {
            const { data: { user }, error } = await this.supabase.auth.getUser();
            
            if (error) {
                console.log('👤 No active session');
                return this.currentUser; // از localStorage استفاده کن
            }
            
            if (user) {
                await this.handleSignedIn(user);
                return user;
            }
            
            return this.currentUser;
        } catch (error) {
            console.error('🚨 Error in handleAuthStateChange:', error);
            return this.currentUser;
        }
    }
    
    async signUp(email, password, fullName, referralCode = '') {
        try {
            console.log('📝 Signing up:', email);
            
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
            
            // اگر کاربر بلافاصله تأیید شد
            if (data.user) {
                await this.handleSignedIn(data.user);
            }
            
            return { 
                success: true, 
                data,
                message: data.user?.identities?.[0]?.identity_data?.email_verified 
                    ? 'ثبت نام موفق! ایمیل خود را تأیید کنید.'
                    : 'ثبت نام موفقیت‌آمیز بود!'
            };
        } catch (error) {
            console.error('🚨 Sign up exception:', error);
            return { 
                success: false, 
                error: 'خطای غیرمنتظره در ثبت نام' 
            };
        }
    }
    
    async signIn(email, password) {
        try {
            console.log('🔑 Signing in:', email);
            
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
            await this.handleSignedIn(data.user);
            
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
    
    getErrorMessage(error) {
        const errorMessages = {
            'User already registered': 'این ایمیل قبلاً ثبت نام کرده است.',
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
