// BioApi's own leave-type ids, captured live via `curl http://localhost:5119/api/attendance/leave-types`
// on 2026-08-11: [{"id":3,"name":"Unpaid Leave"},{"id":2,"name":"Annuale Leave"},{"id":1,"name":"Emergency Leave"}]
// ("Annuale Leave" is a typo on BioApi's own side for the paid/annual leave type — not ours to fix).
// If these are ever renamed/renumbered (e.g. via our Attendance Settings "Leave Types" tab, or
// directly on BioApi), this mapping needs a matching manual update.
export const LEAVE_TYPE_ID_MAP: Record<string, number> = {
    PAID_HOLIDAY: 2,
    UNPAID_LEAVE: 3,
    EMERGENCY_LEAVE: 1,
};
