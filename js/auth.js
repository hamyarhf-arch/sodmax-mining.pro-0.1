// Authentication functions for SODmAX Pro
class AuthService {
    constructor() {
        this.currentUser = null;
        this.supabase = window.supabaseClient;
        
        // Listen for auth changes
        this.supabase.auth.onAuthStateChange((event, session) => {
            console.log('🔐 Auth state changed:', event);
            
            if (event === 'SIGNED_IN' && session?.user) {
                this.currentUser = session.user;
                console.log('👤 User signed in:', session.user.email);
                this.handleUserAuthenticated(session.user);
            } else if (event === 'SIGNED_OUT') {
                this.currentUser = null;
                console.log('👤 User signed out');
                this.handleUserSignedOut();
            } else if (event === 'INITIAL_SESSION') {
                console.log('🔄 Initial session check');
                // این طبیعی است - کاربر هنوز وارد نشده
            }
        });
    }
    
    async handleAuthStateChange() {
        try {
            const { data: { user }, error } = await this.supabase.auth.getUser();
            
            if (error) {
                if (error.message.includes('Auth session missing')) {
                    console.log('👤 No active session - user needs to sign in');
                    return null;
                }
                console.error('❌ Auth error:', error);
                return null;
            }
            
            if (user) {
                this.currentUser = user;
                console.log('👤 User authenticated:', user.email);
                await this.handleUserAuthenticated(user);
                return user;
            }
            
            return null;
        } catch (error) {
            console.error('🚨 Error in handleAuthStateChange:', error);
            return null;
        }
    }
    
    async handleUserAuthenticated(user) {
        try {
            // بررسی وجود کاربر در جدول users
            const existingUser = await window.supabaseService.getUserByEmail(user.email);
            
            if (!existingUser) {
                // ایجاد کاربر جدید
                const newUser = await window.supabaseService.createUser({
                    email: user.email,
                    fullName: user.user_metadata?.full_name || user.email.split('@')[0],
                    referralCode: user.user_metadata?.referral_code || ''
                });
                
                if (newUser) {
                    console.log('✅ New user created in database');
                }
            }
        } catch (error) {
            console.error('🚨 Error in handleUserAuthenticated:', error);
        }
    }
    
    handleUserSignedOut() {
        // پاک کردن داده‌های محلی
        localStorage.clear();
        console.log('🧹 Local storage cleared');
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
                    },
                    emailRedirectTo: window.location.origin
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
            
            // اگر ایمیل تأیید نیاز نباشد، کاربر را وارد کن
            if (data.user && !data.user.identities?.[0]?.identity_data?.email_verified) {
                this.currentUser = data.user;
                await this.handleUserAuthenticated(data.user);
            }
            
            return { 
                success: true, 
                data,
                message: data.user?.identities?.[0]?.identity_data?.email_verified 
                    ? 'ثبت نام موفقیت‌آمیز بود! لطفاً ایمیل خود را تأیید کنید.'
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
            this.currentUser = data.user;
            await this.handleUserAuthenticated(data.user);
            
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
                return { 
                    success: false, 
                    error: error.message 
                };
            }
            
            this.currentUser = null;
            this.handleUserSignedOut();
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
