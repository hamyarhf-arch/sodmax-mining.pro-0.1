// Authentication functions for SODmAX Pro
class AuthService {
    constructor() {
        this.currentUser = null;
        this.userVerified = false;
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
            } else if (event === 'USER_UPDATED') {
                console.log('👤 User updated');
                this.checkUserVerification();
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
        
        // بررسی اینکه آیا کاربر واقعاً در دیتابیس ما ثبت‌نام کرده است
        const isRegistered = await this.checkUserRegistration(user);
        
        if (isRegistered) {
            this.currentUser = user;
            this.userVerified = true;
            this.saveUserToStorage(user);
            console.log('✅ User verified and registered');
            
            // اطلاع‌رسانی به UI
            if (window.uiService) {
                window.uiService.onUserVerified(user);
            }
        } else {
            console.log('⚠️ User not registered in database');
            await this.signOut();
            
            // نمایش پیام به کاربر
            if (window.uiService) {
                window.uiService.showNotification('❌', 'شما ثبت‌نام نکرده‌اید. لطفاً ابتدا ثبت‌نام کنید.');
            }
        }
    }
    
    async checkUserRegistration(user) {
        try {
            console.log('🔍 Checking user registration for:', user.email);
            
            // 1. بررسی اینکه آیا کاربر ایمیل خود را تأیید کرده است
            if (!user.email_confirmed_at && !user.confirmed_at) {
                console.log('❌ Email not confirmed');
                return false;
            }
            
            // 2. بررسی وجود کاربر در جدول users ما
            const existingUser = await window.supabaseService.getUserByEmail(user.email);
            
            if (existingUser) {
                console.log('✅ User found in database');
                return true;
            }
            
            // 3. اگر کاربر در دیتابیس ما نیست، ایجادش کن
            console.log('👤 Creating user in database...');
            const createdUser = await window.supabaseService.createUser({
                id: user.id,
                email: user.email,
                fullName: user.user_metadata?.full_name || user.email.split('@')[0],
                referralCode: user.user_metadata?.referral_code || ''
            });
            
            return !!createdUser;
        } catch (error) {
            console.error('🚨 Error checking user registration:', error);
            return false;
        }
    }
    
    async checkUserVerification() {
        if (!this.currentUser) return false;
        
        try {
            const { data: { user }, error } = await this.supabase.auth.getUser();
            
            if (error) {
                console.error('❌ Error getting user for verification:', error);
                return false;
            }
            
            if (user) {
                const isVerified = await this.checkUserRegistration(user);
                this.userVerified = isVerified;
                return isVerified;
            }
            
            return false;
        } catch (error) {
            console.error('🚨 Error in checkUserVerification:', error);
            return false;
        }
    }
    
    handleSignedOut() {
        this.currentUser = null;
        this.userVerified = false;
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
                this.handleSignedOut();
                return null;
            }
            
            if (user) {
                const isRegistered = await this.checkUserRegistration(user);
                
                if (isRegistered) {
                    this.currentUser = user;
                    this.userVerified = true;
                    this.saveUserToStorage(user);
                    console.log('✅ User authenticated and registered');
                    return user;
                } else {
                    console.log('❌ User not registered');
                    await this.signOut();
                    return null;
                }
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
            
            // اگر کاربر بلافاصله تأیید شد
            if (data.user && (data.user.email_confirmed_at || data.session)) {
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
            
            // بررسی ثبت‌نام کاربر
            const isRegistered = await this.checkUserRegistration(data.user);
            
            if (!isRegistered) {
                await this.signOut();
                return { 
                    success: false, 
                    error: 'شما ثبت‌نام نکرده‌اید. لطفاً ابتدا ثبت‌نام کنید.'
                };
            }
            
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
            'Auth session missing': 'لطفاً دوباره وارد شوید.',
            'Network error': 'خطای شبکه. لطفاً اتصال اینترنت را بررسی کنید.',
            'User not found': 'کاربری با این ایمیل پیدا نشد.',
            'Invalid email': 'ایمیل نامعتبر است.'
        };
        
        return errorMessages[error.message] || error.message || 'خطای نامشخص';
    }
    
    // تابع برای چک کردن وضعیت ایمیل تأیید
    async checkEmailConfirmation() {
        if (!this.currentUser) return false;
        
        try {
            const { data: { user }, error } = await this.supabase.auth.getUser();
            
            if (error) {
                console.error('❌ Error checking email confirmation:', error);
                return false;
            }
            
            return !!(user?.email_confirmed_at || user?.confirmed_at);
        } catch (error) {
            console.error('🚨 Error in checkEmailConfirmation:', error);
            return false;
        }
    }
}

// Create global instance
window.authService = new AuthService();
console.log('✅ Auth service loaded');
