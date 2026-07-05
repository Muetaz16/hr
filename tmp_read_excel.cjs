const XLSX = require('xlsx');
const fs = require('fs');
const filePath = "C:\\Users\\Muetaz layyas\\Desktop\\Copy of 1. Employee Lifecycle (2).xlsx";
const outputPath = "c:\\Users\\Muetaz layyas\\Desktop\\iph_hr-system\\tmp_excel_content.txt";

try {
    const workbook = XLSX.readFile(filePath);
    let output = `All Sheets: ${workbook.SheetNames.join(', ')}\n`;
    
    workbook.SheetNames.forEach(name => {
        output += `\n================================================================\n`;
        output += `SHEET: ${name}\n`;
        output += `================================================================\n`;
        const sheet = workbook.Sheets[name];
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        
        if (rows.length > 0) {
            rows.slice(0, 100).forEach((row, rowIndex) => {
                if (!row || row.length === 0) return;
                const formattedRow = row.map(cell => {
                    const val = String(cell || '').trim();
                    return val.replace(/\n/g, ' ');
                }).join(' | ');
                output += `${String(rowIndex).padStart(2, ' ')}: ${formattedRow}\n`;
            });
        } else {
            output += 'Empty sheet\n';
        }
    });
    
    fs.writeFileSync(outputPath, output);
    console.log('Successfully wrote content to', outputPath);
} catch (e) {
    console.error('CRITICAL ERROR:', e.message);
}
