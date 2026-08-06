const fs = require('fs');
const path = require('path');

const tsxPath = path.join(__dirname, '..', 'src', 'pages', 'StaffHub.tsx');
let tsxContent = fs.readFileSync(tsxPath, 'utf8');

const enJsonPath = path.join(__dirname, '..', 'public', 'locales', 'en', 'translation.json');
const arJsonPath = path.join(__dirname, '..', 'public', 'locales', 'ar', 'translation.json');

let enJson = JSON.parse(fs.readFileSync(enJsonPath, 'utf8'));
let arJson = JSON.parse(fs.readFileSync(arJsonPath, 'utf8'));

const translations = {
  staff_hub: { en: "Staff Hub", ar: "مركز الموظفين" },
  staff_hub_subtitle: { en: "Everything you need in one place.", ar: "كل ما تحتاجه في مكان واحد." },
  approvals: { en: "Approvals", ar: "الموافقات" },
  assign_task: { en: "Assign Task", ar: "تعيين مهمة" },
  post_notice: { en: "Post Notice", ar: "نشر إعلان" },
  new_request: { en: "New Request", ar: "طلب جديد" },
  notice_board: { en: "Notice Board", ar: "لوحة الإعلانات" },
  no_active_announcements: { en: "No active announcements", ar: "لا توجد إعلانات نشطة" },
  my_requests: { en: "My Requests", ar: "طلباتي" },
  manager_note: { en: "Manager:", ar: "المدير:" },
  no_requests_yet: { en: "No requests yet", ar: "لا توجد طلبات بعد" },
  fill_details_below: { en: "Fill in the details below.", ar: "املأ التفاصيل أدناه." },
  request_type: { en: "Request Type", ar: "نوع الطلب" },
  paid_holiday: { en: "Paid Holiday", ar: "إجازة مدفوعة" },
  unpaid_leave: { en: "Unpaid Leave", ar: "إجازة غير مدفوعة" },
  emergency_leave: { en: "Emergency Leave", ar: "إجازة طارئة" },
  late_coming: { en: "Late Coming", ar: "تأخير حضور" },
  early_leaving: { en: "Early Leaving", ar: "انصراف مبكر" },
  few_hours_permission: { en: "Few Hours Permission", ar: "إذن لساعات" },
  end_date_optional: { en: "End Date (Optional)", ar: "تاريخ الانتهاء (اختياري)" },
  start_time: { en: "Pick-up/Start Time", ar: "وقت البدء" },
  end_time: { en: "Return/End Time", ar: "وقت الانتهاء" },
  reason_note: { en: "Reason / Note (Optional)", ar: "السبب / ملاحظة (اختياري)" },
  add_brief_note: { en: "Add a brief note...", ar: "أضف ملاحظة قصيرة..." },
  submit_request: { en: "Submit Request", ar: "تقديم الطلب" },
  assign_new_task: { en: "Assign New Task", ar: "تعيين مهمة جديدة" },
  assign_task_desc: { en: "Assign a task to a team member.", ar: "تعيين مهمة لعضو في الفريق." },
  task_title: { en: "Task Title", ar: "عنوان المهمة" },
  enter_task_title: { en: "Enter task title...", ar: "أدخل عنوان المهمة..." },
  assignee: { en: "Assignee", ar: "المكلف" },
  select_employee: { en: "Select an employee...", ar: "اختر موظفاً..." },
  low: { en: "Low", ar: "منخفض" },
  normal: { en: "Normal", ar: "عادي" },
  high: { en: "High", ar: "مرتفع" },
  confirm_assignment: { en: "Confirm Assignment", ar: "تأكيد التعيين" },
  no_deadline: { en: "No deadline", ar: "لا يوجد موعد نهائي" },
  what_working_on: { en: "What are you working on right now?", ar: "ما الذي تعمل عليه الآن؟" },
  add_more_details: { en: "Add more details if needed...", ar: "أضف المزيد من التفاصيل إذا لزم الأمر..." },
  loading_staff_hub: { en: "Loading Staff Hub...", ar: "جاري تحميل مركز الموظفين..." },
  no_tasks: { en: "No tasks", ar: "لا توجد مهام" },
  enter_task_details: { en: "Enter task details...", ar: "أدخل تفاصيل المهمة..." }
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
  ['>Staff Hub<', '>{t("staff_hub")}<'],
  ['>Everything you need in one place.<', '>{t("staff_hub_subtitle")}<'],
  ['Loading Staff Hub...', '{t("loading_staff_hub")}'],
  ['>Approvals<', '>{t("approvals")}<'],
  ['>Assign Task<', '>{t("assign_task")}<'],
  ['>Post Notice<', '>{t("post_notice")}<'],
  ['>New Request<', '>{t("new_request")}<'],
  ['>Notice Board<', '>{t("notice_board")}<'],
  ['>No active announcements<', '>{t("no_active_announcements")}<'],
  ['>My Requests<', '>{t("my_requests")}<'],
  ['>No requests yet<', '>{t("no_requests_yet")}<'],
  ['>Manager: ', '>{t("manager_note")} '],
  ['>New Request<', '>{t("new_request")}<'],
  ['>Fill in the details below.<', '>{t("fill_details_below")}<'],
  ['>Request Type<', '>{t("request_type")}<'],
  ['>Paid Holiday<', '>{t("paid_holiday")}<'],
  ['>Unpaid Leave<', '>{t("unpaid_leave")}<'],
  ['>Emergency Leave<', '>{t("emergency_leave")}<'],
  ['>Late Coming<', '>{t("late_coming")}<'],
  ['>Early Leaving<', '>{t("early_leaving")}<'],
  ['>Few Hours Permission<', '>{t("few_hours_permission")}<'],
  ['>Start Date<', '>{t("start_date")}<'],
  ['>End Date (Optional)<', '>{t("end_date_optional")}<'],
  ['>Pick-up/Start Time<', '>{t("start_time")}<'],
  ['>Return/End Time<', '>{t("end_time")}<'],
  ['>Reason / Note (Optional)<', '>{t("reason_note")}<'],
  ['placeholder="Add a brief note..."', 'placeholder={t("add_brief_note")}'],
  ['>Submit Request<', '>{t("submit_request")}<'],
  ['>Assign New Task<', '>{t("assign_new_task")}<'],
  ['>Assign a task to a team member.<', '>{t("assign_task_desc")}<'],
  ['>Task Title<', '>{t("task_title")}<'],
  ['placeholder="Enter task title..."', 'placeholder={t("enter_task_title")}'],
  ['>Assignee<', '>{t("assignee")}<'],
  ['>Select an employee...<', '>{t("select_employee")}<'],
  ['>Priority<', '>{t("priority")}<'],
  ['>Low<', '>{t("low")}<'],
  ['>Normal<', '>{t("normal")}<'],
  ['>High<', '>{t("high")}<'],
  ['>Critical<', '>{t("critical")}<'],
  ['>Deadline<', '>{t("deadline")}<'],
  ['>Description<', '>{t("description")}<'],
  ['placeholder="Enter task details..."', 'placeholder={t("enter_task_details")}'],
  ['>Confirm Assignment<', '>{t("confirm_assignment")}<'],
  ['No deadline', '{t("no_deadline")}'],
  ['placeholder="What are you working on right now?"', 'placeholder={t("what_working_on")}'],
  ['placeholder="Add more details if needed..."', 'placeholder={t("add_more_details")}'],
  ["{t('no_tasks')}", "{t('no_tasks')}"]
];

for (const [search, replace] of replacements) {
    // using split join for replaceAll functionality
    tsxContent = tsxContent.split(search).join(replace);
}

fs.writeFileSync(tsxPath, tsxContent);
console.log('Replacements completed successfully.');
