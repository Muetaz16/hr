// BioApi ships the paid/annual leave type with a spelling mistake in its own data ("Annuale
// Leave"). We can't change the upstream value, but we can correct known typos for DISPLAY wherever
// a leave type's name is shown to users. The stored id/value is never touched — only the label.
const LEAVE_NAME_FIXES: Record<string, string> = {
    'Annuale Leave': 'Annual Leave',
};

export const formatLeaveTypeName = (name: string | null | undefined): string => {
    if (!name) return '';
    return LEAVE_NAME_FIXES[name.trim()] ?? name;
};
