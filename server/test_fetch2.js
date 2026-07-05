const jwt = require('jsonwebtoken');
const axios = require('axios');

async function test() {
    // We need the JWT_SECRET from .env
    require('dotenv').config();
    const token = jwt.sign({ id: '37310d31-50ad-4610-9d59-b08626c8573b', role: 'SUPER_ADMIN' }, process.env.JWT_SECRET || 'fallback_secret');
    
    try {
        const res = await axios.get('http://localhost:5001/api/employees', {
            headers: { Authorization: `Bearer ${token}` }
        });
        console.log("Employees length:", res.data.length);
    } catch(e) {
        console.error("FAILED!", e.response ? e.response.status + " " + JSON.stringify(e.response.data) : e.message);
    }
}
test();
