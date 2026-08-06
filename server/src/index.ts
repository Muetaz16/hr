import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import compression from 'compression';
import { PrismaClient } from '@prisma/client';
import path from 'path';

dotenv.config();

const app = express();
const port = process.env.PORT || 5001;
const prisma = new PrismaClient();
const SERVER_VERSION = "2026-03-17-V3"; // Updated to verify reload

// Cross-Origin Resource Sharing
app.use(helmet({ 
    crossOriginResourcePolicy: false,
    contentSecurityPolicy: process.env.NODE_ENV === 'production' ? undefined : false,
})); // Allow cross-origin static file serving and prevent HTTPS upgrades in dev
app.use(compression());
app.use(cors());
app.use(express.json());

// Serve static uploads
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Convenience: serve the public careers site locally at /careers for testing.
// In production the careers site is deployed separately (its own subdomain).
app.use('/careers', express.static(path.join(__dirname, '../../careers')));

// Global Request Logger
app.use((req, res, next) => {
    console.log(`[REQ][${SERVER_VERSION}] ${req.method} ${req.url}`);
    next();
});

if (!process.env.JWT_SECRET) {
    console.error("!!! CRITICAL ERROR: JWT_SECRET IS MISSING !!!");
}

app.get('/', (req, res) => {
    res.send('IPH HR System API is running');
});

// Routes
import authRoutes from './routes/authRoutes';
import userRoutes from './routes/userRoutes';
import employeeRoutes from './routes/employeeRoutes';
import evaluationRoutes from './routes/evaluationRoutes';
import payrollRoutes from './routes/payrollRoutes';
import timeRoutes from './routes/timeRoutes';
import evaluationPeriodRoutes from './routes/evaluationPeriodRoutes';
import staffHubRoutes from './routes/staffHubRoutes';
import unitRoutes from './routes/unitRoutes';
import operationsRoutes from './routes/operationsRoutes';
import recruitmentRoutes from './routes/recruitmentRoutes';
import salaryStructureRoutes from './routes/salaryStructureRoutes';
import jobDescriptionRoutes from './routes/jobDescriptionRoutes';
import candidateRoutes from './routes/candidateRoutes';
import notificationRoutes from './routes/notificationRoutes';
import publicRoutes from './routes/publicRoutes';

// Health check endpoint (Public)
app.get('/api/health', async (req, res) => {
    try {
        await prisma.$queryRaw`SELECT 1`;
        res.json({ status: 'ok', database: 'connected' });
    } catch (error) {
        res.status(500).json({ status: 'error', database: 'disconnected', error: String(error) });
    }
});

// Public careers portal — no authentication (its own CORS + rate limits).
app.use('/api/public', publicRoutes);

app.use('/api/auth', authRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/evaluations', evaluationRoutes);
app.use('/api/payroll', payrollRoutes);
app.use('/api/time', timeRoutes);
app.use('/api/evaluation-periods', evaluationPeriodRoutes);
app.use('/api/staff-hub', staffHubRoutes);
app.use('/api/units', unitRoutes);
app.use('/api/operations', operationsRoutes);
app.use('/api/recruitment', recruitmentRoutes);
app.use('/api/salary-structures', salaryStructureRoutes);
app.use('/api/job-descriptions', jobDescriptionRoutes);
app.use('/api/candidates', candidateRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api', userRoutes); // For users, departments, and groups

// Global Error Handler (Health & Security)
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error("GLOBAL_ERROR:", err.stack);
    res.status(500).json({
        error: 'Internal Server Error',
        message: err.message,
        details: process.env.NODE_ENV === 'production' ? null : err.stack
    });
});

app.listen(Number(port), '0.0.0.0', () => {
    console.log(`[INIT] IPH HR Server ${SERVER_VERSION} is running on port ${port}`);
});