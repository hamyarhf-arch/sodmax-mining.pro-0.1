// js/wallet.js - سیستم کیف پول کاربران (نسخه نهایی و کامل)
class WalletService {
    constructor() {
        console.log('💰 WalletService initializing...');
        this.supabase = window.supabaseClient;
        this.supabaseService = null;
        this.walletSettings = {};
        
        // منتظر بارگذاری سرویس‌ها
        this.initialize();
    }

    async initialize() {
        console.log('🔄 WalletService waiting for dependencies...');
        
        // منتظر supabaseService
        let attempts = 0;
        while (attempts < 20) {
            if (window.supabaseService) {
                this.supabaseService = window.supabaseService;
                console.log('✅ SupabaseService loaded in WalletService');
                break;
            }
            await new Promise(resolve => setTimeout(resolve, 200));
            attempts++;
        }
        
        if (!this.supabaseService) {
            console.warn('⚠️ SupabaseService not found, some features may not work');
        }
        
        // بارگذاری تنظیمات
        await this.loadWalletSettings();
        console.log('✅ WalletService initialized successfully');
    }

    // بارگذاری تنظیمات کیف پول
    async loadWalletSettings() {
        try {
            if (this.supabaseService && this.supabaseService.getWalletSettingsFromDB) {
                this.walletSettings = await this.supabaseService.getWalletSettingsFromDB();
                console.log('✅ Wallet settings loaded:', this.walletSettings);
            } else {
                console.warn('⚠️ Using default wallet settings');
                this.walletSettings = this.getDefaultSettings();
            }
        } catch (error) {
            console.error('❌ Error loading wallet settings:', error);
            this.walletSettings = this.getDefaultSettings();
        }
    }

    getDefaultSettings() {
        return {
            enable_bank_gateway: 'true',
            enable_crypto_gateway: 'true',
            min_withdrawal_usdt: '10',
            max_withdrawal_usdt: '1000',
            withdrawal_fee_percent: '2',
            withdrawal_processing_time: '24',
            max_daily_boosts: '3',
            max_daily_purchases: '5',
            daily_mining_limit: '1000000',
            wallet_usdt_cap: '10000',
            min_deposit_usdt: '1',
            max_deposit_usdt: '5000'
        };
    }

    // 1. دریافت کیف پول کاربر
    async getUserWallet(userId) {
        try {
            console.log('🔍 Getting wallet for user:', userId);
            
            if (!this.supabaseService || !this.supabaseService.getUserWalletFromDB) {
                console.warn('⚠️ SupabaseService not ready');
                return null;
            }
            
            const wallet = await this.supabaseService.getUserWalletFromDB(userId);
            
            // اگر کیف پول وجود نداشت، ایجادش کن
            if (!wallet && this.supabaseService.createUserWalletInDB) {
                console.log('🆕 Wallet not found, creating new one for user:', userId);
                return await this.supabaseService.createUserWalletInDB(userId);
            }
            
            return wallet;
        } catch (error) {
            console.error('❌ Error getting user wallet:', error);
            return null;
        }
    }

    // 2. دریافت موجودی
    async getBalance(userId, currency = 'both') {
        try {
            const wallet = await this.getUserWallet(userId);
            if (!wallet) {
                console.warn('⚠️ Wallet not found for user:', userId);
                return null;
            }

            if (currency === 'usdt') {
                return parseFloat(wallet.usdt_balance) || 0;
            }
            
            if (currency === 'sod') {
                return parseInt(wallet.sod_balance) || 0;
            }
            
            // اگر both یا چیز دیگر
            return {
                usdt: parseFloat(wallet.usdt_balance) || 0,
                sod: parseInt(wallet.sod_balance) || 0,
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
            
            // اعتبارسنجی مقدار
            amount = parseFloat(amount);
            if (!amount || amount <= 0) {
                throw new Error('مبلغ وارد شده معتبر نیست');
            }
            
            const wallet = await this.getUserWallet(userId);
            if (!wallet) {
                throw new Error('کیف پول پیدا نشد');
            }

            let updateData = {};
            let newBalance = 0;
            
            if (currency === 'USDT') {
                // بررسی محدودیت‌ها
                const minDeposit = parseFloat(this.walletSettings.min_deposit_usdt || 1);
                const maxDeposit = parseFloat(this.walletSettings.max_deposit_usdt || 5000);
                const usdtCap = parseFloat(this.walletSettings.wallet_usdt_cap || 10000);
                
                if (amount < minDeposit) {
                    throw new Error(`حداقل شارژ ${minDeposit} USDT می‌باشد`);
                }
                
                if (amount > maxDeposit) {
                    throw new Error(`حداکثر شارژ ${maxDeposit} USDT می‌باشد`);
                }
                
                newBalance = (parseFloat(wallet.usdt_balance) || 0) + amount;
                
                if (newBalance > usdtCap) {
                    throw new Error(`سقف کیف پول USDT ${usdtCap} می‌باشد. موجودی جدید: ${newBalance}`);
                }
                
                updateData = {
                    usdt_balance: newBalance,
                    total_deposited_usdt: (parseFloat(wallet.total_deposited_usdt) || 0) + amount
                };
            } else if (currency === 'SOD') {
                newBalance = (parseInt(wallet.sod_balance) || 0) + parseInt(amount);
                updateData = {
                    sod_balance: newBalance
                };
            } else {
                throw new Error(`ارز ${currency} پشتیبانی نمی‌شود`);
            }

            // بررسی سرویس
            if (!this.supabaseService || !this.supabaseService.updateUserWallet) {
                throw new Error('سرویس در دسترس نیست');
            }

            // آپدیت کیف پول
            const success = await this.supabaseService.updateUserWallet(userId, updateData);
            if (!success) {
                throw new Error('خطا در آپدیت کیف پول');
            }

            // ثبت تراکنش
            if (this.supabaseService.addWalletTransactionToDB) {
                await this.supabaseService.addWalletTransactionToDB({
                    userId: userId,
                    type: 'deposit',
                    amount: amount,
                    currency: currency,
                    paymentMethod: paymentMethod,
                    transactionId: transactionId || `DEP-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                    description: `شارژ کیف پول از طریق ${paymentMethod}`
                });
            }

            console.log(`✅ Deposit successful: ${amount} ${currency} for user ${userId}`);
            
            return {
                success: true,
                newBalance: newBalance,
                message: `شارژ ${amount} ${currency} با موفقیت انجام شد`
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
            
            // اعتبارسنجی
            amount = parseFloat(amount);
            if (!amount || amount <= 0) {
                throw new Error('مبلغ وارد شده معتبر نیست');
            }
            
            if (!walletAddress || walletAddress.trim().length < 10) {
                throw new Error('آدرس کیف پول معتبر نیست');
            }
            
            // بررسی تنظیمات
            const minWithdrawal = parseFloat(this.walletSettings.min_withdrawal_usdt || 10);
            const maxWithdrawal = parseFloat(this.walletSettings.max_withdrawal_usdt || 1000);
            const feePercent = parseFloat(this.walletSettings.withdrawal_fee_percent || 2);
            
            if (currency === 'USDT') {
                if (amount < minWithdrawal) {
                    throw new Error(`حداقل برداشت ${minWithdrawal} USDT می‌باشد`);
                }
                
                if (amount > maxWithdrawal) {
                    throw new Error(`حداکثر برداشت ${maxWithdrawal} USDT می‌باشد`);
                }
            }
            
            const wallet = await this.getUserWallet(userId);
            if (!wallet) {
                throw new Error('کیف پول پیدا نشد');
            }

            // بررسی موجودی کافی
            if (currency === 'USDT') {
                const fee = amount * (feePercent / 100);
                const totalAmount = amount + fee;
                
                const currentBalance = parseFloat(wallet.usdt_balance) || 0;
                if (currentBalance < totalAmount) {
                    throw new Error(`موجودی کافی نیست. نیاز: ${totalAmount.toFixed(2)} USDT (${amount} + ${fee.toFixed(2)} کارمزد)`);
                }
            } else if (currency === 'SOD') {
                const currentBalance = parseInt(wallet.sod_balance) || 0;
                if (currentBalance < amount) {
                    throw new Error(`موجودی SOD کافی نیست`);
                }
            }

            // بررسی سرویس‌ها
            if (!this.supabaseService) {
                throw new Error('سرویس در دسترس نیست');
            }

            // ایجاد درخواست برداشت
            const requestData = {
                amount: amount,
                currency: currency,
                walletAddress: walletAddress.trim(),
                network: network
            };

            let request;
            if (this.supabaseService.createWithdrawalRequest) {
                request = await this.supabaseService.createWithdrawalRequest(userId, requestData);
                if (!request) {
                    throw new Error('خطا در ایجاد درخواست برداشت');
                }
            } else {
                // Fallback: ذخیره در localStorage (برای تست)
                request = {
                    id: `WR-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                    ...requestData,
                    status: 'pending',
                    created_at: new Date().toISOString()
                };
                
                // ذخیره در localStorage
                const withdrawals = JSON.parse(localStorage.getItem('temp_withdrawals') || '[]');
                withdrawals.push({ userId, ...request });
                localStorage.setItem('temp_withdrawals', JSON.stringify(withdrawals));
            }

            // کسر از موجودی (برای USDT)
            if (currency === 'USDT') {
                const fee = amount * (feePercent / 100);
                const totalAmount = amount + fee;
                
                const updateData = {
                    usdt_balance: (parseFloat(wallet.usdt_balance) || 0) - totalAmount,
                    pending_withdrawal: (parseFloat(wallet.pending_withdrawal) || 0) + amount,
                    total_withdrawn_usdt: (parseFloat(wallet.total_withdrawn_usdt) || 0) + amount
                };

                if (this.supabaseService.updateUserWallet) {
                    await this.supabaseService.updateUserWallet(userId, updateData);
                }
            }

            // ثبت تراکنش کارمزد
            if (currency === 'USDT' && this.supabaseService.addWalletTransactionToDB) {
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
            
            const processingTime = parseInt(this.walletSettings.withdrawal_processing_time || 24);
            const fee = currency === 'USDT' ? amount * (feePercent / 100) : 0;
            
            return {
                success: true,
                requestId: request.id,
                processingTime: processingTime,
                fee: fee,
                message: `درخواست برداشت ${amount} ${currency} ثبت شد. زمان پردازش: ${processingTime} ساعت`
            };
        } catch (error) {
            console.error('❌ Withdrawal request error:', error);
            throw error; // خطا را به بالا منتقل کن تا UI مدیریت کند
        }
    }

    // 5. دریافت لیست تراکنش‌های کیف پول
    async getWalletTransactions(userId, limit = 20, offset = 0) {
        try {
            if (!this.supabase) {
                console.warn('⚠️ Supabase client not available');
                return [];
            }
            
            const { data, error } = await this.supabase
                .from('wallet_transactions')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false })
                .range(offset, offset + limit - 1);

            if (error) {
                console.error('❌ Supabase error:', error);
                throw error;
            }
            
            return data || [];
        } catch (error) {
            console.error('❌ Error getting wallet transactions:', error);
            return [];
        }
    }

    // 6. دریافت آمار کیف پول
    async getWalletStats(userId) {
        try {
            const wallet = await this.getUserWallet(userId);
            if (!wallet) {
                return null;
            }

            // دریافت تعداد تراکنش‌ها
            let transactionsCount = 0;
            if (this.supabase) {
                const { count, error } = await this.supabase
                    .from('wallet_transactions')
                    .select('id', { count: 'exact', head: true })
                    .eq('user_id', userId);
                    
                if (!error) {
                    transactionsCount = count || 0;
                }
            }

            return {
                totalDeposited: parseFloat(wallet.total_deposited_usdt) || 0,
                totalWithdrawn: parseFloat(wallet.total_withdrawn_usdt) || 0,
                pendingWithdrawal: parseFloat(wallet.pending_withdrawal || 0),
                transactionsCount: transactionsCount,
                walletAddress: wallet.wallet_address || 'تنظیم نشده',
                createdAt: wallet.created_at,
                currentBalance: {
                    usdt: parseFloat(wallet.usdt_balance) || 0,
                    sod: parseInt(wallet.sod_balance) || 0
                }
            };
        } catch (error) {
            console.error('❌ Error getting wallet stats:', error);
            return {
                totalDeposited: 0,
                totalWithdrawn: 0,
                pendingWithdrawal: 0,
                transactionsCount: 0,
                walletAddress: 'خطا در دریافت اطلاعات',
                currentBalance: { usdt: 0, sod: 0 }
            };
        }
    }

    // 7. انتقال بین کیف‌پول‌ها
    async transferFunds(senderId, receiverId, amount, currency = 'SOD', description = '') {
        try {
            console.log(`🔄 Transfer: ${amount} ${currency} from ${senderId} to ${receiverId}`);
            
            amount = parseFloat(amount);
            if (!amount || amount <= 0) {
                throw new Error('مبلغ وارد شده معتبر نیست');
            }
            
            // بررسی موجودی فرستنده
            const senderWallet = await this.getUserWallet(senderId);
            const receiverWallet = await this.getUserWallet(receiverId);

            if (!senderWallet || !receiverWallet) {
                throw new Error('کیف پول پیدا نشد');
            }

            if (currency === 'USDT') {
                const senderBalance = parseFloat(senderWallet.usdt_balance) || 0;
                if (senderBalance < amount) {
                    throw new Error('موجودی USDT کافی نیست');
                }
            } else if (currency === 'SOD') {
                const senderBalance = parseInt(senderWallet.sod_balance) || 0;
                if (senderBalance < amount) {
                    throw new Error('موجودی SOD کافی نیست');
                }
            } else {
                throw new Error(`ارز ${currency} پشتیبانی نمی‌شود`);
            }

            // آپدیت فرستنده
            let senderUpdate = {};
            if (currency === 'USDT') {
                senderUpdate = { 
                    usdt_balance: (parseFloat(senderWallet.usdt_balance) || 0) - amount 
                };
            } else {
                senderUpdate = { 
                    sod_balance: (parseInt(senderWallet.sod_balance) || 0) - parseInt(amount) 
                };
            }

            // آپدیت گیرنده
            let receiverUpdate = {};
            if (currency === 'USDT') {
                receiverUpdate = { 
                    usdt_balance: (parseFloat(receiverWallet.usdt_balance) || 0) + amount 
                };
            } else {
                receiverUpdate = { 
                    sod_balance: (parseInt(receiverWallet.sod_balance) || 0) + parseInt(amount) 
                };
            }

            // بررسی سرویس
            if (!this.supabaseService || !this.supabaseService.updateUserWallet) {
                throw new Error('سرویس در دسترس نیست');
            }

            // انجام تراکنش‌ها
            await this.supabaseService.updateUserWallet(senderId, senderUpdate);
            await this.supabaseService.updateUserWallet(receiverId, receiverUpdate);

            // ثبت تراکنش‌ها
            const transferDesc = description || `انتقال به کاربر ${receiverId}`;
            
            if (this.supabaseService.addWalletTransactionToDB) {
                await this.supabaseService.addWalletTransactionToDB({
                    userId: senderId,
                    type: 'transfer_sent',
                    amount: -amount,
                    currency: currency,
                    description: transferDesc
                });

                await this.supabaseService.addWalletTransactionToDB({
                    userId: receiverId,
                    type: 'transfer_received',
                    amount: amount,
                    currency: currency,
                    description: `دریافت از کاربر ${senderId}`
                });
            }

            return {
                success: true,
                amount: amount,
                currency: currency,
                message: `انتقال ${amount} ${currency} با موفقیت انجام شد`
            };
        } catch (error) {
            console.error('❌ Transfer error:', error);
            throw error;
        }
    }

    // 8. خرید پنل از کیف پول
    async purchasePlanFromWallet(userId, planId, planPrice, planName) {
        try {
            const planPriceNum = parseFloat(planPrice);
            if (!planPriceNum || planPriceNum <= 0) {
                throw new Error('قیمت پنل معتبر نیست');
            }
            
            const wallet = await this.getUserWallet(userId);
            if (!wallet) {
                throw new Error('کیف پول پیدا نشد');
            }

            const currentBalance = parseFloat(wallet.usdt_balance) || 0;
            if (currentBalance < planPriceNum) {
                throw new Error('موجودی USDT کافی نیست');
            }

            // بررسی سرویس
            if (!this.supabaseService || !this.supabaseService.updateUserWallet) {
                throw new Error('سرویس در دسترس نیست');
            }

            // کسر از کیف پول
            const updateData = {
                usdt_balance: currentBalance - planPriceNum
            };

            const success = await this.supabaseService.updateUserWallet(userId, updateData);
            if (!success) {
                throw new Error('خطا در کسر از کیف پول');
            }

            // ثبت تراکنش خرید
            if (this.supabaseService.addWalletTransactionToDB) {
                await this.supabaseService.addWalletTransactionToDB({
                    userId: userId,
                    type: 'plan_purchase',
                    amount: -planPriceNum,
                    currency: 'USDT',
                    description: `خرید پنل ${planName} (ID: ${planId})`
                });
            }

            return {
                success: true,
                newBalance: updateData.usdt_balance,
                message: `خرید پنل ${planName} با موفقیت انجام شد`
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

    // 10. دریافت آدرس کیف پول کاربر
    async getUserWalletAddress(userId) {
        try {
            const wallet = await this.getUserWallet(userId);
            return wallet?.wallet_address || null;
        } catch (error) {
            console.error('❌ Error getting wallet address:', error);
            return null;
        }
    }

    // 11. دریافت درخواست‌های برداشت کاربر
    async getUserWithdrawalRequests(userId, limit = 10) {
        try {
            if (!this.supabase) {
                console.warn('⚠️ Supabase client not available');
                return [];
            }
            
            const { data, error } = await this.supabase
                .from('withdrawal_requests')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false })
                .limit(limit);

            if (error) {
                console.error('❌ Supabase error:', error);
                throw error;
            }
            
            return data || [];
        } catch (error) {
            console.error('❌ Error getting user withdrawal requests:', error);
            return [];
        }
    }

    // 12. بررسی وضعیت درخواست برداشت
    async getWithdrawalRequestStatus(requestId) {
        try {
            if (!this.supabase) {
                console.warn('⚠️ Supabase client not available');
                return null;
            }
            
            const { data, error } = await this.supabase
                .from('withdrawal_requests')
                .select('*')
                .eq('id', requestId)
                .single();

            if (error) {
                console.error('❌ Supabase error:', error);
                throw error;
            }
            
            return data;
        } catch (error) {
            console.error('❌ Error getting withdrawal status:', error);
            return null;
        }
    }

    // 13. آپدیت وضعیت برداشت (برای ادمین)
    async updateWithdrawalStatus(requestId, status, adminNotes = '') {
        try {
            if (!this.supabase || !this.supabaseService) {
                throw new Error('سرویس در دسترس نیست');
            }

            // دریافت درخواست برداشت
            const request = await this.getWithdrawalRequestStatus(requestId);
            if (!request) {
                throw new Error('درخواست برداشت پیدا نشد');
            }

            // آپدیت وضعیت در supabaseService
            if (this.supabaseService.updateWithdrawalRequestStatus) {
                const success = await this.supabaseService.updateWithdrawalRequestStatus(
                    requestId, 
                    status, 
                    adminNotes
                );
                
                if (!success) {
                    throw new Error('خطا در آپدیت وضعیت');
                }
            }

            return {
                success: true,
                status: status,
                message: `وضعیت درخواست به ${status} تغییر کرد`
            };
        } catch (error) {
            console.error('❌ Update withdrawal status error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
}

// ایجاد instance جهانی - با تاخیر برای اطمینان از بارگذاری سرویس‌های وابسته
setTimeout(() => {
    if (!window.walletService) {
        window.walletService = new WalletService();
        console.log('✅ Wallet Service loaded and ready');
    }
}, 1000);
