const fs = require('fs');
const path = require('path');

const enJsonPath = path.join(__dirname, '..', 'public', 'locales', 'en', 'translation.json');
const arJsonPath = path.join(__dirname, '..', 'public', 'locales', 'ar', 'translation.json');

let enJson = JSON.parse(fs.readFileSync(enJsonPath, 'utf8'));
let arJson = JSON.parse(fs.readFileSync(arJsonPath, 'utf8'));

const statuses = {
  pending: { en: "Pending", ar: "قيد الانتظار" },
  in_progress: { en: "In Progress", ar: "قيد التنفيذ" },
  completed: { en: "Completed", ar: "مكتمل" },
  rejected: { en: "Rejected", ar: "مرفوض" },
  approved_by_manager: { en: "Approved by Manager", ar: "تمت الموافقة من المدير" },
  hours_leave: { en: "Few Hours Permission", ar: "إذن لساعات" }
};

for (const [key, value] of Object.entries(statuses)) {
  if (!enJson[key]) enJson[key] = value.en;
  if (!arJson[key]) arJson[key] = value.ar;
}

fs.writeFileSync(enJsonPath, JSON.stringify(enJson, null, 4));
fs.writeFileSync(arJsonPath, JSON.stringify(arJson, null, 4));
console.log('Done adding statuses');
