// Premium role-based theme configuration with HSL for better harmony
export const roleThemes = {
    SUPER_ADMIN: {
        primary: 'hsl(262, 83%, 58%)', // Vibrant Purple
        secondary: 'hsl(262, 83%, 70%)',
        light: 'hsl(262, 83%, 96%)',
        dark: 'hsl(262, 83%, 40%)',
        gradient: 'from-[#7c3aed] to-[#4f46e5]',
        text: 'Super Admin',
        badge: 'bg-purple-100 text-purple-700'
    },
    HR_MANAGER: {
        primary: 'hsl(187, 92%, 35%)', // Deep Teal/Cyan
        secondary: 'hsl(187, 92%, 50%)',
        light: 'hsl(187, 92%, 95%)',
        dark: 'hsl(187, 92%, 25%)',
        gradient: 'from-[#0891b2] to-[#0e7490]',
        text: 'HR Manager',
        badge: 'bg-cyan-100 text-cyan-700'
    },
    HEAD_DIRECTOR: {
        primary: 'hsl(0, 72%, 51%)', // Elegant Red
        secondary: 'hsl(0, 72%, 65%)',
        light: 'hsl(0, 72%, 96%)',
        dark: 'hsl(0, 72%, 35%)',
        gradient: 'from-[#dc2626] to-[#991b1b]',
        text: 'Head Director',
        badge: 'bg-red-100 text-red-700'
    },
    HEAD_UNIT: {
        primary: 'hsl(32, 98%, 51%)', // Amber/Orange
        secondary: 'hsl(32, 98%, 65%)',
        light: 'hsl(32, 98%, 95%)',
        dark: 'hsl(32, 98%, 35%)',
        gradient: 'from-[#f59e0b] to-[#b45309]',
        text: 'Head Unit',
        badge: 'bg-amber-100 text-amber-700'
    },
    HEAD_DEPARTMENT: {
        primary: 'hsl(221, 83%, 53%)', // Professional Blue
        secondary: 'hsl(221, 83%, 70%)',
        light: 'hsl(221, 83%, 95%)',
        dark: 'hsl(221, 83%, 35%)',
        gradient: 'from-[#2563eb] to-[#1e40af]',
        text: 'Head Department',
        badge: 'bg-blue-100 text-blue-700'
    },
    EMPLOYEE: {
        primary: 'hsl(142, 69%, 36%)', // Nature Green
        secondary: 'hsl(142, 69%, 55%)',
        light: 'hsl(142, 69%, 95%)',
        dark: 'hsl(142, 69%, 25%)',
        gradient: 'from-[#16a34a] to-[#15803d]',
        text: 'Employee',
        badge: 'bg-green-100 text-green-700'
    },
    PERSONNEL: {
        primary: 'hsl(0, 0%, 45%)', // Professional Grey/Silver
        secondary: 'hsl(0, 0%, 60%)',
        light: 'hsl(0, 0%, 96%)',
        dark: 'hsl(0, 0%, 30%)',
        gradient: 'from-[#64748b] to-[#475569]',
        text: 'Personnel',
        badge: 'bg-slate-100 text-slate-700'
    }
};

export type UserRole = keyof typeof roleThemes;
