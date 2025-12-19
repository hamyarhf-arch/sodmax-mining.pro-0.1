// js/auth.js
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
        // منتظر Supabase نمی‌شویم - اگر بود که خوب، اگر نبود با localStorage کار می‌کنیم
        this.supabase = window.supabaseClient || null;
        
        // همیشه ابتدا از localStorage چک می‌کنیم
        this.loadUserFromStorage();
        
        // اگر Supabase داریم، وضعیت auth را چک می‌کنیم
        if (this.supabase) {
            setTimeout(() => {
                this.handleAuthStateChange();
            }, 1000);
        }
        
        console.log('✅ AuthService initialized');
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
            
            // حالت آفلاین: ذخیره در localStorage
            const mockUser = {
                id: 'user_' + Date.now(),
                email: email,
                user_metadata: {
                    full_name: fullName,
                    referral_code: referralCode
                },
                created_at: new Date().toISOString()
            };
            
            this.currentUser = mockUser;
            this.userVerified = true;
            this.saveUserToStorage(mockUser);
            
            // ایجاد کاربر در دیتابیس محلی
            if (window.supabaseService) {
                await window.supabaseService.createUser({
                    id: mockUser.id,
                    email: email,
                    fullName: fullName,
                    referralCode: referralCode,
                    created_at: new Date().toISOString()
                });
            }
            
            console.log('✅ Sign up successful (offline mode)');
            
            return { 
                success: true, 
                data: { user: mockUser },
                message: 'ثبت‌نام موفقیت‌آمیز بود! خوش آمدید.'
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
            
            // حالت آفلاین: چک کردن localStorage
            const userData = localStorage.getItem('sodmax_user');
            if (userData) {
                const user = JSON.parse(userData);
                if (user.email === email) {
                    this.currentUser = user;
                    this.userVerified = true;
                    console.log('✅ Sign in successful (from storage)');
                    
                    return { 
                        success: true, 
                        data: { user },
                        message: 'ورود موفقیت‌آمیز بود!'
                    };
                }
            }
            
            // اگر کاربر پیدا نشد
            return { 
                success: false, 
                error: 'ایمیل یا رمز عبور نادرست است'
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
            // همیشه از localStorage چک می‌کنیم
            const userData = localStorage.getItem('sodmax_user');
            
            if (userData) {
                const user = JSON.parse(userData);
                this.currentUser = user;
                this.userVerified = true;
                console.log('✅ User authenticated from storage:', user.email);
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
        if (!email || typeof email !== 'string') return false;
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    }
}

// ایجاد instance جهانی
window.authService = new AuthService();
console.log('✅ Auth service loaded');
