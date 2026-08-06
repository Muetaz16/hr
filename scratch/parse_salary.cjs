const fs = require('fs');

const raw = fs.readFileSync('scratch/pdf_output.txt', 'utf8');
const lines = raw.split('\n');

const results = [];
let currentCategory = '';

// We know the order of structures from the PDF footer:
// SS-01-LYD, SS-02-USD, SS-03-USD, SS-04-EUR, SS-05-EUR
const structures = ['SS-01-LYD', 'SS-02-USD', 'SS-03-USD', 'SS-04-EUR', 'SS-05-EUR'];

lines.forEach(line => {
    line = line.trim();
    // Match line that ends with numbers
    const match = line.match(/^([A-Za-z\s]+)((\d+,\d\d{3,5}){5})$/); // wait, the hourly rate has 1 decimal digit, so \d+,\d then \d{3,5}
    const betterMatch = line.match(/^([a-zA-Z\s]+?)\s*(\d+,\d\d+.*)$/);
    if (betterMatch) {
        let namePart = betterMatch[1].trim();
        let numbersPart = betterMatch[2].trim();

        // Try to separate namePart into grade and category if possible
        // Categories: Engineer, Financial Officer, Operation Officer, Administrative Officer, Supervisor, Technician, Support Officer
        const categories = ['Engineer', 'Financial Officer', 'Operation Officer', 'Administrative Officer', 'Supervisor', 'Technician', 'Support Officer'];
        let category = '';
        let grade = '';

        for (const cat of categories) {
            if (namePart.endsWith(cat)) {
                category = cat;
                grade = namePart.substring(0, namePart.length - cat.length).trim();
                break;
            }
        }

        if (!category) return;

        // parse numbers: find all instances of (\d+,\d) which represent the hourly rates
        const numRegex = /(\d+,\d)/g;
        let matches = [...numbersPart.matchAll(numRegex)];

        if (matches.length === 5) {
            matches.forEach((m, i) => {
                const hourly = parseFloat(m[1].replace(',', '.'));
                const monthly = Math.round(hourly * 208); // monthly is exactly hourly * 208
                results.push({
                    category,
                    grade,
                    structure: structures[i],
                    hourlyRate: hourly,
                    monthlyRate: monthly
                });
            });
        }
    }
});

fs.writeFileSync('scratch/salary_data.json', JSON.stringify(results, null, 2));
console.log('Saved to scratch/salary_data.json. Total entries:', results.length);
