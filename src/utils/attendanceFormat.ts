// Shared formatting helpers for attendance-system durations — used by both the HR-facing
// Attendance page and the employee self-service My Attendance page.

// Every duration the attendance system gives us is raw minutes — `Math.round(mins / 60) + 'h'`
// rounds 390 (6h30m) up to "7h", silently overstating worked/overtime/lateness. Format as h/m
// instead so nothing gets rounded away.
export const formatMinutesAsHM = (mins: number) => {
    const total = Math.round(mins);
    const h = Math.floor(total / 60);
    const m = total % 60;
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
};

// A few fields (e.g. overtime records) come back as "HH:MM:SS" strings instead of raw minutes.
export const formatHmsAsHM = (hms: string) => {
    const [h = '0', m = '0'] = hms.split(':');
    return formatMinutesAsHM((Number(h) || 0) * 60 + (Number(m) || 0));
};

// Some excused-late/early-out reasons come back as a bare "/" placeholder rather than empty —
// treat that the same as "no reason given" instead of showing "Excused Late: /".
export const cleanReason = (reason: string | null) => {
    const trimmed = (reason || '').trim();
    return trimmed && trimmed !== '/' ? trimmed : null;
};
