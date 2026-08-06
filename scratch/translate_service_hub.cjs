const fs = require('fs');
const path = require('path');

const tsxPath = path.join(__dirname, '..', 'src', 'pages', 'SupportCenter.tsx');
let tsxContent = fs.readFileSync(tsxPath, 'utf8');

const enJsonPath = path.join(__dirname, '..', 'public', 'locales', 'en', 'translation.json');
const arJsonPath = path.join(__dirname, '..', 'public', 'locales', 'ar', 'translation.json');

let enJson = JSON.parse(fs.readFileSync(enJsonPath, 'utf8'));
let arJson = JSON.parse(fs.readFileSync(arJsonPath, 'utf8'));

const translations = {
    support_center_title: { en: "Service Hub", ar: "مركز الخدمات" },
    support_center_subtitle: { en: "How can we help you today? Request hardware or report issues directly to our operations team.", ar: "كيف يمكننا مساعدتك اليوم؟ اطلب أجهزة أو أبلغ عن مشاكل مباشرة إلى فريق العمليات لدينا." },
    request_equipment: { en: "Request Equipment", ar: "طلب معدات" },
    request_equipment_desc: { en: "Order a new laptop, mobile device, or accessories for your role.", ar: "اطلب جهاز كمبيوتر محمول، أو هاتف محمول، أو ملحقات لعملك." },
    report_issue: { en: "Report an Issue", ar: "الإبلاغ عن مشكلة" },
    report_issue_desc: { en: "Facing technical problems or system errors? Let us know.", ar: "هل تواجه مشاكل فنية أو أخطاء في النظام؟ أخبرنا بذلك." },
    track_status_subtitle: { en: "Track the status of your equipment and support logs.", ar: "تتبع حالة طلبات المعدات وسجلات الدعم الخاصة بك." },
    support_tickets: { en: "Support Tickets", ar: "تذاكر الدعم" },
    equipment_requests: { en: "Hardware", ar: "المعدات" },
    no_tickets_yet: { en: "No active support tickets", ar: "لا توجد تذاكر دعم نشطة" },
    no_assets_yet: { en: "No equipment requests yet", ar: "لا توجد طلبات معدات حتى الآن" },
    resolution_note: { en: "Resolution Note", ar: "ملاحظة الحل" },
    request_new_equipment: { en: "New Equipment", ar: "معدات جديدة" },
    equipment_modal_desc: { en: "Tell us which hardware you need for your role.", ar: "أخبرنا بالأجهزة التي تحتاجها لدورك." },
    item_type: { en: "Category", ar: "الفئة" },
    laptop_mac_pc: { en: "Laptop (Mac/PC)", ar: "كمبيوتر محمول (ماك/كمبيوتر شخصي)" },
    mobile_phone: { en: "Mobile Phone", ar: "هاتف محمول" },
    sim_card: { en: "SIM Card", ar: "شريحة اتصال (SIM)" },
    dual_monitor_setup: { en: "Dual Monitor Setup", ar: "إعداد شاشة مزدوجة" },
    general_accessories: { en: "General Accessories", ar: "ملحقات عامة" },
    request_notes: { en: "Specification & Reason", ar: "المواصفات والسبب" },
    asset_notes_placeholder: { en: "e.g. Need high memory for video editing, or replacing a broken unit...", ar: "مثال: أحتاج ذاكرة عالية لتحرير الفيديو، أو استبدال وحدة معطلة..." },
    report_new_issue: { en: "New Support Ticket", ar: "تذكرة دعم جديدة" },
    ticket_modal_desc: { en: "Report bugs, system crashes, or hardware issues.", ar: "الإبلاغ عن الأخطاء أو أعطال النظام أو مشاكل الأجهزة." },
    it_hw_sw: { en: "IT (HW/SW)", ar: "تكنولوجيا المعلومات (أجهزة/برامج)" },
    office_facility: { en: "Office Facility", ar: "مرافق المكتب" },
    hr_access: { en: "HR / Access", ar: "الموارد البشرية / الوصول" },
    urgency: { en: "Priority", ar: "الأولوية" },
    subject: { en: "Problem Title", ar: "عنوان المشكلة" },
    issue_summary_placeholder: { en: "Short summary of the issue", ar: "ملخص قصير للمشكلة" },
    detailed_desc: { en: "Full Description", ar: "الوصف الكامل" },
    issue_desc_placeholder: { en: "Proivde as much detail as possible. Steps to reproduce if software bug.", ar: "قدم أكبر قدر ممكن من التفاصيل. خطوات التكرار إذا كان خطأ برمجي." },
    submit_ticket: { en: "Send Ticket", ar: "إرسال التذكرة" },
    asset_request_submitted: { en: "Request submitted successfully!", ar: "تم تقديم الطلب بنجاح!" },
    ticket_submitted: { en: "Ticket submitted successfully!", ar: "تم تقديم التذكرة بنجاح!" }
};

for (const [key, value] of Object.entries(translations)) {
    if (!enJson[key]) enJson[key] = value.en;
    if (!arJson[key]) arJson[key] = value.ar;
}

fs.writeFileSync(enJsonPath, JSON.stringify(enJson, null, 4));
fs.writeFileSync(arJsonPath, JSON.stringify(arJson, null, 4));

const replacements = [
    [">Resolution Note<", ">{t('resolution_note')}<"],
    [">Laptop (Mac/PC)<", ">{t('laptop_mac_pc')}<"],
    [">Mobile Phone<", ">{t('mobile_phone')}<"],
    [">SIM Card<", ">{t('sim_card')}<"],
    [">Dual Monitor Setup<", ">{t('dual_monitor_setup')}<"],
    [">General Accessories<", ">{t('general_accessories')}<"],
    ["placeholder=\"e.g. Need high memory for video editing, or replacing a broken unit...\"", "placeholder={t('asset_notes_placeholder')}"],
    [">IT (HW/SW)<", ">{t('it_hw_sw')}<"],
    [">Office Facility<", ">{t('office_facility')}<"],
    [">HR / Access<", ">{t('hr_access')}<"],
    ["placeholder=\"Short summary of the issue\"", "placeholder={t('issue_summary_placeholder')}"],
    ["placeholder=\"Proivde as much detail as possible. Steps to reproduce if software bug.\"", "placeholder={t('issue_desc_placeholder')}"],
    [">Low<", ">{t('low')}<"],
    [">Normal<", ">{t('normal')}<"],
    [">High<", ">{t('high')}<"],
    [">Critical<", ">{t('critical')}<"]
];

for (const [search, replace] of replacements) {
    tsxContent = tsxContent.split(search).join(replace);
}

tsxContent = tsxContent.replace(/{status\.replace\('_', ' '\)}/g, "{t(status.toLowerCase())}");
tsxContent = tsxContent.replace(/{ticket\.category}/g, "{t('category_' + ticket.category.toLowerCase())}");

fs.writeFileSync(tsxPath, tsxContent);
console.log('SupportCenter translations applied successfully.');
