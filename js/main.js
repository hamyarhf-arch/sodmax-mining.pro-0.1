// این کد را در فایل main.js یا در تگ <script> در index.html قرار دهید

// Wait for DOM to be fully loaded
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 SODmAX Pro starting...');
    
    // Import services
    import { supabase } from './supabase.js';
    import { AuthService } from './auth.js';
    import { GameService } from './game.js';
    import { UIService } from './ui.js';
    
    // Initialize services
    window.supabase = supabase;
    window.authService = new AuthService();
    window.gameService = new GameService();
    window.uiService = new UIService();
    
    // Make them globally available
    window.authService = window.uiService.authService;
    window.gameService = window.uiService.gameService;
    
    console.log('🎉 All services initialized!');
    
    // Check if user is already signed in
    setTimeout(async () => {
        const isAuth = await window.authService.isAuthenticated();
        console.log('Initial auth check:', isAuth ? 'User is signed in' : 'No user');
    }, 1000);
});
