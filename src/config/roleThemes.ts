// Premium role-based theme configuration with HSL for better harmony
export const roleThemes = {
    SUPER_ADMIN: {
        primary: '#541c2c', // Deep Burgundy (Main)
        secondary: '#aa7a51', // Accent Gold (Sub)
        light: '#fdfcf7',
        dark: '#300a15',
        gradient: 'from-[#541c2c] to-[#aa7a51]',
        text: 'Super Admin',
        badge: 'bg-[#541c2c]/10 text-[#541c2c]'
    },
    HR_MANAGER: {
        primary: '#541c2c',
        secondary: '#d4aa80',
        light: '#fdfcf7',
        dark: '#300a15',
        gradient: 'from-[#541c2c] to-[#d4aa80]',
        text: 'HR Manager',
        badge: 'bg-[#d4aa80]/15 text-[#aa7a51]'
    },
    HEAD_DIRECTOR: {
        primary: '#421220',
        secondary: '#aa7a51',
        light: '#fdfcf7',
        dark: '#300a15',
        gradient: 'from-[#421220] to-[#aa7a51]',
        text: 'Directorate Head',
        badge: 'bg-[#aa7a51]/15 text-[#aa7a51]'
    },
    HEAD_UNIT: {
        primary: '#aa7a51',
        secondary: '#e3c4a2',
        light: '#fdfcf7',
        dark: '#300a15',
        gradient: 'from-[#aa7a51] to-[#e3c4a2]',
        text: 'Head Unit',
        badge: 'bg-[#e3c4a2]/30 text-[#aa7a51]'
    },
    HEAD_DEPARTMENT: {
        primary: '#541c2c',
        secondary: '#e3c4a2',
        light: '#fdfcf7',
        dark: '#300a15',
        gradient: 'from-[#541c2c] to-[#e3c4a2]',
        text: 'Head Department',
        badge: 'bg-[#e3c4a2]/30 text-[#aa7a51]'
    },
    EMPLOYEE: {
        primary: '#541c2c',
        secondary: '#aa7a51',
        light: '#fdfcf7',
        dark: '#300a15',
        gradient: 'from-[#541c2c] to-[#aa7a51]',
        text: 'Employee',
        badge: 'bg-[#541c2c]/10 text-[#541c2c]'
    },
    PERSONNEL: {
        primary: '#300a15',
        secondary: '#aa7a51',
        light: '#fdfcf7',
        dark: '#300a15',
        gradient: 'from-[#300a15] to-[#aa7a51]',
        text: 'Personnel',
        badge: 'bg-[#aa7a51]/15 text-[#aa7a51]'
    },
    CHAIRMAN: {
        primary: '#300a15',
        secondary: '#aa7a51',
        light: '#fdfcf7',
        dark: '#300a15',
        gradient: 'from-[#300a15] to-[#aa7a51]',
        text: 'Chairman',
        badge: 'bg-[#aa7a51]/15 text-[#aa7a51]'
    },
    GENERAL_MANAGER: {
        primary: '#421220',
        secondary: '#aa7a51',
        light: '#fdfcf7',
        dark: '#300a15',
        gradient: 'from-[#421220] to-[#aa7a51]',
        text: 'General Manager',
        badge: 'bg-[#aa7a51]/15 text-[#aa7a51]'
    },
    HEAD_DIVISION: {
        primary: '#421220',
        secondary: '#aa7a51',
        light: '#fdfcf7',
        dark: '#300a15',
        gradient: 'from-[#421220] to-[#aa7a51]',
        text: 'Head of Division',
        badge: 'bg-[#aa7a51]/15 text-[#aa7a51]'
    },
    HEAD_OFFICE: {
        primary: '#541c2c',
        secondary: '#e3c4a2',
        light: '#fdfcf7',
        dark: '#300a15',
        gradient: 'from-[#541c2c] to-[#e3c4a2]',
        text: 'Head of Office',
        badge: 'bg-[#e3c4a2]/30 text-[#aa7a51]'
    }
};

// Use the main type from index.ts instead, or keep this if needed locally
export type ThemeUserRole = keyof typeof roleThemes;
