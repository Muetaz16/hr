// Backwards-compatible shim. The authoritative access catalog now lives in
// ./accessCatalog.ts (positions, functional hats, individual grants + the
// effective-permission merge). These re-exports keep older imports working.
//
// `presetForRole` now returns the POSITION defaults for the given org role.
// Functional duties (HR Manager, Head of Payroll, …) are granted via hats,
// not via the role string.

import { ALL_PERMISSION_IDS, POSITION_DEFAULTS, positionDefaults } from './accessCatalog';

export { ALL_PERMISSION_IDS };
export const ROLE_PRESETS = POSITION_DEFAULTS;
export const presetForRole = positionDefaults;
