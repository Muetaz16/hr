import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { recruitmentService } from '../services/recruitmentService';
import { departmentService } from '../services/departmentService';
import { unitService } from '../services/unitService';
import type { RecruitmentRequest, Department, Unit } from '../types';
import { 
    UserPlus, 
    Clock, 
    CheckCircle2, 
    XCircle, 
    Plus, 
    Building2, 
    Briefcase,
    MessageSquare,
    Trash2,
    Search,
    User as UserIcon
} from 'lucide-react';
import { toast } from 'sonner';
import Modal from '../components/Modal';

const Recruitment: React.FC = () => {
    const { currentUser } = useAuth();
    const [requests, setRequests] = useState<RecruitmentRequest[]>([]);
    const [departments, setDepartments] = useState<Department[]>([]);
    const [units, setUnits] = useState<Unit[]>([]);
    const [loading, setLoading] = useState(true);
    
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [formData, setFormData] = useState({
        jobTitle: '',
        reason: '',
        departmentId: '',
        unitId: ''
    });

    const [editingRequestId, setEditingRequestId] = useState<string | null>(null);
    const [selectedRequest, setSelectedRequest] = useState<RecruitmentRequest | null>(null);
    const [approvalNote, setApprovalNote] = useState('');

    const isHR = currentUser?.role === 'HR_MANAGER' || currentUser?.role === 'SUPER_ADMIN';
    const isGM = currentUser?.role === 'HEAD_DIRECTOR' || currentUser?.role === 'SUPER_ADMIN';
    const isDeptHead = currentUser?.role === 'HEAD_DEPARTMENT' || currentUser?.role === 'SUPER_ADMIN';
    const canRequest = currentUser?.role === 'HEAD_UNIT' || currentUser?.role === 'HEAD_DEPARTMENT' || currentUser?.role === 'SUPER_ADMIN';

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [reqs, depts, unts] = await Promise.all([
                recruitmentService.getAllRequests(),
                departmentService.getAllDepartments(),
                unitService.getAllUnits()
            ]);
            setRequests(reqs);
            setDepartments(depts);
            setUnits(unts);

            if (currentUser?.departmentId) {
                setFormData(prev => ({ ...prev, departmentId: currentUser.departmentId! }));
            }
            if (currentUser?.unitId) {
                setFormData(prev => ({ ...prev, unitId: currentUser.unitId! }));
            }
        } catch (error) {
            toast.error('Failed to load recruitment data');
        } finally {
            setLoading(false);
        }
    };

    const handleCreateOrUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (editingRequestId) {
                await recruitmentService.updateRequest(editingRequestId, formData);
                toast.success('Recruitment request updated successfully');
            } else {
                await recruitmentService.createRequest(formData);
                toast.success('Recruitment request submitted successfully');
            }
            setIsCreateModalOpen(false);
            setEditingRequestId(null);
            setFormData({ jobTitle: '', reason: '', departmentId: currentUser?.departmentId || '', unitId: currentUser?.unitId || '' });
            fetchData();
        } catch (error) {
            toast.error(editingRequestId ? 'Failed to update request' : 'Failed to submit request');
        }
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm('Are you sure you want to delete this recruitment request?')) return;
        try {
            await recruitmentService.deleteRequest(id);
            toast.success('Request deleted successfully');
            fetchData();
        } catch (error) {
            toast.error('Failed to delete request');
        }
    };

    const openEditModal = (request: RecruitmentRequest) => {
        setFormData({
            jobTitle: request.jobTitle,
            reason: request.reason || '',
            departmentId: request.departmentId,
            unitId: request.unitId || ''
        });
        setEditingRequestId(request.id);
        setIsCreateModalOpen(true);
    };

    const handleUpdateStatus = async (status: string) => {
        if (!selectedRequest) return;
        try {
            await recruitmentService.updateStatus(selectedRequest.id, status, approvalNote);
            toast.success(`Request ${status.toLowerCase().replace('_', ' ')} successfully`);
            setSelectedRequest(null);
            setApprovalNote('');
            fetchData();
        } catch (error) {
            toast.error('Failed to update request status');
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'FULLY_APPROVED': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
            case 'HR_APPROVED': return 'bg-blue-100 text-blue-700 border-blue-200';
            case 'DEPT_APPROVED': return 'bg-amber-100 text-amber-700 border-amber-200';
            case 'REJECTED': return 'bg-rose-100 text-rose-700 border-rose-200';
            default: return 'bg-slate-100 text-slate-700 border-slate-200';
        }
    };

    if (loading) return <div className="p-12 text-center animate-pulse text-slate-400">Loading Recruitment Requests...</div>;

    return (
        <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h1 className="text-4xl font-outfit font-black text-slate-800 tracking-tight">Recruitment Requests</h1>
                    <p className="text-slate-500 font-medium mt-1">Manage and approve hiring requests for the organization</p>
                </div>
                {canRequest && (
                    <button 
                        onClick={() => setIsCreateModalOpen(true)}
                        className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all hover:scale-[1.02] active:scale-95"
                    >
                        <Plus className="w-5 h-5" />
                        Request New Employee
                    </button>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center">
                        <Clock className="w-6 h-6 text-amber-500" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Pending</p>
                        <p className="text-2xl font-black text-slate-800">{requests.filter(r => r.status === 'PENDING').length}</p>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center">
                        <UserPlus className="w-6 h-6 text-blue-500" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">HR Approved</p>
                        <p className="text-2xl font-black text-slate-800">{requests.filter(r => r.status === 'HR_APPROVED').length}</p>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center">
                        <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Fully Approved</p>
                        <p className="text-2xl font-black text-slate-800">{requests.filter(r => r.status === 'FULLY_APPROVED').length}</p>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-rose-50 flex items-center justify-center">
                        <XCircle className="w-6 h-6 text-rose-500" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Rejected</p>
                        <p className="text-2xl font-black text-slate-800">{requests.filter(r => r.status === 'REJECTED').length}</p>
                    </div>
                </div>
            </div>

            <div className="bg-white/40 backdrop-blur-xl rounded-[2.5rem] border border-slate-100 shadow-premium p-8">
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-3">
                        <Search className="w-5 h-5 text-slate-300" />
                        <h3 className="text-xl font-black text-slate-800 tracking-tight">Active Requests</h3>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {requests.map((request) => (
                        <div key={request.id} className="group bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-500 relative overflow-hidden">
                            <div className={`absolute top-0 right-0 w-24 h-24 blur-3xl opacity-5 transition-opacity group-hover:opacity-10 ${getStatusColor(request.status).split(' ')[0]}`}></div>
                            
                            <div className="flex justify-between items-start mb-4">
                                <div className="space-y-1">
                                    <div className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${getStatusColor(request.status)}`}>
                                        {request.status.replace('_', ' ')}
                                    </div>
                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-2">Job Position</p>
                                    <h4 className="text-lg font-black text-slate-800 tracking-tight leading-tight uppercase">{request.jobTitle}</h4>
                                </div>
                                <div className="flex items-center gap-2">
                                    {(request.status === 'PENDING' || currentUser?.role === 'SUPER_ADMIN') && (request.requesterId === currentUser?.id || currentUser?.role === 'SUPER_ADMIN') && (
                                        <button 
                                            onClick={() => openEditModal(request)}
                                            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                                            title="Edit Request"
                                        >
                                            <Search className="w-4 h-4" />
                                        </button>
                                    )}
                                    {(currentUser?.role === 'SUPER_ADMIN' || request.requesterId === currentUser?.id) && (
                                        <button 
                                            onClick={() => handleDelete(request.id)}
                                            className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                                            title="Delete Request"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    )}
                                    <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center group-hover:rotate-6 transition-transform">
                                        <Briefcase className="w-5 h-5 text-indigo-500" />
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-4 pt-4 border-t border-slate-50">
                                <div className="flex items-center gap-3">
                                    <Building2 className="w-4 h-4 text-slate-400" />
                                    <div className="min-w-0">
                                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-tighter leading-none mb-0.5">Department / Unit</p>
                                        <p className="text-xs font-bold text-slate-700 truncate">{request.department?.name} {request.unit ? `/ ${request.unit.name}` : ''}</p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3">
                                    <MessageSquare className="w-4 h-4 text-slate-400" />
                                    <div className="min-w-0">
                                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-tighter leading-none mb-0.5">Requester Reason</p>
                                        <p className="text-xs text-slate-500 line-clamp-2 italic">"{request.reason || 'No reason provided'}"</p>
                                    </div>
                                </div>

                                <div className="pt-2 flex items-center justify-between">
                                    <p className="text-[9px] font-bold text-slate-400">
                                        Requested by <span className="text-slate-600">{request.requester?.fullName}</span>
                                    </p>
                                    <button 
                                        onClick={() => setSelectedRequest(request)}
                                        className="text-[10px] font-black text-indigo-600 uppercase tracking-widest hover:underline"
                                    >
                                        Details & Approval
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}

                    {requests.length === 0 && (
                        <div className="col-span-full py-20 text-center space-y-4">
                            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto">
                                <Search className="w-10 h-10 text-slate-200" />
                            </div>
                            <p className="text-slate-400 font-medium">No recruitment requests found.</p>
                        </div>
                    )}
                </div>
            </div>

            <Modal
                isOpen={isCreateModalOpen}
                onClose={() => {
                    setIsCreateModalOpen(false);
                    setEditingRequestId(null);
                    setFormData({ jobTitle: '', reason: '', departmentId: currentUser?.departmentId || '', unitId: currentUser?.unitId || '' });
                }}
                title={editingRequestId ? "Edit Recruitment Request" : "New Recruitment Request"}
                maxWidth="max-w-lg"
            >
                <form onSubmit={handleCreateOrUpdate} className="space-y-6 py-2">
                    <div className="space-y-4">
                        <div className="bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100/50">
                            <p className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.2em] mb-3">Job Information</p>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">Job Title / Position Name</label>
                                    <input 
                                        type="text" 
                                        required
                                        value={formData.jobTitle}
                                        onChange={(e) => setFormData({...formData, jobTitle: e.target.value})}
                                        className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all font-bold text-slate-700"
                                        placeholder="e.g. Senior Software Engineer"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">Justification / Reason</label>
                                    <textarea 
                                        required
                                        value={formData.reason}
                                        onChange={(e) => setFormData({...formData, reason: e.target.value})}
                                        className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all font-medium text-slate-600 min-h-[100px]"
                                        placeholder="Explain why this position is needed..."
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">Department</label>
                                <select 
                                    required
                                    disabled={!!currentUser?.departmentId}
                                    value={formData.departmentId}
                                    onChange={(e) => setFormData({...formData, departmentId: e.target.value})}
                                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all font-bold text-slate-700 disabled:bg-slate-50"
                                >
                                    <option value="">Select Department</option>
                                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">Unit (Optional)</label>
                                <select 
                                    disabled={!!currentUser?.unitId}
                                    value={formData.unitId}
                                    onChange={(e) => setFormData({...formData, unitId: e.target.value})}
                                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all font-bold text-slate-700 disabled:bg-slate-50"
                                >
                                    <option value="">Select Unit</option>
                                    {units.filter(u => u.departmentId === formData.departmentId).map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                                </select>
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-3 pt-4">
                        <button 
                            type="button"
                            onClick={() => setIsCreateModalOpen(false)}
                            className="flex-1 py-4 bg-slate-50 text-slate-400 rounded-2xl font-black text-[11px] uppercase tracking-widest hover:bg-slate-100 transition-all"
                        >
                            Cancel
                        </button>
                        <button 
                            type="submit"
                            className="flex-[2] py-4 bg-indigo-600 text-white rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all"
                        >
                            Submit Request
                        </button>
                    </div>
                </form>
            </Modal>

            <Modal
                isOpen={!!selectedRequest}
                onClose={() => setSelectedRequest(null)}
                title="Recruitment Request Details"
                maxWidth="max-w-2xl"
            >
                {selectedRequest && (
                    <div className="space-y-8 py-2">
                        <div className="flex flex-col md:flex-row gap-6 items-start md:items-center p-6 bg-slate-50 rounded-3xl border border-slate-100">
                            <div className="w-16 h-16 rounded-2xl bg-white shadow-sm flex items-center justify-center">
                                <Briefcase className="w-8 h-8 text-indigo-500" />
                            </div>
                            <div className="flex-1 space-y-1">
                                <p className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.2em]">New Hiring Request</p>
                                <h3 className="text-2xl font-black text-slate-800 tracking-tight uppercase">{selectedRequest.jobTitle}</h3>
                                <div className="flex gap-4">
                                    <div className="flex items-center gap-1.5">
                                        <Building2 className="w-3 h-3 text-slate-400" />
                                        <span className="text-[10px] font-bold text-slate-500 uppercase">{selectedRequest.department?.name}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <Clock className="w-3 h-3 text-slate-400" />
                                        <span className="text-[10px] font-bold text-slate-500 uppercase">{new Date(selectedRequest.createdAt).toLocaleDateString()}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5 ml-auto">
                                        <div className="w-5 h-5 rounded-full bg-indigo-100 flex items-center justify-center">
                                            <UserIcon className="w-2.5 h-2.5 text-indigo-600" />
                                        </div>
                                        <span className="text-[10px] font-black text-slate-700 uppercase">{selectedRequest.requester?.fullName}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Request Justification</p>
                            <div className="p-5 bg-white border border-slate-100 rounded-2xl text-slate-600 font-medium leading-relaxed italic">
                                "{selectedRequest.reason || 'No reason provided.'}"
                            </div>
                        </div>

                        <div className="space-y-4">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Approval Workflow</p>
                            <div className="p-5 bg-white border border-slate-100 rounded-3xl">
                                    {/* Department Approval Stage */}
                                    <div className="relative pl-8 pb-8 border-l-2 border-dashed border-slate-100">
                                        <div className={`absolute -left-[9px] top-0 w-4 h-4 rounded-full border-2 border-white shadow-sm ${
                                            selectedRequest.deptApprovedById ? 'bg-amber-500' : 'bg-slate-200'
                                        }`} />
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <p className="text-[11px] font-black text-slate-800 uppercase tracking-wider">Dept Head Review</p>
                                                {selectedRequest.deptApprovedBy ? (
                                                    <div className="mt-2 space-y-1">
                                                        <p className="text-xs font-bold text-indigo-600">{selectedRequest.deptApprovedBy.fullName}</p>
                                                        {selectedRequest.deptNote && (
                                                            <p className="text-[11px] text-slate-500 bg-slate-50 p-2 rounded-lg border border-slate-100 italic">"{selectedRequest.deptNote}"</p>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <p className="text-[10px] text-slate-400 italic mt-1">Awaiting Department Head Decision</p>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* HR Approval Stage */}
                                    <div className="relative pl-8 pb-8 border-l-2 border-dashed border-slate-100">
                                        <div className={`absolute -left-[9px] top-0 w-4 h-4 rounded-full border-2 border-white shadow-sm ${
                                            selectedRequest.hrApprovedById ? 'bg-blue-500' : 'bg-slate-200'
                                        }`} />
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <p className="text-[11px] font-black text-slate-800 uppercase tracking-wider">HR Manager Review</p>
                                                {selectedRequest.hrApprovedBy ? (
                                                    <div className="mt-2 space-y-1">
                                                        <p className="text-xs font-bold text-indigo-600">{selectedRequest.hrApprovedBy.fullName}</p>
                                                        {selectedRequest.hrNote && (
                                                            <p className="text-[11px] text-slate-500 bg-slate-50 p-2 rounded-lg border border-slate-100 italic">"{selectedRequest.hrNote}"</p>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <p className="text-[10px] text-slate-400 italic mt-1">Awaiting HR Approval</p>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* GM Final Stage */}
                                    <div className="relative pl-8">
                                        <div className={`absolute -left-[9px] top-0 w-4 h-4 rounded-full border-2 border-white shadow-sm ${
                                            selectedRequest.status === 'FULLY_APPROVED' ? 'bg-emerald-500' : 'bg-slate-200'
                                        }`} />
                                        <p className="text-[11px] font-black text-slate-800 uppercase tracking-wider">General Manager Final Decision</p>
                                        {selectedRequest.gmApprovedBy ? (
                                            <div className="mt-2 space-y-1">
                                                <p className="text-xs font-bold text-indigo-600">{selectedRequest.gmApprovedBy.fullName}</p>
                                                {selectedRequest.gmNote && (
                                                    <p className="text-[11px] text-slate-500 bg-slate-50 p-2 rounded-lg border border-slate-100 italic">"{selectedRequest.gmNote}"</p>
                                                )}
                                            </div>
                                        ) : (
                                            <p className="text-[10px] text-slate-400 italic mt-1">Awaiting GM Final Approval</p>
                                        )}
                                    </div>
                            </div>
                        </div>

                        {((isDeptHead && selectedRequest.status === 'PENDING' && (currentUser?.role === 'SUPER_ADMIN' || selectedRequest.departmentId === currentUser?.departmentId)) || 
                          (isHR && (selectedRequest.status === 'DEPT_APPROVED' || selectedRequest.status === 'PENDING')) || 
                          (isGM && (selectedRequest.status === 'PENDING' || selectedRequest.status === 'DEPT_APPROVED' || selectedRequest.status === 'HR_APPROVED'))) && (
                            <div className="p-6 bg-indigo-50/50 rounded-3xl border border-indigo-100/50 space-y-4">
                                <p className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.2em] mb-2">Provide Your Decision</p>
                                <textarea 
                                    value={approvalNote}
                                    onChange={(e) => setApprovalNote(e.target.value)}
                                    placeholder="Add a comment or feedback for this decision..."
                                    className="w-full px-4 py-3 bg-white border border-indigo-200 rounded-xl focus:ring-4 focus:ring-indigo-500/10 outline-none font-medium text-slate-600 text-sm"
                                />
                                <div className="flex gap-3">
                                    <button 
                                        onClick={() => handleUpdateStatus('REJECTED')}
                                        className="flex-1 py-3.5 bg-rose-50 text-rose-600 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-rose-100 transition-all border border-rose-100"
                                    >
                                        Reject
                                    </button>
                                    <button 
                                        onClick={() => {
                                            if (isDeptHead && selectedRequest.status === 'PENDING') handleUpdateStatus('DEPT_APPROVED');
                                            else if (isHR) handleUpdateStatus('HR_APPROVED');
                                            else handleUpdateStatus('FULLY_APPROVED');
                                        }}
                                        className="flex-[2] py-3.5 bg-indigo-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all"
                                    >
                                        {isDeptHead && selectedRequest.status === 'PENDING' ? 'Approve (Dept Review)' : 
                                         isHR ? 'Approve (HR Review)' : 'Grant Final Approval'}
                                    </button>
                                </div>
                            </div>
                        )}

                        <button 
                            onClick={() => setSelectedRequest(null)}
                            className="w-full py-3.5 bg-slate-900 text-white rounded-2xl font-black text-[11px] uppercase tracking-widest hover:scale-[1.01] active:scale-95 transition-all"
                        >
                            Close
                        </button>
                    </div>
                )}
            </Modal>
        </div>
    );
};

export default Recruitment;
