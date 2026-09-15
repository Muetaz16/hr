import type { TFunction } from 'i18next';
import type { DayPunchAnomaly } from '../services/attendanceService';

// Why a day is broken, said in the reader's own language.
//
// The server sends FACTS, not a finished sentence. A sentence built server-side arrives in one
// language and lands in a page written in another — which is exactly what happened here first in
// one direction (the attendance service's Arabic overnight note inside an English table) and then
// in the other (this detector's English detail inside the Arabic attendance screen).
//
// The punch STATES are left as the attendance service reports them ("Check In"/"Check Out"): they
// are the literal labels an attendance officer sees on the terminal and in the punch list, and
// translating them would make the screen disagree with the device.
export function punchAnomalyText(anomaly: DayPunchAnomaly, t: TFunction): string {
    const f = anomaly.facts || ({} as DayPunchAnomaly['facts']);
    switch (anomaly.kind) {
        case 'UNPAIRED_PUNCH':
            return t('anomaly_unpaired', {
                defaultValue: 'One punch only — {{at}} "{{state}}". The other half of the day was never recorded.',
                at: f.at, state: f.state,
            });
        case 'SAME_STATE_ONLY':
            return t('anomaly_same_state', {
                defaultValue: '{{count}} punches ({{times}}), every one recorded as "{{state}}" — nothing could pair, so the day counted as zero.',
                count: f.count, times: f.times, state: f.state,
            });
        case 'DOUBLE_TAP':
            return t('anomaly_double_tap', {
                defaultValue: 'Two punches at {{at}}, one in and one out — a double tap that swallowed the real pairing.',
                at: f.at,
            });
        case 'OVERTIME_OUT_UNCLOSED':
            return t('anomaly_ot_out', {
                defaultValue: 'Checked in {{inAt}}, then "{{state}}" at {{at}} — no check-out, so nothing paired.',
                inAt: f.inAt, state: f.state, at: f.at,
            });
        case 'SUSPICIOUSLY_SHORT':
            return t('anomaly_short_day', {
                defaultValue: 'Only {{worked}} minutes credited against a {{scheduled}}-minute day ({{times}}).',
                worked: f.workedMins, scheduled: f.scheduledMins, times: f.times,
            });
        case 'ZERO_WORK_WITH_PUNCHES':
        default:
            return t('anomaly_zero_work', {
                defaultValue: '{{count}} punches ({{times}}) but no working hours were credited.',
                count: f.count, times: f.times,
            });
    }
}
