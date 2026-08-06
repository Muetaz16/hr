const fs = require('fs');
const path = require('path');

const enJsonPath = path.join(__dirname, '..', 'public', 'locales', 'en', 'translation.json');
const arJsonPath = path.join(__dirname, '..', 'public', 'locales', 'ar', 'translation.json');
const tsxPath = path.join(__dirname, '..', 'src', 'pages', 'Organization.tsx');

let enJson = JSON.parse(fs.readFileSync(enJsonPath, 'utf8'));
let arJson = JSON.parse(fs.readFileSync(arJsonPath, 'utf8'));

const translations = {
    // Errors & Loading
    "err_load_org": { en: "Failed to load organization data", ar: "فشل في تحميل بيانات المؤسسة" },
    "loading_org": { en: "Loading Organization...", ar: "جاري تحميل الهيكل التنظيمي..." },
    "err_load_profile": { en: "Unable to load your profile record.", ar: "غير قادر على تحميل سجل ملفك الشخصي." },
    
    // Headings & Labels
    "org_structure": { en: "Organization Structure", ar: "الهيكل التنظيمي" },
    "official_hierarchy": { en: "Official Leadership Hierarchy", ar: "التسلسل الهرمي الرسمي للقيادة" },
    "total_staff": { en: "Total Staff", ar: "إجمالي الموظفين" },
    
    // Roles & Entities
    "top_leadership": { en: "Top Leadership", ar: "القيادة العليا" },
    "chairman_gm": { en: "Chairman & General Manager", ar: "رئيس مجلس الإدارة والمدير العام" },
    "direct_office": { en: "Direct Office", ar: "مكتب مباشر" },
    "directorate": { en: "Directorate", ar: "إدارة عامة" },
    "division": { en: "Division", ar: "تقسيم" },
    "head_of_division": { en: "Head of Division", ar: "رئيس التقسيم" },
    "unassigned_divisions": { en: "Unassigned Divisions", ar: "تقسيمات غير معينة" },
    "units_in_office": { en: "Units in Office", ar: "الوحدات في المكتب" },
    "depts_in_division": { en: "Departments in Division", ar: "الأقسام في التقسيم" },
    "department_label": { en: "Department", ar: "القسم" },
    "head_of_department": { en: "Head of Department", ar: "رئيس القسم" },
    "no_depts_in_div": { en: "No Departments assigned to this division.", ar: "لا توجد أقسام معينة لهذا التقسيم." },
    
    // Profile Modal
    "personnel_profile": { en: "Personnel Profile", ar: "ملف الموظف" },
    "assigned_position": { en: "Assigned Position", ar: "المنصب المعين" },
    "standard_employee": { en: "Standard Employee", ar: "موظف عادي" },
    "dismiss_profile": { en: "Dismiss Profile", ar: "إغلاق الملف" },
    "no_members": { en: "No members.", ar: "لا يوجد أعضاء." }
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
if (!content.includes('const { t } = useTranslation();') && content.includes('const UnitGrid')) {
    // Add to UnitGrid as well
    content = content.replace("const UnitGrid = ({ units, allEmployees, setSelectedEmployee }: any) => {", "const UnitGrid = ({ units, allEmployees, setSelectedEmployee }: any) => {\n    const { t } = useTranslation();");
}
if (!content.includes('const { t } = useTranslation();') && content.includes('const TreeNode')) {
    // Add to TreeNode as well? No, TreeNode doesn't need it if we pass translated strings, but let's check.
    // Actually, TreeNode only receives props, so it doesn't need t().
}

const replacements = [
    ["'Failed to load organization data'", "t('err_load_org')"],
    [">Loading Organization...<", ">{t('loading_org')}<"],
    [">Unable to load your profile record.<", ">{t('err_load_profile')}<"],
    
    [">Organization Structure<", ">{t('org_structure')}<"],
    [">Official Leadership Hierarchy<", ">{t('official_hierarchy')}<"],
    [">Total Staff<", ">{t('total_staff')}<"],
    
    [">Top Leadership<", ">{t('top_leadership')}<"],
    [">Chairman & General Manager<", ">{t('chairman_gm')}<"],
    ['subtitle="Direct Office"', 'subtitle={t("direct_office")}'],
    ['subtitle="Directorate"', 'subtitle={t("directorate")}'],
    ['subtitle="Division"', 'subtitle={t("division")}'],
    [">Head of Division<", ">{t('head_of_division')}<"],
    [">Unassigned Divisions<", ">{t('unassigned_divisions')}<"],
    [">Units in Office<", ">{t('units_in_office')}<"],
    [">Departments in Division<", ">{t('depts_in_division')}<"],
    [">Department<", ">{t('department_label')}<"], // Might need to be careful if it matches other things
    [">Head of Department<", ">{t('head_of_department')}<"],
    [">No Departments assigned to this division.<", ">{t('no_depts_in_div')}<"],
    
    ['title="Personnel Profile"', 'title={t("personnel_profile")}'],
    [">Assigned Position<", ">{t('assigned_position')}<"],
    ["'Standard Employee'", "t('standard_employee')"],
    [">Dismiss Profile<", ">{t('dismiss_profile')}<"],
    [">No members.<", ">{t('no_members')}<"]
];

for (const [search, replace] of replacements) {
    content = content.split(search).join(replace);
}

fs.writeFileSync(tsxPath, content);
console.log('Done translating Organization.tsx');
