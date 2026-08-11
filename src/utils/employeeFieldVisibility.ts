// Which identity/contact/bank/document fields differ between the 3 self-service onboarding
// forms (Resident / Direct Non-Resident / Service Provider) — shared between the enrollment
// review screen (EmployeeForm) and the read-only employee detail view (Personnel Relations
// Lifecycle) so both stay in sync with what each onboarding type actually collects.
export const KNOWN_CONTRACT_TYPES = ['RESDANT', 'DIRCT NONE RESDANT', 'NONE RESDANT'] as const;
export type ResidentContractType = typeof KNOWN_CONTRACT_TYPES[number];

const RESIDENT_ONLY_FIELDS = new Set([
    'gender', 'nationalId', 'idCardNumber', 'idPlaceOfIssue', 'idPlaceOfIssueArabic', 'idIssueDate',
    'drivingLicenseType', 'drivingLicenseTypeArabic', 'drivingLicenseNumber', 'drivingLicenseExpiry',
    'drivingLicensePlaceOfIssue', 'drivingLicensePlaceOfIssueArabic',
    'hasRelativesInCompany', 'relativesNames', 'relativesNamesArabic',
    'bankName', 'bankNameArabic', 'bankBranchName', 'bankBranchNameArabic', 'bankAccountNumber',
    'healthCertUrl', 'bankCheckUrl', 'idCardUrl',
]);
const RESIDENT_AND_DIRECT_FIELDS = new Set([
    'fullNameArabic', 'placeOfBirthArabic', 'nationalityArabic', 'academicQualificationArabic',
    'passportPlaceOfIssue', 'passportPlaceOfIssueArabic', 'residentialAddressArabic', 'birthCertUrl',
]);
const DIRECT_AND_SERVICE_FIELDS = new Set(['ticketUrl', 'residencyDocumentUrl']);
const SERVICE_ONLY_FIELDS = new Set(['interviewEvaluationUrl', 'serviceProviderCompany', 'employeeTravelDate']);

/**
 * Returns a `showField(key)` predicate for the given contract/residency type.
 * - Unknown/missing type → always show everything (safe default for legacy records or
 *   global-scope roles with no residency concept, e.g. General Manager).
 * - `gate = false` disables filtering entirely (e.g. manual admin creation with no onboarding type).
 */
export function makeFieldVisibility(contractType: string | null | undefined, gate: boolean = true) {
    const type = gate && (KNOWN_CONTRACT_TYPES as readonly string[]).includes(contractType || '')
        ? (contractType as ResidentContractType)
        : null;

    return (key: string): boolean => {
        if (!type) return true;
        if (RESIDENT_ONLY_FIELDS.has(key)) return type === 'RESDANT';
        if (RESIDENT_AND_DIRECT_FIELDS.has(key)) return type === 'RESDANT' || type === 'DIRCT NONE RESDANT';
        if (DIRECT_AND_SERVICE_FIELDS.has(key)) return type === 'DIRCT NONE RESDANT' || type === 'NONE RESDANT';
        if (SERVICE_ONLY_FIELDS.has(key)) return type === 'NONE RESDANT';
        return true; // not a type-varying field — always shown
    };
}
