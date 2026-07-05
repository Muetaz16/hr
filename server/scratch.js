const jwt = require('jsonwebtoken');
const token = jwt.sign({ id: 'dummy', role: 'SUPER_ADMIN' }, 'your_jwt_secret_key_here');
fetch('http://localhost:5001/api/employees', { headers: { Authorization: `Bearer ${token}` } })
  .then(r => r.json())
  .then(console.log)
  .catch(console.error);
