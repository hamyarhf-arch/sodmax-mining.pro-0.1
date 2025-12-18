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
            } else if (event === 'SIGNED_OUT') {
                this.currentUser = null;
                console.log('👤 User signed out');
            }
        });
    }
    
    async handleAuthStateChange() {
        try {
            const { data: { user }, error } = await this.supabase.auth.getUser();
            
            if (error) {
                console.error('❌ Auth error:', error);
                return null;
            }
            
            if (user) {
                this.currentUser = user;
                console.log('👤 User authenticated:', user.email);
                
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
                
                return user;
            }
            
            return null;
        } catch (error) {
            console.error('🚨 Error in handleAuthStateChange:', error);
            return null;
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
                return { success: false, error: error.message };
            }
            
            console.log('✅ Sign up successful');
            return { success: true, data };
        } catch (error) {
            console.error('🚨 Sign up exception:', error);
            return { success: false, error: 'خطای غیرمنتظره' };
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
                return { success: false, error: error.message };
            }
            
            console.log('✅ Sign in successful');
            return { success: true, data };
        } catch (error) {
            console.error('🚨 Sign in exception:', error);
            return { success: false, error: 'خطای غیرمنتظره' };
        }
    }
    
    async signOut() {
        try {
            const { error } = await this.supabase.auth.signOut();
            
            if (error) {
                console.error('❌ Sign out error:', error);
                return { success: false, error: error.message };
            }
            
            this.currentUser = null;
            console.log('✅ Sign out successful');
            return { success: true };
        } catch (error) {
            console.error('🚨 Sign out exception:', error);
            return { success: false, error: 'خطای غیرمنتظره' };
        }
    }
    
    getCurrentUser() {
        return this.currentUser;
    }
}

// Create global instance
window.authService = new AuthService();
console.log('✅ Auth service loaded');
