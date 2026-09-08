// DOCX -> PDF, via LibreOffice in headless mode.
//
// Why LibreOffice and not a JavaScript library: the payslip is a bilingual 12-table form with a
// letterhead image and a QR code, and its Arabic column needs proper right-to-left shaping. No JS
// PDF library renders that from a .docx — they build PDFs from primitives, which would mean
// redrawing the company's approved template by hand and producing a document that no longer looks
// like the one people signed off. LibreOffice renders the actual file.
//
// Why a PDF at all: a .docx handed to an employee is editable. Anyone can change their own net
// salary in Word and forward it as though payroll issued it.
//
// ---------------------------------------------------------------------------------------------
// The concurrency design here is measured, not assumed. On this template:
//
//   fresh profile per conversion   ~6,000 ms
//   one warmed profile, reused     ~2,000 ms      <- 3x faster
//   two at once on ONE profile      one succeeds, the other exits with NO OUTPUT and no useful error
//   two at once on TWO profiles     both succeed, ~6,800 ms each
//
// So: keep ONE profile and reuse it (for the 3x), and serialise conversions through a queue (because
// sharing a profile concurrently silently loses a document). Serialising is also the right call on
// its own — a process per request would have N copies of LibreOffice competing for the machine.
// ---------------------------------------------------------------------------------------------
import { execFile, execFileSync } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import os from 'os';
import path from 'path';

const execFileAsync = promisify(execFile);

const CONVERT_TIMEOUT_MS = 90_000;

/**
 * A stable profile directory, so it stays warm across server restarts. LibreOffice builds a font
 * cache and configuration on first use; that first run costs ~8s and every later one ~2s.
 */
const PROFILE_DIR = path.join(os.tmpdir(), 'iph-libreoffice-profile');

/** Where soffice usually lives, per platform. SOFFICE_PATH overrides all of it. */
const CANDIDATES: string[] = [
    process.env.SOFFICE_PATH || '',
    'C:\\Program Files\\LibreOffice\\program\\soffice.exe',
    'C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe',
    '/usr/bin/soffice',
    '/usr/bin/libreoffice',
    '/usr/lib/libreoffice/program/soffice',
    '/snap/bin/libreoffice',
    '/Applications/LibreOffice.app/Contents/MacOS/soffice',
].filter(Boolean);

let resolved: string | null = null;

/** The soffice binary, or null when LibreOffice is not installed. Resolved once per process. */
export const findSoffice = (): string | null => {
    if (resolved) return resolved;
    for (const c of CANDIDATES) {
        try { if (fs.existsSync(c)) { resolved = c; return c; } } catch { /* keep looking */ }
    }
    for (const name of ['soffice', 'libreoffice']) {
        try {
            const which = process.platform === 'win32' ? 'where' : 'which';
            const first = String(execFileSync(which, [name], { encoding: 'utf8' })).split(/\r?\n/).find(Boolean);
            if (first && fs.existsSync(first)) { resolved = first; return first; }
        } catch { /* not on PATH */ }
    }
    return null;
};

export const isPdfConversionAvailable = (): boolean => findSoffice() !== null;

export class PdfConversionUnavailable extends Error {
    constructor() {
        super(
            'PDF conversion is not available: LibreOffice was not found on this server. '
            + 'Install it, or point SOFFICE_PATH at the soffice binary.',
        );
        this.name = 'PdfConversionUnavailable';
    }
}

/**
 * One-at-a-time gate. Conversions chain onto this promise, so the shared profile is never used by
 * two soffice processes at once — which is what silently drops a document.
 */
let gate: Promise<unknown> = Promise.resolve();

const serialise = <T>(work: () => Promise<T>): Promise<T> => {
    // The chained promise deliberately swallows the previous failure so one bad conversion cannot
    // wedge the queue for every later caller.
    const next = gate.then(work, work);
    gate = next.catch(() => undefined);
    return next;
};

const convertOnce = async (docx: Buffer, baseName: string): Promise<Buffer> => {
    const soffice = findSoffice();
    if (!soffice) throw new PdfConversionUnavailable();

    await fs.promises.mkdir(PROFILE_DIR, { recursive: true });
    const work = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'iph-pdf-'));
    const safe = baseName.replace(/[^a-zA-Z0-9._-]+/g, '_') || 'document';
    const inFile = path.join(work, `${safe}.docx`);
    const outFile = path.join(work, `${safe}.pdf`);
    // A file:// URL with forward slashes on every platform, including Windows.
    const profileUrl = `file:///${PROFILE_DIR.split(path.sep).join('/')}`;

    try {
        await fs.promises.writeFile(inFile, docx);
        await execFileAsync(soffice, [
            `-env:UserInstallation=${profileUrl}`,
            '--headless',
            '--norestore',
            '--invisible',
            '--nolockcheck',
            '--nodefault',
            '--nologo',
            '--convert-to', 'pdf:writer_pdf_Export',
            '--outdir', work,
            inFile,
        ], { timeout: CONVERT_TIMEOUT_MS, windowsHide: true, maxBuffer: 16 * 1024 * 1024 });

        // soffice exits 0 and prints a success line even when it wrote nothing, so the output file
        // is what is actually checked — not the exit code.
        if (!fs.existsSync(outFile)) {
            throw new Error('LibreOffice produced no PDF. The document may be malformed, or the conversion timed out.');
        }
        const pdf = await fs.promises.readFile(outFile);
        if (pdf.length < 5 || pdf.subarray(0, 4).toString('latin1') !== '%PDF') {
            throw new Error('LibreOffice produced a file that is not a PDF.');
        }
        return pdf;
    } finally {
        await fs.promises.rm(work, { recursive: true, force: true }).catch(() => { /* temp dir */ });
    }
};

/**
 * Converts a .docx buffer to PDF. Calls are queued, so two requests never share the profile.
 *
 * Throws PdfConversionUnavailable when LibreOffice is missing — deliberately, rather than quietly
 * returning the .docx, because the caller asked for a PDF for a reason.
 */
export const docxToPdf = (docx: Buffer, baseName = 'document'): Promise<Buffer> =>
    serialise(() => convertOnce(docx, baseName));
