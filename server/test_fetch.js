const axios = require('axios');

async function test() {
    try {
        const res = await axios.post('http://localhost:5001/api/auth/login', {
            email: 'admin@iph.com',
            password: 'admin' // Or whatever default is, maybe I can just fetch the DB directly
        });
        const token = res.data.token;
        const empRes = await axios.get('http://localhost:5001/api/employees', {
            headers: { Authorization: `Bearer ${token}` }
        });
        console.log("SUCCESS, employees count:", empRes.data.length);
    } catch (e) {
        if (e.response) {
            console.error("API ERROR:", e.response.status, e.response.data);
        } else {
            console.error("NET ERROR:", e.message);
        }
    }
}
test();
