const fs = require('fs');
const path = require('path');

const tsxPath = path.join(__dirname, '..', 'src', 'pages', 'Approvals.tsx');
let tsxContent = fs.readFileSync(tsxPath, 'utf8');

const enJsonPath = path.join(__dirname, '..', 'public', 'locales', 'en', 'translation.json');
const arJsonPath = path.join(__dirname, '..', 'public', 'locales', 'ar', 'translation.json');

let enJson = JSON.parse(fs.readFileSync(enJsonPath, 'utf8'));
let arJson = JSON.parse(fs.readFileSync(arJsonPath, 'utf8'));

const translations = {
  manager_control_room: { en: "Manager Control Room", ar: "غرفة تحكم المدير" },
  manage_approvals_desc: { en: "Manage approvals, delegate work, and broadcast news.", ar: "إدارة الموافقات وتفويض العمل وبث الأخبار." },
  leave_requests: { en: "Leave Requests", ar: "طلبات الإجازة" },
  request_history: { en: "Request History", ar: "سجل الطلبات" },
  assign_tasks: { en: "Assign Tasks", ar: "تعيين المهام" },
  task_progress: { en: "Task Progress", ar: "تقدم المهمة" },
  broadcasting: { en: "Broadcasting", ar: "البث" },
  unknown_staff: { en: "Unknown Staff", ar: "موظف غير معروف" },
  no_specific_reason: { en: "No specific reason provided", ar: "لم يتم تقديم سبب محدد" },
  pending: { en: "Pending", ar: "معلق" },
  approve: { en: "Approve", ar: "موافقة" },
  reject: { en: "Reject", ar: "رفض" },
  add_rejection_note: { en: "Add rejection note (optional):", ar: "إضافة ملاحظة رفض (اختياري):" },
  inbox_zero: { en: "Inbox Zero!", ar: "صندوق الوارد فارغ!" },
  no_pending_leave_requests: { en: "No pending leave requests to review.", ar: "لا توجد طلبات إجازة معلقة للمراجعة." },
  decision_archive: { en: "Decision Archive", ar: "أرشيف القرارات" },
  historical_records: { en: "historical records", ar: "سجلات تاريخية" },
  staff_member: { en: "Staff Member", ar: "عضو هيئة التدريس / الموظف" },
  no_specific_note: { en: "No specific note provided", ar: "لم يتم تقديم ملاحظة محددة" },
  unit_approval: { en: "Unit", ar: "الوحدة" },
  dept_approval: { en: "Dept", ar: "القسم" },
  dir_approval: { en: "Dir", ar: "المدير" },
  no_historical_records: { en: "No historical records found.", ar: "لم يتم العثور على سجلات تاريخية." },
  assign_new_task: { en: "Assign New Task", ar: "تعيين مهمة جديدة" },
  task_headline: { en: "Task Headline", ar: "عنوان المهمة" },
  what_needs_to_be_done: { en: "What needs to be done?", ar: "ما الذي يجب القيام به؟" },
  assign_to_dept: { en: "Assign to Dept (Optional)", ar: "التعيين للقسم (اختياري)" },
  select_department: { en: "Select Department", ar: "اختر القسم" },
  assign_to_individual: { en: "Assign to Individual", ar: "التعيين للفرد" },
  select_employee: { en: "Select Employee", ar: "اختر الموظف" },
  deadline_date: { en: "Deadline Date", ar: "تاريخ الموعد النهائي" },
  priority_level: { en: "Priority Level", ar: "مستوى الأولوية" },
  low: { en: "Low", ar: "منخفض" },
  normal: { en: "Normal", ar: "عادي" },
  high: { en: "High", ar: "مرتفع" },
  critical: { en: "Critical", ar: "حرج" },
  instructions_md: { en: "Instructions (Markdown Support)", ar: "التعليمات (دعم Markdown)" },
  describe_task_detail: { en: "Describe the task in detail...", ar: "وصف المهمة بالتفصيل..." },
  deploy_task: { en: "Deploy Task", ar: "نشر المهمة" },
  broadcast_title: { en: "Broadcast Title", ar: "عنوان البث" },
  important_office_policy: { en: "Important: New Office Policy...", ar: "هام: سياسة مكتبية جديدة..." },
  target_audience: { en: "Target Audience", ar: "الجمهور المستهدف" },
  global_everyone: { en: "Global (Everyone)", ar: "كل (الجميع)" },
  specific_department: { en: "Specific Department", ar: "قسم محدد" },
  private_individual: { en: "Private (One Individual)", ar: "خاص (فرد واحد)" },
  select_target: { en: "Select Target", ar: "اختر الهدف" },
  choose_target: { en: "Choose Target...", ar: "اختر الهدف..." },
  broadcast_message: { en: "Broadcast Message", ar: "رسالة البث" },
  type_announcement_here: { en: "Type your announcement here...", ar: "اكتب إعلانك هنا..." },
  broadcast_announcement: { en: "Broadcast Announcement", ar: "بث الإعلان" },
  dept_task_tracker: { en: "Department Task Tracker", ar: "متتبع مهام القسم" },
  monitoring_workload: { en: "Monitoring workload and progress across your scope.", ar: "مراقبة عبء العمل والتقدم عبر نطاقك." },
  unassigned: { en: "Unassigned", ar: "غير معين" },
  deadline: { en: "Deadline", ar: "الموعد النهائي" },
  no_tasks_found: { en: "No tasks found", ar: "لم يتم العثور على مهام" },
  tasks_assigned_appear_here: { en: "Tasks assigned by you or within your scope will appear here.", ar: "ستظهر المهام المعينة من قبلك أو ضمن نطاقك هنا." },
  failed_to_load_data: { en: "Failed to load data", ar: "فشل في تحميل البيانات" },
  failed_to_update_status: { en: "Failed to update status", ar: "فشل في تحديث الحالة" },
  task_assigned_success: { en: "Task assigned successfully", ar: "تم تعيين المهمة بنجاح" },
  failed_to_assign_task: { en: "Failed to assign task", ar: "فشل في تعيين المهمة" },
  announcement_posted: { en: "Announcement posted", ar: "تم نشر الإعلان" },
  failed_to_post_announcement: { en: "Failed to post announcement", ar: "فشل في نشر الإعلان" },
  loading_approvals: { en: "Loading Approvals Dashboard...", ar: "جاري تحميل لوحة الموافقات..." },
  request_approved: { en: "Request Approved", ar: "تمت الموافقة على الطلب" },
  request_rejected: { en: "Request Rejected", ar: "تم رفض الطلب" },
  all: { en: "ALL", ar: "الكل" }
};

// Add to JSONs
for (const [key, value] of Object.entries(translations)) {
  if (!enJson[key]) enJson[key] = value.en;
  if (!arJson[key]) arJson[key] = value.ar;
}

fs.writeFileSync(enJsonPath, JSON.stringify(enJson, null, 4));
fs.writeFileSync(arJsonPath, JSON.stringify(arJson, null, 4));

// Now replace in TSX content
const replacements = [
  ["'Failed to load data'", "t('failed_to_load_data')"],
  ["'Failed to update status'", "t('failed_to_update_status')"],
  ["'Task assigned successfully'", "t('task_assigned_success')"],
  ["'Failed to assign task'", "t('failed_to_assign_task')"],
  ["'Announcement posted'", "t('announcement_posted')"],
  ["'Failed to post announcement'", "t('failed_to_post_announcement')"],
  ["'Add rejection note (optional):'", "t('add_rejection_note')"],
  ["`Request ${status === 'REJECTED' ? 'Rejected' : 'Approved'}`", "status === 'REJECTED' ? t('request_rejected') : t('request_approved')"],
  [">Manage approvals, delegate work, and broadcast news.<", ">{t('manage_approvals_desc')}<"],
  ["label: 'Leave Requests'", "label: t('leave_requests')"],
  ["label: 'Request History'", "label: t('request_history')"],
  ["label: 'Assign Tasks'", "label: t('assign_tasks')"],
  ["label: 'Task Progress'", "label: t('task_progress')"],
  ["label: 'Broadcasting'", "label: t('broadcasting')"],
  ["'Unknown Staff'", "t('unknown_staff')"],
  [">Unknown Staff<", ">{t('unknown_staff')}<"],
  ["'Pending'", "t('pending')"],
  [">Pending<", ">{t('pending')}<"],
  ["'No specific reason provided'", "t('no_specific_reason')"],
  ["\"No specific reason provided\"", "t('no_specific_reason')"],
  ["'No specific note provided'", "t('no_specific_note')"],
  ["\"No specific note provided\"", "t('no_specific_note')"],
  [">Unit: ", ">Unit: "], // Wait, this needs special handling
  [">Unit<", ">{t('unit_approval')}<"],
  [">Dept<", ">{t('dept_approval')}<"],
  [">Dir<", ">{t('dir_approval')}<"],
  [">Approve<", ">{t('approve')}<"],
  [">Reject<", ">{t('reject')}<"],
  [">Inbox Zero!<", ">{t('inbox_zero')}<"],
  [">No pending leave requests to review.<", ">{t('no_pending_leave_requests')}<"],
  [">Decision Archive<", ">{t('decision_archive')}<"],
  ["historical records", "{t('historical_records')}"],
  [">Staff Member<", ">{t('staff_member')}<"],
  ["'Staff Member'", "t('staff_member')"],
  [">No historical records found.<", ">{t('no_historical_records')}<"],
  [">Assign New Task<", ">{t('assign_new_task')}<"],
  [">Task Headline<", ">{t('task_headline')}<"],
  ["placeholder=\"What needs to be done?\"", "placeholder={t('what_needs_to_be_done')}"],
  [">Assign to Dept (Optional)<", ">{t('assign_to_dept')}<"],
  [">Select Department<", ">{t('select_department')}<"],
  ["'Select Department'", "t('select_department')"],
  [">Assign to Individual<", ">{t('assign_to_individual')}<"],
  [">Select Employee<", ">{t('select_employee')}<"],
  ["'Select Employee'", "t('select_employee')"],
  [">Deadline Date<", ">{t('deadline_date')}<"],
  [">Priority Level<", ">{t('priority_level')}<"],
  [">Low<", ">{t('low')}<"],
  [">Normal<", ">{t('normal')}<"],
  [">High<", ">{t('high')}<"],
  [">Critical<", ">{t('critical')}<"],
  [">Instructions (Markdown Support)<", ">{t('instructions_md')}<"],
  ["placeholder=\"Describe the task in detail...\"", "placeholder={t('describe_task_detail')}"],
  [">Deploy Task<", ">{t('deploy_task')}<"],
  [">Broadcast Title<", ">{t('broadcast_title')}<"],
  ["placeholder=\"Important: New Office Policy...\"", "placeholder={t('important_office_policy')}"],
  [">Target Audience<", ">{t('target_audience')}<"],
  [">Global (Everyone)<", ">{t('global_everyone')}<"],
  [">Specific Department<", ">{t('specific_department')}<"],
  [">Private (One Individual)<", ">{t('private_individual')}<"],
  [">Select Target<", ">{t('select_target')}<"],
  [">Choose Target...<", ">{t('choose_target')}<"],
  [">Broadcast Message<", ">{t('broadcast_message')}<"],
  ["placeholder=\"Type your announcement here...\"", "placeholder={t('type_announcement_here')}"],
  [">Broadcast Announcement<", ">{t('broadcast_announcement')}<"],
  [">Department Task Tracker<", ">{t('dept_task_tracker')}<"],
  [">Monitoring workload and progress across your scope.<", ">{t('monitoring_workload')}<"],
  ["'Unassigned'", "t('unassigned')"],
  [">Unassigned<", ">{t('unassigned')}<"],
  [">Deadline<", ">{t('deadline')}<"],
  [">No tasks found<", ">{t('no_tasks_found')}<"],
  [">Tasks assigned by you or within your scope will appear here.<", ">{t('tasks_assigned_appear_here')}<"],
  [">Loading Approvals Dashboard...<", ">{t('loading_approvals')}<"]
];

for (const [search, replace] of replacements) {
  tsxContent = tsxContent.split(search).join(replace);
}

// Custom handle: Unit: {(req as any).unitApprovedBy?.fullName || 'Pending'}
tsxContent = tsxContent.replace(/Unit: \{\(req as any\)\.unitApprovedBy\?\.fullName \|\| 'Pending'\}/g, "{t('unit_approval')}: {(req as any).unitApprovedBy?.fullName || t('pending')}");
tsxContent = tsxContent.replace(/Dept: \{\(req as any\)\.deptApprovedBy\?\.fullName \|\| 'Pending'\}/g, "{t('dept_approval')}: {(req as any).deptApprovedBy?.fullName || t('pending')}");
tsxContent = tsxContent.replace(/Director: \{\(req as any\)\.directorApprovedBy\?\.fullName \|\| 'Pending'\}/g, "{t('dir_approval')}: {(req as any).directorApprovedBy?.fullName || t('pending')}");
tsxContent = tsxContent.replace(/'ALL', 'PENDING', 'IN_PROGRESS', 'COMPLETED'/g, "t('all'), t('pending'), t('in_progress'), t('completed')");
// wait the tabs at task progress are mapped:
// {['ALL', 'PENDING', 'IN_PROGRESS', 'COMPLETED'].map(s => (
// we should map them differently so that `s` is translated.
// Actually, let's keep the value for state, and translate just the render:

fs.writeFileSync(tsxPath, tsxContent);
console.log('Replacements completed successfully.');
