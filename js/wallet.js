// js/wallet.js - سیستم کیف پول کاربران (نسخه نهایی)
class WalletService {
    constructor() {
        console.log('💰 WalletService initializing...');
        this.supabase = window.supabaseClient;
        this.supabaseService = window.supabaseService;
        this.walletSettings = {};
        this.loadWalletSettings();
    }

    // بارگذاری تنظیمات کیف پول
    async loadWalletSettings() {
        this.walletSettings = await this.supabaseService.getWalletSettingsFromDB();
        console.log('✅ Wallet settings loaded:', this.walletSettings);
    }

    // 1. دریافت کیف پول کاربر
    async getUserWallet(userId) {
        const wallet = await this.supabaseService.getUserWalletFromDB(userId);
        
        // اگر کیف پول وجود نداشت، ایجادش کن
        if (!wallet) {
            console.log('⚠️ Wallet not found, creating new one for user:', userId);
            return await this.supabaseService.createUserWalletInDB(userId);
        }
        
        return wallet;
    }

    // 2. دریافت موجودی
    async getBalance(userId, currency = 'both') {
        try {
            const wallet = await this.getUserWallet(userId);
            if (!wallet) return null;

            if (currency === 'usdt') return parseFloat(wallet.usdt_balance);
            if (currency === 'sod') return parseInt(wallet.sod_balance);
            
            return {
                usdt: parseFloat(wallet.usdt_balance),
                sod: parseInt(wallet.sod_balance),
                pending: parseFloat(wallet.pending_withdrawal || 0)
            };
        } catch (error) {
            console.error('❌ Get balance error:', error);
            return null;
        }
    }

    // 3. شارژ کیف پول
    async depositToWallet(userId, amount, currency = 'USDT', paymentMethod = 'manual', transactionId = null) {
        try {
            console.log(`💳 Deposit request: ${amount} ${currency} for user ${userId}`);
            
            // دریافت کیف پول فعلی
            const wallet = await this.getUserWallet(userId);
            if (!wallet) throw new Error('کیف پول پیدا نشد');

            // آپدیت موجودی
            let updateData = {};
            if (currency === 'USDT') {
                const usdtCap = parseFloat(this.walletSettings.wallet_usdt_cap || 10000);
                const newBalance = parseFloat(wallet.usdt_balance) + parseFloat(amount);
                
                if (newBalance > usdtCap) {
                    throw new Error(`سقف کیف پول USDT ${usdtCap} می‌باشد. موجودی جدید: ${newBalance}`);
                }
                
                updateData = {
                    usdt_balance: newBalance,
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
                transactionId: transactionId || `DEP-${Date.now()}`,
                description: `شارژ کیف پول از طریق ${paymentMethod}`
            });

            console.log(`✅ Deposit successful: ${amount} ${currency} for user ${userId}`);
            return {
                success: true,
                newBalance: currency === 'USDT' ? updateData.usdt_balance : updateData.sod_balance
            };
        } catch (error) {
            console.error('❌ Deposit error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // 4. درخواست برداشت
    async requestWithdrawal(userId, amount, currency, walletAddress, network = 'TRC20') {
        try {
            console.log(`💰 Withdrawal request: ${amount} ${currency} to ${walletAddress}`);
            
            // بررسی تنظیمات
            const minWithdrawal = parseFloat(this.walletSettings.min_withdrawal_usdt || 10);
            const maxWithdrawal = parseFloat(this.walletSettings.max_withdrawal_usdt || 1000);
            const feePercent = parseFloat(this.walletSettings.withdrawal_fee_percent || 2);
            
            if (currency === 'USDT' && amount < minWithdrawal) {
                throw new Error(`حداقل برداشت ${minWithdrawal} USDT می‌باشد`);
            }
            
            if (currency === 'USDT' && amount > maxWithdrawal) {
                throw new Error(`حداکثر برداشت ${maxWithdrawal} USDT می‌باشد`);
            }
            
            // بررسی آدرس کیف پول
            if (!walletAddress || walletAddress.length < 10) {
                throw new Error('آدرس کیف پول معتبر نیست');
            }
            
            const wallet = await this.getUserWallet(userId);
            if (!wallet) throw new Error('کیف پول پیدا نشد');

            // بررسی موجودی کافی
            if (currency === 'USDT') {
                const fee = amount * (feePercent / 100);
                const totalAmount = amount + fee;
                
                if (parseFloat(wallet.usdt_balance) < totalAmount) {
                    throw new Error(`موجودی کافی نیست. نیاز: ${totalAmount.toFixed(2)} USDT (${amount} + ${fee.toFixed(2)} کارمزد)`);
                }
            }

            // ایجاد درخواست برداشت
            const request = await this.supabaseService.createWithdrawalRequest(userId, {
                amount: amount,
                currency: currency,
                walletAddress: walletAddress,
                network: network
            });

            if (!request) throw new Error('خطا در ایجاد درخواست');

            // کاهش موجودی موقت
            if (currency === 'USDT') {
                const fee = amount * (feePercent / 100);
                const totalAmount = amount + fee;
                
                const updateData = {
                    usdt_balance: parseFloat(wallet.usdt_balance) - totalAmount,
                    pending_withdrawal: parseFloat(wallet.pending_withdrawal || 0) + amount,
                    total_withdrawn_usdt: parseFloat(wallet.total_withdrawn_usdt) + amount
                };

                await this.supabaseService.updateUserWallet(userId, updateData);
            }

            // ثبت تراکنش کارمزد
            if (currency === 'USDT') {
                const fee = amount * (feePercent / 100);
                await this.supabaseService.addWalletTransactionToDB({
                    userId: userId,
                    type: 'withdrawal_fee',
                    amount: -fee,
                    currency: currency,
                    description: `کارمزد برداشت ${amount} ${currency}`
                });
            }

            console.log(`✅ Withdrawal requested: ${amount} ${currency} for user ${userId}`);
            
            const processingTime = this.walletSettings.withdrawal_processing_time || 24;
            
            return {
                success: true,
                requestId: request.id,
                processingTime: processingTime,
                fee: currency === 'USDT' ? amount * (feePercent / 100) : 0
            };
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
                    const feePercent = parseFloat(this.walletSettings.withdrawal_fee_percent || 2);
                    const fee = request.amount * (feePercent / 100);
                    const totalAmount = request.amount + fee;
                    
                    let updateData = {};
                    if (request.currency === 'USDT') {
                        updateData = {
                            usdt_balance: parseFloat(wallet.usdt_balance) + totalAmount,
                            pending_withdrawal: parseFloat(wallet.pending_withdrawal || 0) - request.amount,
                            total_withdrawn_usdt: parseFloat(wallet.total_withdrawn_usdt) - request.amount
                        };
                    }

                    await this.supabaseService.updateUserWallet(request.user_id, updateData);
                    
                    // حذف تراکنش کارمزد
                    await this.supabase
                        .from('wallet_transactions')
                        .delete()
                        .eq('user_id', request.user_id)
                        .eq('type', 'withdrawal_fee')
                        .eq('amount', -fee)
                        .gte('created_at', request.created_at);
                }
            }

            // اگر تأیید شد، ثبت تراکنش برداشت
            if (status === 'completed') {
                await this.supabaseService.addWalletTransactionToDB({
                    userId: request.user_id,
                    type: 'withdrawal',
                    amount: -request.amount,
                    currency: request.currency,
                    description: `برداشت به آدرس ${request.wallet_address} (${request.network})`
                });
            }

            return {
                success: true,
                status: status
            };
        } catch (error) {
            console.error('❌ Update withdrawal status error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // 7. انتقال بین کیف‌پول‌ها
    async transferFunds(senderId, receiverId, amount, currency = 'SOD', description = '') {
        try {
            console.log(`🔄 Transfer: ${amount} ${currency} from ${senderId} to ${receiverId}`);
            
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
            const transferDesc = description || `انتقال به کاربر ${receiverId}`;
            
            await this.supabaseService.addWalletTransactionToDB({
                userId: senderId,
                type: 'transfer_sent',
                amount: -parseFloat(amount),
                currency: currency,
                description: transferDesc
            });

            await this.supabaseService.addWalletTransactionToDB({
                userId: receiverId,
                type: 'transfer_received',
                amount: parseFloat(amount),
                currency: currency,
                description: `دریافت از کاربر ${senderId}`
            });

            return {
                success: true,
                amount: amount,
                currency: currency
            };
        } catch (error) {
            console.error('❌ Transfer error:', error);
            throw error;
        }
    }

    // 8. خرید پنل از کیف پول
    async purchasePlanFromWallet(userId, planId, planPrice, planName) {
        try {
            const wallet = await this.getUserWallet(userId);
            if (!wallet) throw new Error('کیف پول پیدا نشد');

            // بررسی موجودی کافی
            if (parseFloat(wallet.usdt_balance) < parseFloat(planPrice)) {
                throw new Error('موجودی USDT کافی نیست');
            }

            // کسر از کیف پول
            const updateData = {
                usdt_balance: parseFloat(wallet.usdt_balance) - parseFloat(planPrice)
            };

            await this.supabaseService.updateUserWallet(userId, updateData);

            // ثبت تراکنش خرید
            await this.supabaseService.addWalletTransactionToDB({
                userId: userId,
                type: 'plan_purchase',
                amount: -parseFloat(planPrice),
                currency: 'USDT',
                description: `خرید پنل ${planName}`
            });

            return {
                success: true,
                newBalance: updateData.usdt_balance
            };
        } catch (error) {
            console.error('❌ Purchase plan error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // 9. دریافت تنظیمات کیف پول
    async getWalletSettings() {
        return this.walletSettings;
    }

    // 10. آپدیت تنظیمات کیف پول
    async updateWalletSettings(settings) {
        try {
            const success = await this.supabaseService.updateWalletSettings(settings);
            if (success) {
                // آپدیت تنظیمات محلی
                this.walletSettings = { ...this.walletSettings, ...settings };
            }
            return success;
        } catch (error) {
            console.error('❌ Update wallet settings error:', error);
            return false;
        }
    }

    // 11. دریافت درخواست‌های برداشت کاربر
    async getUserWithdrawalRequests(userId, limit = 10) {
        try {
            const { data, error } = await this.supabase
                .from('withdrawal_requests')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false })
                .limit(limit);

            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('❌ Error getting user withdrawal requests:', error);
            return [];
        }
    }

    // 12. بررسی وضعیت درخواست برداشت
    async getWithdrawalRequestStatus(requestId) {
        try {
            const { data, error } = await this.supabase
                .from('withdrawal_requests')
                .select('*')
                .eq('id', requestId)
                .single();

            if (error) throw error;
            return data;
        } catch (error) {
            console.error('❌ Error getting withdrawal status:', error);
            return null;
        }
    }

    // 13. دریافت آدرس کیف پول کاربر
    async getUserWalletAddress(userId) {
        try {
            const wallet = await this.getUserWallet(userId);
            return wallet?.wallet_address || null;
        } catch (error) {
            console.error('❌ Error getting wallet address:', error);
            return null;
        }
    }

    // 14. دریافت آمار کیف پول
    async getWalletStats(userId) {
        try {
            const wallet = await this.getUserWallet(userId);
            if (!wallet) return null;

            // دریافت تعداد تراکنش‌ها
            const { count: transactionsCount, error: countError } = await this.supabase
                .from('wallet_transactions')
                .select('id', { count: 'exact', head: true })
                .eq('user_id', userId);

            // دریافت تعداد برداشت‌ها
            const { count: withdrawalsCount, error: withdrawalsError } = await this.supabase
                .from('withdrawal_requests')
                .select('id', { count: 'exact', head: true })
                .eq('user_id', userId);

            return {
                totalDeposited: parseFloat(wallet.total_deposited_usdt),
                totalWithdrawn: parseFloat(wallet.total_withdrawn_usdt),
                pendingWithdrawal: parseFloat(wallet.pending_withdrawal || 0),
                transactionsCount: transactionsCount || 0,
                withdrawalsCount: withdrawalsCount || 0,
                walletAddress: wallet.wallet_address,
                createdAt: wallet.created_at
            };
        } catch (error) {
            console.error('❌ Error getting wallet stats:', error);
            return null;
        }
    }
}

// ایجاد instance جهانی
window.walletService = new WalletService();
console.log('✅ Wallet Service loaded and ready');
