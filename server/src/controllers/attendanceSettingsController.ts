import { Request, Response } from 'express';
import { proxy, jsonPost, jsonPut } from '../utils/attendanceApiProxy';

// Rarely-changed admin config for the attendance system: work-hour settings, leave types,
// holidays, and multiplier-factor (e.g. Ramadan/overtime) overrides. Lives as a tab inside the
// Attendance & Leave Requests page. Work-Hour Settings and Leave Types are structural config
// referenced elsewhere in the attendance system's own calculations — only editing their values is
// allowed here, not adding or removing entries; Holidays and Multiplier Factors keep full CRUD.

// --- System Settings (key/value: WorkStart, WorkEnd, GracePeriod, OtThreshold, ...) ----------
// There is no dedicated list endpoint for these — GET /api/system-settings returns a full
// snapshot (systemSettings + leaveTypes + employeeLeaves + holidays + outWorks + ...), so the
// frontend only reads the `systemSettings` and `leaveTypes` slices of it.
export const getSystemSettingsSnapshot = (req: Request, res: Response) => proxy(res, '/api/system-settings');

export const updateSystemSetting = (req: Request, res: Response) => {
    const { key, valueString, description, isDuration } = req.body;
    if (!key || valueString === undefined || isDuration === undefined) {
        return res.status(400).json({ error: 'key, valueString and isDuration are required.' });
    }
    return proxy(res, `/api/system-settings/${encodeURIComponent(req.params.id)}`, jsonPut({ key, valueString, description: description ?? null, isDuration }));
};

// --- Leave Types --------------------------------------------------------------------------
// Same story — no dedicated GET, list comes from the snapshot's `leaveTypes` slice.
export const updateLeaveType = (req: Request, res: Response) => {
    const { name, isPaid } = req.body;
    if (!name || isPaid === undefined) {
        return res.status(400).json({ error: 'name and isPaid are required.' });
    }
    return proxy(res, `/api/system-settings/leave-types/${encodeURIComponent(req.params.id)}`, jsonPut({ name, isPaid }));
};

// --- Holidays ------------------------------------------------------------------------------
export const getHolidays = (req: Request, res: Response) => proxy(res, '/api/system-settings/holidays');

export const createHoliday = (req: Request, res: Response) => {
    const { name, startDate, endDate } = req.body;
    if (!name || !startDate || !endDate) {
        return res.status(400).json({ error: 'name, startDate and endDate are required.' });
    }
    return proxy(res, '/api/system-settings/holidays', jsonPost({ name, startDate, endDate }));
};

export const updateHoliday = (req: Request, res: Response) => {
    const { name, startDate, endDate } = req.body;
    if (!name || !startDate || !endDate) {
        return res.status(400).json({ error: 'name, startDate and endDate are required.' });
    }
    return proxy(res, `/api/system-settings/holidays/${encodeURIComponent(req.params.id)}`, jsonPut({ name, startDate, endDate }));
};

export const deleteHoliday = (req: Request, res: Response) =>
    proxy(res, `/api/system-settings/holidays/${encodeURIComponent(req.params.id)}`, { method: 'DELETE' });

// --- Multiplier Factors ---------------------------------------------------------------------
// Ramadan-style or other date-ranged overrides of the standard work-hour settings above. `type`
// is a single-character code whose meaning is defined by the attendance system itself — it isn't
// documented further in their API, so the UI just exposes it as a free-text 1-character field.
export const getMultiplierFactors = (req: Request, res: Response) => proxy(res, '/api/system-settings/multiplier-factors');

const multiplierFactorFields = (body: any) => ({
    name: body.name,
    factorValue: body.factorValue,
    type: body.type,
    dateStart: body.dateStart,
    dateEnd: body.dateEnd,
    workStart: body.workStart ?? null,
    gracePeriod: body.gracePeriod ?? null,
    workEnd: body.workEnd ?? null,
    otThreshold: body.otThreshold ?? null,
});

export const createMultiplierFactor = (req: Request, res: Response) => {
    const { name, factorValue, type, dateStart, dateEnd } = req.body;
    if (!name || !factorValue || !type || !dateStart || !dateEnd) {
        return res.status(400).json({ error: 'name, factorValue, type, dateStart and dateEnd are required.' });
    }
    return proxy(res, '/api/system-settings/multiplier-factors', jsonPost(multiplierFactorFields(req.body)));
};

export const updateMultiplierFactor = (req: Request, res: Response) => {
    const { name, factorValue, type, dateStart, dateEnd } = req.body;
    if (!name || !factorValue || !type || !dateStart || !dateEnd) {
        return res.status(400).json({ error: 'name, factorValue, type, dateStart and dateEnd are required.' });
    }
    return proxy(res, `/api/system-settings/multiplier-factors/${encodeURIComponent(req.params.id)}`, jsonPut(multiplierFactorFields(req.body)));
};

export const deleteMultiplierFactor = (req: Request, res: Response) =>
    proxy(res, `/api/system-settings/multiplier-factors/${encodeURIComponent(req.params.id)}`, { method: 'DELETE' });
