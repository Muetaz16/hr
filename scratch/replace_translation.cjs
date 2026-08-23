const fs = require('fs');
const path = './public/locales/en/translation.json';
let data = fs.readFileSync(path, 'utf8');
data = data.replace(/"paid_holiday":\s*"Paid Holiday"/g, '"paid_holiday": "Paid Leave"');
data = data.replace(/"early_leaving":\s*"Early Leaving"/g, '"early_leaving": "Early Departure"');
fs.writeFileSync(path, data);
console.log('done');
