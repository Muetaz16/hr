/* ==========================================================================
   New-hire onboarding form. Loads /api/public/onboarding/:token, lets the hire
   fill their identity + bank + documents, and submits back to the same token.
   ========================================================================== */
const CFG = {
    API_BASE: '/api/public', // set to full URL if hosted on a separate subdomain
    COMPANY: 'IPH',
};

const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const YES_NO = ['Yes', 'No'];
const GENDERS = ['Male', 'Female'];

const root = document.getElementById('root');
const token = new URLSearchParams(location.search).get('token') || '';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

document.getElementById('year').textContent = new Date().getFullYear();
document.querySelectorAll('.footer-company').forEach((el) => (el.textContent = CFG.COMPANY));

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

// value comes from saved data, else the prefill we already have on file.
let VALUES = {};
function val(name) { return VALUES[name] != null ? VALUES[name] : ''; }

function input(name, label, type = 'text', opts = {}) {
    return `<div class="field${opts.full ? ' full' : ''}">
        <label class="label">${esc(label)}${opts.required ? ' *' : ''}</label>
        <input class="input" name="${name}" type="${type}" value="${esc(val(name))}" ${opts.required ? 'required' : ''}
            ${opts.rtl ? 'dir="rtl"' : ''} placeholder="${esc(opts.ph || '')}" />
    </div>`;
}
function select(name, label, options, opts = {}) {
    const cur = val(name);
    const o = ['<option value="">— Select —</option>']
        .concat(options.map((x) => `<option value="${esc(x)}" ${x === cur ? 'selected' : ''}>${esc(x)}</option>`))
        .join('');
    return `<div class="field${opts.full ? ' full' : ''}">
        <label class="label">${esc(label)}${opts.required ? ' *' : ''}</label>
        <select class="select" name="${name}" ${opts.required ? 'required' : ''}>${o}</select>
    </div>`;
}
function fileField(name, label, urlKey) {
    const has = VALUES[urlKey];
    return `<div class="field">
        <label class="label">${esc(label)}</label>
        <input class="file-input" name="${name}" type="file" accept=".pdf,.doc,.docx,image/*" />
        ${has ? '<div class="doc-done">✓ Uploaded — choose a file only to replace it.</div>' : '<div class="hint">PDF, Word or image · max 5 MB</div>'}
    </div>`;
}
function card(title, inner) {
    return `<div class="card"><div class="card-title">${esc(title)}</div><div class="form-grid">${inner}</div></div>`;
}

async function load() {
    if (!token) { root.innerHTML = stateCard('⚠️', 'Invalid link', 'This onboarding link is missing its token.'); return; }
    root.innerHTML = spinner;
    let info;
    try {
        info = await api('/onboarding/' + encodeURIComponent(token));
    } catch (e) {
        root.innerHTML = stateCard('⚠️', 'Link not valid', e.message);
        return;
    }
    if (info.done || info.status === 'ENROLLED') {
        root.innerHTML = stateCard('✓', 'Onboarding complete', 'Your onboarding has already been processed. There is nothing more to do here.');
        return;
    }
    VALUES = Object.assign({}, info.prefill || {}, info.data || {});
    renderForm(info);
}

function renderForm(info) {
    const intro = info.positionTitle
        ? `<div class="card" style="margin-bottom:18px"><div class="card-sub" style="margin:0">You're onboarding for <strong>${esc(info.positionTitle)}</strong>.${info.status === 'SUBMITTED' ? ' You have already submitted — you can update your details below.' : ''}</div></div>`
        : '';

    root.innerHTML = `${intro}<form id="onboardForm">
        ${card('Personal Details',
            input('fullName', 'Full name (as in passport)', 'text', { required: true }) +
            input('fullNameArabic', 'الاسم الرباعي', 'text', { rtl: true }) +
            input('dateOfBirth', 'Date of birth', 'date', { required: true }) +
            input('placeOfBirth', 'Place of birth', 'text') +
            select('gender', 'Gender', GENDERS, { required: true }) +
            select('bloodType', 'Blood type', BLOOD_TYPES) +
            input('nationality', 'Nationality', 'text', { required: true }) +
            input('nationalId', 'National ID', 'text') +
            input('academicQualification', 'Academic qualification', 'text', { full: true })
        )}
        ${card('ID, Passport & Licence',
            input('idCardNumber', 'ID card number', 'text') +
            input('idPlaceOfIssue', 'ID place of issue', 'text') +
            input('idIssueDate', 'ID issue date', 'date') +
            input('passportNumber', 'Passport number', 'text') +
            input('passportPlaceOfIssue', 'Passport place of issue', 'text') +
            input('passportExpiryDate', 'Passport expiry date', 'date') +
            input('drivingLicenseType', 'Driving licence type', 'text') +
            input('drivingLicenseNumber', 'Driving licence number', 'text') +
            input('drivingLicenseExpiry', 'Licence expiry date', 'date') +
            input('drivingLicensePlaceOfIssue', 'Licence place of issue', 'text')
        )}
        ${card('Contact & Address',
            input('personalPhone', 'Personal phone', 'tel', { required: true }) +
            input('personalEmail', 'Personal email', 'email', { required: true }) +
            input('emergencyContactNumber', 'Emergency contact number', 'tel') +
            input('residentialAddress', 'Residential address', 'text', { full: true })
        )}
        ${card('Background',
            select('workedBefore', 'Worked in this company before?', YES_NO) +
            select('hasRelativesInCompany', 'Relatives in the company?', YES_NO) +
            input('relativesNames', "Relatives' names (if any)", 'text', { full: true })
        )}
        ${card('Bank Details',
            input('bankName', 'Bank name', 'text') +
            input('bankBranchName', 'Bank branch name', 'text') +
            input('bankAccountNumber', 'Bank account number (IBAN)', 'text', { full: true })
        )}
        ${card('Documents',
            fileField('cv', 'CV / Resume', 'cvUrl') +
            fileField('degree', 'University degree', 'degreeUrl') +
            fileField('birthCert', 'Birth certificate', 'birthCertUrl') +
            fileField('passportCopy', 'Passport copy', 'passportCopyUrl') +
            fileField('bankCheck', 'Cancelled bank check', 'bankCheckUrl') +
            fileField('photo', 'Photo (white background)', 'photoUrl') +
            fileField('idCard', 'ID & driving card', 'idCardUrl') +
            fileField('jobOffer', 'Signed job offer', 'jobOfferUrl') +
            fileField('healthCert', 'Health certificate', 'healthCertUrl')
        )}
        <div class="card">
            <div id="formError" class="error" style="display:none"></div>
            <button id="submitBtn" class="btn" type="submit">Submit My Details</button>
        </div>
    </form>`;

    document.getElementById('onboardForm').addEventListener('submit', submitForm);
}

async function submitForm(e) {
    e.preventDefault();
    const form = e.target;
    const btn = document.getElementById('submitBtn');
    const errBox = document.getElementById('formError');
    errBox.style.display = 'none';
    btn.disabled = true; btn.textContent = 'Submitting…';
    try {
        await api('/onboarding/' + encodeURIComponent(token), { method: 'POST', body: new FormData(form) });
        window.scrollTo({ top: 0, behavior: 'smooth' });
        root.innerHTML = stateCard('✓', 'Thank you!', 'Your details have been submitted to our HR team. They will be in touch about your first day.');
    } catch (err) {
        errBox.textContent = err.message; errBox.style.display = 'block';
        btn.disabled = false; btn.textContent = 'Submit My Details';
    }
}

load();
