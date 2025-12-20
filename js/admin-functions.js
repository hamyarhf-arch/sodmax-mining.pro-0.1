// ============ js/admin-functions.js ============
// توابع مدیریتی پیشرفته برای پنل ادمین SODmAX Pro

// ============ توابع مدیریت کاربران ============

/**
 * تعلیق کاربر
 * @param {string} userId - شناسه کاربر
 * @param {string} reason - دلیل تعلیق
 */
async function suspendUser(userId, reason = 'تعلیق توسط مدیر') {
    try {
        if (!confirm(`آیا مطمئن هستید که می‌خواهید این کاربر را تعلیق کنید؟\nدلیل: ${reason}`)) {
            return;
        }

        const { error } = await supabaseClient
            .from('users')
            .update({ 
                status: 'suspended',
                updated_at: new Date().toISOString()
            })
            .eq('id', userId);

        if (error) throw error;

        // ثبت لاگ
        await logAdminAction('suspend_user', 'users', userId, null, { reason });

        showNotification('کاربر با موفقیت تعلیق شد', 'success');
        await loadUsers();

    } catch (error) {
        console.error('❌ Suspend user error:', error);
        showNotification('خطا در تعلیق کاربر', 'error');
    }
}

/**
 * حذف کاربر
 * @param {string} userId - شناسه کاربر
 */
async function deleteUser(userId) {
    try {
        if (!confirm('⚠️ اخطار: حذف کاربر غیرقابل بازگشت است!\nآیا مطمئن هستید؟')) {
            return;
        }

        const { error } = await supabaseClient
            .from('users')
            .delete()
            .eq('id', userId);

        if (error) throw error;

        // ثبت لاگ
        await logAdminAction('delete_user', 'users', userId, null, null);

        showNotification('کاربر با موفقیت حذف شد', 'success');
        await loadUsers();

    } catch (error) {
        console.error('❌ Delete user error:', error);
        showNotification('خطا در حذف کاربر', 'error');
    }
}

/**
 * مسدود کردن IP کاربر
 * @param {string} userId - شناسه کاربر
 */
async function banUserIP(userId) {
    try {
        // دریافت IP کاربر از آخرین فعالیت‌ها
        const { data: activities, error } = await supabaseClient
            .from('user_activities')
            .select('ip_address')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(5);

        if (error) throw error;

        const ips = [...new Set(activities.map(a => a.ip_address).filter(Boolean))];
        
        if (ips.length === 0) {
            showNotification('آی‌پی کاربر یافت نشد', 'warning');
            return;
        }

        const ipList = ips.join(', ');
        if (!confirm(`آیا می‌خواهید IPهای زیر مسدود شوند؟\n${ipList}`)) {
            return;
        }

        // ذخیره IPهای مسدود شده
        const { error: updateError } = await supabaseClient
            .from('system_settings')
            .upsert({
                setting_key: 'blocked_ips',
                setting_value: JSON.stringify(ips),
                category: 'security',
                setting_type: 'json',
                description: 'IPهای مسدود شده',
                updated_at: new Date().toISOString()
            });

        if (updateError) throw updateError;

        // ثبت لاگ
        await logAdminAction('ban_ip', 'users', userId, null, { ips });

        showNotification(`آی‌پی‌های کاربر مسدود شدند`, 'success');

    } catch (error) {
        console.error('❌ Ban user IP error:', error);
        showNotification('خطا در مسدود کردن آی‌پی', 'error');
    }
}

// ============ توابع مدیریت مالی ============

/**
 * تأیید واریز
 * @param {string} transactionId - شناسه تراکنش
 */
async function approveDeposit(transactionId) {
    try {
        const adminNotes = document.getElementById('depositAdminNotes')?.value || '';

        // دریافت اطلاعات تراکنش
        const { data: transaction, error: txError } = await supabaseClient
            .from('financial_transactions')
            .select('*')
            .eq('id', transactionId)
            .single();

        if (txError) throw txError;

        // بررسی اینکه قبلاً تأیید نشده باشد
        if (transaction.status === 'completed') {
            showNotification('این واریز قبلاً تأیید شده است', 'warning');
            closeModal('modalConfirmDeposit');
            return;
        }

        // بروزرسانی وضعیت تراکنش
        const { error: updateError } = await supabaseClient
            .from('financial_transactions')
            .update({
                status: 'completed',
                completed_at: new Date().toISOString(),
                metadata: {
                    ...transaction.metadata,
                    approved_by: currentAdmin.id,
                    approved_at: new Date().toISOString(),
                    admin_notes: adminNotes
                }
            })
            .eq('id', transactionId);

        if (updateError) throw updateError;

        // افزایش موجودی کاربر
        const { error: walletError } = await supabaseClient
            .from('user_wallets')
            .update({
                usdt_balance: supabaseClient.rpc('increment', { 
                    x: transaction.amount 
                }),
                total_deposited: supabaseClient.rpc('increment', { 
                    x: transaction.amount 
                }),
                updated_at: new Date().toISOString()
            })
            .eq('user_id', transaction.user_id);

        if (walletError) throw walletError;

        // ثبت فعالیت کاربر
        await supabaseClient
            .from('user_activities')
            .insert({
                user_id: transaction.user_id,
                activity_type: 'deposit_approved',
                activity_data: {
                    amount: transaction.amount,
                    transaction_id: transactionId,
                    currency: transaction.currency
                }
            });

        // ارسال نوتیفیکیشن به کاربر
        await sendUserNotification(
            transaction.user_id,
            '✅ واریز شما تأیید شد',
            `واریز شما به مبلغ ${formatCurrency(transaction.amount)} با موفقیت تأیید شد.`,
            'success'
        );

        // ثبت لاگ
        await logAdminAction('approve_deposit', 'financial_transactions', transactionId, 
            { status: 'pending' }, { status: 'completed', admin_notes: adminNotes });

        showNotification('واریز با موفقیت تأیید شد', 'success');
        closeModal('modalConfirmDeposit');
        loadPendingDeposits();
        loadDashboardStats();

    } catch (error) {
        console.error('❌ Approve deposit error:', error);
        showNotification('خطا در تأیید واریز', 'error');
    }
}

/**
 * رد درخواست واریز
 * @param {string} transactionId - شناسه تراکنش
 */
async function rejectDeposit(transactionId) {
    try {
        if (!confirm('آیا مطمئن هستید که می‌خواهید این واریز را رد کنید؟')) {
            return;
        }

        const reason = prompt('دلیل رد درخواست را وارد کنید:', 'عدم تطابق اطلاعات');

        if (!reason) {
            showNotification('لطفاً دلیل رد را وارد کنید', 'warning');
            return;
        }

        // بروزرسانی وضعیت تراکنش
        const { error } = await supabaseClient
            .from('financial_transactions')
            .update({
                status: 'rejected',
                metadata: {
                    rejected_by: currentAdmin.id,
                    rejected_at: new Date().toISOString(),
                    rejection_reason: reason
                },
                updated_at: new Date().toISOString()
            })
            .eq('id', transactionId);

        if (error) throw error;

        // ارسال نوتیفیکیشن به کاربر
        const { data: transaction } = await supabaseClient
            .from('financial_transactions')
            .select('user_id, amount')
            .eq('id', transactionId)
            .single();

        if (transaction) {
            await sendUserNotification(
                transaction.user_id,
                '❌ واریز شما رد شد',
                `درخواست واریز شما به مبلغ ${formatCurrency(transaction.amount)} رد شد.\nدلیل: ${reason}`,
                'error'
            );
        }

        // ثبت لاگ
        await logAdminAction('reject_deposit', 'financial_transactions', transactionId,
            { status: 'pending' }, { status: 'rejected', rejection_reason: reason });

        showNotification('واریز با موفقیت رد شد', 'success');
        closeModal('modalConfirmDeposit');
        loadPendingDeposits();

    } catch (error) {
        console.error('❌ Reject deposit error:', error);
        showNotification('خطا در رد واریز', 'error');
    }
}

/**
 * تأیید درخواست برداشت
 * @param {string} requestId - شناسه درخواست برداشت
 */
async function approveWithdrawal(requestId) {
    try {
        const adminNotes = prompt('توضیحات تأیید (اختیاری):', '');

        // دریافت اطلاعات درخواست
        const { data: request, error } = await supabaseClient
            .from('withdrawal_requests')
            .select(`
                *,
                users (email, user_wallets (usdt_balance))
            `)
            .eq('id', requestId)
            .single();

        if (error) throw error;

        // بررسی موجودی کاربر
        const userWallet = request.users.user_wallets[0];
        if (userWallet.usdt_balance < request.amount) {
            showNotification('موجودی کاربر کافی نیست', 'error');
            return;
        }

        // بروزرسانی وضعیت درخواست
        const { error: updateError } = await supabaseClient
            .from('withdrawal_requests')
            .update({
                status: 'completed',
                processed_by: currentAdmin.id,
                processed_at: new Date().toISOString(),
                admin_notes: adminNotes,
                updated_at: new Date().toISOString()
            })
            .eq('id', requestId);

        if (updateError) throw updateError;

        // کسر موجودی کاربر
        const { error: walletError } = await supabaseClient
            .from('user_wallets')
            .update({
                usdt_balance: supabaseClient.rpc('increment', { 
                    x: -request.amount 
                }),
                total_withdrawn: supabaseClient.rpc('increment', { 
                    x: request.amount 
                }),
                updated_at: new Date().toISOString()
            })
            .eq('user_id', request.user_id);

        if (walletError) throw walletError;

        // ثبت تراکنش مالی
        await supabaseClient
            .from('financial_transactions')
            .insert({
                user_id: request.user_id,
                type: 'withdrawal',
                amount: -request.amount,
                currency: request.currency,
                status: 'completed',
                description: `برداشت به آدرس ${request.wallet_address.substring(0, 15)}...`,
                metadata: {
                    request_id: requestId,
                    wallet_address: request.wallet_address,
                    network: request.network,
                    processed_by: currentAdmin.id
                },
                completed_at: new Date().toISOString()
            });

        // ثبت فعالیت کاربر
        await supabaseClient
            .from('user_activities')
            .insert({
                user_id: request.user_id,
                activity_type: 'withdrawal_approved',
                activity_data: {
                    amount: request.amount,
                    request_id: requestId,
                    wallet_address: request.wallet_address
                }
            });

        // ارسال نوتیفیکیشن
        await sendUserNotification(
            request.user_id,
            '✅ برداشت شما تأیید شد',
            `درخواست برداشت شما به مبلغ ${formatCurrency(request.amount)} تأیید شد.\nآدرس: ${request.wallet_address}`,
            'success'
        );

        // ثبت لاگ
        await logAdminAction('approve_withdrawal', 'withdrawal_requests', requestId,
            { status: 'pending' }, { status: 'completed', admin_notes: adminNotes });

        showNotification('برداشت با موفقیت تأیید شد', 'success');
        loadPendingWithdrawals();
        loadDashboardStats();

    } catch (error) {
        console.error('❌ Approve withdrawal error:', error);
        showNotification('خطا در تأیید برداشت', 'error');
    }
}

/**
 * رد درخواست برداشت
 * @param {string} requestId - شناسه درخواست برداشت
 */
async function rejectWithdrawal(requestId) {
    try {
        const reason = prompt('دلیل رد درخواست را وارد کنید:', 'عدم تطابق اطلاعات یا مشکوک بودن تراکنش');

        if (!reason) {
            showNotification('لطفاً دلیل رد را وارد کنید', 'warning');
            return;
        }

        // بروزرسانی وضعیت درخواست
        const { error } = await supabaseClient
            .from('withdrawal_requests')
            .update({
                status: 'rejected',
                admin_notes: reason,
                updated_at: new Date().toISOString()
            })
            .eq('id', requestId);

        if (error) throw error;

        // ارسال نوتیفیکیشن به کاربر
        const { data: request } = await supabaseClient
            .from('withdrawal_requests')
            .select('user_id, amount')
            .eq('id', requestId)
            .single();

        if (request) {
            await sendUserNotification(
                request.user_id,
                '❌ برداشت شما رد شد',
                `درخواست برداشت شما به مبلغ ${formatCurrency(request.amount)} رد شد.\nدلیل: ${reason}`,
                'error'
            );
        }

        // ثبت لاگ
        await logAdminAction('reject_withdrawal', 'withdrawal_requests', requestId,
            { status: 'pending' }, { status: 'rejected', rejection_reason: reason });

        showNotification('برداشت با موفقیت رد شد', 'success');
        loadPendingWithdrawals();

    } catch (error) {
        console.error('❌ Reject withdrawal error:', error);
        showNotification('خطا در رد برداشت', 'error');
    }
}

// ============ توابع مدیریت پکیج‌ها ============

/**
 * بارگذاری پکیج‌های فروش
 */
async function loadSalePlans() {
    try {
        const { data: plans, error } = await supabaseClient
            .from('sale_plans')
            .select('*')
            .order('order_index', { ascending: true });

        if (error) throw error;

        const container = document.getElementById('adminPagePackages');
        if (!container) return;

        let html = `
            <div class="admin-table-container">
                <div class="admin-table-header">
                    <div class="admin-table-title">مدیریت پکیج‌های فروش</div>
                    <button class="admin-btn admin-btn-success" onclick="showAddPackageModal()">
                        <i class="fas fa-plus"></i> پکیج جدید
                    </button>
                </div>
                <div class="admin-table-content">
                    <table class="admin-table">
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>نام</th>
                                <th>قیمت (USDT)</th>
                                <th>مقدار SOD</th>
                                <th>تخفیف</th>
                                <th>محبوب</th>
                                <th>ویژه</th>
                                <th>وضعیت</th>
                                <th>عملیات</th>
                            </tr>
                        </thead>
                        <tbody id="tableSalePlans">
        `;

        if (!plans || plans.length === 0) {
            html += `
                <tr>
                    <td colspan="9" style="text-align: center; padding: 40px; color: var(--admin-text-secondary);">
                        هیچ پکیجی تعریف نشده است
                    </td>
                </tr>
            `;
        } else {
            plans.forEach((plan, index) => {
                html += `
                    <tr>
                        <td>${index + 1}</td>
                        <td style="font-weight: 600;">${plan.name}</td>
                        <td>${formatCurrency(plan.price)}</td>
                        <td>${formatNumber(plan.sod_amount)}</td>
                        <td>${plan.discount}%</td>
                        <td>
                            <span class="admin-badge ${plan.popular ? 'badge-success' : 'badge-info'}">
                                ${plan.popular ? '✓' : '✗'}
                            </span>
                        </td>
                        <td>
                            <span class="admin-badge ${plan.featured ? 'badge-success' : 'badge-info'}">
                                ${plan.featured ? '✓' : '✗'}
                            </span>
                        </td>
                        <td>
                            <span class="admin-badge ${plan.is_active ? 'badge-success' : 'badge-warning'}">
                                ${plan.is_active ? 'فعال' : 'غیرفعال'}
                            </span>
                        </td>
                        <td>
                            <div style="display: flex; gap: 5px;">
                                <button class="admin-btn admin-btn-sm admin-btn-primary" onclick="editPackage(${plan.id})">
                                    <i class="fas fa-edit"></i>
                                </button>
                                <button class="admin-btn admin-btn-sm ${plan.is_active ? 'admin-btn-warning' : 'admin-btn-success'}" 
                                        onclick="togglePackageStatus(${plan.id}, ${!plan.is_active})">
                                    <i class="fas ${plan.is_active ? 'fa-eye-slash' : 'fa-eye'}"></i>
                                </button>
                                <button class="admin-btn admin-btn-sm admin-btn-danger" onclick="deletePackage(${plan.id})">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </div>
                        </td>
                    </tr>
                `;
            });
        }

        html += `
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        container.innerHTML = html;

    } catch (error) {
        console.error('❌ Load sale plans error:', error);
        showNotification('خطا در بارگذاری پکیج‌ها', 'error');
    }
}

/**
 * تغییر وضعیت پکیج
 */
async function togglePackageStatus(packageId, newStatus) {
    try {
        const { error } = await supabaseClient
            .from('sale_plans')
            .update({ 
                is_active: newStatus,
                updated_at: new Date().toISOString()
            })
            .eq('id', packageId);

        if (error) throw error;

        showNotification(`پکیج ${newStatus ? 'فعال' : 'غیرفعال'} شد`, 'success');
        await loadSalePlans();

    } catch (error) {
        console.error('❌ Toggle package status error:', error);
        showNotification('خطا در تغییر وضعیت پکیج', 'error');
    }
}

// ============ توابع مدیریت تنظیمات سیستم ============

/**
 * بارگذاری تنظیمات سیستم
 */
async function loadSystemSettings() {
    try {
        const { data: settings, error } = await supabaseClient
            .from('system_settings')
            .select('*')
            .order('category')
            .order('setting_key');

        if (error) throw error;

        const container = document.getElementById('adminPageSettings');
        if (!container) return;

        // گروه‌بندی تنظیمات بر اساس دسته‌بندی
        const settingsByCategory = {};
        settings.forEach(setting => {
            if (!settingsByCategory[setting.category]) {
                settingsByCategory[setting.category] = [];
            }
            settingsByCategory[setting.category].push(setting);
        });

        let html = `
            <div class="admin-tabs" id="settingsTabs">
        `;

        // ایجاد تب‌ها
        Object.keys(settingsByCategory).forEach((category, index) => {
            html += `
                <div class="admin-tab ${index === 0 ? 'active' : ''}" 
                     onclick="showSettingsTab('${category}')">
                    ${getCategoryName(category)}
                </div>
            `;
        });

        html += `</div>`;

        // ایجاد محتوای تب‌ها
        Object.keys(settingsByCategory).forEach((category, index) => {
            html += `
                <div id="settingsTab${capitalizeFirstLetter(category)}" 
                     class="admin-tab-content ${index === 0 ? 'active' : ''}" 
                     style="${index === 0 ? '' : 'display: none;'}">
                    <div class="admin-table-container">
                        <div class="admin-table-header">
                            <div class="admin-table-title">تنظیمات ${getCategoryName(category)}</div>
                            <button class="admin-btn admin-btn-primary" onclick="saveSettings('${category}')">
                                <i class="fas fa-save"></i> ذخیره تغییرات
                            </button>
                        </div>
                        <div class="admin-table-content">
                            <table class="admin-table">
                                <thead>
                                    <tr>
                                        <th>تنظیم</th>
                                        <th>مقدار</th>
                                        <th>توضیحات</th>
                                        <th>نوع</th>
                                    </tr>
                                </thead>
                                <tbody id="settingsTable${capitalizeFirstLetter(category)}">
            `;

            settingsByCategory[category].forEach(setting => {
                let inputField = '';
                
                switch (setting.setting_type) {
                    case 'number':
                        inputField = `
                            <input type="number" 
                                   class="admin-form-input" 
                                   id="setting_${setting.setting_key}" 
                                   value="${setting.setting_value || ''}"
                                   style="width: 150px; padding: 8px 12px;">
                        `;
                        break;
                    
                    case 'boolean':
                        inputField = `
                            <select class="admin-form-input" 
                                    id="setting_${setting.setting_key}"
                                    style="width: 150px; padding: 8px 12px;">
                                <option value="true" ${setting.setting_value === 'true' ? 'selected' : ''}>فعال</option>
                                <option value="false" ${setting.setting_value === 'false' ? 'selected' : ''}>غیرفعال</option>
                            </select>
                        `;
                        break;
                    
                    case 'select':
                        const options = setting.options ? setting.options.split(',') : [];
                        inputField = `
                            <select class="admin-form-input" 
                                    id="setting_${setting.setting_key}"
                                    style="width: 150px; padding: 8px 12px;">
                                ${options.map(opt => 
                                    `<option value="${opt.trim()}" ${setting.setting_value === opt.trim() ? 'selected' : ''}>
                                        ${opt.trim()}
                                     </option>`
                                ).join('')}
                            </select>
                        `;
                        break;
                    
                    default:
                        inputField = `
                            <input type="text" 
                                   class="admin-form-input" 
                                   id="setting_${setting.setting_key}" 
                                   value="${setting.setting_value || ''}"
                                   style="width: 250px; padding: 8px 12px;">
                        `;
                }

                html += `
                    <tr>
                        <td style="font-weight: 600;">${setting.setting_key}</td>
                        <td>${inputField}</td>
                        <td>${setting.description || '—'}</td>
                        <td>
                            <span class="admin-badge badge-info">
                                ${getSettingTypeName(setting.setting_type)}
                            </span>
                        </td>
                    </tr>
                `;
            });

            html += `
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            `;
        });

        container.innerHTML = html;

    } catch (error) {
        console.error('❌ Load system settings error:', error);
        showNotification('خطا در بارگذاری تنظیمات', 'error');
    }
}

/**
 * ذخیره تنظیمات یک دسته‌بندی
 */
async function saveSettings(category) {
    try {
        const settingsElements = document.querySelectorAll(`#settingsTable${capitalizeFirstLetter(category)} input, 
                                                           #settingsTable${capitalizeFirstLetter(category)} select`);
        
        const updates = [];
        const oldValues = {};

        // دریافت مقادیر قدیمی
        const { data: oldSettings } = await supabaseClient
            .from('system_settings')
            .select('setting_key, setting_value')
            .eq('category', category);

        oldSettings?.forEach(setting => {
            oldValues[setting.setting_key] = setting.setting_value;
        });

        // آماده‌سازی داده‌ها برای آپدیت
        for (const element of settingsElements) {
            const settingKey = element.id.replace('setting_', '');
            const newValue = element.value;

            updates.push({
                setting_key: settingKey,
                setting_value: newValue,
                updated_at: new Date().toISOString()
            });
        }

        // آپدیت دسته‌جمعی
        for (const update of updates) {
            const { error } = await supabaseClient
                .from('system_settings')
                .update(update)
                .eq('setting_key', update.setting_key);

            if (error) throw error;

            // ثبت لاگ اگر مقدار تغییر کرده
            if (oldValues[update.setting_key] !== update.setting_value) {
                await logAdminAction(
                    'update_setting',
                    'system_settings',
                    update.setting_key,
                    { value: oldValues[update.setting_key] },
                    { value: update.setting_value }
                );
            }
        }

        showNotification('تنظیمات با موفقیت ذخیره شد', 'success');

        // بروزرسانی کش کاربران (اگر تنظیمات عمومی تغییر کرده)
        if (category === 'general' || category === 'mining') {
            showNotification('تنظیمات جدید برای کاربران اعمال خواهد شد', 'info');
        }

    } catch (error) {
        console.error('❌ Save settings error:', error);
        showNotification('خطا در ذخیره تنظیمات', 'error');
    }
}

// ============ توابع گزارشات ============

/**
 * بارگذاری گزارشات
 */
async function loadReports() {
    try {
        // دریافت گزارشات مالی ۳۰ روز اخیر
        const { data: financialReport, error: financialError } = await supabaseClient
            .rpc('get_financial_report', { days: 30 });

        // دریافت گزارش کاربران
        const { data: usersReport, error: usersError } = await supabaseClient
            .from('user_reports')
            .select('*')
            .limit(50);

        // دریافت گزارش روزانه
        const { data: dailyStats, error: dailyError } = await supabaseClient
            .from('daily_stats')
            .select('*')
            .order('date', { ascending: false })
            .limit(30);

        if (financialError) throw financialError;
        if (usersError) throw usersError;
        if (dailyError) throw dailyError;

        const container = document.getElementById('adminPageReports');
        if (!container) return;

        let html = `
            <div class="admin-stats-grid" style="margin-bottom: 30px;">
                <div class="admin-stat-card">
                    <div class="admin-stat-title">کاربران کل</div>
                    <div class="admin-stat-value">${usersReport?.length || 0}</div>
                    <div class="admin-stat-change">
                        <i class="fas fa-chart-line"></i>
                        گزارش ۳۰ روزه
                    </div>
                </div>
                <div class="admin-stat-card">
                    <div class="admin-stat-title">درآمد کل</div>
                    <div class="admin-stat-value">
                        ${financialReport?.total_revenue ? formatCurrency(financialReport.total_revenue) : '0 USDT'}
                    </div>
                    <div class="admin-stat-change change-up">
                        <i class="fas fa-arrow-up"></i>
                        ${financialReport?.growth_percentage ? financialReport.growth_percentage + '%' : '0%'} رشد
                    </div>
                </div>
                <div class="admin-stat-card">
                    <div class="admin-stat-title">تراکنش‌ها</div>
                    <div class="admin-stat-value">
                        ${financialReport?.total_transactions || 0}
                    </div>
                    <div class="admin-stat-change">
                        <i class="fas fa-exchange-alt"></i>
                        ${financialReport?.avg_daily_transactions || 0} روزانه
                    </div>
                </div>
                <div class="admin-stat-card">
                    <div class="admin-stat-title">کاربران فعال</div>
                    <div class="admin-stat-value">
                        ${dailyStats?.[0]?.active_users || 0}
                    </div>
                    <div class="admin-stat-change">
                        <i class="fas fa-users"></i>
                        امروز
                    </div>
                </div>
            </div>

            <div class="admin-tabs">
                <div class="admin-tab active" onclick="showReportTab('financial')">گزارش مالی</div>
                <div class="admin-tab" onclick="showReportTab('users')">گزارش کاربران</div>
                <div class="admin-tab" onclick="showReportTab('daily')">گزارش روزانه</div>
                <div class="admin-tab" onclick="showReportTab('export')">خروجی گزارش</div>
            </div>

            <!-- تب گزارش مالی -->
            <div id="reportTabFinancial" class="admin-tab-content active">
                <div class="admin-table-container">
                    <div class="admin-table-header">
                        <div class="admin-table-title">گزارش مالی ۳۰ روز اخیر</div>
                        <button class="admin-btn admin-btn-primary" onclick="exportFinancialReport()">
                            <i class="fas fa-download"></i> خروجی Excel
                        </button>
                    </div>
                    <div class="admin-table-content">
                        <table class="admin-table">
                            <thead>
                                <tr>
                                    <th>تاریخ</th>
                                    <th>واریزها</th>
                                    <th>برداشت‌ها</th>
                                    <th>فروش پکیج</th>
                                    <th>کاربران منحصربه‌فرد</th>
                                    <th>تراکنش‌ها</th>
                                </tr>
                            </thead>
                            <tbody id="financialReportTable">
        `;

        if (dailyStats && dailyStats.length > 0) {
            dailyStats.forEach(stat => {
                html += `
                    <tr>
                        <td>${new Date(stat.date).toLocaleDateString('fa-IR')}</td>
                        <td style="color: #00C853;">${formatCurrency(stat.total_deposits)}</td>
                        <td style="color: #FF3D00;">${formatCurrency(stat.total_withdrawals)}</td>
                        <td style="color: #FFB300;">${formatCurrency(stat.total_package_revenue)}</td>
                        <td>${stat.active_users}</td>
                        <td>${stat.total_package_sales}</td>
                    </tr>
                `;
            });
        } else {
            html += `
                <tr>
                    <td colspan="6" style="text-align: center; padding: 40px; color: var(--admin-text-secondary);">
                        داده‌ای برای نمایش وجود ندارد
                    </td>
                </tr>
            `;
        }

        html += `
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <!-- تب گزارش کاربران -->
            <div id="reportTabUsers" class="admin-tab-content" style="display: none;">
                <div class="admin-table-container">
                    <div class="admin-table-header">
                        <div class="admin-table-title">گزارش کاربران برتر</div>
                        <div style="display: flex; gap: 10px;">
                            <input type="text" class="admin-form-input" placeholder="جستجوی کاربر..." 
                                   id="searchReportUser" style="width: 250px;">
                            <button class="admin-btn admin-btn-primary" onclick="searchReportUsers()">
                                <i class="fas fa-search"></i>
                            </button>
                        </div>
                    </div>
                    <div class="admin-table-content">
                        <table class="admin-table">
                            <thead>
                                <tr>
                                    <th>کاربر</th>
                                    <th>سطح</th>
                                    <th>وضعیت</th>
                                    <th>USDT</th>
                                    <th>SOD</th>
                                    <th>واریز شده</th>
                                    <th>برداشت شده</th>
                                    <th>معرفی‌ها</th>
                                </tr>
                            </thead>
                            <tbody id="usersReportTable">
        `;

        if (usersReport && usersReport.length > 0) {
            usersReport.forEach(user => {
                html += `
                    <tr>
                        <td>
                            <div style="font-weight: 600;">${user.email}</div>
                            <div style="font-size: 12px; color: var(--admin-text-secondary);">
                                ${user.full_name || '—'}
                            </div>
                        </td>
                        <td>${user.level}</td>
                        <td>
                            <span class="admin-badge badge-${user.status}">
                                ${getUserStatusText(user.status)}
                            </span>
                        </td>
                        <td>${formatCurrency(user.usdt_balance)}</td>
                        <td>${formatNumber(user.sod_balance)}</td>
                        <td>${formatCurrency(user.total_deposited)}</td>
                        <td>${formatCurrency(user.total_withdrawn)}</td>
                        <td>${user.total_invites}</td>
                    </tr>
                `;
            });
        }

        html += `
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;

        container.innerHTML = html;

    } catch (error) {
        console.error('❌ Load reports error:', error);
        showNotification('خطا در بارگذاری گزارشات', 'error');
    }
}

// ============ توابع لاگ سیستم ============

/**
 * بارگذاری لاگ‌های سیستم
 */
async function loadSystemLogs() {
    try {
        const { data: logs, error } = await supabaseClient
            .from('admin_logs')
            .select(`
                *,
                admin_users (email, full_name)
            `)
            .order('created_at', { ascending: false })
            .limit(100);

        if (error) throw error;

        const container = document.getElementById('adminPageLogs');
        if (!container) return;

        let html = `
            <div class="admin-table-container">
                <div class="admin-table-header">
                    <div class="admin-table-title">لاگ سیستم (۱۰۰ مورد آخر)</div>
                    <div style="display: flex; gap: 10px;">
                        <select class="admin-form-input" id="logFilterType" style="width: 150px;">
                            <option value="all">همه عملیات</option>
                            <option value="user">کاربران</option>
                            <option value="transaction">تراکنش‌ها</option>
                            <option value="financial">مالی</option>
                            <option value="system">سیستم</option>
                        </select>
                        <button class="admin-btn admin-btn-primary" onclick="filterLogs()">
                            <i class="fas fa-filter"></i> فیلتر
                        </button>
                        <button class="admin-btn admin-btn-danger" onclick="clearOldLogs()">
                            <i class="fas fa-trash"></i> پاک کردن لاگ‌های قدیمی
                        </button>
                    </div>
                </div>
                <div class="admin-table-content">
                    <table class="admin-table">
                        <thead>
                            <tr>
                                <th>زمان</th>
                                <th>ادمین</th>
                                <th>عملیات</th>
                                <th>جدول</th>
                                <th>شناسه رکورد</th>
                                <th>تغییرات</th>
                                <th>IP</th>
                            </tr>
                        </thead>
                        <tbody id="systemLogsTable">
        `;

        if (!logs || logs.length === 0) {
            html += `
                <tr>
                    <td colspan="7" style="text-align: center; padding: 40px; color: var(--admin-text-secondary);">
                        لاگی برای نمایش وجود ندارد
                    </td>
                </tr>
            `;
        } else {
            logs.forEach(log => {
                const admin = log.admin_users;
                const time = new Date(log.created_at).toLocaleTimeString('fa-IR');
                const date = new Date(log.created_at).toLocaleDateString('fa-IR');
                
                let changes = '—';
                if (log.old_data || log.new_data) {
                    changes = `
                        <button class="admin-btn admin-btn-sm admin-btn-outline" 
                                onclick="showLogChanges('${log.id}')">
                            <i class="fas fa-eye"></i> مشاهده
                        </button>
                    `;
                }

                html += `
                    <tr>
                        <td>
                            <div>${time}</div>
                            <div style="font-size: 12px; color: var(--admin-text-secondary);">${date}</div>
                        </td>
                        <td>
                            <div style="font-weight: 600;">${admin?.email || 'سیستم'}</div>
                            <div style="font-size: 12px; color: var(--admin-text-secondary);">
                                ${admin?.full_name || '—'}
                            </div>
                        </td>
                        <td>
                            <span class="admin-badge badge-info">${getActionText(log.action)}</span>
                        </td>
                        <td>${log.table_name || '—'}</td>
                        <td>
                            <div style="font-family: monospace; font-size: 12px;">
                                ${log.record_id ? log.record_id.substring(0, 8) + '...' : '—'}
                            </div>
                        </td>
                        <td>${changes}</td>
                        <td>
                            <div style="font-family: monospace; font-size: 11px;">
                                ${log.ip_address || '—'}
                            </div>
                        </td>
                    </tr>
                `;
            });
        }

        html += `
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        container.innerHTML = html;

    } catch (error) {
        console.error('❌ Load system logs error:', error);
        showNotification('خطا در بارگذاری لاگ‌ها', 'error');
    }
}

// ============ توابع کمکی ============

/**
 * ثبت لاگ عملیات ادمین
 */
async function logAdminAction(action, tableName, recordId, oldData = null, newData = null) {
    try {
        // در پروژه واقعی، این اطلاعات باید از ریکوئست دریافت شوند
        const ipAddress = '127.0.0.1'; // نمونه
        const userAgent = navigator.userAgent;

        const { error } = await supabaseClient
            .from('admin_logs')
            .insert({
                admin_id: currentAdmin?.id || null,
                action: action,
                table_name: tableName,
                record_id: recordId,
                old_data: oldData,
                new_data: newData,
                ip_address: ipAddress,
                user_agent: userAgent
            });

        if (error) {
            console.error('❌ Log admin action error:', error);
        }

    } catch (error) {
        console.error('❌ Log admin action error:', error);
    }
}

/**
 * ارسال نوتیفیکیشن به کاربر
 */
async function sendUserNotification(userId, title, message, type = 'info') {
    try {
        const { error } = await supabaseClient
            .from('notifications')
            .insert({
                user_id: userId,
                title: title,
                message: message,
                type: type,
                is_read: false
            });

        if (error) throw error;

    } catch (error) {
        console.error('❌ Send user notification error:', error);
    }
}

/**
 * دریافت نام فارسی دسته‌بندی تنظیمات
 */
function getCategoryName(category) {
    const categories = {
        'mining': 'استخراج',
        'rewards': 'پاداش‌ها',
        'referral': 'معرفی',
        'general': 'عمومی',
        'financial': 'مالی',
        'security': 'امنیت',
        'maintenance': 'تعمیرات'
    };
    return categories[category] || category;
}

/**
 * دریافت نام فارسی نوع تنظیمات
 */
function getSettingTypeName(type) {
    const types = {
        'string': 'متنی',
        'number': 'عددی',
        'boolean': 'صحیح/غلط',
        'json': 'JSON',
        'select': 'انتخابی'
    };
    return types[type] || type;
}

/**
 * دریافت نام فارسی عملیات
 */
function getActionText(action) {
    const actions = {
        'suspend_user': 'تعلیق کاربر',
        'delete_user': 'حذف کاربر',
        'ban_ip': 'مسدود کردن IP',
        'approve_deposit': 'تأیید واریز',
        'reject_deposit': 'رد واریز',
        'approve_withdrawal': 'تأیید برداشت',
        'reject_withdrawal': 'رد برداشت',
        'update_setting': 'بروزرسانی تنظیمات',
        'login': 'ورود',
        'logout': 'خروج'
    };
    return actions[action] || action;
}

/**
 * نمایش تغییرات لاگ
 */
async function showLogChanges(logId) {
    try {
        const { data: log, error } = await supabaseClient
            .from('admin_logs')
            .select('old_data, new_data, action, table_name, record_id')
            .eq('id', logId)
            .single();

        if (error) throw error;

        const modalContent = `
            <div style="max-height: 400px; overflow-y: auto;">
                <h3 style="color: white; margin-bottom: 20px;">جزئیات تغییرات</h3>
                
                <div style="margin-bottom: 20px;">
                    <div style="color: var(--admin-text-secondary); font-size: 14px; margin-bottom: 5px;">
                        عملیات: <strong>${getActionText(log.action)}</strong>
                    </div>
                    <div style="color: var(--admin-text-secondary); font-size: 14px;">
                        جدول: <strong>${log.table_name}</strong> | شناسه: <strong>${log.record_id}</strong>
                    </div>
                </div>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                    <div>
                        <h4 style="color: #FF3D00; margin-bottom: 10px;">داده‌های قدیمی</h4>
                        <pre style="background: rgba(255,61,0,0.1); padding: 15px; border-radius: 8px; font-size: 12px; color: white; max-height: 200px; overflow-y: auto;">
${JSON.stringify(log.old_data, null, 2) || 'بدون تغییر'}
                        </pre>
                    </div>
                    
                    <div>
                        <h4 style="color: #00C853; margin-bottom: 10px;">داده‌های جدید</h4>
                        <pre style="background: rgba(0,200,83,0.1); padding: 15px; border-radius: 8px; font-size: 12px; color: white; max-height: 200px; overflow-y: auto;">
${JSON.stringify(log.new_data, null, 2) || 'بدون تغییر'}
                        </pre>
                    </div>
                </div>
            </div>
        `;

        // نمایش در مودال
        showCustomModal('تغییرات لاگ سیستم', modalContent, [
            { text: 'بستن', class: 'admin-btn-outline', action: () => closeModal('modalCustom') }
        ]);

    } catch (error) {
        console.error('❌ Show log changes error:', error);
        showNotification('خطا در نمایش تغییرات', 'error');
    }
}

/**
 * نمایش مودال سفارشی
 */
function showCustomModal(title, content, buttons = []) {
    // حذف مودال قبلی اگر وجود داشته باشد
    const existingModal = document.getElementById('modalCustom');
    if (existingModal) {
        existingModal.remove();
    }

    // ایجاد مودال جدید
    const modal = document.createElement('div');
    modal.id = 'modalCustom';
    modal.className = 'admin-modal-overlay active';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0,0,0,0.8);
        backdrop-filter: blur(10px);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
        padding: 20px;
    `;

    modal.innerHTML = `
        <div class="admin-modal">
            <div class="admin-modal-header">
                <div class="admin-modal-title">${title}</div>
                <button class="admin-modal-close" onclick="document.getElementById('modalCustom').remove()">×</button>
            </div>
            <div class="admin-modal-body">
                ${content}
            </div>
            <div class="admin-modal-footer">
                ${buttons.map(btn => 
                    `<button class="admin-btn ${btn.class}" onclick="${btn.action}">${btn.text}</button>`
                ).join('')}
            </div>
        </div>
    `;

    document.body.appendChild(modal);
}

// ============ توابع تب‌ها ============

/**
 * نمایش تب تنظیمات
 */
function showSettingsTab(category) {
    // آپدیت تب‌ها
    document.querySelectorAll('#settingsTabs .admin-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    event.target.classList.add('active');

    // مخفی کردن همه تب‌ها
    document.querySelectorAll('#adminPageSettings .admin-tab-content').forEach(content => {
        content.style.display = 'none';
    });

    // نمایش تب مورد نظر
    const tabContent = document.getElementById('settingsTab' + capitalizeFirstLetter(category));
    if (tabContent) {
        tabContent.style.display = 'block';
    }
}

/**
 * نمایش تب گزارشات
 */
function showReportTab(tabName) {
    // آپدیت تب‌ها
    document.querySelectorAll('#adminPageReports .admin-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    event.target.classList.add('active');

    // مخفی کردن همه تب‌ها
    document.querySelectorAll('#adminPageReports .admin-tab-content').forEach(content => {
        content.style.display = 'none';
    });

    // نمایش تب مورد نظر
    const tabContent = document.getElementById('reportTab' + capitalizeFirstLetter(tabName));
    if (tabContent) {
        tabContent.style.display = 'block';
    }
}

// ============ توابع مدیریت درخواست‌های برداشت ============

/**
 * بارگذاری درخواست‌های برداشت در انتظار
 */
async function loadPendingWithdrawals() {
    try {
        const { data: withdrawals, error } = await supabaseClient
            .from('withdrawal_requests')
            .select(`
                *,
                users (email, full_name)
            `)
            .eq('status', 'pending')
            .order('created_at', { ascending: false });

        if (error) throw error;

        const container = document.getElementById('adminPageWithdrawals');
        if (!container) return;

        let html = `
            <div class="admin-table-container">
                <div class="admin-table-header">
                    <div class="admin-table-title">درخواست‌های برداشت در انتظار</div>
                    <button class="admin-btn admin-btn-primary" onclick="loadPendingWithdrawals()">
                        <i class="fas fa-sync-alt"></i> بروزرسانی
                    </button>
                </div>
                <div class="admin-table-content">
                    <table class="admin-table">
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>کاربر</th>
                                <th>مبلغ</th>
                                <th>آدرس کیف پول</th>
                                <th>شبکه</th>
                                <th>تاریخ</th>
                                <th>وضعیت</th>
                                <th>عملیات</th>
                            </tr>
                        </thead>
                        <tbody id="tablePendingWithdrawals">
        `;

        if (!withdrawals || withdrawals.length === 0) {
            html += `
                <tr>
                    <td colspan="8" style="text-align: center; padding: 40px; color: var(--admin-text-secondary);">
                        هیچ درخواست برداشتی در انتظار نیست
                    </td>
                </tr>
            `;
        } else {
            withdrawals.forEach((withdrawal, index) => {
                const user = withdrawal.users;
                const date = new Date(withdrawal.created_at).toLocaleString('fa-IR');
                
                html += `
                    <tr>
                        <td>${index + 1}</td>
                        <td>
                            <div style="font-weight: 600;">${user?.email || 'ناشناس'}</div>
                            <div style="font-size: 12px; color: var(--admin-text-secondary);">
                                ${user?.full_name || ''}
                            </div>
                        </td>
                        <td style="font-weight: 600; color: #FF3D00;">${formatCurrency(withdrawal.amount)}</td>
                        <td>
                            <div style="font-family: monospace; font-size: 12px;">
                                ${withdrawal.wallet_address.substring(0, 15)}...
                            </div>
                        </td>
                        <td>
                            <span class="admin-badge badge-info">${withdrawal.network}</span>
                        </td>
                        <td>${date}</td>
                        <td>
                            <span class="admin-badge badge-pending">در انتظار</span>
                        </td>
                        <td>
                            <button class="admin-btn admin-btn-sm admin-btn-success" onclick="approveWithdrawal(${withdrawal.id})">
                                <i class="fas fa-check"></i> تأیید
                            </button>
                            <button class="admin-btn admin-btn-sm admin-btn-danger" onclick="rejectWithdrawal(${withdrawal.id})">
                                <i class="fas fa-times"></i> رد
                            </button>
                        </td>
                    </tr>
                `;
            });
        }

        html += `
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        container.innerHTML = html;

    } catch (error) {
        console.error('❌ Load pending withdrawals error:', error);
        showNotification('خطا در بارگذاری درخواست‌های برداشت', 'error');
    }
}

// ============ صادر کردن توابع ============
// برای استفاده در فایل‌های دیگر

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        suspendUser,
        deleteUser,
        banUserIP,
        approveDeposit,
        rejectDeposit,
        approveWithdrawal,
        rejectWithdrawal,
        loadSalePlans,
        togglePackageStatus,
        loadSystemSettings,
        saveSettings,
        loadReports,
        loadSystemLogs,
        logAdminAction,
        sendUserNotification,
        getCategoryName,
        getSettingTypeName,
        getActionText,
        showLogChanges,
        showCustomModal,
        showSettingsTab,
        showReportTab,
        loadPendingWithdrawals
    };
}
