// supabase-config.js
const SUPABASE_URL = 'https://wxxhulztrxmjqftxcetp.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind4eGh1bHp0cnhtanFmdHhjZXRwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYwNzEwNDcsImV4cCI6MjA4MTY0NzA0N30.iC6Ief8aF-zw66RQRSnLxA-BmAjChQj9xy4HkJpGOA4';

// ایجاد کلاینت Supabase
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// اکسپورت برای استفاده در سایر فایل‌ها
window.supabaseClient = supabase;
console.log('✅ Supabase connected successfully');
