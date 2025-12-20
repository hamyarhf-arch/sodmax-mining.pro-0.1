// js/wallet.js - سیستم کیف پول کاربران
class WalletService {
    constructor() {
        console.log('💰 WalletService initializing...');
        this.supabase = window.supabaseClient;
    }

    // 1. ایجاد کیف پول برای کاربر جدید
    async createUserWallet(userId) {
        try {
            const walletData = {
                user_id: userId,
                sod_balance: 1000000, // مقدار اولیه
                usdt_balance: 0,
                total_deposited_usdt: 0,
                total_withdrawn_usdt: 0,
                wallet_address: this.generateWalletAddress(),
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };

            const { data, error } = await this.supabase
                .from('user_wallets')
                .insert([walletData]);

            if (error) throw error;
            console.log('✅ Wallet created for user:', userId);
            return data[0];
        } catch (error) {
            console.error('❌ Error creating wallet:', error);
            return null;
        }
    }

    // 2. دریافت کیف پول کاربر
    async getUserWallet(userId) {
        try {
            const { data, error } = await this.supabase
                .from('user_wallets')
                .select('*')
                .eq('user_id', userId)
                .single();

            if (error && error.code !== 'PGRST116') throw error;
            
            if (!data) {
                return await this.createUserWallet(userId);
            }
            
            return data;
        } catch (error) {
            console.error('❌ Error getting wallet:', error);
            return null;
        }
    }

    // 3. شارژ کیف پول
    async depositToWallet(userId, amount, currency = 'USDT', paymentMethod, transactionId) {
        try {
            // دریافت کیف پول فعلی
            const wallet = await this.getUserWallet(userId);
            if (!wallet) throw new Error('کیف پول پیدا نشد');

            // آپدیت موجودی
            let updateData = {};
            if (currency === 'USDT') {
                updateData = {
                    usdt_balance: parseFloat(wallet.usdt_balance) + parseFloat(amount),
                    total_deposited_usdt: parseFloat(wallet.total_deposited_usdt) + parseFloat(amount)
                };
            } else if (currency === 'SOD') {
                updateData = {
                    sod_balance: parseInt(wallet.sod_balance) + parseInt(amount)
                };
            }

            const { error: updateError } = await this.supabase
                .from('user_wallets')
                .update(updateData)
                .eq('user_id', userId);

            if (updateError) throw updateError;

            // ثبت تراکنش شارژ
            const { error: transError } = await this.supabase
                .from('wallet_transactions')
                .insert([{
                    user_id: userId,
                    type: 'deposit',
                    amount: parseFloat(amount),
                    currency: currency,
                    payment_method: paymentMethod,
                    transaction_id: transactionId,
                    status: 'completed',
                    description: `شارژ کیف پول از طریق ${paymentMethod}`,
                    created_at: new Date().toISOString()
                }]);

            if (transError) throw transError;

            console.log(`✅ Deposit successful: ${amount} ${currency} for user ${userId}`);
            return true;
        } catch (error) {
            console.error('❌ Deposit error:', error);
            return false;
        }
    }

    // 4. درخواست برداشت
    async requestWithdrawal(userId, amount, currency, walletAddress, network = 'TRC20') {
        try {
            const wallet = await this.getUserWallet(userId);
            if (!wallet) throw new Error('کیف پول پیدا نشد');

            // بررسی موجودی کافی
            if (currency === 'USDT' && parseFloat(wallet.usdt_balance) < parseFloat(amount)) {
                throw new Error('موجودی کافی نیست');
            }

            if (currency === 'SOD' && parseInt(wallet.sod_balance) < parseInt(amount)) {
                throw new Error('موجودی کافی نیست');
            }

            // ایجاد درخواست برداشت
            const { data, error } = await this.supabase
                .from('withdrawal_requests')
                .insert([{
                    user_id: userId,
                    amount: parseFloat(amount),
                    currency: currency,
                    wallet_address: walletAddress,
                    network: network,
                    status: 'pending', // pending, approved, rejected, completed
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                }])
                .select()
                .single();

            if (error) throw error;

            // کاهش موجودی موقت (تا زمان تأیید ادمین)
            let updateData = {};
            if (currency === 'USDT') {
                updateData = {
                    usdt_balance: parseFloat(wallet.usdt_balance) - parseFloat(amount),
                    pending_withdrawal: parseFloat(wallet.pending_withdrawal || 0) + parseFloat(amount)
                };
            }

            const { error: updateError } = await this.supabase
                .from('user_wallets')
                .update(updateData)
                .eq('user_id', userId);

            if (updateError) throw updateError;

            console.log(`✅ Withdrawal requested: ${amount} ${currency} for user ${userId}`);
            return data;
        } catch (error) {
            console.error('❌ Withdrawal request error:', error);
            throw error;
        }
    }

    // 5. دریافت لیست تراکنش‌های کیف پول
    async getWalletTransactions(userId, limit = 20, offset = 0) {
        try {
            const { data, error } = await this.supabase
                .from('wallet_transactions')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false })
                .range(offset, offset + limit - 1);

            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('❌ Error getting wallet transactions:', error);
            return [];
        }
    }

    // 6. آپدیت وضعیت برداشت (برای ادمین)
    async updateWithdrawalStatus(requestId, status, adminNotes = '') {
        try {
            // دریافت درخواست برداشت
            const { data: request, error: reqError } = await this.supabase
                .from('withdrawal_requests')
                .select('*')
                .eq('id', requestId)
                .single();

            if (reqError) throw reqError;

            // آپدیت وضعیت
            const { error: updateError } = await this.supabase
                .from('withdrawal_requests')
                .update({
                    status: status,
                    admin_notes: adminNotes,
                    processed_at: status === 'completed' ? new Date().toISOString() : null,
                    updated_at: new Date().toISOString()
                })
                .eq('id', requestId);

            if (updateError) throw updateError;

            // اگر رد شد، بازگرداندن موجودی
            if (status === 'rejected') {
                const wallet = await this.getUserWallet(request.user_id);
                let updateData = {};
                if (request.currency === 'USDT') {
                    updateData = {
                        usdt_balance: parseFloat(wallet.usdt_balance) + parseFloat(request.amount),
                        pending_withdrawal: parseFloat(wallet.pending_withdrawal || 0) - parseFloat(request.amount)
                    };
                }

                await this.supabase
                    .from('user_wallets')
                    .update(updateData)
                    .eq('user_id', request.user_id);
            }

            // اگر تأیید شد، ثبت تراکنش برداشت
            if (status === 'completed') {
                await this.supabase
                    .from('wallet_transactions')
                    .insert([{
                        user_id: request.user_id,
                        type: 'withdrawal',
                        amount: -parseFloat(request.amount),
                        currency: request.currency,
                        status: 'completed',
                        description: `برداشت به آدرس ${request.wallet_address} (${request.network})`,
                        created_at: new Date().toISOString()
                    }]);
            }

            return true;
        } catch (error) {
            console.error('❌ Update withdrawal status error:', error);
            return false;
        }
    }

    // 7. تولید آدرس کیف پول تصادفی
    generateWalletAddress() {
        const chars = '0123456789ABCDEF';
        let address = 'SOD';
        for (let i = 0; i < 10; i++) {
            address += chars[Math.floor(Math.random() * chars.length)];
        }
        return address;
    }

    // 8. دریافت موجودی
    async getBalance(userId, currency = 'both') {
        try {
            const wallet = await this.getUserWallet(userId);
            if (!wallet) return null;

            if (currency === 'usdt') return parseFloat(wallet.usdt_balance);
            if (currency === 'sod') return parseInt(wallet.sod_balance);
            
            return {
                usdt: parseFloat(wallet.usdt_balance),
                sod: parseInt(wallet.sod_balance)
            };
        } catch (error) {
            console.error('❌ Get balance error:', error);
            return null;
        }
    }

    // 9. انتقال بین کیف‌پول‌ها
    async transferFunds(senderId, receiverId, amount, currency = 'SOD') {
        try {
            // بررسی موجودی فرستنده
            const senderWallet = await this.getUserWallet(senderId);
            const receiverWallet = await this.getUserWallet(receiverId);

            if (!senderWallet || !receiverWallet) {
                throw new Error('کیف پول پیدا نشد');
            }

            if (currency === 'USDT' && parseFloat(senderWallet.usdt_balance) < parseFloat(amount)) {
                throw new Error('موجودی کافی نیست');
            }

            if (currency === 'SOD' && parseInt(senderWallet.sod_balance) < parseInt(amount)) {
                throw new Error('موجودی کافی نیست');
            }

            // کسر از فرستنده
            let senderUpdate = {};
            let receiverUpdate = {};

            if (currency === 'USDT') {
                senderUpdate = { usdt_balance: parseFloat(senderWallet.usdt_balance) - parseFloat(amount) };
                receiverUpdate = { usdt_balance: parseFloat(receiverWallet.usdt_balance) + parseFloat(amount) };
            } else {
                senderUpdate = { sod_balance: parseInt(senderWallet.sod_balance) - parseInt(amount) };
                receiverUpdate = { sod_balance: parseInt(receiverWallet.sod_balance) + parseInt(amount) };
            }

            // آپدیت فرستنده
            const { error: senderError } = await this.supabase
                .from('user_wallets')
                .update(senderUpdate)
                .eq('user_id', senderId);

            if (senderError) throw senderError;

            // آپدیت گیرنده
            const { error: receiverError } = await this.supabase
                .from('user_wallets')
                .update(receiverUpdate)
                .eq('user_id', receiverId);

            if (receiverError) throw receiverError;

            // ثبت تراکنش‌ها
            await this.supabase
                .from('wallet_transactions')
                .insert([
                    {
                        user_id: senderId,
                        type: 'transfer_sent',
                        amount: -parseFloat(amount),
                        currency: currency,
                        description: `انتقال به کاربر ${receiverId}`,
                        created_at: new Date().toISOString()
                    },
                    {
                        user_id: receiverId,
                        type: 'transfer_received',
                        amount: parseFloat(amount),
                        currency: currency,
                        description: `دریافت از کاربر ${senderId}`,
                        created_at: new Date().toISOString()
                    }
                ]);

            return true;
        } catch (error) {
            console.error('❌ Transfer error:', error);
            throw error;
        }
    }
}

// ایجاد instance جهانی
window.walletService = new WalletService();
console.log('✅ Wallet Service loaded');
