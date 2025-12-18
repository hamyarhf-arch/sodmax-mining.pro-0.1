import { supabase } from './supabase.js';

export class AuthService {
    constructor() {
        this.client = supabase;
        this.user = null;
        this.init();
    }

    async init() {
        console.log('🔐 Auth service initializing...');
        
        // Listen for auth state changes
        this.client.auth.onAuthStateChange((event, session) => {
            console.log(`🔐 Auth state changed: ${event}`, session?.user?.email);
            
            if (event === 'SIGNED_IN' && session?.user) {
                this.handleSignedIn(session.user);
            } else if (event === 'SIGNED_OUT') {
                this.handleSignedOut();
            }
        });

        // Check current session
        const { data: { session } } = await this.client.auth.getSession();
        if (session?.user) {
            await this.handleSignedIn(session.user);
        }
        
        console.log('✅ Auth service loaded');
    }

    async handleSignedIn(user) {
        console.log('👤 User signed in:', user.email);
        
        try {
            // Ensure user exists in database
            await this.ensureUserInDatabase(user);
            
            // Get complete user data
            const userData = await this.getCurrentUser();
            console.log('📊 User data loaded:', userData);
            
            // Save user locally
            this.user = userData || user;
            localStorage.setItem('currentUser', JSON.stringify(this.user));
            
            // IMPORTANT FIX: Use setTimeout to ensure UI is ready
            setTimeout(() => {
                console.log('🔄 Notifying UI...');
                this.notifyUI(this.user);
            }, 100);
            
        } catch (error) {
            console.error('❌ Error in handleSignedIn:', error);
        }
    }
    
    notifyUI(userData) {
        // Method 1: Direct call if available
        if (window.uiService && typeof window.uiService.onUserSignedIn === 'function') {
            console.log('📢 Calling uiService.onUserSignedIn directly');
            window.uiService.onUserSignedIn(userData);
        }
        // Method 2: Event dispatch as fallback
        else {
            console.log('📢 Dispatching userSignedIn event');
            const event = new CustomEvent('userSignedIn', { 
                detail: userData,
                bubbles: true
            });
            document.dispatchEvent(event);
        }
    }

    async ensureUserInDatabase(user) {
        console.log('👤 Ensuring user in database:', user.email);
        
        const userData = {
            id: user.id,
            email: user.email,
            full_name: user.email.split('@')[0],
            referral_code: Math.random().toString(36).substring(7),
            level: 1,
            sod_balance: 100,
            usdt_balance: 0,
            mining_power: 1,
            total_mined: 0,
            usdt_progress: 0,
            last_login: new Date().toISOString()
        };

        try {
            // First, try to get existing user
            const { data: existingUser } = await supabase
                .from('users')
                .select('*')
                .eq('id', user.id)
                .single();

            if (!existingUser) {
                // Create new user
                const { data, error } = await supabase
                    .from('users')
                    .insert([userData])
                    .select()
                    .single();

                if (error) throw error;
                console.log('✅ User created in database:', data.id);
                return data;
            } else {
                // Update last login
                await supabase
                    .from('users')
                    .update({ last_login: new Date().toISOString() })
                    .eq('id', user.id);
                
                console.log('✅ User exists in database');
                return existingUser;
            }
        } catch (error) {
            console.error('❌ Database error:', error);
            // Save locally anyway
            localStorage.setItem('user_' + user.id, JSON.stringify(userData));
            console.log('⚠️ User saved locally');
            return userData;
        }
    }

    async signUp(email, password) {
        console.log('📝 Signing up:', email);
        
        try {
            const { data, error } = await this.client.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        email: email
                    }
                }
            });

            if (error) throw error;
            
            console.log('✅ Sign up successful');
            
            // Auto sign in after sign up
            if (data.user) {
                await this.handleSignedIn(data.user);
            }
            
            return data.user;
            
        } catch (error) {
            console.error('❌ Sign up error:', error);
            throw error;
        }
    }

    async signIn(email, password) {
        console.log('🔑 Signing in:', email);
        
        try {
            const { data, error } = await this.client.auth.signInWithPassword({
                email,
                password
            });

            if (error) throw error;
            
            console.log('✅ Sign in successful');
            
            if (data.user) {
                await this.handleSignedIn(data.user);
            }
            
            return data.user;
            
        } catch (error) {
            console.error('❌ Sign in error:', error);
            throw error;
        }
    }

    async signOut() {
        try {
            await this.client.auth.signOut();
            this.user = null;
            localStorage.removeItem('currentUser');
            console.log('✅ Signed out successfully');
        } catch (error) {
            console.error('❌ Sign out error:', error);
        }
    }

    async getCurrentUser() {
        if (this.user) return this.user;
        
        const { data: { user } } = await this.client.auth.getUser();
        if (!user) return null;
        
        try {
            const { data, error } = await supabase
                .from('users')
                .select('*')
                .eq('id', user.id)
                .single();

            if (error) throw error;
            this.user = data;
            return data;
        } catch (error) {
            console.error('❌ Error fetching user:', error);
            return user;
        }
    }

    async isAuthenticated() {
        const { data: { session } } = await this.client.auth.getSession();
        return !!session;
    }

    handleSignedOut() {
        console.log('👤 User signed out');
        this.user = null;
        localStorage.removeItem('currentUser');
        
        // Notify UI
        if (window.uiService && typeof window.uiService.onUserSignedOut === 'function') {
            window.uiService.onUserSignedOut();
        }
    }
}
