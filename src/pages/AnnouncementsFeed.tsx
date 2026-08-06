import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { staffHubService } from '../services/staffHubService';
import type { Announcement } from '../services/staffHubService';
import { employeeService } from '../services/employeeService';
import { useAuth } from '../context/AuthContext';
import { Megaphone, Search, Paperclip, Download, Clock, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { SERVER_URL } from '../services/apiClient';

const AnnouncementsFeed: React.FC = () => {
    const { t } = useTranslation();
    const { currentUser } = useAuth();
    const [announcements, setAnnouncements] = useState<Announcement[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterType, setFilterType] = useState('ALL');

    const managerRoles = ['SUPER_ADMIN', 'HR_MANAGER', 'HEAD_DIRECTOR', 'HEAD_DEPARTMENT', 'HEAD_UNIT'];
    const isManager = managerRoles.includes(currentUser?.role || '');

    useEffect(() => {
        fetchAnnouncements();
    }, [currentUser]);

    const fetchAnnouncements = async () => {
        if (!currentUser) return;
        setLoading(true);
        try {
            const me = await employeeService.getMyEmployeeRecord();
            const deptId = me?.departmentId || 'undefined';
            
            const data = isManager 
                ? await staffHubService.getAllAnnouncements() 
                : await staffHubService.getAnnouncements(currentUser.id, deptId);
            
            setAnnouncements(data);
        } catch (error) {
            console.error("Failed to load announcements:", error);
        } finally {
            setLoading(false);
        }
    };

    const filteredAnnouncements = announcements.filter(ann => {
        const matchesSearch = ann.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                              ann.content.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesFilter = filterType === 'ALL' || ann.targetType === filterType;
        return matchesSearch && matchesFilter;
    });

    if (loading) return <div className="p-8 text-center animate-pulse text-slate-500">{t('loading')}</div>;

    return (
        <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-10 animate-in fade-in duration-700 slide-in-from-bottom-4">
            {/* Header section with premium gradient and glow */}
            <div className="bg-gradient-to-br from-[#300a15] via-[#4a1625] to-[#541c2c] text-white p-8 md:p-14 rounded-[3rem] shadow-[0_20px_50px_rgba(48,10,21,0.3)] relative overflow-hidden border border-[#e3c4a2]/15">
                {/* Decorative glowing orb */}
                <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-gradient-to-br from-[#aa7a51]/30 to-transparent blur-[80px] rounded-full -translate-y-1/2 translate-x-1/4 pointer-events-none" />
                
                <div className="absolute top-1/2 right-0 p-12 opacity-10 rotate-12 -translate-y-1/2 group-hover:rotate-45 transition-transform duration-1000">
                    <Megaphone className="w-48 h-48" />
                </div>
                <div className="relative z-10 max-w-2xl">
                    <h1 className="text-4xl md:text-5xl font-black mb-4 tracking-tight text-[#e3c4a2]">{t('notice_board', { defaultValue: 'Notice Board' })}</h1>
                    <p className="text-lg text-slate-300 font-medium leading-relaxed">
                        {t('notice_board_desc', { defaultValue: 'Stay up to date with the latest news, policies, and internal updates.' })}
                    </p>
                </div>
            </div>

            {/* Controls */}
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between glass-card p-4 rounded-3xl">
                <div className="relative w-full md:w-96 group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-[#aa7a51] transition-colors" />
                    <input 
                        type="text"
                        placeholder={t('search_announcements', { defaultValue: 'Search updates...' })}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-white/60 backdrop-blur-md border border-white/40 rounded-2xl pl-12 pr-4 py-4 text-slate-800 font-bold focus:ring-4 focus:ring-[#aa7a51]/20 shadow-inner transition-all"
                    />
                </div>
                <div className="flex gap-2 w-full md:w-auto overflow-x-auto pb-2 md:pb-0 scrollbar-hide">
                    {[
                        { id: 'ALL', label: t('all', { defaultValue: 'All' }) },
                        { id: 'GLOBAL', label: t('global', { defaultValue: 'Global' }) },
                        { id: 'DEPARTMENT', label: t('department', { defaultValue: 'Department' }) }
                    ].map(f => (
                        <button
                            key={f.id}
                            onClick={() => setFilterType(f.id)}
                            className={`px-6 py-3 rounded-2xl font-bold text-sm whitespace-nowrap transition-all ${
                                filterType === f.id 
                                ? 'bg-gradient-to-r from-[#aa7a51] to-[#d4aa80] text-white shadow-[0_8px_20px_rgba(170,122,81,0.3)] scale-105' 
                                : 'bg-white/60 backdrop-blur-md border border-white/40 text-slate-500 hover:bg-white hover:text-slate-800 hover:scale-105 hover:shadow-md'
                            }`}
                        >
                            {f.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Grid Layout */}
            {filteredAnnouncements.length === 0 ? (
                <div className="text-center py-20 glass-card rounded-[2.5rem] flex flex-col items-center justify-center space-y-4">
                    <AlertCircle className="w-16 h-16 text-slate-300" />
                    <h3 className="text-xl font-bold text-slate-600">{t('no_announcements', { defaultValue: 'No announcements found' })}</h3>
                    <p className="text-slate-400">{t('try_adjusting_search', { defaultValue: 'Try adjusting your search or filters' })}</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {filteredAnnouncements.map(ann => (
                        <div key={ann.id} className="bg-white/40 backdrop-blur-xl p-8 rounded-[2.5rem] flex flex-col hover:bg-white/80 hover:-translate-y-2 hover:shadow-[0_20px_40px_rgba(84,28,44,0.08)] transition-all duration-500 border border-white/80 group relative overflow-hidden">
                            {/* Accent line */}
                            <div className={`absolute top-0 left-0 w-full h-1.5 ${
                                ann.targetType === 'GLOBAL' ? 'bg-[#aa7a51]' :
                                ann.targetType === 'DEPARTMENT' ? 'bg-[#541c2c]' :
                                'bg-[#300a15]'
                            }`} />
                            
                            <div className="flex-1 space-y-4">
                                <div className="flex justify-between items-start gap-4">
                                    <div className={`px-3 py-1 rounded-xl text-[10px] font-black tracking-widest uppercase flex items-center gap-1.5 ${
                                        ann.targetType === 'GLOBAL' ? 'bg-[#aa7a51]/10 text-[#aa7a51]' :
                                        ann.targetType === 'DEPARTMENT' ? 'bg-[#541c2c]/10 text-[#541c2c]' :
                                        'bg-[#300a15]/10 text-[#300a15]'
                                    }`}>
                                        {ann.targetType === 'GLOBAL' ? t('global', { defaultValue: 'Global' }) :
                                         ann.targetType === 'DEPARTMENT' ? t('department', { defaultValue: 'Department' }) :
                                         t('individual', { defaultValue: 'Individual' })}
                                    </div>
                                    <span className="text-xs font-bold text-[#aa7a51] bg-[#e3c4a2]/10 px-3 py-1 rounded-xl flex items-center gap-1.5 border border-[#e3c4a2]/20">
                                        <Clock className="w-3.5 h-3.5" />
                                        {format(new Date(ann.createdAt), 'MMM dd')}
                                    </span>
                                </div>
                                
                                <h3 className="text-2xl font-black text-slate-800 leading-tight group-hover:text-[#541c2c] transition-colors mt-2">
                                    {ann.title}
                                </h3>
                                
                                <p className="text-slate-600 whitespace-pre-wrap leading-relaxed font-medium">
                                    {ann.content}
                                </p>
                            </div>

                            {/* Footer / Attachments */}
                            {ann.attachmentUrl && (
                                <div className="mt-6 pt-4 border-t border-slate-200/50">
                                    <a 
                                        href={`${SERVER_URL}${ann.attachmentUrl}`} 
                                        target="_blank" 
                                        rel="noreferrer" 
                                        className="inline-flex items-center justify-between w-full p-4 bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm hover:shadow-[0_8px_20px_rgba(170,122,81,0.15)] hover:-translate-y-1 transition-all duration-300 group/link border border-slate-200/50"
                                    >
                                        <div className="flex items-center gap-3 overflow-hidden">
                                            <div className="w-10 h-10 rounded-xl bg-[#aa7a51]/10 flex items-center justify-center text-[#aa7a51] group-hover/link:bg-[#aa7a51]/20 transition-colors shrink-0">
                                                <Paperclip className="w-4 h-4" />
                                            </div>
                                            <div className="flex flex-col truncate">
                                                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{t('attachment', { defaultValue: 'Attachment' })}</span>
                                                <span className="text-sm font-bold text-slate-700 truncate">{ann.attachmentName || t('download_file', { defaultValue: 'Download File' })}</span>
                                            </div>
                                        </div>
                                        <Download className="w-4 h-4 text-[#e3c4a2] group-hover/link:text-[#aa7a51] transition-colors shrink-0 ml-2" />
                                    </a>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default AnnouncementsFeed;
