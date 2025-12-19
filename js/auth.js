// js/auth.js - نسخه فقط Supabase
class AuthService {
    constructor() {
        console.log('🔐 AuthService (Supabase-Only) initializing...');
        this.currentUser = null;
        this.userVerified = false;
        this.supabase = window.supabaseClient;
        
        this.init();
    }
    
    async init() {
        if (!this.supabase) {
            console.error('❌ Supabase client not available');
            return;
        }
        
        // چک کردن session موجود
        await this.checkSession();
        console.log('✅ AuthService ready (Supabase-Only)');
    }
    
    // 1. چک کردن session از Supabase
    async checkSession() {
        try {
            const { data: { session }, error } = await this.supabase.auth.getSession();
            
            if (error) {
                console.error('❌ Session error:', error.message);
                return;
            }
            
            if (session?.user) {
                this.currentUser = session.user;
                this.userVerified = true;
                console.log('✅ Session found:', session.user.email);
                
                // آپدیت last_login در دیتابیس
                await this.updateLastLogin(session.user.id);
            }
        } catch (error) {
            console.error('🚨 Session check exception:', error);
        }
    }
    
    // 2. ثبت‌نام با Supabase
    async signUp(email, password, fullName, referralCode = '') {
        try {
            console.log('📝 Signing up (Supabase):', email);
            
            // اعتبارسنجی
            if (!this.isValidEmail(email)) {
                return { success: false, error: 'ایمیل معتبر نیست' };
            }
            
            if (password.length < 6) {
                return { success: false, error: 'رمز عبور حداقل ۶ کاراکتر' };
            }
            
            // ثبت‌نام در Supabase Auth
            const { data: authData, error: authError } = await this.supabase.auth.signUp({
                email: email,
                password: password,
                options: {
                    data: {
                        full_name: fullName,
                        referral_code: referralCode
                    }
                }
            });
            
            if (authError) {
                console.error('❌ Sign up auth error:', authError.message);
                return { success: false, error: this.translateAuthError(authError.message) };
            }
            
            // ایجاد کاربر در جدول users
            if (authData.user) {
                const userCreated = await window.supabaseService.createUserInDB({
                    id: authData.user.id,
                    email: email,
                    fullName: fullName,
                    referralCode: referralCode
                });
                
                if (!userCreated) {
                    console.error('❌ Failed to create user in database');
                    return { 
                        success: false, 
                        error: 'ثبت‌نام انجام شد اما خطا در ایجاد پروفایل' 
                    };
                }
                
                this.currentUser = authData.user;
                this.userVerified = authData.user.email_confirmed_at !== null;
                
                console.log('✅ Sign up successful:', email);
                return { 
                    success: true, 
                    data: { user: authData.user },
                    message: this.userVerified ? 
                        'ثبت‌نام موفق! خوش آمدید.' : 
                        'ثبت‌نام موفق! لطفاً ایمیل خود را تأیید کنید.'
                };
            }
            
            return { success: false, error: 'خطا در ثبت‌نام' };
            
        } catch (error) {
            console.error('🚨 Sign up exception:', error);
            return { success: false, error: 'خطای سرور در ثبت‌نام' };
        }
    }
    
    // 3. ورود با Supabase
    async signIn(email, password) {
        try {
            console.log('🔑 Signing in (Supabase):', email);
            
            const { data: authData, error: authError } = await this.supabase.auth.signInWithPassword({
                email: email,
                password: password
            });
            
            if (authError) {
                console.error('❌ Sign in error:', authError.message);
                return { 
                    success: false, 
                    error: this.translateAuthError(authError.message) 
                };
            }
            
            if (authData.user) {
                this.currentUser = authData.user;
                this.userVerified = true;
                
                // آپدیت last_login
                await this.updateLastLogin(authData.user.id);
                
                console.log('✅ Sign in successful:', email);
                return { 
                    success: true, 
                    data: { user: authData.user },
                    message: 'ورود موفقیت‌آمیز! خوش آمدید.'
                };
            }
            
            return { success: false, error: 'خطا در ورود' };
            
        } catch (error) {
            console.error('🚨 Sign in exception:', error);
            return { success: false, error: 'خطای سرور در ورود' };
        }
    }
    
    // 4. خروج
    async signOut() {
        try {
            console.log('👋 Signing out...');
            
            const { error } = await this.supabase.auth.signOut();
            
            if (error) {
                console.error('❌ Sign out error:', error.message);
                return { success: false, error: 'خطا در خروج' };
            }
            
            this.currentUser = null;
            this.userVerified = false;
            
            console.log('✅ Sign out successful');
            return { 
                success: true, 
                message: 'خروج موفقیت‌آمیز بود!' 
            };
            
        } catch (error) {
            console.error('🚨 Sign out exception:', error);
            return { success: false, error: 'خطای سرور در خروج' };
        }
    }
    
    // 5. آپدیت last_login در دیتابیس
    async updateLastLogin(userId) {
        try {
            if (!window.supabaseService) return;
            
            await window.supabaseService.client
                .from('users')
                .update({ last_login: new Date().toISOString() })
                .eq('id', userId);
            
            console.log('🕒 Last login updated');
        } catch (error) {
            console.error('❌ Last login update error:', error.message);
        }
    }
    
    // 6. دریافت کاربر فعلی
    getCurrentUser() {
        return this.userVerified ? this.currentUser : null;
    }
    
    // 7. چک کردن تأیید کاربر
    isUserVerified() {
        return this.userVerified;
    }
    
    // 8. اعتبارسنجی ایمیل
    isValidEmail(email) {
        if (!email || typeof email !== 'string') return false;
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    }
    
    // 9. ترجمه خطاهای Supabase
    translateAuthError(errorMessage) {
        const errors = {
            'Invalid login credentials': 'ایمیل یا رمز عبور نادرست است',
            'Email not confirmed': 'ایمیل شما تأیید نشده است',
            'User already registered': 'این ایمیل قبلاً ثبت‌نام کرده است',
            'Password should be at least 6 characters': 'رمز عبور باید حداقل ۶ کاراکتر باشد',
            'Invalid email': 'ایمیل معتبر نیست'
        };
        
        return errors[errorMessage] || errorMessage;
    }
    
    // 10. گوش دادن به تغییرات auth state
    async listenToAuthChanges() {
        if (!this.supabase) return;
        
        this.supabase.auth.onAuthStateChange(async (event, session) => {
            console.log('🔄 Auth state changed:', event);
            
            if (event === 'SIGNED_IN' && session?.user) {
                this.currentUser = session.user;
                this.userVerified = true;
                await this.updateLastLogin(session.user.id);
                console.log('✅ User signed in via listener');
            }
            
            if (event === 'SIGNED_OUT') {
                this.currentUser = null;
                this.userVerified = false;
                console.log('👋 User signed out via listener');
            }
        });
    }
}

// ایجاد instance جهانی
window.authService = new AuthService();

// گوش دادن به تغییرات auth
setTimeout(() => {
    if (window.authService && window.authService.listenToAuthChanges) {
        window.authService.listenToAuthChanges();
    }
}, 2000);

console.log('✅ Auth Service loaded (Supabase-Only Mode)');
