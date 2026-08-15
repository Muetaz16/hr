const fs = require('fs');
const PizZip = require('pizzip');
const zip = new PizZip(fs.readFileSync('public/Early Departure Request Form.docx'));
const xml = zip.file('word/document.xml').asText();
const cells = xml.match(/<w:tc\b[\s\S]*?<\/w:tc>/g) || [];
console.log(cells.map(c => c.replace(/<[^>]+>/g, '').trim()).filter(t => t.includes('Head') || t.includes('Attendance') || t.includes('Approved')));
