import { Router } from 'express';
import cors from 'cors';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { rateLimit } from '../middleware/rateLimit';
import { listOpenPositions, getPublicPosition, submitApplication, getOnboarding, submitOnboarding } from '../controllers/publicCareersController';

const router = Router();

// --- CORS: only the careers site may call these public endpoints. ---
// CAREERS_ORIGIN can be a comma-separated list (e.g. prod + preview). If unset,
// all origins are allowed (local development convenience).
const allowedOrigins = (process.env.CAREERS_ORIGIN || '')
    .split(',')
    .map(o => o.trim())
    .filter(Boolean);

const publicCors = cors({
    origin: allowedOrigins.length ? allowedOrigins : true,
    methods: ['GET', 'POST'],
});
router.use(publicCors);

// --- CV upload storage (separate folder from internal uploads). ---
const careersDir = path.join(__dirname, '../../uploads/careers');
if (!fs.existsSync(careersDir)) {
    fs.mkdirSync(careersDir, { recursive: true });
}
const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, careersDir),
    filename: (_req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    },
});
const ALLOWED_MIME = new Set([
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);
const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
    fileFilter: (_req, file, cb) => {
        if (ALLOWED_MIME.has(file.mimetype)) return cb(null, true);
        cb(new Error('Only PDF or Word documents are allowed.'));
    },
});

// Onboarding also accepts images (photo, ID/licence scans) in addition to PDF/Word.
const ALLOWED_DOC_MIME = new Set([...ALLOWED_MIME, 'image/png', 'image/jpeg', 'image/webp']);
const docUpload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        if (ALLOWED_DOC_MIME.has(file.mimetype)) return cb(null, true);
        cb(new Error('Only PDF, Word, or image files are allowed.'));
    },
});

// --- Rate limits ---
const listLimiter = rateLimit({ windowMs: 60 * 1000, max: 60, message: 'Too many requests. Please slow down.' });
const applyLimiter = rateLimit({ windowMs: 10 * 60 * 1000, max: 5, message: 'Too many applications from this network. Please try again later.' });

// --- Public endpoints (no authentication) ---
router.get('/positions', listLimiter, listOpenPositions);
router.get('/positions/:id', listLimiter, getPublicPosition);

// Wrap multer so a rejected file (wrong type / too big) returns a clean 400.
const applyUpload = upload.fields([{ name: 'cv', maxCount: 1 }, { name: 'degree', maxCount: 1 }]);
router.post('/apply', applyLimiter, (req, res, next) => {
    applyUpload(req, res, (err: any) => {
        if (err) return res.status(400).json({ error: err.message || 'Upload failed.' });
        next();
    });
}, submitApplication);

// --- Self-service onboarding ---
const onboardingUpload = docUpload.fields([
    { name: 'cv', maxCount: 1 }, { name: 'degree', maxCount: 1 }, { name: 'birthCert', maxCount: 1 },
    { name: 'passportCopy', maxCount: 1 }, { name: 'bankCheck', maxCount: 1 }, { name: 'photo', maxCount: 1 },
    { name: 'idCard', maxCount: 1 }, { name: 'jobOffer', maxCount: 1 }, { name: 'healthCert', maxCount: 1 },
]);
router.get('/onboarding/:token', listLimiter, getOnboarding);
router.post('/onboarding/:token', applyLimiter, (req, res, next) => {
    onboardingUpload(req, res, (err: any) => {
        if (err) return res.status(400).json({ error: err.message || 'Upload failed.' });
        next();
    });
}, submitOnboarding);

export default router;
