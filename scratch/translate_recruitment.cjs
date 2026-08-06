const fs = require('fs');
const path = require('path');

const enJsonPath = path.join(__dirname, '..', 'public', 'locales', 'en', 'translation.json');
const arJsonPath = path.join(__dirname, '..', 'public', 'locales', 'ar', 'translation.json');

const tsxPath = path.join(__dirname, '..', 'src', 'pages', 'Recruitment.tsx');

let enJson = JSON.parse(fs.readFileSync(enJsonPath, 'utf8'));
let arJson = JSON.parse(fs.readFileSync(arJsonPath, 'utf8'));

const translations = {
    // Toasts and alerts
    "err_load_recruitment": { en: "Failed to load recruitment data", ar: "فشل في تحميل بيانات التوظيف" },
    "req_updated_success": { en: "Recruitment request updated successfully", ar: "تم تحديث طلب التوظيف بنجاح" },
    "req_submitted_success": { en: "Recruitment request submitted successfully", ar: "تم تقديم طلب التوظيف بنجاح" },
    "err_update_req": { en: "Failed to update request", ar: "فشل في تحديث الطلب" },
    "err_submit_req": { en: "Failed to submit request", ar: "فشل في تقديم الطلب" },
    "confirm_delete_req": { en: "Are you sure you want to delete this recruitment request?", ar: "هل أنت متأكد أنك تريد حذف طلب التوظيف هذا؟" },
    "req_deleted_success": { en: "Request deleted successfully", ar: "تم حذف الطلب بنجاح" },
    "err_delete_req": { en: "Failed to delete request", ar: "فشل في حذف الطلب" },
    "err_update_status": { en: "Failed to update request status", ar: "فشل في تحديث حالة الطلب" },
    "req_status_updated": { en: "Request updated successfully", ar: "تم تحديث الطلب بنجاح" }, // simplified for the template string
    
    // UI Elements
    "loading_recruitment": { en: "Loading Recruitment Requests...", ar: "جاري تحميل طلبات التوظيف..." },
    "recruitment_requests": { en: "Recruitment Requests", ar: "طلبات التوظيف" },
    "recruitment_subtitle": { en: "Manage and approve hiring requests for the organization", ar: "إدارة والموافقة على طلبات التوظيف للمؤسسة" },
    "request_new_employee": { en: "Request New Employee", ar: "طلب موظف جديد" },
    "active_requests": { en: "Active Requests", ar: "الطلبات النشطة" },
    "job_position": { en: "Job Position", ar: "المسمى الوظيفي" },
    "dept_unit": { en: "Department / Unit", ar: "القسم / الوحدة" },
    "requester_reason": { en: "Requester Reason", ar: "سبب الطلب" },
    "no_reason_provided": { en: "No reason provided", ar: "لم يتم تقديم سبب" },
    "requested_by": { en: "Requested by", ar: "بطلب من" },
    "details_approval": { en: "Details & Approval", ar: "التفاصيل والموافقة" },
    "no_recruitment_reqs": { en: "No recruitment requests found.", ar: "لم يتم العثور على طلبات توظيف." },
    "edit_recruitment_req": { en: "Edit Recruitment Request", ar: "تعديل طلب التوظيف" },
    "new_recruitment_req": { en: "New Recruitment Request", ar: "طلب توظيف جديد" },
    "job_information": { en: "Job Information", ar: "معلومات الوظيفة" },
    "job_title_name": { en: "Job Title / Position Name", ar: "المسمى الوظيفي / اسم المنصب" },
    "eg_senior_engineer": { en: "e.g. Senior Software Engineer", ar: "مثال: مهندس برمجيات أول" },
    "justification_reason": { en: "Justification / Reason", ar: "المبرر / السبب" },
    "explain_position_needed": { en: "Explain why this position is needed...", ar: "اشرح لماذا هذا المنصب مطلوب..." },
    "select_department": { en: "Select Department", ar: "اختر القسم" },
    "unit_optional": { en: "Unit (Optional)", ar: "الوحدة (اختياري)" },
    "select_unit": { en: "Select Unit", ar: "اختر الوحدة" },
    "req_details": { en: "Recruitment Request Details", ar: "تفاصيل طلب التوظيف" },
    "new_hiring_req": { en: "New Hiring Request", ar: "طلب تعيين جديد" },
    "req_justification": { en: "Request Justification", ar: "مبرر الطلب" },
    "approval_workflow": { en: "Approval Workflow", ar: "سير عمل الموافقة" },
    "dept_head_review": { en: "Dept Head Review", ar: "مراجعة رئيس القسم" },
    "awaiting_dept_head": { en: "Awaiting Department Head Decision", ar: "في انتظار قرار رئيس القسم" },
    "hr_manager_review": { en: "HR Manager Review", ar: "مراجعة مدير الموارد البشرية" },
    "awaiting_hr_approval": { en: "Awaiting HR Approval", ar: "في انتظار موافقة الموارد البشرية" },
    "gm_final_decision": { en: "General Manager Final Decision", ar: "القرار النهائي للمدير العام" },
    "awaiting_gm_approval": { en: "Awaiting GM Final Approval", ar: "في انتظار الموافقة النهائية للمدير العام" },
    "provide_decision": { en: "Provide Your Decision", ar: "قدم قرارك" },
    "add_comment_feedback": { en: "Add a comment or feedback for this decision...", ar: "أضف تعليقًا أو ملاحظة لهذا القرار..." },
    "approve_dept_review": { en: "Approve (Dept Review)", ar: "موافقة (مراجعة القسم)" },
    "approve_hr_review": { en: "Approve (HR Review)", ar: "موافقة (مراجعة الموارد البشرية)" },
    "grant_final_approval": { en: "Grant Final Approval", ar: "منح الموافقة النهائية" },
    
    // Statuses
    "hr_approved": { en: "HR Approved", ar: "موافقة الموارد البشرية" },
    "fully_approved": { en: "Fully Approved", ar: "موافق عليه بالكامل" },
    "dept_approved": { en: "Dept Approved", ar: "موافقة القسم" }
};

for (const [key, value] of Object.entries(translations)) {
    if (!enJson[key]) enJson[key] = value.en;
    if (!arJson[key]) arJson[key] = value.ar;
}

fs.writeFileSync(enJsonPath, JSON.stringify(enJson, null, 4));
fs.writeFileSync(arJsonPath, JSON.stringify(arJson, null, 4));

// Now replace in TSX content
let content = fs.readFileSync(tsxPath, 'utf8');

// Add import
if (!content.includes('useTranslation')) {
    content = content.replace("import { toast } from 'sonner';", "import { toast } from 'sonner';\nimport { useTranslation } from 'react-i18next';");
}
if (!content.includes('const { t } = useTranslation();')) {
    content = content.replace("const { currentUser } = useAuth();", "const { currentUser } = useAuth();\n    const { t } = useTranslation();");
}

const replacements = [
    ["'Failed to load recruitment data'", "t('err_load_recruitment')"],
    ["'Recruitment request updated successfully'", "t('req_updated_success')"],
    ["'Recruitment request submitted successfully'", "t('req_submitted_success')"],
    ["'Failed to update request'", "t('err_update_req')"],
    ["'Failed to submit request'", "t('err_submit_req')"],
    ["'Are you sure you want to delete this recruitment request?'", "t('confirm_delete_req')"],
    ["'Request deleted successfully'", "t('req_deleted_success')"],
    ["'Failed to delete request'", "t('err_delete_req')"],
    ["'Failed to update request status'", "t('err_update_status')"],
    ["`Request ${status.toLowerCase().replace('_', ' ')} successfully`", "t('req_status_updated')"],
    
    [">Loading Recruitment Requests...<", ">{t('loading_recruitment')}<"],
    [">Recruitment Requests<", ">{t('recruitment_requests')}<"],
    [">Manage and approve hiring requests for the organization<", ">{t('recruitment_subtitle')}<"],
    [">Request New Employee<", ">{t('request_new_employee')}<"],
    [">Active Requests<", ">{t('active_requests')}<"],
    [">Job Position<", ">{t('job_position')}<"],
    [">Department / Unit<", ">{t('dept_unit')}<"],
    [">Requester Reason<", ">{t('requester_reason')}<"],
    ["'No reason provided'", "t('no_reason_provided')"],
    ["'No reason provided.'", "t('no_reason_provided')"],
    [">Requested by <", ">{t('requested_by')} <"],
    [">Details & Approval<", ">{t('details_approval')}<"],
    [">No recruitment requests found.<", ">{t('no_recruitment_reqs')}<"],
    ['"Edit Recruitment Request"', "t('edit_recruitment_req')"],
    ['"New Recruitment Request"', "t('new_recruitment_req')"],
    [">Job Information<", ">{t('job_information')}<"],
    [">Job Title / Position Name<", ">{t('job_title_name')}<"],
    ['placeholder="e.g. Senior Software Engineer"', "placeholder={t('eg_senior_engineer')}"],
    [">Justification / Reason<", ">{t('justification_reason')}<"],
    ['placeholder="Explain why this position is needed..."', "placeholder={t('explain_position_needed')}"],
    [">Select Department<", ">{t('select_department')}<"],
    [">Unit (Optional)<", ">{t('unit_optional')}<"],
    [">Select Unit<", ">{t('select_unit')}<"],
    ['title="Recruitment Request Details"', "title={t('req_details')}"],
    [">New Hiring Request<", ">{t('new_hiring_req')}<"],
    [">Request Justification<", ">{t('req_justification')}<"],
    [">Approval Workflow<", ">{t('approval_workflow')}<"],
    [">Dept Head Review<", ">{t('dept_head_review')}<"],
    [">Awaiting Department Head Decision<", ">{t('awaiting_dept_head')}<"],
    [">HR Manager Review<", ">{t('hr_manager_review')}<"],
    [">Awaiting HR Approval<", ">{t('awaiting_hr_approval')}<"],
    [">General Manager Final Decision<", ">{t('gm_final_decision')}<"],
    [">Awaiting GM Final Approval<", ">{t('awaiting_gm_approval')}<"],
    [">Provide Your Decision<", ">{t('provide_decision')}<"],
    ['placeholder="Add a comment or feedback for this decision..."', "placeholder={t('add_comment_feedback')}"],
    [">Approve (Dept Review)<", ">{t('approve_dept_review')}<"],
    [">Approve (HR Review)<", ">{t('approve_hr_review')}<"],
    [">Grant Final Approval<", ">{t('grant_final_approval')}<"],
    
    // Status badges on top
    [">Pending<", ">{t('pending')}<"],
    [">HR Approved<", ">{t('hr_approved')}<"],
    [">Fully Approved<", ">{t('fully_approved')}<"],
    [">Rejected<", ">{t('rejected')}<"],
    
    // Buttons missing from above
    [">Cancel<", ">{t('cancel')}<"],
    [">Submit Request<", ">{t('submit_request')}<"],
    [">Reject<", ">{t('rejected')}<"],
    [">Close<", ">{t('cancel')}<"], // or close
    
    // Dynamic string
    ["request.status.replace('_', ' ')", "t(request.status.toLowerCase())"],
    [">Department<", ">{t('nav_departments')}<"] // The label for Department select
];

for (const [search, replace] of replacements) {
    content = content.split(search).join(replace);
}

fs.writeFileSync(tsxPath, content);
console.log('Done translating Recruitment.tsx');
