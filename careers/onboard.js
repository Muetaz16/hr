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
// A free-text field split into two separate inputs — one for the English/Latin value,
// one for the Arabic value — instead of asking for both in a single "A / ب" field.
// The Arabic side is always optional since not every hire (e.g. foreign, non-Arabic-speaking
// candidates on the Non-Resident form) has an Arabic value to give.
function bilingual(name, labelEn, labelAr, opts = {}) {
    return input(name, labelEn, 'text', { required: opts.required, full: opts.full, ph: opts.phEn }) +
        input(name + 'Arabic', labelAr, 'text', { full: opts.full, rtl: true, ph: opts.phAr });
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
    const status = info.residentStatus || 'RESDANT'; // default to RESDANT if not set
    // NONE RESDANT (no "direct") = hired via a service-provider company → Service Provider form.
    // DIRCT NONE RESDANT = hired directly by IPH, just not resident → plain Non-Resident form.
    const isServiceProv = status === 'NONE RESDANT';
    const isNonRes = status === 'DIRCT NONE RESDANT';
    const isRes = status === 'RESDANT';

    let intro = info.positionTitle
        ? `<div class="card" style="margin-bottom:18px"><div class="card-sub" style="margin:0">You're onboarding for <strong>${esc(info.positionTitle)}</strong>. (${esc(status)})<br/>${info.status === 'SUBMITTED' ? ' You have already submitted — you can update your details below.' : ''}</div></div>`
        : '';

    let formHTML = '';

    // ==========================================
    // SERVICE PROVIDER FORM
    // ==========================================
    if (isServiceProv) {
        formHTML += card('Company Information / معلومات الشركة',
            input('serviceProviderCompany', 'Service provider company name / اسم الشركة المزودة للخدمة', 'text', { required: true, full: true }) +
            fileField('interviewEvaluation', 'Attach the Interview evaluation form / إرفاق نموذج تقييم المقابلة', 'interviewEvaluationUrl') +
            fileField('jobOffer', 'Attach the job offer / إرفاق عرض العمل', 'jobOfferUrl')
        );

        formHTML += card('Employee Information / معلومات الموظف',
            input('fullName', 'Full name of the employee / الاسم الكامل للموظف', 'text', { required: true }) +
            input('dateOfBirth', 'Date of birth / تاريخ الميلاد', 'date', { required: true }) +
            input('placeOfBirth', 'Place of birth / مكان الميلاد', 'text') +
            input('nationality', 'Nationality / الجنسية', 'text', { required: true }) +
            input('academicQualification', 'Academic qualification / المؤهل العلمي', 'text', { full: true }) +
            input('passportNumber', 'Passport Number / رقم جواز السفر', 'text') +
            input('passportExpiryDate', 'Expiration passport date / تاريخ انتهاء جواز السفر', 'date') +
            input('personalPhone', 'Personal phone number / رقم الهاتف الشخصي', 'tel', { required: true }) +
            input('personalEmail', 'Email / البريد الإلكتروني', 'email', { required: true }) +
            select('bloodType', 'Blood type / فصيلة الدم', BLOOD_TYPES) +
            input('emergencyContactNumber', 'Emergency contact number / رقم الاتصال في حالة الطوارئ', 'tel') +
            input('residentialAddress', 'Residential Address / عنوان السكن', 'text', { full: true }) +
            select('workedBefore', 'Have the employee ever worked in this company before? / هل عمل الموظف في هذه الشركة من قبل؟', YES_NO)
        );

        formHTML += card('Required Attachments / المرفقات المطلوبة',
            fileField('passportCopy', 'Attach the passport copy / إرفاق نسخة من جواز السفر', 'passportCopyUrl') +
            fileField('ticket', 'Attach the ticket / إرفاق التذكرة', 'ticketUrl') +
            fileField('cv', 'Attach the CV / إرفاق السيرة الذاتية', 'cvUrl') +
            fileField('degree', 'Attach the university degree / إرفاق الشهادة الجامعية', 'degreeUrl') +
            fileField('photo', 'Attach the photo with white background (4mm x 6mm) / إرفاق صورة بخلفية بيضاء (4×6 مم)', 'photoUrl') +
            fileField('residencyDocument', 'Attach Residency document (matching the passport residency address) / إرفاق وثيقة الإقامة (مطابقة لعنوان الإقامة في جواز السفر)', 'residencyDocumentUrl')
        );

        formHTML += card('Employment Details / تفاصيل التوظيف',
            input('employeeTravelDate', 'What date the employee is traveling? / تاريخ سفر الموظف', 'date') +
            input('employeeStartDate', 'When the employee can start work in the company? / متى يمكن للموظف أن يبدأ العمل في الشركة؟', 'date', { required: true })
        );
    }
    // ==========================================
    // NON-RESIDENT FORM
    // ==========================================
    else if (isNonRes) {
        formHTML += card('Personal Information / المعلومات الشخصية',
            bilingual('fullName', 'Full name in English (like passport)', 'الاسم الرباعي', { required: true }) +
            input('dateOfBirth', 'Date of birth / تاريخ الميلاد', 'date', { required: true }) +
            bilingual('placeOfBirth', 'Place of birth', 'مكان الميلاد') +
            bilingual('nationality', 'Nationality', 'الجنسية', { required: true }) +
            bilingual('academicQualification', 'Academic qualification', 'المؤهل العلمي', { full: true })
        );

        formHTML += card('Identification Documents / وثائق إثبات الشخصية',
            input('passportNumber', 'Passport Number / رقم جواز السفر', 'text') +
            bilingual('passportPlaceOfIssue', 'Place of Passport Issue', 'مكان اصدار جواز السفر') +
            input('passportExpiryDate', 'Expiration passport date / تاريخ انتهاء صلاحية جواز السفر', 'date') +
            select('bloodType', 'Blood type / فصيلة الدم', BLOOD_TYPES)
        );

        formHTML += card('Contact Information / معلومات التواصل',
            input('personalPhone', 'Personal phone number / رقم الهاتف الشخصي', 'tel', { required: true }) +
            input('personalEmail', 'Email / البريد الالكتروني', 'email', { required: true }) +
            input('emergencyContactNumber', 'Emergency contact number / جهة الاتصال في حال الطوارىء', 'tel') +
            bilingual('residentialAddress', 'Residential Address', 'عنوان السكن', { full: true })
        );

        formHTML += card('Employment / التوظيف',
            select('workedBefore', 'Have you worked in this company before? / هل عملت في هذه الشركة من قبل؟', YES_NO) +
            input('employeeStartDate', 'When you can start working in the company? (Arrival date) / متى يمكنك البدء في العمل بالشركة؟', 'date')
        );

        formHTML += card('Required Attachments / المرفقات المطلوبة',
            fileField('cv', 'CV / السيرة الذاتية', 'cvUrl') +
            fileField('degree', 'University degree / الشهادة الجامعية', 'degreeUrl') +
            fileField('birthCert', 'Birth Certificate / شهادة الميلاد', 'birthCertUrl') +
            fileField('passportCopy', 'Passport copy / نسخة جواز السفر', 'passportCopyUrl') +
            fileField('photo', 'Photo with white background (4mm x 6mm) / صورة بخلفية بيضاء', 'photoUrl') +
            fileField('ticket', 'Airplane ticket / تذكرة حجز الطيران', 'ticketUrl') +
            fileField('jobOffer', 'Signed job offer / عرض العمل الموقع', 'jobOfferUrl') +
            fileField('residencyDocument', 'Residency document / وثيقة الإقامة', 'residencyDocumentUrl')
        );
    }
    // ==========================================
    // RESIDENT FORM
    // ==========================================
    else {
        formHTML += card('Personal Information / المعلومات الشخصية',
            bilingual('fullName', 'Full name in English (like passport)', 'الاسم الرباعي كما في شهادة الميلاد', { required: true }) +
            select('gender', 'Gender / الجنس', GENDERS, { required: true }) +
            input('dateOfBirth', 'Date of birth / تاريخ الميلاد', 'date', { required: true }) +
            bilingual('placeOfBirth', 'Place of birth', 'مكان الميلاد') +
            input('nationalId', 'National ID / الرقم الوطني', 'text') +
            bilingual('nationality', 'Nationality', 'الجنسية', { required: true }) +
            bilingual('academicQualification', 'Academic qualification', 'المؤهل العلمي', { full: true })
        );

        formHTML += card('Identification Documents / وثائق إثبات الشخصية',
            input('idCardNumber', 'ID Number / رقم البطاقة الشخصية', 'text') +
            bilingual('idPlaceOfIssue', 'Place of issue', 'مكان الاصدار') +
            input('idIssueDate', 'Date of ID issue / تاريخ اصدار البطاقة', 'date') +
            input('passportNumber', 'Passport Number / رقم جواز السفر', 'text') +
            bilingual('passportPlaceOfIssue', 'Place of Passport Issue', 'مكان اصدار جواز السفر') +
            input('passportExpiryDate', 'Expiration passport date / تاريخ انتهاء الجواز', 'date') +
            bilingual('drivingLicenseType', 'Driving license type', 'نوع رخصة القيادة') +
            input('drivingLicenseNumber', 'Driving license number / رقم رخصة القيادة', 'text') +
            input('drivingLicenseExpiry', 'License expiration date / تاريخ انتهاء الرخصة', 'date') +
            bilingual('drivingLicensePlaceOfIssue', 'Place of issuance of the license', 'مكان اصدار الرخصة') +
            select('bloodType', 'Blood type / فصيلة الدم', BLOOD_TYPES)
        );

        formHTML += card('Contact Information / معلومات التواصل',
            input('personalPhone', 'Personal phone number / رقم الهاتف الشخصي', 'tel', { required: true }) +
            input('personalEmail', 'Email / البريد الالكتروني', 'email', { required: true }) +
            input('emergencyContactNumber', 'Emergency contact number / جهة الاتصال في حال الطوارىء', 'tel') +
            bilingual('residentialAddress', 'Residential Address', 'عنوان السكن', { full: true })
        );

        formHTML += card('Employment & Relations / التوظيف والأقارب',
            select('workedBefore', 'Have you worked in this company before? / هل عملت في هذه الشركة من قبل؟', YES_NO) +
            select('hasRelativesInCompany', 'Do you have relatives in the company? / هل لديك أقارب في الشركة؟', YES_NO) +
            bilingual('relativesNames', 'If yes, please mention the names', 'اذا كانت الاجابة نعم، اذكر الأسماء', { full: true })
        );

        formHTML += card('Banking Information / المعلومات البنكية',
            bilingual('bankName', 'Bank name', 'اسم المصرف') +
            bilingual('bankBranchName', 'Bank Branch Name', 'اسم فرع المصرف') +
            input('bankAccountNumber', 'Bank Account Number / رقم الحساب المصرفي', 'text', { full: true })
        );

        formHTML += card('Job Details / تفاصيل الوظيفة',
            input('employeeStartDate', 'When can you start working in the company? / متى يمكنك البدء في العمل بالشركة؟', 'date')
        );

        formHTML += card('Required Attachments / المرفقات المطلوبة',
            fileField('cv', 'CV / السيرة الذاتية', 'cvUrl') +
            fileField('degree', 'University degree / المؤهل العلمي', 'degreeUrl') +
            fileField('birthCert', 'Birth Certificate / شهادة الميلاد', 'birthCertUrl') +
            fileField('healthCert', 'Health Certificate / شهادة صحية', 'healthCertUrl') +
            fileField('passportCopy', 'Passport copy / صورة من جواز السفر', 'passportCopyUrl') +
            fileField('bankCheck', 'Bank canceler check / شيك ملغي من المصرف', 'bankCheckUrl') +
            fileField('photo', 'Photo with white background / صورة بخلفية بيضاء', 'photoUrl') +
            fileField('idCard', 'ID and Driving card / البطاقة الشخصية ورخصة القيادة', 'idCardUrl') +
            fileField('jobOffer', 'Signed job offer / عرض العمل موقع', 'jobOfferUrl')
        );
    }

    root.innerHTML = `${intro}<form id="onboardForm">
        ${formHTML}
        <div class="card">
            <div id="formError" class="error" style="display:none"></div>
            <button id="submitBtn" class="btn" type="submit">Submit My Details / تقديم التفاصيل</button>
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
