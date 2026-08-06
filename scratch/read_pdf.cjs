const fs = require('fs');
const pdf = require('pdf-parse');

const dataBuffer = fs.readFileSync('../public/Salary Structure 2025.pdf');

pdf(dataBuffer).then(function(data) {
    fs.writeFileSync('pdf_output.txt', data.text);
    console.log('PDF text extracted to scratch/pdf_output.txt');
}).catch(function(err) {
    console.error('Error parsing PDF:', err);
});
