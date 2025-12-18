// در کلاس GameService این تابع را اضافه کنید
validateUserAccess() {
    if (!this.userId) {
        console.error('❌ No user ID - access denied');
        return false;
    }
    
    // چک کردن اینکه کاربر در localStorage وجود دارد
    const userData = localStorage.getItem('sodmax_user');
    if (!userData) {
        console.error('❌ No user in localStorage - access denied');
        return false;
    }
    
    try {
        const user = JSON.parse(userData);
        if (user.id !== this.userId) {
            console.error('❌ User ID mismatch - access denied');
            return false;
        }
        
        return true;
    } catch (error) {
        console.error('❌ Error parsing user data - access denied');
        return false;
    }
}

// و در ابتدای هر تابع که نیاز به دسترسی کاربر دارد، این چک را اضافه کنید:
manualMine() {
    if (!this.validateUserAccess()) {
        console.error('❌ Access denied for manual mining');
        return { earned: 0, usdtResult: null };
    }
    
    // بقیه کد...
}

claimUSDT() {
    if (!this.validateUserAccess()) {
        console.error('❌ Access denied for claiming USDT');
        return { success: false, error: 'دسترسی غیرمجاز' };
    }
    
    // بقیه کد...
}
