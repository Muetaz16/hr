/* ==========================================================================
   CONFIG — edit these for production deployment.
   ========================================================================== */
const CFG = {
    // Relative path works when the site is served from the backend (e.g. http://localhost:5001/careers/).
    // For a separate careers subdomain, set the full URL, e.g. 'https://api.iph-ly.com/api/public'.
    API_BASE: '/api/public',
    TURNSTILE_SITE_KEY: '', // set to enable captcha (pair with TURNSTILE_SECRET on the server)
    COMPANY: 'IPH',
};

// Option lists (edit freely). The Position list is NOT here — it is loaded live
// from the open roles in the HR system.
const SOURCES = [
    'Service Provider - Montenegro Warmth',
    'Service Provider - Pure Pharma',
    'Service Provider - Art Ocbija',
    'Libyan Jobs',
    'LinkedIn',
    'Recommendation',
    'Other',
];
const NATIONALITIES = [
    'Libyan', 'Sudanese', 'Palestinian', 'Egyptian', 'Algerian',
    'Tunisian', 'Syrian', 'Filipino', 'Serbian', 'Bosnian', 'Other',
];
const EDUCATION_LEVELS = [
    'Primary School', 'Middle School', 'High School', 'Diploma',
    "Bachelor's Degree", "Master's Degree", 'PhD',
];
const EXPERIENCE = [
    '0 - 6 Months', '7 - 12 Months', '1 - 4 Years', '5 - 9 Years',
    '10 - 14 Years', '15 - 19 Years', '20+ Years',
];

const root = document.getElementById('root');

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

// ---- boot chrome ----
document.getElementById('year').textContent = new Date().getFullYear();
document.querySelectorAll('.footer-company').forEach((el) => (el.textContent = CFG.COMPANY));
if (CFG.TURNSTILE_SITE_KEY) {
    const s = document.createElement('script');
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
    s.async = true; s.defer = true;
    document.head.appendChild(s);
}

async function api(path, opts) {
    const res = await fetch(CFG.API_BASE + path, opts);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Request failed. Please try again.');
    return data;
}

const spinner = '<div class="spinner"></div>';

function stateCard(icon, title, msg) {
    return `<div class="card"><div class="state">
        <div class="state-icon">${icon}</div>
        <div class="state-title">${esc(title)}</div>
        <div class="state-msg">${esc(msg)}</div>
    </div></div>`;
}

function textField(name, label, type, required, placeholder, full) {
    return `<div class="field${full ? ' full' : ''}">
        <label class="label">${esc(label)}${required ? ' *' : ''}</label>
        <input class="input" name="${name}" type="${type}" ${required ? 'required' : ''} placeholder="${esc(placeholder || '')}" />
    </div>`;
}

function selectField(name, label, options, required, full) {
    const opts = ['<option value="">— Select —</option>']
        .concat(options.map((o) => `<option value="${esc(o)}">${esc(o)}</option>`))
        .join('');
    return `<div class="field${full ? ' full' : ''}">
        <label class="label">${esc(label)}${required ? ' *' : ''}</label>
        <select class="select" name="${name}" ${required ? 'required' : ''}>${opts}</select>
    </div>`;
}

// ---- Application form ----
async function renderForm() {
    root.innerHTML = spinner;

    let positions;
    try {
        positions = await api('/positions');
    } catch (e) {
        root.innerHTML = stateCard('⚠️', 'Could not load positions', e.message);
        return;
    }

    if (!positions.length) {
        root.innerHTML = stateCard('🔍', 'No open positions right now', 'Please check back soon — new roles are posted here as they open.');
        return;
    }

    const positionOptions = ['<option value="">— Select a position —</option>']
        .concat(positions.map((p) => {
            const where = [p.department, p.unit].filter(Boolean).join(' · ');
            return `<option value="${esc(p.id)}">${esc(p.title)}${where ? ' — ' + esc(where) : ''}</option>`;
        }))
        .join('');

    const turnstile = CFG.TURNSTILE_SITE_KEY
        ? `<div class="field full"><div class="cf-turnstile" data-sitekey="${esc(CFG.TURNSTILE_SITE_KEY)}"></div></div>`
        : '';

    root.innerHTML = `<div class="card">
        <div class="card-title">Job Application</div>
        <div class="card-sub">Fill in your details and attach your CV. Fields marked * are required.</div>
        <form id="applyForm">
            <div class="form-grid">
                <div class="field full">
                    <label class="label">Position you are applying for *</label>
                    <select class="select" name="positionId" required>${positionOptions}</select>
                </div>

                ${textField('fullName', 'Full name', 'text', true, 'Jane Doe')}
                ${textField('email', 'Email', 'email', true, 'jane@example.com')}
                ${textField('phone', 'Mobile number', 'tel', true, '+218 …')}
                ${selectField('source', 'Application source', SOURCES, true)}
                ${selectField('nationality', 'Nationality', NATIONALITIES, true)}
                ${textField('placeOfLiving', 'Place of residence', 'text', true, 'Tripoli')}
                ${textField('dateOfBirth', 'Birthdate', 'date', true)}
                ${selectField('educationLevel', 'Educational level', EDUCATION_LEVELS, true)}
                ${textField('speciality', 'Degree course', 'text', false, 'e.g. Computer Science')}
                ${selectField('yearsExperience', 'Years of relevant experience', EXPERIENCE, true)}
                ${textField('salaryExpectation', 'Salary expectation', 'text', false, 'e.g. 2500 USD')}

                <div class="field">
                    <label class="label">Submit your updated CV *</label>
                    <input class="file-input" name="cv" type="file" accept=".pdf,.doc,.docx" required />
                    <div class="hint">PDF or Word · max 5 MB</div>
                </div>
                <div class="field">
                    <label class="label">Submit your degree certificate</label>
                    <input class="file-input" name="degree" type="file" accept=".pdf,.doc,.docx,image/*" />
                    <div class="hint">PDF, Word or image · max 5 MB · optional</div>
                </div>
                ${turnstile}
            </div>
            <div id="formError" class="error" style="display:none"></div>
            <button id="submitBtn" class="btn" type="submit">Submit Application</button>
        </form>
    </div>`;

    document.getElementById('applyForm').addEventListener('submit', submitApplication);
}

async function submitApplication(e) {
    e.preventDefault();
    const form = e.target;
    const btn = document.getElementById('submitBtn');
    const errBox = document.getElementById('formError');
    errBox.style.display = 'none';

    const fd = new FormData(form);

    if (CFG.TURNSTILE_SITE_KEY) {
        const el = form.querySelector('[name="cf-turnstile-response"]');
        const token = el && el.value;
        if (!token) { showErr(errBox, 'Please complete the verification.'); return; }
        fd.append('captchaToken', token);
    }

    const positionTitle = form.querySelector('[name="positionId"]').selectedOptions[0].textContent;

    btn.disabled = true;
    btn.textContent = 'Submitting…';
    try {
        await api('/apply', { method: 'POST', body: fd });
        renderThanks(positionTitle);
    } catch (err) {
        showErr(errBox, err.message);
        btn.disabled = false;
        btn.textContent = 'Submit Application';
        if (window.turnstile) { try { window.turnstile.reset(); } catch (_) {} }
    }
}

function showErr(box, msg) {
    box.textContent = msg;
    box.style.display = 'block';
}

function renderThanks(positionTitle) {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    const title = positionTitle ? positionTitle.split(' — ')[0] : '';
    root.innerHTML = `<div class="card">
        <div class="state">
            <div class="success-icon">✓</div>
            <div class="state-title">Application received!</div>
            <div class="state-msg">Thank you for applying${title ? ' for <strong>' + esc(title) + '</strong>' : ''}. Our team will review your CV and get back to you if there's a match.</div>
            <button id="again" class="btn" style="max-width:260px;margin:22px auto 0">Submit another application</button>
        </div>
    </div>`;
    document.getElementById('again').addEventListener('click', renderForm);
}

renderForm();
