import nodemailer, { Transporter } from 'nodemailer';

let transporter: Transporter | null = null;

// Lazily builds the SMTP transporter from env vars. Returns null when SMTP
// isn't configured, so callers can fall back to a safe no-op (dev/local envs
// don't need a live mail server to run the rest of the app).
const getTransporter = (): Transporter | null => {
    if (!process.env.SMTP_HOST) return null;
    if (transporter) return transporter;
    transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_SECURE === 'true',
        auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
    });
    return transporter;
};

interface MailInput {
    to: string;
    subject: string;
    text: string;
    html?: string;
}

// Fire-and-forget email send — logs instead of sending when SMTP isn't
// configured, and never throws into the caller's flow.
export const sendMail = async ({ to, subject, text, html }: MailInput): Promise<void> => {
    const t = getTransporter();
    if (!t) {
        console.log('[MAILER] SMTP not configured, skipping email:', { to, subject });
        return;
    }
    try {
        await t.sendMail({
            from: process.env.SMTP_FROM || process.env.SMTP_USER,
            to,
            subject,
            text,
            html,
        });
    } catch (err) {
        console.error('[MAILER] Failed to send email:', err);
    }
};
