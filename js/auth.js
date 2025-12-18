// Authentication functions for SODmAX Pro
let currentUser = null;

async function handleAuthStateChange() {
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error) {
        console.error('❌ Auth error:', error);
        return null;
    }
    
    if (user) {
        currentUser = user;
        console.log('👤 User authenticated:', user.email);
        
        // بررسی وجود کاربر در جدول users
        const existingUser = await supabaseService.getUserByEmail(user.email);
        
        if (!existingUser) {
            // ایجاد کاربر جدید
            const newUser = await supabaseService.createUser({
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
}

async function signUp(email, password, fullName, referralCode = '') {
    try {
        console.log('📝 Signing up:', email);
        
        const { data, error } = await supabase.auth.signUp({
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

async function signIn(email, password) {
    try {
        console.log('🔑 Signing in:', email);
        
        const { data, error } = await supabase.auth.signInWithPassword({
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

async function signOut() {
    try {
        const { error } = await supabase.auth.signOut();
        
        if (error) {
            console.error('❌ Sign out error:', error);
            return { success: false, error: error.message };
        }
        
        currentUser = null;
        console.log('✅ Sign out successful');
        return { success: true };
    } catch (error) {
        console.error('🚨 Sign out exception:', error);
        return { success: false, error: 'خطای غیرمنتظره' };
    }
}

function getCurrentUser() {
    return currentUser;
}

// Listen for auth changes
supabase.auth.onAuthStateChange((event, session) => {
    console.log('🔐 Auth state changed:', event);
    
    if (event === 'SIGNED_IN' && session?.user) {
        currentUser = session.user;
    } else if (event === 'SIGNED_OUT') {
        currentUser = null;
    }
});

// Export
window.authService = {
    handleAuthStateChange,
    signUp,
    signIn,
    signOut,
    getCurrentUser
};

console.log('✅ Auth service loaded');
