import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { employeeService } from '../services/employeeService';
import { unitService } from '../services/unitService';
import { departmentService, divisionService } from '../services/departmentService';
import { directorateService } from '../services/directorateService';
import {
    Users, Landmark, Building2, Crown, ArrowRight, Briefcase, LayoutGrid, Building
} from 'lucide-react';
import { toast } from 'sonner';
import Modal from '../components/Modal';

const Organization: React.FC = () => {
    const { currentUser } = useAuth();
    const [myRecord, setMyRecord] = useState<any>(null);
    const [allEmployees, setAllEmployees] = useState<any[]>([]);
    const [allUnits, setAllUnits] = useState<any[]>([]);
    const [allDepts, setAllDepts] = useState<any[]>([]);
    const [allDivisions, setAllDivisions] = useState<any[]>([]);
    const [allDirectorates, setAllDirectorates] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const [selectedEntity, setSelectedEntity] = useState<{ id: string, type: 'DIRECTORATE' | 'DIVISION' | 'DEPARTMENT' | 'OFFICE' } | null>(null);
    const [selectedEmployee, setSelectedEmployee] = useState<any | null>(null);

    useEffect(() => {
        if (currentUser) {
            fetchData();
        }
    }, [currentUser]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const me = await employeeService.getMyEmployeeRecord();
            if (me) {
                setMyRecord(me);
                const [emps, units, depts, divs, dirs] = await Promise.all([
                    employeeService.getAllEmployees().catch(() => []),
                    unitService.getAllUnits().catch(() => []),
                    departmentService.getAllDepartments().catch(() => []),
                    divisionService.getAllDivisions().catch(() => []),
                    directorateService.getAllDirectorates().catch(() => [])
                ]);
                setAllEmployees(emps);
                setAllUnits(units);
                setAllDepts(depts);
                setAllDivisions(divs);
                setAllDirectorates(dirs);

                // Default selection
                if (me.departmentId) {
                    const myDept = depts.find((d: any) => d.id === me.departmentId);
                    if (myDept?.isOffice) {
                        setSelectedEntity({ id: myDept.id, type: 'OFFICE' });
                    } else if (myDept?.divisionId) {
                        setSelectedEntity({ id: myDept.divisionId, type: 'DIVISION' });
                    } else {
                        setSelectedEntity({ id: myDept.id, type: 'DEPARTMENT' });
                    }
                }
            }
        } catch (error) {
            toast.error('Failed to load organization data');
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="p-12 text-center animate-pulse text-slate-400 font-medium">Loading Organization...</div>;
    if (!myRecord) return <div className="p-12 text-center text-slate-400">Unable to load your profile record.</div>;

    const offices = allDepts.filter(d => d.isOffice);
    const topLevelDepts = allDepts.filter(d => !d.isOffice && !d.divisionId); // Legacy fallback

    return (
        <div className="max-w-[1400px] mx-auto p-4 md:p-8 space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8 border-b-2 border-[#511d29]/10 pb-6">
                <div>
                    <h1 className="text-4xl font-outfit font-black text-[#511d29] tracking-tight">Organization Structure</h1>
                    <p className="text-[#511d29]/70 font-medium mt-1 uppercase tracking-widest text-xs">Official Leadership Hierarchy</p>
                </div>
                <div className="flex items-center gap-3 px-6 py-3 bg-[#f5ebd9] border border-[#511d29]/30 shadow-sm">
                    <div className="w-10 h-10 bg-[#511d29] flex items-center justify-center">
                        <Users className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-[#511d29]/70 uppercase tracking-widest leading-none mb-1">Total Staff</p>
                        <p className="text-lg font-black text-[#511d29] leading-none">{allEmployees.length}</p>
                    </div>
                </div>
            </div>

            {/* Tree Section */}
            <section className="relative overflow-hidden bg-white py-12 px-4 rounded-xl border-2 border-[#511d29]/10 shadow-sm">
                
                <div className="relative flex flex-col items-center max-w-[1200px] mx-auto">
                    
                    {/* Level 1: GM / Chairman */}
                    <div className="relative z-10 w-full flex justify-center">
                        <button className="w-80 flex flex-row items-stretch border-2 border-[#511d29] shadow-md" style={{ backgroundColor: '#f5ebd9' }}>
                            <div className="w-14 flex items-center justify-center bg-[#511d29] text-white">
                                <Crown className="w-6 h-6" />
                            </div>
                            <div className="flex-1 p-4 text-left">
                                <p className="text-[10px] font-black text-[#511d29]/70 uppercase tracking-widest mb-1">Top Leadership</p>
                                <h4 className="text-md font-black text-[#511d29] tracking-tight leading-tight">Chairman & General Manager</h4>
                            </div>
                        </button>
                    </div>

                    <div className="w-[2px] h-12 bg-[#511d29]"></div>

                    {/* Level 2: Offices (Ribs) */}
                    <div className="flex flex-col items-center relative w-full">
                        <div className="absolute top-0 bottom-0 left-1/2 w-[2px] bg-[#511d29] -translate-x-1/2"></div>
                        {Array.from({ length: Math.ceil(offices.length / 2) }).map((_, i) => {
                            const leftOffice = offices[i * 2];
                            const rightOffice = offices[i * 2 + 1];
                            return (
                                <div key={`office-row-${i}`} className="flex items-center justify-center w-full max-w-[800px] my-3 relative z-10">
                                    <div className="w-[380px] flex justify-end pr-8 relative">
                                        {leftOffice && (
                                            <>
                                                <TreeNode 
                                                    title={leftOffice.name} 
                                                    subtitle="Direct Office" 
                                                    badge={leftOffice.name.substring(0, 2).toUpperCase()} 
                                                    isSelected={selectedEntity?.id === leftOffice.id && selectedEntity?.type === 'OFFICE'}
                                                    onClick={() => setSelectedEntity({ id: leftOffice.id, type: 'OFFICE' })}
                                                />
                                                <div className="absolute right-0 top-1/2 w-8 h-[2px] bg-[#511d29] -translate-y-1/2"></div>
                                            </>
                                        )}
                                    </div>
                                    <div className="w-[40px]"></div> {/* space for trunk */}
                                    <div className="w-[380px] flex justify-start pl-8 relative">
                                        {rightOffice && (
                                            <>
                                                <div className="absolute left-0 top-1/2 w-8 h-[2px] bg-[#511d29] -translate-y-1/2"></div>
                                                <TreeNode 
                                                    title={rightOffice.name} 
                                                    subtitle="Direct Office" 
                                                    badge={rightOffice.name.substring(0, 2).toUpperCase()} 
                                                    isSelected={selectedEntity?.id === rightOffice.id && selectedEntity?.type === 'OFFICE'}
                                                    onClick={() => setSelectedEntity({ id: rightOffice.id, type: 'OFFICE' })}
                                                />
                                            </>
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                    </div>

                    {/* Trunk continues down */}
                    <div className="w-[2px] h-12 bg-[#511d29]"></div>

                    {/* Level 3: Directorates (Horizontal row) */}
                    <div className="w-full pb-8 overflow-x-auto custom-scrollbar">
                        <div className="min-w-max flex justify-center relative pt-4 px-8">
                            {allDirectorates.length > 1 && (
                                <div className="absolute top-0 left-[50%] right-[50%] w-[calc(100%-24rem)] -translate-x-1/2 h-[2px] bg-[#511d29]"></div>
                            )}
                            <div className="flex justify-center gap-12">
                                {allDirectorates.map(dir => {
                                    const isSelected = selectedEntity?.id === dir.id && selectedEntity?.type === 'DIRECTORATE';
                                    const assignedDivisions = allDivisions.filter(d => d.directorateId === dir.id);
                                    
                                    return (
                                        <div key={`dir-${dir.id}`} className="flex flex-col items-center relative min-w-[18rem]">
                                            <div className="absolute top-[-16px] w-[2px] h-[16px] bg-[#511d29]"></div>
                                            <TreeNode 
                                                title={dir.name} 
                                                subtitle="Directorate" 
                                                badge={dir.name.substring(0, 2).toUpperCase()} 
                                                isSelected={isSelected}
                                                onClick={() => setSelectedEntity(isSelected ? null : { id: dir.id, type: 'DIRECTORATE' })}
                                            />

                                            {/* Sub-level: Assigned Divisions */}
                                            {assignedDivisions.length > 0 && (isSelected || assignedDivisions.some(div => selectedEntity?.id === div.id && selectedEntity?.type === 'DIVISION')) && (
                                                <div className="flex flex-col items-center mt-6 relative w-max px-4 animate-in slide-in-from-top-4 fade-in duration-300">
                                                    <div className="absolute top-[-24px] w-[2px] h-[24px] bg-[#511d29]"></div>
                                                    
                                                    {assignedDivisions.length > 1 && (
                                                        <div className="absolute top-0 left-[50%] right-[50%] w-[calc(100%-16rem)] -translate-x-1/2 h-[2px] bg-[#511d29]"></div>
                                                    )}

                                                    <div className="w-full flex justify-center gap-6 pt-4 relative">
                                                        {assignedDivisions.map(div => {
                                                            const isDivSelected = selectedEntity?.id === div.id && selectedEntity?.type === 'DIVISION';
                                                            return (
                                                                <div key={`div-${div.id}`} className="flex flex-col items-center relative">
                                                                    <div className="absolute top-[-16px] w-[2px] h-[16px] bg-[#511d29]"></div>
                                                                    <div className="w-64 flex flex-col gap-2">
                                                                        <TreeNode 
                                                                            title={div.name} 
                                                                            subtitle="Division" 
                                                                            badge={div.name.substring(0, 2).toUpperCase()} 
                                                                            isSelected={isDivSelected}
                                                                            onClick={() => setSelectedEntity(isDivSelected ? null : { id: div.id, type: 'DIVISION' })}
                                                                        />
                                                                        {(() => {
                                                                            const headOfDivision = allEmployees.find(e => e.divisionId === div.id && e.role === 'HEAD_DIVISION');
                                                                            if (headOfDivision) {
                                                                                return (
                                                                                    <button onClick={() => setSelectedEmployee(headOfDivision)} className="w-full flex items-center gap-2 p-2 bg-[#f5ebd9] border border-[#511d29]/30 hover:border-[#511d29] shadow-sm transition-all text-left">
                                                                                        <div className="w-6 h-6 flex items-center justify-center text-[10px] font-black bg-[#511d29] text-white">
                                                                                            {headOfDivision.fullName[0].toUpperCase()}
                                                                                        </div>
                                                                                        <div className="flex-1 min-w-0">
                                                                                            <p className="text-[10px] font-black text-[#511d29]/60 uppercase tracking-widest leading-none mb-0.5">Head of Division</p>
                                                                                            <p className="text-xs font-bold text-[#511d29] truncate">{headOfDivision.fullName}</p>
                                                                                        </div>
                                                                                    </button>
                                                                                );
                                                                            }
                                                                            return null;
                                                                        })()}
                                                                    </div>
                                                                </div>
                                                            )
                                                        })}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                    
                    {/* Floating Unassigned Divisions (Legacy) */}
                    {allDivisions.filter(d => !d.directorateId).length > 0 && (
                        <>
                            <div className="w-[2px] h-12 bg-[#511d29]/30"></div>
                            <div className="text-[10px] font-black text-[#511d29]/50 uppercase tracking-widest mb-4">Unassigned Divisions</div>
                            <div className="flex justify-center gap-4 opacity-70">
                                {allDivisions.filter(d => !d.directorateId).map(div => (
                                    <TreeNode 
                                        key={`udiv-${div.id}`}
                                        title={div.name} 
                                        subtitle="Division" 
                                        badge={div.name.substring(0, 2).toUpperCase()} 
                                        isSelected={selectedEntity?.id === div.id && selectedEntity?.type === 'DIVISION'}
                                        onClick={() => setSelectedEntity(selectedEntity?.id === div.id ? null : { id: div.id, type: 'DIVISION' })}
                                    />
                                ))}
                            </div>
                        </>
                    )}
                    {/* Expanded Departments / Units Section */}
                    {selectedEntity && (
                        <div className="w-full max-w-5xl mx-auto mt-12 p-8 border-2 border-[#511d29]/20 bg-[#f5ebd9]/30 relative z-10 animate-in fade-in zoom-in-95 duration-500">
                            {(() => {
                                // If Office is selected, show Units directly
                                if (selectedEntity.type === 'OFFICE') {
                                    const officeUnits = allUnits.filter(u => u.departmentId === selectedEntity.id);
                                    return (
                                        <div className="space-y-8">
                                            <div className="text-center border-b-2 border-[#511d29]/10 pb-4">
                                                <h3 className="text-2xl font-black text-[#511d29] tracking-tight uppercase">Units in Office</h3>
                                            </div>
                                            <UnitGrid units={officeUnits} allEmployees={allEmployees} setSelectedEmployee={setSelectedEmployee} />
                                        </div>
                                    );
                                }

                                // If Division is selected, show Departments
                                if (selectedEntity.type === 'DIVISION') {
                                    const divDepts = allDepts.filter(d => d.divisionId === selectedEntity.id);
                                    return (
                                        <div className="space-y-8">
                                            <div className="text-center border-b-2 border-[#511d29]/10 pb-4">
                                                <h3 className="text-2xl font-black text-[#511d29] tracking-tight uppercase">Departments in Division</h3>
                                            </div>
                                            
                                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                                {divDepts.map(dept => {
                                                    const deptUnits = allUnits.filter(u => u.departmentId === dept.id);
                                                    return (
                                                        <div key={dept.id} className="bg-white p-6 border-2 border-[#511d29]/20">
                                                            <div className="flex items-center gap-4 mb-6 pb-4 border-b border-[#511d29]/10">
                                                                <div className="w-10 h-10 bg-[#511d29] text-white flex items-center justify-center">
                                                                    <Building2 className="w-5 h-5" />
                                                                </div>
                                                                <div className="flex-1">
                                                                    <p className="text-[10px] font-black uppercase text-[#511d29]/60 tracking-widest">Department</p>
                                                                    <h4 className="text-lg font-bold text-[#511d29]">{dept.name}</h4>
                                                                </div>
                                                                {(() => {
                                                                    const headOfDept = allEmployees.find(e => e.departmentId === dept.id && e.role === 'HEAD_DEPARTMENT');
                                                                    if (headOfDept) {
                                                                        return (
                                                                            <button onClick={() => setSelectedEmployee(headOfDept)} className="flex items-center gap-2 px-3 py-1.5 bg-[#f5ebd9] border border-[#511d29]/30 hover:border-[#511d29] shadow-sm transition-all text-left">
                                                                                <div className="w-5 h-5 flex items-center justify-center text-[8px] font-black bg-[#511d29] text-white">
                                                                                    {headOfDept.fullName[0].toUpperCase()}
                                                                                </div>
                                                                                <div className="min-w-0">
                                                                                    <p className="text-[8px] font-black text-[#511d29]/60 uppercase tracking-widest leading-none mb-0.5">Head of Department</p>
                                                                                    <p className="text-[10px] font-bold text-[#511d29] truncate max-w-[120px]">{headOfDept.fullName}</p>
                                                                                </div>
                                                                            </button>
                                                                        );
                                                                    }
                                                                    return null;
                                                                })()}
                                                            </div>
                                                            <UnitGrid units={deptUnits} allEmployees={allEmployees} setSelectedEmployee={setSelectedEmployee} />
                                                        </div>
                                                    )
                                                })}
                                                {divDepts.length === 0 && <p className="text-center text-[#511d29]/60 col-span-2 py-8 font-bold italic">No Departments assigned to this division.</p>}
                                            </div>
                                        </div>
                                    )
                                }
                                return null;
                            })()}
                        </div>
                    )}
                </div>
            </section>

            {/* Employee Detail Modal */}
            <Modal isOpen={!!selectedEmployee} onClose={() => setSelectedEmployee(null)} title="Personnel Profile" maxWidth="max-w-md">
                {selectedEmployee && (
                    <div className="flex flex-col items-center gap-6 py-4 px-2">
                        <div className="w-24 h-24 bg-[#511d29] flex items-center justify-center text-[#f5ebd9] text-4xl font-black border-4 border-[#f5ebd9] shadow-xl">
                            {selectedEmployee.fullName[0].toUpperCase()}
                        </div>
                        
                        <div className="w-full space-y-6">
                            <div className="text-center space-y-1">
                                <h4 className="text-2xl font-black text-[#511d29] tracking-tight">{selectedEmployee.fullName}</h4>
                            </div>

                            <div className="p-5 bg-[#f5ebd9]/50 border border-[#511d29]/20 flex items-center gap-4">
                                <div className="w-12 h-12 bg-white flex items-center justify-center shadow-sm border border-[#511d29]/10">
                                    <Briefcase className="w-6 h-6 text-[#511d29]" />
                                </div>
                                <div>
                                    <p className="text-[10px] font-black text-[#511d29]/60 uppercase tracking-widest leading-none mb-1">Assigned Position</p>
                                    <p className="text-md font-black text-[#511d29] leading-none">{selectedEmployee.position || 'Standard Employee'}</p>
                                </div>
                            </div>
                        </div>

                        <button onClick={() => setSelectedEmployee(null)} className="mt-4 w-full py-4 bg-[#511d29] text-[#f5ebd9] font-black text-xs uppercase tracking-widest hover:bg-[#3a151d] transition-colors">
                            Dismiss Profile
                        </button>
                    </div>
                )}
            </Modal>
        </div>
    );
};

const TreeNode = ({ title, subtitle, badge, isSelected, onClick }: any) => (
    <button 
        onClick={onClick}
        className={`w-full flex flex-row items-stretch border-2 transition-all text-left group ${isSelected ? 'border-[#511d29] shadow-lg scale-[1.02]' : 'border-[#511d29]/40 hover:border-[#511d29] hover:shadow-md hover:-translate-y-1'}`}
        style={{ backgroundColor: '#f5ebd9' }}
    >
        <div className={`w-12 flex items-center justify-center transition-colors ${isSelected ? 'bg-[#511d29] text-[#f5ebd9]' : 'bg-[#511d29]/90 text-white group-hover:bg-[#511d29]'}`}>
            <span className="font-bold text-sm tracking-tighter">{badge}</span>
        </div>
        <div className="flex-1 p-3">
            <p className="text-[9px] font-black text-[#511d29]/60 uppercase tracking-widest mb-1">{subtitle}</p>
            <h5 className="text-sm font-bold text-[#511d29] leading-tight pr-2">{title}</h5>
        </div>
    </button>
);

const UnitGrid = ({ units, allEmployees, setSelectedEmployee }: any) => {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {units.map((unit: any) => {
                const unitMates = allEmployees.filter((e: any) => e.unitId === unit.id);
                return (
                    <div key={unit.id} className="bg-[#f5ebd9] p-4 border border-[#511d29]/20 relative">
                        <div className="absolute top-0 left-0 w-1 h-full bg-[#511d29]"></div>
                        <h5 className="font-bold text-[#511d29] text-sm mb-3 uppercase tracking-widest pl-2">{unit.name}</h5>
                        <div className="flex flex-col gap-1.5 max-h-[160px] overflow-y-auto pr-2 custom-scrollbar">
                            {unitMates.map((c: any) => (
                                <button key={c.id} onClick={() => setSelectedEmployee(c)} className="w-full flex items-center gap-2 p-1.5 border border-transparent hover:border-[#511d29]/30 bg-white/60 transition-all text-left">
                                    <div className="w-6 h-6 flex items-center justify-center text-[8px] font-black bg-[#511d29] text-white">
                                        {c.fullName[0].toUpperCase()}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[11px] font-bold text-[#511d29] truncate">{c.fullName}</p>
                                    </div>
                                </button>
                            ))}
                            {unitMates.length === 0 && <p className="text-[10px] text-[#511d29]/50 italic pl-2">No members.</p>}
                        </div>
                    </div>
                )
            })}
        </div>
    );
};

export default Organization;
