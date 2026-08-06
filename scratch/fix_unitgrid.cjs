const fs = require('fs');
const path = require('path');
const tsxPath = path.join(__dirname, '..', 'src', 'pages', 'Organization.tsx');

let content = fs.readFileSync(tsxPath, 'utf8');

content = content.replace("const UnitGrid = ({ units, allEmployees, setSelectedEmployee }: any) => {\r\n    return (", "const UnitGrid = ({ units, allEmployees, setSelectedEmployee }: any) => {\n    const { t } = useTranslation();\n    return (");
content = content.replace("const UnitGrid = ({ units, allEmployees, setSelectedEmployee }: any) => {\n    return (", "const UnitGrid = ({ units, allEmployees, setSelectedEmployee }: any) => {\n    const { t } = useTranslation();\n    return (");

fs.writeFileSync(tsxPath, content);
console.log('Fixed UnitGrid');
