import { AuthService } from './auth.js';
import { GameService } from './game.js';

export class UIService {
    constructor() {
        console.log('🔄 Initializing UI...');
        this.authService = new AuthService();
        this.gameService = new GameService();
        this.currentUser = null;
        
        this.init();
    }

    async init() {
        this.bindEvents();
        
        // Listen for auth events
        this.setupAuthListeners();
        
        // Check initial auth state
        await this.checkAuthState();
        
        console.log('✅ UI initialized');
    }

    setupAuthListeners() {
        console.log('🔗 Setting up auth listeners...');
        
        // Method 1: Direct callback
        window.authService = this.authService;
        
        // Method 2: Event listener
        document.addEventListener('userSignedIn', (event) => {
            console.log('📢 Event received: userSignedIn', event.detail);
            this.onUserSignedIn(event.detail);
        });
        
        document.addEventListener('userSignedOut', () => {
            this.onUserSignedOut();
        });
    }

    onUserSignedIn(userData) {
        console.log('🎯 onUserSignedIn called!', userData?.email);
        this.currentUser = userData;
        
        // 1. Hide register form
        const registerForm = document.getElementById('registerForm');
        if (registerForm) {
            console.log('📦 Hiding register form');
            registerForm.classList.add('hidden');
        }
        
        // 2. Show miner core
        const minerCore = document.getElementById('minerCore');
        if (minerCore) {
            console.log('🎮 Showing miner core');
            minerCore.classList.remove('hidden');
        }
        
        // 3. Hide team section if exists
        const teamSection = document.getElementById('teamSection');
        if (teamSection) {
            teamSection.classList.add('hidden');
        }
        
        // 4. Start the game
        setTimeout(() => {
            if (this.gameService && typeof this.gameService.startGame === 'function') {
                console.log('🚀 Starting game...');
                this.gameService.startGame(userData);
            } else {
                console.error('❌ Game service not available');
            }
        }, 200);
        
        // 5. Update user stats
        if (this.updateUserStats) {
            this.updateUserStats(userData);
        }
        
        console.log('✅ UI updated for signed in user');
    }

    onUserSignedOut() {
        console.log('👋 User signed out - resetting UI');
        this.currentUser = null;
        
        // Show register form
        const registerForm = document.getElementById('registerForm');
        if (registerForm) {
            registerForm.classList.remove('hidden');
        }
        
        // Hide miner core
        const minerCore = document.getElementById('minerCore');
        if (minerCore) {
            minerCore.classList.add('hidden');
        }
        
        // Reset game
        if (this.gameService && typeof this.gameService.reset === 'function') {
            this.gameService.reset();
        }
    }

    async checkAuthState() {
        console.log('🔍 Checking user state...');
        
        try {
            const isAuthenticated = await this.authService.isAuthenticated();
            
            if (isAuthenticated) {
                const user = await this.authService.getCurrentUser();
                if (user) {
                    console.log('✅ Authenticated user found:', user.email);
                    this.onUserSignedIn(user);
                    return;
                }
            }
            
            console.log('❌ No authenticated user');
            this.showRegisterForm();
            
        } catch (error) {
            console.error('❌ Error checking auth:', error);
            this.showRegisterForm();
        }
    }

    showRegisterForm() {
        console.log('📝 Showing register form');
        const registerForm = document.getElementById('registerForm');
        const minerCore = document.getElementById('minerCore');
        
        if (registerForm) registerForm.classList.remove('hidden');
        if (minerCore) minerCore.classList.add('hidden');
    }

    bindEvents() {
        console.log('🔗 Binding events...');
        
        // Register form
        const registerForm = document.getElementById('registerForm');
        if (registerForm) {
            registerForm.addEventListener('submit', (e) => this.handleRegister(e));
            console.log('✅ Register form bound');
        }
        
        // Logout button
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => this.handleLogout());
            console.log('✅ Logout button bound');
        }
        
        // Claim USDT button
        const claimBtn = document.getElementById('claimUsdtBtn');
        if (claimBtn) {
            claimBtn.addEventListener('click', () => this.handleClaimUsdt());
            console.log('✅ Claim USDT button bound');
        }
        
        // Auto mine button
        const autoMineBtn = document.getElementById('autoMineBtn');
        if (autoMineBtn) {
            autoMineBtn.addEventListener('click', () => this.handleAutoMine());
            console.log('✅ Auto mine button bound');
        }
        
        console.log('✅ All events bound');
    }

    async handleRegister(e) {
        e.preventDefault();
        console.log('📝 Handling register...');
        
        const emailInput = document.getElementById('emailInput');
        const passwordInput = document.getElementById('passwordInput');
        
        if (!emailInput || !passwordInput) {
            console.error('❌ Input fields not found');
            return;
        }
        
        const email = emailInput.value.trim();
        const password = passwordInput.value;
        
        if (!email || !password) {
            alert('Please enter email and password');
            return;
        }
        
        try {
            // Show loading
            const submitBtn = e.target.querySelector('button[type="submit"]');
            const originalText = submitBtn.textContent;
            submitBtn.textContent = 'Signing up...';
            submitBtn.disabled = true;
            
            // Sign up user
            await this.authService.signUp(email, password);
            
            // Reset form
            emailInput.value = '';
            passwordInput.value = '';
            
            console.log('✅ Registration handled');
            
        } catch (error) {
            console.error('❌ Registration error:', error);
            alert('Registration failed: ' + error.message);
            
            // Reset button
            const submitBtn = e.target.querySelector('button[type="submit"]');
            submitBtn.textContent = 'Start Mining';
            submitBtn.disabled = false;
        }
    }

    async handleLogout() {
        console.log('👋 Handling logout...');
        await this.authService.signOut();
        this.onUserSignedOut();
    }

    handleClaimUsdt() {
        console.log('💰 Claiming USDT...');
        if (this.gameService && typeof this.gameService.claimUsdt === 'function') {
            this.gameService.claimUsdt();
        }
    }

    handleAutoMine() {
        console.log('⛏️ Toggling auto mine...');
        if (this.gameService && typeof this.gameService.toggleAutoMine === 'function') {
            this.gameService.toggleAutoMine();
        }
    }

    updateUserStats(userData) {
        console.log('📊 Updating user stats...');
        
        // Update SOD balance
        const sodBalanceEl = document.getElementById('sodBalance');
        if (sodBalanceEl && userData.sod_balance !== undefined) {
            sodBalanceEl.textContent = userData.sod_balance.toFixed(2);
        }
        
        // Update USDT balance
        const usdtBalanceEl = document.getElementById('usdtBalance');
        if (usdtBalanceEl && userData.usdt_balance !== undefined) {
            usdtBalanceEl.textContent = userData.usdt_balance.toFixed(2);
        }
        
        // Update mining power
        const miningPowerEl = document.getElementById('miningPower');
        if (miningPowerEl && userData.mining_power !== undefined) {
            miningPowerEl.textContent = userData.mining_power;
        }
        
        // Update level
        const levelEl = document.getElementById('userLevel');
        if (levelEl && userData.level !== undefined) {
            levelEl.textContent = `Level ${userData.level}`;
        }
        
        // Update total mined
        const totalMinedEl = document.getElementById('totalMined');
        if (totalMinedEl && userData.total_mined !== undefined) {
            totalMinedEl.textContent = userData.total_mined.toFixed(2);
        }
    }
}
