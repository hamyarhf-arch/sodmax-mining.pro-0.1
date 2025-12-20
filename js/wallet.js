// js/wallet.js - سیستم کیف پول کاربران (نسخه سازگار)
class WalletService {
    constructor() {
        console.log('💰 WalletService initializing...');
        this.supabase = window.supabaseClient;
        this.supabaseService = window.supabaseService;
    }

    // 1. ایجاد کیف پول برای کاربر جدید
    async createUserWallet(userId) {
        return await this.supabaseService.createUserWalletInDB(userId);
    }

    // 2. دریافت کیف پول کاربر
    async getUserWallet(userId) {
        return await this.supabaseService.getUserWalletFromDB(userId);
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

            const success = await this.supabaseService.updateUserWallet(userId, updateData);
            if (!success) throw new Error('خطا در آپدیت کیف پول');

            // ثبت تراکنش شارژ
            await this.supabaseService.addWalletTransactionToDB({
                userId: userId,
                type: 'deposit',
                amount: parseFloat(amount),
                currency: currency,
                paymentMethod: paymentMethod,
                transactionId: transactionId,
                description: `شارژ کیف پول از طریق ${paymentMethod}`
            });

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

            // ایجاد درخواست برداشت
            const request = await this.supabaseService.createWithdrawalRequest(userId, {
                amount: amount,
                currency: currency,
                walletAddress: walletAddress,
                network: network
            });

            if (!request) throw new Error('خطا در ایجاد درخواست');

            // کاهش موجودی موقت (تا زمان تأیید ادمین)
            let updateData = {};
            if (currency === 'USDT') {
                updateData = {
                    usdt_balance: parseFloat(wallet.usdt_balance) - parseFloat(amount),
                    pending_withdrawal: parseFloat(wallet.pending_withdrawal || 0) + parseFloat(amount)
                };
            }

            await this.supabaseService.updateUserWallet(userId, updateData);

            console.log(`✅ Withdrawal requested: ${amount} ${currency} for user ${userId}`);
            return request;
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
            const success = await this.supabaseService.updateWithdrawalRequestStatus(requestId, status, adminNotes);
            if (!success) throw new Error('خطا در آپدیت وضعیت');

            // اگر رد شد، بازگرداندن موجودی
            if (status === 'rejected') {
                const wallet = await this.getUserWallet(request.user_id);
                if (wallet) {
                    let updateData = {};
                    if (request.currency === 'USDT') {
                        updateData = {
                            usdt_balance: parseFloat(wallet.usdt_balance) + parseFloat(request.amount),
                            pending_withdrawal: parseFloat(wallet.pending_withdrawal || 0) - parseFloat(request.amount)
                        };
                    }

                    await this.supabaseService.updateUserWallet(request.user_id, updateData);
                }
            }

            // اگر تأیید شد، ثبت تراکنش برداشت
            if (status === 'completed') {
                await this.supabaseService.addWalletTransactionToDB({
                    userId: request.user_id,
                    type: 'withdrawal',
                    amount: -parseFloat(request.amount),
                    currency: request.currency,
                    description: `برداشت به آدرس ${request.wallet_address} (${request.network})`
                });
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
            await this.supabaseService.updateUserWallet(senderId, senderUpdate);

            // آپدیت گیرنده
            await this.supabaseService.updateUserWallet(receiverId, receiverUpdate);

            // ثبت تراکنش‌ها
            await this.supabaseService.addWalletTransactionToDB({
                userId: senderId,
                type: 'transfer_sent',
                amount: -parseFloat(amount),
                currency: currency,
                description: `انتقال به کاربر ${receiverId}`
            });

            await this.supabaseService.addWalletTransactionToDB({
                userId: receiverId,
                type: 'transfer_received',
                amount: parseFloat(amount),
                currency: currency,
                description: `دریافت از کاربر ${senderId}`
            });

            return true;
        } catch (error) {
            console.error('❌ Transfer error:', error);
            throw error;
        }
    }

    // 10. دریافت تنظیمات کیف پول
    async getWalletSettings() {
        return await this.supabaseService.getWalletSettingsFromDB();
    }

    // 11. آپدیت تنظیمات کیف پول
    async updateWalletSettings(settings) {
        return await this.supabaseService.updateWalletSettings(settings);
    }
}

// ایجاد instance جهانی
window.walletService = new WalletService();
console.log('✅ Wallet Service loaded');
