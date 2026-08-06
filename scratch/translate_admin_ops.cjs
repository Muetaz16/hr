const fs = require('fs');
const path = require('path');

const tsxPath = path.join(__dirname, '..', 'src', 'pages', 'admin', 'AdminOperations.tsx');
let tsxContent = fs.readFileSync(tsxPath, 'utf8');

const enJsonPath = path.join(__dirname, '..', 'public', 'locales', 'en', 'translation.json');
const arJsonPath = path.join(__dirname, '..', 'public', 'locales', 'ar', 'translation.json');

let enJson = JSON.parse(fs.readFileSync(enJsonPath, 'utf8'));
let arJson = JSON.parse(fs.readFileSync(arJsonPath, 'utf8'));

const translations = {
    admin_ops_title: { en: "Operational Services", ar: "الخدمات التشغيلية" },
    admin_ops_subtitle: { en: "Manage device onboarding and help desk support tickets.", ar: "إدارة إعداد أجهزة الموظفين وتذاكر مكتب الدعم الفني." },
    onboarding_queue: { en: "Device Setup", ar: "إعداد الأجهزة" },
    support_desk: { en: "Help Desk", ar: "مكتب الدعم" },
    pending_requests: { en: "Pending Requests", ar: "الطلبات المعلقة" },
    open_tickets: { en: "Open Tickets", ar: "التذاكر المفتوحة" },
    critical_issues: { en: "Critical Issues", ar: "المشاكل الحرجة" },
    hardware_requests: { en: "Equipment Queue", ar: "طابور المعدات" },
    incident_logs: { en: "Incident logs", ar: "سجلات الحوادث" },
    records_match: { en: "matching records", ar: "سجلات مطابقة" },
    search_admin_ops: { en: "Search by name, ID, or title...", ar: "البحث بالاسم، المعرف، أو العنوان..." },
    all_statuses: { en: "All Status", ar: "جميع الحالات" },
    all_priorities: { en: "All Priority", ar: "جميع الأولويات" },
    all_categories: { en: "All Category", ar: "جميع الفئات" },
    no_hardware_reqs: { en: "No hardware requests in queue", ar: "لا توجد طلبات معدات في الطابور" },
    no_dept: { en: "No Dept", ar: "بدون قسم" },
    requested_by: { en: "Req by", ar: "طُلب بواسطة" },
    no_tickets_found: { en: "No support tickets found", ar: "لم يتم العثور على تذاكر دعم" },
    assigned_to: { en: "Assigned to:", ar: "معين إلى:" },
    ready_time: { en: "Ready:", ar: "جاهز:" },
    request_details: { en: "Request Details", ar: "تفاصيل الطلب" },
    equipment_request: { en: "Equipment Request", ar: "طلب معدات" },
    id_label: { en: "ID:", ar: "المعرف:" },
    subject_employee: { en: "Subject Employee", ar: "الموظف المعني" },
    requested_item: { en: "Requested Item", ar: "العنصر المطلوب" },
    update_priority: { en: "Update Priority", ar: "تحديث الأولوية" },
    request_details_notes: { en: "Request Details / Notes", ar: "تفاصيل الطلب / ملاحظات" },
    no_additional_notes: { en: "No additional notes provided.", ar: "لم يتم تقديم ملاحظات إضافية." },
    update_action: { en: "Update Action", ar: "إجراء التحديث" },
    add_remark_placeholder: { en: "Add a remark (serial numbers, tracking info, or reason for rejection)...", ar: "أضف ملاحظة (الأرقام التسلسلية، معلومات التتبع، أو سبب الرفض)..." },
    start_preparing: { en: "Start Preparing", ar: "بدء التجهيز" },
    mark_as_ready: { en: "Mark as Ready", ar: "تحديد كجاهز" },
    mark_as_assigned: { en: "Mark as Assigned", ar: "تحديد كمعين" },
    reject_request: { en: "Reject Request", ar: "رفض الطلب" },
    incident_details: { en: "Incident Details", ar: "تفاصيل الحادثة" },
    incident: { en: "Incident", ar: "حادثة" },
    ref_label: { en: "Ref:", ar: "المرجع:" },
    issue_subject: { en: "Issue Subject", ar: "موضوع المشكلة" },
    description: { en: "Description", ar: "الوصف" },
    reporter: { en: "Reporter", ar: "المُبلغ" },
    priority_assignee: { en: "Priority & Assignee", ar: "الأولوية والمعين" },
    assign_ticket: { en: "Assign Ticket", ar: "تعيين التذكرة" },
    select_admin: { en: "Select Admin...", ar: "اختر مسؤول..." },
    estimated_ready_time: { en: "Estimated Ready Time", ar: "وقت التجهيز المقدر" },
    assign_btn: { en: "Assign", ar: "تعيين" },
    status_transition: { en: "Status Transition", ar: "تغيير الحالة" },
    take_ticket: { en: "Take Ticket", ar: "استلام التذكرة" },
    resolve: { en: "Resolve", ar: "حل" },
    close_ticket: { en: "Close", ar: "إغلاق" },
    resolution_response: { en: "Resolution Response / Private Note", ar: "الاستجابة للحل / ملاحظة خاصة" },
    explain_resolution: { en: "Explain the resolution or add a progress update...", ar: "اشرح الحل أو أضف تحديثاً عن التقدم..." },
    danger_zone: { en: "Danger Zone", ar: "منطقة الخطر" },
    remove_incident: { en: "Permanently remove this incident from the system.", ar: "إزالة هذه الحادثة نهائياً من النظام." },
    delete_ticket: { en: "Delete Ticket", ar: "حذف التذكرة" },
    check_back_later: { en: "Check back later or try adjusting filters.", ar: "تحقق مرة أخرى لاحقاً أو حاول تعديل عوامل التصفية." },
    perm_cat_operational: { en: "IT & Operational Services", ar: "خدمات تكنولوجيا المعلومات والتشغيل" },

    // Status translations
    preparing: { en: "Preparing", ar: "قيد التجهيز" },
    ready: { en: "Ready", ar: "جاهز" },
    assigned: { en: "Assigned", ar: "معين" },
    open: { en: "Open", ar: "مفتوح" },
    resolved: { en: "Resolved", ar: "محلول" },
    closed: { en: "Closed", ar: "مغلق" },
    category_it: { en: "IT", ar: "تكنولوجيا المعلومات" },
    category_facility: { en: "Facility", ar: "المرافق" },
    category_hr: { en: "HR", ar: "الموارد البشرية" }
};

for (const [key, value] of Object.entries(translations)) {
    if (!enJson[key]) enJson[key] = value.en;
    if (!arJson[key]) arJson[key] = value.ar;
}

fs.writeFileSync(enJsonPath, JSON.stringify(enJson, null, 4));
fs.writeFileSync(arJsonPath, JSON.stringify(arJson, null, 4));

const replacements = [
    [">Pending Requests<", ">{t('pending_requests')}<"],
    [">Open Tickets<", ">{t('open_tickets')}<"],
    [">Critical Issues<", ">{t('critical_issues')}<"],
    ["placeholder=\"Search by name, ID, or title...\"", "placeholder={t('search_admin_ops')}"],
    ["'No Dept'", "t('no_dept')"],
    ["\"No hardware requests in queue\"", "t('no_hardware_reqs')"],
    ["\"No support tickets found\"", "t('no_tickets_found')"],
    ["Assigned to:", "{t('assigned_to')}"],
    ["Ready:", "{t('ready_time')}"],
    ["title=\"Request Details\"", "title={t('request_details')}"],
    [">Equipment Request<", ">{t('equipment_request')}<"],
    [">ID: #", ">{t('id_label')} #"],
    [">Subject Employee<", ">{t('subject_employee')}<"],
    [">Requested Item<", ">{t('requested_item')}<"],
    [">Update Priority<", ">{t('update_priority')}<"],
    [">Request Details / Notes<", ">{t('request_details_notes')}<"],
    ["\"No additional notes provided.\"", "t('no_additional_notes')"],
    [">Update Action<", ">{t('update_action')}<"],
    ["placeholder=\"Add a remark (serial numbers, tracking info, or reason for rejection)...\"", "placeholder={t('add_remark_placeholder')}"],
    [">Start Preparing<", ">{t('start_preparing')}<"],
    [">Mark as Ready<", ">{t('mark_as_ready')}<"],
    [">Mark as Assigned<", ">{t('mark_as_assigned')}<"],
    [">Reject Request<", ">{t('reject_request')}<"],
    ["title=\"Incident Details\"", "title={t('incident_details')}"],
    [" Incident<", " {t('incident')}<"],
    [">Ref: #", ">{t('ref_label')} #"],
    [">Issue Subject<", ">{t('issue_subject')}<"],
    [">Description<", ">{t('description')}<"],
    [">Reporter<", ">{t('reporter')}<"],
    [">Priority & Assignee<", ">{t('priority_assignee')}<"],
    [">Unassigned<", ">{t('unassigned')}<"],
    [">Assign Ticket<", ">{t('assign_ticket')}<"],
    [">Select Admin...<", ">{t('select_admin')}<"],
    [">Estimated Ready Time<", ">{t('estimated_ready_time')}<"],
    ["Assign\\n", "{t('assign_btn')}\\n"],
    [">Status Transition<", ">{t('status_transition')}<"],
    [">Take Ticket<", ">{t('take_ticket')}<"],
    [">Resolve<", ">{t('resolve')}<"],
    [">Close<", ">{t('close_ticket')}<"],
    [">Resolution Response / Private Note<", ">{t('resolution_response')}<"],
    ["placeholder=\"Explain the resolution or add a progress update...\"", "placeholder={t('explain_resolution')}"],
    [">Danger Zone<", ">{t('danger_zone')}<"],
    [">Permanently remove this incident from the system.<", ">{t('remove_incident')}<"],
    [">Delete Ticket<", ">{t('delete_ticket')}<"],
    [">Check back later or try adjusting filters.<", ">{t('check_back_later')}<"],
    [">Low<", ">{t('low')}<"],
    [">Normal<", ">{t('normal')}<"],
    [">High<", ">{t('high')}<"],
    [">Critical<", ">{t('critical')}<"]
];

for (const [search, replace] of replacements) {
    tsxContent = tsxContent.split(search).join(replace);
}

// Special cases
tsxContent = tsxContent.replace(/{status\.replace\('_', ' '\)}/g, "{t(status.toLowerCase())}");
tsxContent = tsxContent.replace(/{ticket\.category} Incident/g, "{t('category_' + ticket.category.toLowerCase())} {t('incident')}");
tsxContent = tsxContent.replace(/>IT</g, ">{t('category_it')}<");
tsxContent = tsxContent.replace(/>Facility</g, ">{t('category_facility')}<");
tsxContent = tsxContent.replace(/>HR</g, ">{t('category_hr')}<");

tsxContent = tsxContent.replace(/<option value="PENDING">Pending<\/option>/g, "<option value=\"PENDING\">{t('pending')}</option>");
tsxContent = tsxContent.replace(/<option value="PREPARING">Preparing<\/option>/g, "<option value=\"PREPARING\">{t('preparing')}</option>");
tsxContent = tsxContent.replace(/<option value="READY">Ready<\/option>/g, "<option value=\"READY\">{t('ready')}</option>");
tsxContent = tsxContent.replace(/<option value="ASSIGNED">Assigned<\/option>/g, "<option value=\"ASSIGNED\">{t('assigned')}</option>");
tsxContent = tsxContent.replace(/<option value="REJECTED">Rejected<\/option>/g, "<option value=\"REJECTED\">{t('rejected')}</option>");
tsxContent = tsxContent.replace(/<option value="OPEN">Open<\/option>/g, "<option value=\"OPEN\">{t('open')}</option>");
tsxContent = tsxContent.replace(/<option value="IN_PROGRESS">In Progress<\/option>/g, "<option value=\"IN_PROGRESS\">{t('in_progress')}</option>");
tsxContent = tsxContent.replace(/<option value="RESOLVED">Resolved<\/option>/g, "<option value=\"RESOLVED\">{t('resolved')}</option>");
tsxContent = tsxContent.replace(/<option value="CLOSED">Closed<\/option>/g, "<option value=\"CLOSED\">{t('closed')}</option>");

fs.writeFileSync(tsxPath, tsxContent);
console.log('AdminOperations translations applied successfully.');
