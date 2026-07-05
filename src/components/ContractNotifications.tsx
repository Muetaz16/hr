import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { employeeService } from '../services/employeeService';
import type { Employee } from '../types';
import { Bell, ChevronRight, AlertTriangle, Calendar } from 'lucide-react';
import { Link } from 'react-router-dom';

const ContractNotifications: React.FC = () => {
    const { t } = useTranslation();
    const [expiringEmployees, setExpiringEmployees] = useState<Employee[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchExpiring = async () => {
            try {
                const data = await employeeService.getExpiringContracts(30); // 30 days
                setExpiringEmployees(data);
            } catch (error) {
                console.error("Failed to fetch expiring contracts:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchExpiring();
    }, []);

    if (loading || expiringEmployees.length === 0) return null;

    return (
        <div className="bg-white rounded-[24px] p-6 shadow-xl shadow-slate-200/50 border border-slate-100 animate-in fade-in slide-in-from-top-4 duration-700">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-500">
                        <Bell size={20} />
                    </div>
                    <div>
                        <h3 className="font-outfit font-bold text-slate-800">{t('contract_notifications')}</h3>
                        <div className="flex gap-2 items-center">
                            <p className="text-xs text-slate-400 font-bold uppercase tracking-tight">{expiringEmployees.length} {t('expiring_soon')}</p>
                            {expiringEmployees.some(e => Math.ceil((new Date(e.contractEndDate!).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)) < 7) && (
                                <span className="flex h-2 w-2 rounded-full bg-red-500 animate-ping shadow-[0_0_8px_rgba(239,68,68,0.8)]"></span>
                            )}
                        </div>
                    </div>
                </div>
                <Link to="/employees" className="p-2 hover:bg-slate-50 rounded-lg transition-colors text-slate-400">
                    <ChevronRight size={18} />
                </Link>
            </div>

            <div className="space-y-3">
                {expiringEmployees.map(emp => {
                    const expiryDate = new Date(emp.contractEndDate!);
                    const daysLeft = Math.ceil((expiryDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                    const isUrgent = daysLeft < 7;

                    return (
                        <Link
                            key={emp.id}
                            to={`/contracts/${emp.id}`}
                            className={`flex items-center justify-between p-4 rounded-2xl border transition-all hover:scale-[1.02] active:scale-95 ${isUrgent ? 'bg-red-50/30 border-red-100 hover:bg-red-50/50' : 'bg-slate-50/50 border-slate-100 hover:bg-slate-50'}`}
                        >
                            <div className="flex items-center gap-4">
                                <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-white shadow-sm ${isUrgent ? 'bg-red-500' : 'bg-slate-900'}`}>
                                    {emp.fullName.charAt(0)}
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-slate-800">{emp.fullName}</p>
                                    <div className="flex items-center gap-2 mt-0.5">
                                        <Calendar size={12} className="text-slate-400" />
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">
                                            {t('expires')}: {emp.contractEndDate}
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex flex-col items-end">
                                <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md ${isUrgent ? 'bg-red-500 text-white' : 'bg-slate-200 text-slate-600'}`}>
                                    {daysLeft} {t('days_remaining')}
                                </span>
                                {isUrgent && <AlertTriangle size={14} className="text-red-500 mt-1" />}
                            </div>
                        </Link>
                    );
                })}
            </div>
        </div>
    );
};

export default ContractNotifications;
