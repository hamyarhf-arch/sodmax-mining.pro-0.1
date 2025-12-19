// js/supabase.js - نسخه خیلی ساده

// فقط اگر وجود نداره
if (!window.supabaseClient) {
    const SUPABASE_URL = 'https://wxxhulztrxmjqftxcetp.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind4eGh1bHp0cnhtanFmdHhjZXRwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYwNzEwNDcsImV4cCI6MjA4MTY0NzA0N30.iC6Ief8aF-zw66RQRSnLxA-BmAjChQj9xy4HkJpGOA4';
    
    window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    console.log('✅ Supabase client loaded');
}

// فقط سرویس‌های اصلی
if (!window.supabaseService) {
    window.supabaseService = {
        // فقط ۴ تابع اصلی
        getGameData: async function(userId) {
            try {
                const { data, error } = await window.supabaseClient
                    .from('users')
                    .select('*')
                    .eq('id', userId)
                    .maybeSingle();
                
                if (error) throw error;
                
                return {
                    sodBalance: data?.sod_balance || 1000000,
                    usdtBalance: data?.usdt_balance || 0,
                    miningPower: data?.mining_power || 10,
                    userLevel: data?.level || 1,
                    usdtProgress: data?.usdt_progress || 1000000,
                    totalMined: data?.total_mined || 0
                };
            } catch (e) {
                console.error('❌ Error:', e);
                return {
                    sodBalance: 1000000,
                    usdtBalance: 0,
                    miningPower: 10,
                    userLevel: 1,
                    usdtProgress: 1000000,
                    totalMined: 0
                };
            }
        },
        
        saveGameData: async function(userId, gameData) {
            try {
                const { error } = await window.supabaseClient
                    .from('users')
                    .update({
                        sod_balance: gameData.sodBalance,
                        usdt_balance: gameData.usdtBalance,
                        mining_power: gameData.miningPower,
                        level: gameData.userLevel,
                        usdt_progress: gameData.usdtProgress,
                        total_mined: gameData.totalMined,
                        last_updated: new Date().toISOString()
                    })
                    .eq('id', userId);
                
                if (error) throw error;
                return true;
            } catch (e) {
                console.error('❌ Error:', e);
                return false;
            }
        },
        
        getSalePlans: async function() {
            try {
                const { data, error } = await window.supabaseClient
                    .from('sale_plans')
                    .select('*');
                
                if (error) throw error;
                return data || [];
            } catch (e) {
                console.error('❌ Error:', e);
                return [];
            }
        },
        
        addTransaction: async function(userId, transaction) {
            try {
                const { error } = await window.supabaseClient
                    .from('transactions')
                    .insert([{
                        user_id: userId,
                        type: transaction.type,
                        amount: transaction.amount,
                        currency: transaction.currency,
                        description: transaction.description || ''
                    }]);
                
                if (error) throw error;
                return true;
            } catch (e) {
                console.error('❌ Error:', e);
                return false;
            }
        }
    };
    
    console.log('✅ Supabase service loaded');
}
