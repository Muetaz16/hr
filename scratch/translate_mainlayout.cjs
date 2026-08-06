const fs = require('fs');
const path = require('path');

const enJsonPath = path.join(__dirname, '..', 'public', 'locales', 'en', 'translation.json');
const arJsonPath = path.join(__dirname, '..', 'public', 'locales', 'ar', 'translation.json');

let enJson = JSON.parse(fs.readFileSync(enJsonPath, 'utf8'));
let arJson = JSON.parse(fs.readFileSync(arJsonPath, 'utf8'));

const translations = {
    nav_group_core: { en: "Core", ar: "الأساسية" },
    nav_group_ops: { en: "Operations", ar: "العمليات" },
    nav_approvals: { en: "Manager Approvals", ar: "موافقات المدير" },
    nav_operational_services: { en: "Operation Hub", ar: "مركز العمليات" },
    nav_service_center: { en: "Support Center", ar: "مركز الدعم" },
    nav_admin_operations: { en: "Admin Operations", ar: "العمليات الإدارية" },
    nav_group_hr: { en: "HR & Personnel", ar: "الموارد البشرية وشؤون الموظفين" },
    nav_hr: { en: "HR Management", ar: "إدارة الموارد البشرية" },
    nav_lifecycle_control: { en: "Lifecycle Control", ar: "التحكم في دورة الحياة" },
    nav_contract_management: { en: "Contract Management", ar: "إدارة العقود" },
    nav_group_evaluations: { en: "Evaluations", ar: "التقييمات" },
    nav_my_evaluations: { en: "Performance Reviews", ar: "مراجعات الأداء" },
    nav_group_admin: { en: "Administration", ar: "الإدارة" },
    nav_system_admin: { en: "System", ar: "النظام" },
    nav_units: { en: "Units", ar: "الوحدات" },
    change_password: { en: "Change Password", ar: "تغيير كلمة المرور" },
    new_password: { en: "New Password", ar: "كلمة المرور الجديدة" },
    enter_new_password: { en: "Enter new password", ar: "أدخل كلمة المرور الجديدة" },
    confirm_password: { en: "Confirm Password", ar: "تأكيد كلمة المرور" },
    confirm_new_password: { en: "Confirm new password", ar: "تأكيد كلمة المرور الجديدة" },
    save_password: { en: "Save Password", ar: "حفظ كلمة المرور" },
    passwords_do_not_match: { en: "Passwords do not match!", ar: "كلمات المرور غير متطابقة!" },
    password_too_short: { en: "Password must be at least 6 characters.", ar: "يجب أن تتكون كلمة المرور من 6 أحرف على الأقل." },
    password_changed_success: { en: "Password updated successfully!", ar: "تم تحديث كلمة المرور بنجاح!" },
    error_changing_password: { en: "Failed to change password.", ar: "فشل في تغيير كلمة المرور." }
};

for (const [key, value] of Object.entries(translations)) {
    if (!enJson[key]) enJson[key] = value.en;
    if (!arJson[key]) arJson[key] = value.ar;
}

fs.writeFileSync(enJsonPath, JSON.stringify(enJson, null, 4));
fs.writeFileSync(arJsonPath, JSON.stringify(arJson, null, 4));

console.log('Main Layout translations applied successfully.');
