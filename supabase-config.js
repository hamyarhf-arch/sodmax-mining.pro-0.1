// supabase-config.js
// فقط یکبار لود شود
(function() {
    // اگر قبلاً لود شده، دوباره لود نکن
    if (window.supabaseClient) {
        console.log('⚠️ Supabase already loaded');
        return;
    }
    
    try {
        const SUPABASE_URL = 'https://wxxhulztrxmjqftxcetp.supabase.co';
        const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind4eGh1bHp0cnhtanFmdHhjZXRwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYwNzEwNDcsImV4cCI6MjA4MTY0NzA0N30.iC6Ief8aF-zw66RQRSnLxA-BmAjChQj9xy4HkJpGOA4';

        // ایجاد کلاینت
        const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        
        // تست اتصال
        supabase.from('users').select('count', { count: 'exact', head: true })
            .then(({ count, error }) => {
                if (error) {
                    console.warn('⚠️ Could not connect to users table:', error.message);
                    console.log('✅ Supabase client created (tables may not exist yet)');
                } else {
                    console.log(`✅ Supabase connected! Users table has ${count} records`);
                }
            })
            .catch(err => {
                console.log('✅ Supabase client created (connection test failed)');
            });
        
        // ذخیره در گلوبال
        window.supabaseClient = supabase;
        
    } catch (error) {
        console.error('❌ Failed to create Supabase client:', error);
    }
})();
