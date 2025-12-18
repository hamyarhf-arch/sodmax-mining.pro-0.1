// js/auth.js
class AuthService {
    constructor() {
        this.supabaseService = window.SupabaseService;
        this.currentUser = null;
        this.loadUserFromStorage();
    }
    
    loadUserFromStorage() {
        try {
            const saved = localStorage.getItem('sodmax_user');
            if (saved) {
                this.currentUser = JSON.parse(saved);
                console.log('👤 Loaded user from storage:', this.currentUser.email);
            }
        } catch (error) {
            console.warn('Failed to load user from storage:', error);
        }
    }
    
    saveUserToStorage(user) {
        try {
            localStorage.setItem('sodmax_user', JSON.stringify(user));
            this.currentUser = user;
            console.log('💾 Saved user to storage:', user.email);
        } catch (error) {
            console.error('Failed to save user to storage:', error);
        }
    }
    
    clearUserStorage() {
        localStorage.removeItem('sodmax_user');
        this.currentUser = null;
        console.log('🧹 Cleared user storage');
    }
    
    async register(userData) {
        try {
            console.log('📝 Registering user:', userData.email);
            
            // ثبت در دیتابیس
            const result = await this.supabaseService.registerUser(userData);
            
            if (!result.success) {
                throw new Error(result.error || 'Registration failed');
            }
            
            // ایجاد کاربر محلی
            const localUser = {
                isRegistered: true,
                fullName: userData.fullName,
                email: userData.email,
                userId: result.userId || result.data.user_id,
                referralCode: userData.referralCode || ''
            };
            
            // ذخیره در localStorage
            this.saveUserToStorage(localUser);
            
            // ایجاد داده اولیه بازی
            await this.supabaseService.createInitialGameData(localUser.userId);
            
            // لاگ تراکنش هدیه
            await this.supabaseService.addTransaction({
                userId: localUser.userId,
                type: 'bonus',
                amount: 1000000,
                currency: 'SOD',
                description: 'سکه هدیه ثبت نام'
            });
            
            console.log('✅ User registered successfully');
            return {
                success: true,
                user: localUser
            };
            
        } catch (error) {
            console.error('❌ Registration error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    async login(email) {
        try {
            console.log('🔑 Logging in:', email);
            
            // پیدا کردن کاربر در دیتابیس
            const dbUser = await this.supabaseService.getUserByEmail(email);
            
            if (!dbUser) {
                throw new Error('User not found');
            }
            
            // ایجاد کاربر محلی
            const localUser = {
                isRegistered: true,
                fullName: dbUser.full_name,
                email: dbUser.email,
                userId: dbUser.user_id,
                referralCode: dbUser.referral_code || ''
            };
            
            // ذخیره در localStorage
            this.saveUserToStorage(localUser);
            
            // آپدیت last_login
            await this.supabaseService.supabase
                .from('users')
                .update({ last_login: new Date().toISOString() })
                .eq('user_id', dbUser.user_id);
            
            console.log('✅ User logged in successfully');
            return {
                success: true,
                user: localUser
            };
            
        } catch (error) {
            console.error('❌ Login error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    logout() {
        this.clearUserStorage();
        console.log('👋 User logged out');
        return { success: true };
    }
    
    isLoggedIn() {
        return this.currentUser !== null && this.currentUser.isRegistered === true;
    }
    
    getCurrentUser() {
        return this.currentUser;
    }
    
    getUserId() {
        return this.currentUser?.userId;
    }
}

// ایجاد نمونه global
window.AuthService = new AuthService();
