// Shared header for every screen in the Payroll section.
//
// Payroll is not one screen, it is a set of procedures: the monthly run, and the registers that
// feed it. Without a visible tab strip each page looks like the whole section, which is exactly
// how the first version read. Every page renders this so you always know where you are and what
// else is here.
import React from 'react';
import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CalendarRange, HandCoins, Receipt, Table2, Award, Building2 } from 'lucide-react';

const TABS = [
    { to: '/payroll/runs', icon: CalendarRange, key: 'payroll_tab_runs', fallback: 'Monthly Runs' },
    { to: '/payroll/advances', icon: HandCoins, key: 'payroll_tab_advances', fallback: 'Advances' },
    // A separate procedure with an outside counterparty, so a separate screen — not a section
    // of the advances register.
    { to: '/payroll/provider-advances', icon: Building2, key: 'payroll_tab_provider_advances', fallback: 'Provider Advances' },
    { to: '/payroll/deductions', icon: Receipt, key: 'payroll_tab_deductions', fallback: 'Deductions' },
    { to: '/payroll/rewards', icon: Award, key: 'payroll_tab_rewards', fallback: 'Bonuses Due' },
    { to: '/payroll/structures', icon: Table2, key: 'payroll_tab_structures', fallback: 'Salary Structures' },
];

interface Props {
    /** One line saying what THIS screen is for — the section header alone is not enough. */
    subtitle?: string;
    actions?: React.ReactNode;
}

const PayrollTabs: React.FC<Props> = ({ subtitle, actions }) => {
    const { t } = useTranslation();

    return (
        <div className="mb-6">
            <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">{t('nav_payroll_section', { defaultValue: 'Payroll' })}</h1>
                    {subtitle && <p className="text-sm text-slate-400 mt-1 max-w-3xl">{subtitle}</p>}
                </div>
                {actions && <div className="shrink-0 flex items-center gap-2">{actions}</div>}
            </div>

            <nav className="flex flex-wrap gap-1 border-b border-slate-200">
                {TABS.map(tab => (
                    <NavLink
                        key={tab.to}
                        to={tab.to}
                        className={({ isActive }) =>
                            `flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-t-lg border-b-2 -mb-px transition-colors ${
                                isActive
                                    ? 'border-blue-600 text-blue-700 bg-blue-50/60'
                                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                            }`
                        }
                    >
                        <tab.icon size={16} />
                        {t(tab.key, { defaultValue: tab.fallback })}
                    </NavLink>
                ))}
            </nav>
        </div>
    );
};

export default PayrollTabs;
