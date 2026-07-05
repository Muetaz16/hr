import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { employeeService } from '../services/employeeService';
import { evaluationService } from '../services/evaluationService';
import { isEvaluationEnabled } from '../services/evaluationPeriodService';
import type { Employee, UnitEvaluation, DepartmentEvaluation, DirectorEvaluation, PersonnelEvaluation } from '../types';
import Modal from '../components/Modal';
import { format } from 'date-fns';
import {
    CheckCircle2,
    Lock,
    Search,
    User,
    Clock,
    Calendar,
    ArrowUpRight,
    TrendingUp,
    Filter,
    FileText,
    FileSpreadsheet as ExcelIcon
} from 'lucide-react';
import * as XLSX from 'xlsx-js-style';
import { roleThemes } from '../config/roleThemes';
import type { UserRole } from '../types';

const EvaluationsPage: React.FC = () => {
    const { currentUser } = useAuth();
    const { t } = useTranslation();
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
    const [searchTerm, setSearchTerm] = useState('');
    const [isPeriodEnabled, setIsPeriodEnabled] = useState(true);

    const theme = roleThemes[currentUser?.role as UserRole] || roleThemes.EMPLOYEE;

    // Evaluation Data State
    const [unitEvals, setUnitEvals] = useState<Record<string, UnitEvaluation>>({});
    const [deptEvals, setDeptEvals] = useState<Record<string, DepartmentEvaluation>>({});
    const [dirEvals, setDirEvals] = useState<Record<string, DirectorEvaluation>>({});
    const [persEvals, setPersEvals] = useState<Record<string, PersonnelEvaluation>>({});

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedEmp, setSelectedEmp] = useState<Employee | null>(null);
    const [modalType, setModalType] = useState<'UNIT' | 'DEPT' | 'DIRECTOR' | 'PERSONNEL'>('UNIT');

    // Initial Form State with detailed metrics
    const initialMetrics = {
        relationshipWithColleagues: 0, teamworkParticipation: 0, workOrganization: 0, communicationSkills: 0, regulatoryCompliance: 0,
        taskQuality: 0, timeCommitment: 0, organizationalCompliance: 0, problemSolving: 0, pressureHandling: 0, continuousDevelopment: 0,
        regulationsAdherence: 0, safetyAdherence: 0, appearanceCommitment: 0, resourcePreservation: 0, dataPrivacy: 0,
        comments: ''
    };

    const [unitForm, setUnitForm] = useState(initialMetrics);
    const [deptForm, setDeptForm] = useState(initialMetrics);
    const [dirForm, setDirForm] = useState({ ...initialMetrics, finalScore: 0 });
    const [persForm, setPersForm] = useState({
        warningMessages: 0, disciplinaryDeduction: 0, appreciationMessages: 0, exceptionalAssignments: 0,
        specializedTraining: false, supportingTraining: false, languageTraining: false, softwareTraining: false
    });

    useEffect(() => {
        fetchData();
    }, [selectedMonth, currentUser]);

    const fetchData = async () => {
        if (!currentUser) return;

        setLoading(true);
        try {
            let emps: Employee[] = [];
            if (currentUser.role === 'SUPER_ADMIN' || currentUser.role === 'HR_MANAGER' || currentUser.role === 'PERSONNEL') {
                emps = await employeeService.getAllEmployees();
            } else if (currentUser.role === 'HEAD_UNIT' && currentUser.unitId) {
                emps = await employeeService.getEmployeesByUnit(currentUser.unitId);
            } else if (currentUser.role === 'HEAD_DEPARTMENT' && currentUser.departmentId) {
                emps = await employeeService.getEmployeesByDepartment(currentUser.departmentId);
            } else if (currentUser.role === 'HEAD_DIVISION') {
                const me = await employeeService.getMyEmployeeRecord();
                if (me && me.divisionId) {
                    const all = await employeeService.getAllEmployees();
                    emps = all.filter(e => e.divisionId === me.divisionId && (e.role === 'HEAD_DEPARTMENT' || e.role === 'HEAD_UNIT'));
                }
            } else if (currentUser.role === 'HEAD_DIRECTOR') {
                let allInScope: Employee[] = [];
                if (currentUser.departmentIds && currentUser.departmentIds.length > 0) {
                    const all = await employeeService.getAllEmployees();
                    allInScope = all.filter(e => currentUser.departmentIds?.includes(e.departmentId));
                } else if (currentUser.groupId) {
                    allInScope = await employeeService.getEmployeesByGroup(currentUser.groupId);
                } else {
                    allInScope = await employeeService.getAllEmployees();
                }
                // General Manager only evaluates Heads of Units and Heads of Departments
                emps = allInScope.filter(e => e.role === 'HEAD_UNIT' || e.role === 'HEAD_DEPARTMENT');
            }
            setEmployees(emps);

            const uEvals: Record<string, UnitEvaluation> = {};
            const dEvals: Record<string, DepartmentEvaluation> = {};
            const diEvals: Record<string, DirectorEvaluation> = {};
            const pEvals: Record<string, PersonnelEvaluation> = {};

            await Promise.all(emps.map(async (emp) => {
                const [uEval, dEval, diEval, pEval] = await Promise.all([
                    evaluationService.getUnitEvaluation(emp.id, selectedMonth),
                    evaluationService.getDeptEvaluation(emp.id, selectedMonth),
                    evaluationService.getDirectorEvaluation(emp.id, selectedMonth),
                    evaluationService.getPersonnelEvaluation(emp.id, selectedMonth)
                ]);

                if (uEval) uEvals[emp.id] = uEval;
                if (dEval) dEvals[emp.id] = dEval;
                if (diEval) diEvals[emp.id] = diEval;
                if (pEval) pEvals[emp.id] = pEval;
            }));

            setUnitEvals(uEvals);
            setDeptEvals(dEvals);
            setDirEvals(diEvals);
            setPersEvals(pEvals);

            // Check if period is enabled
            const enabled = await isEvaluationEnabled(selectedMonth, currentUser.departmentId || undefined);
            setIsPeriodEnabled(enabled || currentUser.role === 'SUPER_ADMIN'); // Super admin can always see/edit?

        } catch (error) {
            console.error("Error fetching evaluations:", error);
        } finally {
            setLoading(false);
        }
    };

    const openEvaluationModal = (emp: Employee, type: 'UNIT' | 'DEPT' | 'DIRECTOR' | 'PERSONNEL') => {
        setSelectedEmp(emp);
        setModalType(type);

        if (type === 'UNIT') {
            const existing = unitEvals[emp.id];
            setUnitForm(existing ? { ...existing, comments: existing.comments || '' } : initialMetrics);
        } else if (type === 'DEPT') {
            const existing = deptEvals[emp.id];
            setDeptForm(existing ? { ...existing, comments: existing.comments || '' } : initialMetrics);
        } else if (type === 'DIRECTOR') {
            const existing = dirEvals[emp.id];
            setDirForm(existing ? { ...existing, finalScore: existing.finalScore || 0, comments: '' } : { ...initialMetrics, finalScore: 0 });
        } else {
            const existing = persEvals[emp.id];
            setPersForm(existing || {
                warningMessages: 0, disciplinaryDeduction: 0, appreciationMessages: 0, exceptionalAssignments: 0,
                specializedTraining: false, supportingTraining: false, languageTraining: false, softwareTraining: false
            });
        }
        setIsModalOpen(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedEmp || !currentUser) return;

        try {
            if (modalType === 'UNIT') {
                await evaluationService.saveUnitEvaluation({
                    employeeId: selectedEmp.id,
                    month: selectedMonth,
                    ...unitForm,
                    submittedAt: new Date().toISOString(),
                    submittedBy: currentUser.id,
                    totalScore: 0 // Calculated on service side
                });
            } else if (modalType === 'DEPT') {
                await evaluationService.saveDeptEvaluation({
                    employeeId: selectedEmp.id,
                    month: selectedMonth,
                    ...deptForm,
                    submittedAt: new Date().toISOString(),
                    submittedBy: currentUser.id,
                    totalScore: 0 // Service calculates this
                });
            } else if (modalType === 'PERSONNEL') {
                await evaluationService.savePersonnelEvaluation({
                    employeeId: selectedEmp.id,
                    month: selectedMonth,
                    ...persForm,
                    submittedAt: new Date().toISOString(),
                    submittedBy: currentUser.id
                });
            } else {
                if (!deptEvals[selectedEmp.id]) {
                    // Warn but allow (Director overrides)
                    // alert("Note: Department Evaluation is missing.");
                }

                const id = await evaluationService.saveDirectorEvaluation({
                    employeeId: selectedEmp.id,
                    month: selectedMonth,
                    ...dirForm,
                    submittedBy: currentUser.id,
                    finalScore: 0 // Service calculates this
                });

                if (window.confirm("Approve and Lock this evaluation? This cannot be undone.")) {
                    await evaluationService.lockEvaluation(id);
                }
            }
            setIsModalOpen(false);
            fetchData();
        } catch (error) {
            console.error("Error saving evaluation:", error);
            alert(error instanceof Error ? error.message : "Failed to save");
        }
    };

    const handleExportExcel = () => {
        try {
            const completedCount = Object.keys(dirEvals).filter(id => dirEvals[id]?.locked).length;
            const completionRate = employees.length > 0
                ? Math.round((completedCount / employees.length) * 100)
                : 0;

            // Define Premium Styles
            const titleStyle = {
                font: { name: "Segoe UI", sz: 16, bold: true, color: { rgb: "E3C4A2" } },
                alignment: { horizontal: 'center', vertical: 'center' },
                fill: { fgColor: { rgb: "541C2C" } }
            };
            
            const metaStyle = {
                font: { name: "Segoe UI", sz: 10, italic: true, color: { rgb: "AA7A51" } },
                alignment: { horizontal: 'center', vertical: 'center' },
                fill: { fgColor: { rgb: "FAF7F5" } }
            };

            const kpiLabelStyle = {
                font: { name: "Segoe UI", sz: 9, bold: true, color: { rgb: "AA7A51" } },
                alignment: { horizontal: 'center', vertical: 'center' },
                fill: { fgColor: { rgb: "FDFCF7" } },
                border: {
                    top: { style: 'thin', color: { rgb: "E3C4A2" } },
                    left: { style: 'thin', color: { rgb: "E3C4A2" } },
                    right: { style: 'thin', color: { rgb: "E3C4A2" } }
                }
            };

            const kpiValueStyle = (colorHex: string) => ({
                font: { name: "Segoe UI", sz: 14, bold: true, color: { rgb: colorHex } },
                alignment: { horizontal: 'center', vertical: 'center' },
                fill: { fgColor: { rgb: "FDFCF7" } },
                border: {
                    bottom: { style: 'thin', color: { rgb: "E3C4A2" } },
                    left: { style: 'thin', color: { rgb: "E3C4A2" } },
                    right: { style: 'thin', color: { rgb: "E3C4A2" } }
                }
            });
            
            const categoryStyle = (fillHex: string) => ({
                font: { name: "Segoe UI", sz: 10, bold: true, color: { rgb: "FFFFFF" } },
                alignment: { horizontal: 'center', vertical: 'center' },
                fill: { fgColor: { rgb: fillHex } },
                border: {
                    top: { style: 'thin', color: { rgb: "AA7A51" } },
                    bottom: { style: 'thin', color: { rgb: "AA7A51" } },
                    left: { style: 'thin', color: { rgb: "AA7A51" } },
                    right: { style: 'thin', color: { rgb: "AA7A51" } }
                }
            });
            
            const subHeaderStyle = (fillHex: string, textHex: string) => ({
                font: { name: "Segoe UI", sz: 9, bold: true, color: { rgb: textHex } },
                alignment: { horizontal: 'center', vertical: 'center' },
                fill: { fgColor: { rgb: fillHex } },
                border: {
                    top: { style: 'thin', color: { rgb: "AA7A51" } },
                    bottom: { style: 'medium', color: { rgb: "E3C4A2" } },
                    left: { style: 'thin', color: { rgb: "AA7A51" } },
                    right: { style: 'thin', color: { rgb: "AA7A51" } }
                }
            });
            
            const baseStyle = {
                font: { name: "Segoe UI", sz: 10, color: { rgb: "300A15" } },
                alignment: { horizontal: 'center', vertical: 'center' },
                border: {
                    top: { style: 'thin', color: { rgb: "F1ECE6" } },
                    bottom: { style: 'thin', color: { rgb: "F1ECE6" } },
                    left: { style: 'thin', color: { rgb: "F1ECE6" } },
                    right: { style: 'thin', color: { rgb: "F1ECE6" } }
                }
            };
            
            const zebraStyle = {
                ...baseStyle,
                fill: { fgColor: { rgb: "FAF8F6" } }
            };
            
            const textLeftStyle = {
                alignment: { horizontal: 'left', vertical: 'center' }
            };
            
            // 1. Title Row
            const row1 = [{ v: "IPH HR SYSTEM - HR EVALUATIONS EXECUTIVE PERFORMANCE SUMMARY", s: titleStyle }];
            for (let i = 1; i < 10; i++) row1.push({ v: "", s: titleStyle });
            
            // 2. Metadata Row
            const row2 = [{ v: `Evaluation Month: ${selectedMonth} | Exported: ${format(new Date(), 'dd MMM yyyy HH:mm')} | Total Staff: ${filteredEmployees.length}`, s: metaStyle }];
            for (let i = 1; i < 10; i++) row2.push({ v: "", s: metaStyle });
            
            // 3. Empty Spacer Row
            const row3 = Array(10).fill({ v: "", s: { fill: { fgColor: { rgb: "FFFFFF" } } } });

            // 4. KPI Card Labels Row
            const row4 = [
                { v: "", s: { fill: { fgColor: { rgb: "FFFFFF" } } } },
                { v: "TOTAL MONITORED STAFF", s: kpiLabelStyle },
                { v: "", s: kpiLabelStyle },
                { v: "", s: { fill: { fgColor: { rgb: "FFFFFF" } } } },
                { v: "LOCKED EVALUATIONS", s: kpiLabelStyle },
                { v: "", s: kpiLabelStyle },
                { v: "", s: { fill: { fgColor: { rgb: "FFFFFF" } } } },
                { v: "COMPLETION RATE", s: kpiLabelStyle },
                { v: "", s: kpiLabelStyle },
                { v: "", s: { fill: { fgColor: { rgb: "FFFFFF" } } } }
            ];

            // 5. KPI Card Values Row
            const row5 = [
                { v: "", s: { fill: { fgColor: { rgb: "FFFFFF" } } } },
                { v: employees.length, s: kpiValueStyle("541C2C") },
                { v: "", s: kpiValueStyle("541C2C") },
                { v: "", s: { fill: { fgColor: { rgb: "FFFFFF" } } } },
                { v: completedCount, s: kpiValueStyle("059669") },
                { v: "", s: kpiValueStyle("059669") },
                { v: "", s: { fill: { fgColor: { rgb: "FFFFFF" } } } },
                { v: `${completionRate}%`, s: kpiValueStyle("4F46E5") },
                { v: "", s: kpiValueStyle("4F46E5") },
                { v: "", s: { fill: { fgColor: { rgb: "FFFFFF" } } } }
            ];

            // 6. Spacer Row
            const row6 = Array(10).fill({ v: "", s: { fill: { fgColor: { rgb: "FFFFFF" } } } });
            
            // 7. Category Headers
            const row7 = [
                { v: "STAFF CLASSIFICATION", s: categoryStyle("AA7A51") }, "", "",
                { v: "APPRAISAL PHASES SCORE (%)", s: categoryStyle("541C2C") }, "", "",
                { v: "HR SYSTEM RECORDS", s: categoryStyle("AA7A51") }, "", "",
                { v: "FINAL ACTION", s: categoryStyle("541C2C") }
            ];
            
            // 8. Column Sub-headers
            const row8 = [
                { v: "Staff ID", s: subHeaderStyle("541C2C", "E3C4A2") },
                { v: "Employee Name", s: subHeaderStyle("541C2C", "E3C4A2") },
                { v: "Position / Role", s: subHeaderStyle("541C2C", "E3C4A2") },
                { v: "Unit Score", s: subHeaderStyle("AA7A51", "FFFFFF") },
                { v: "Dept Score", s: subHeaderStyle("AA7A51", "FFFFFF") },
                { v: "Director Score", s: subHeaderStyle("AA7A51", "FFFFFF") },
                { v: "Appreciations", s: subHeaderStyle("541C2C", "E3C4A2") },
                { v: "Deduction Days", s: subHeaderStyle("541C2C", "E3C4A2") },
                { v: "Courses Taken", s: subHeaderStyle("541C2C", "E3C4A2") },
                { v: "Approval Status", s: subHeaderStyle("AA7A51", "FFFFFF") }
            ];
            
            // Data Rows mapping
            const dataRows = filteredEmployees.map((emp, idx) => {
                const rowStyle = idx % 2 === 0 ? baseStyle : zebraStyle;
                const uEval = unitEvals[emp.id];
                const dEval = deptEvals[emp.id];
                const diEval = dirEvals[emp.id];
                const pEval = persEvals[emp.id];
                const isLocked = diEval?.locked;

                const trainingCount = [
                    pEval?.specializedTraining,
                    pEval?.supportingTraining,
                    pEval?.languageTraining,
                    pEval?.softwareTraining
                ].filter(Boolean).length;
                
                const scoreStyle = (val: number | undefined, base: any) => {
                    if (val === undefined || val === null) {
                        return {
                            ...base,
                            font: { ...base.font, italic: true, color: { rgb: "AA7A51" } }
                        };
                    }
                    // Excellent (>=90%)
                    if (val >= 90) {
                        return {
                            ...base,
                            fill: { fgColor: { rgb: "E6F4EA" } },
                            font: { ...base.font, bold: true, color: { rgb: "047857" } }
                        };
                    }
                    // Very Good (>=80%)
                    if (val >= 80) {
                        return {
                            ...base,
                            fill: { fgColor: { rgb: "F0FDFA" } },
                            font: { ...base.font, bold: true, color: { rgb: "0D9488" } }
                        };
                    }
                    // Unsatisfactory (<50%)
                    if (val < 50) {
                        return {
                            ...base,
                            fill: { fgColor: { rgb: "FEF2F2" } },
                            font: { ...base.font, bold: true, color: { rgb: "B91C1C" } }
                        };
                    }
                    // Standard Score
                    return {
                        ...base,
                        font: { ...base.font, bold: true, color: { rgb: "541C2C" } }
                    };
                };

                const formatScore = (val: number | undefined) => {
                    if (val === undefined || val === null) return "Pending";
                    return `${val.toFixed(2)}%`;
                };
                
                const statusText = isLocked ? "Approved" : "In Progress";
                const statusStyle = {
                    ...rowStyle,
                    fill: { fgColor: { rgb: isLocked ? "D1FAE5" : "FEF3C7" } },
                    font: { 
                        ...rowStyle.font, 
                        bold: true, 
                        color: { rgb: isLocked ? "065F46" : "92400E" }
                    }
                };

                const numericHighlightStyle = (val: number, isPositive: boolean, base: any) => {
                    if (val <= 0) return base;
                    return {
                        ...base,
                        fill: { fgColor: { rgb: isPositive ? "E0F2FE" : "FEE2E2" } },
                        font: { ...base.font, bold: true, color: { rgb: isPositive ? "0369A1" : "991B1B" } }
                    };
                };
                
                return [
                    { v: emp.staffId || "---", s: rowStyle },
                    { v: emp.fullName, s: { ...rowStyle, ...textLeftStyle } },
                    { v: emp.position || "---", s: { ...rowStyle, ...textLeftStyle } },
                    { v: formatScore(uEval?.totalScore), s: scoreStyle(uEval?.totalScore, rowStyle) },
                    { v: formatScore(dEval?.totalScore), s: scoreStyle(dEval?.totalScore, rowStyle) },
                    { v: formatScore(diEval?.finalScore), s: scoreStyle(diEval?.finalScore, rowStyle) },
                    { v: pEval?.appreciationMessages || 0, s: numericHighlightStyle(pEval?.appreciationMessages || 0, true, rowStyle) },
                    { v: pEval?.disciplinaryDeduction || 0, s: numericHighlightStyle(pEval?.disciplinaryDeduction || 0, false, rowStyle) },
                    { v: trainingCount, s: numericHighlightStyle(trainingCount, true, rowStyle) },
                    { v: statusText, s: statusStyle }
                ];
            });
            
            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.aoa_to_sheet([row1, row2, row3, row4, row5, row6, row7, row8, ...dataRows]);
            
            // Merges Configuration
            ws['!merges'] = [
                { s: { r: 0, c: 0 }, e: { r: 0, c: 9 } }, // Title merged across 10 columns
                { s: { r: 1, c: 0 }, e: { r: 1, c: 9 } }, // Metadata
                { s: { r: 3, c: 1 }, e: { r: 3, c: 2 } }, // KPI 1 Label
                { s: { r: 4, c: 1 }, e: { r: 4, c: 2 } }, // KPI 1 Value
                { s: { r: 3, c: 4 }, e: { r: 3, c: 5 } }, // KPI 2 Label
                { s: { r: 4, c: 4 }, e: { r: 4, c: 5 } }, // KPI 2 Value
                { s: { r: 3, c: 7 }, e: { r: 3, c: 8 } }, // KPI 3 Label
                { s: { r: 4, c: 7 }, e: { r: 4, c: 8 } }, // KPI 3 Value
                { s: { r: 6, c: 0 }, e: { r: 6, c: 2 } }, // Staff Classification Category merged
                { s: { r: 6, c: 3 }, e: { r: 6, c: 5 } }, // Appraisal Scores Category merged
                { s: { r: 6, c: 6 }, e: { r: 6, c: 8 } }, // HR System Records Category merged
            ];
            
            // Freeze panes split
            ws['!views'] = [{ state: 'frozen', ySplit: 8, xSplit: 2 }];
            
            // Auto-width calculation
            ws['!cols'] = row8.map((h, i) => {
                const maxLen = Math.max(
                    h.v.length,
                    ...dataRows.map(row => String(row[i].v).length)
                );
                return { wch: Math.min(maxLen + 5, 45) };
            });
            
            XLSX.utils.book_append_sheet(wb, ws, "HR Evaluations Summary");
            XLSX.writeFile(wb, `IPH_HR_Evaluations_${selectedMonth}_${format(new Date(), 'yyyyMMdd')}.xlsx`);
            
        } catch (error) {
            console.error("Error exporting Excel:", error);
            alert("Failed to export evaluations report: " + (error instanceof Error ? error.message : String(error)));
        }
    };

    const filteredEmployees = employees.filter(emp =>
        emp.fullName.toLowerCase().includes(searchTerm.toLowerCase()) && 
        (currentUser?.role === 'SUPER_ADMIN' || emp.userId !== currentUser?.id)
    );

    const completionRate = employees.length > 0
        ? Math.round((Object.keys(dirEvals).filter(id => dirEvals[id].locked).length / employees.length) * 100)
        : 0;

    const renderMetricInput = (label: string, field: keyof typeof deptForm, maxScore: number) => {
        // Only for Unit/Dept/Director
        if (modalType === 'PERSONNEL') return null;

        const currentVal = modalType === 'UNIT' ? unitForm[field] : modalType === 'DEPT' ? deptForm[field] : dirForm[field];
        
        // Convert the internal weight value back to a 0-100 scale for user input display
        const displayValue = typeof currentVal === 'number' && maxScore > 0 
            ? Math.round((currentVal / maxScore) * 100) 
            : 0;

        const handleChange = (inputVal: number) => {
            // Constrain input between 0 and 100
            const val100 = Math.min(100, Math.max(0, inputVal));
            // Convert it to the backend representation scale
            const scaledVal = (val100 / 100) * maxScore;

            if (modalType === 'UNIT') {
                setUnitForm(prev => ({ ...prev, [field]: scaledVal }));
            } else if (modalType === 'DEPT') {
                setDeptForm(prev => ({ ...prev, [field]: scaledVal }));
            } else {
                setDirForm(prev => ({ ...prev, [field]: scaledVal }));
            }
        };

        return (
            <div className="space-y-1">
                <div className="flex justify-between items-center">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-tight">{label}</label>
                    <span className="text-[10px] font-mono text-slate-400">Weight: {maxScore}%</span>
                </div>
                <div className="relative">
                    <input
                        type="number"
                        min="0"
                        max="100"
                        step="1"
                        required
                        value={displayValue}
                        onChange={(e) => handleChange(Number(e.target.value))}
                        className="w-full pl-3 pr-8 py-2 bg-slate-50 border-transparent rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:bg-white transition-all font-bold text-slate-800 text-sm"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-bold">%</span>
                </div>
            </div>
        );
    };

    if (loading) return (
        <div className="flex items-center justify-center min-h-[400px]">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2" style={{ borderColor: theme.primary }}></div>
        </div>
    );

    return (
        <div className="space-y-8 animate-[slideIn_0.5s_ease-out_forwards]">
            {/* Header section with Stats */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-white/20">
                <div>
                    <h1 className="text-3xl font-outfit font-bold text-slate-800 tracking-tight">{t('evaluations_title')}</h1>
                    <p className="text-slate-500 mt-1">{t('evaluations_subtitle')}</p>
                </div>

                <div className="flex flex-wrap items-center gap-4">
                    <button
                        onClick={handleExportExcel}
                        className="px-5 py-2 bg-gradient-to-r from-[#aa7a51] to-[#e3c4a2] text-slate-900 rounded-2xl font-black text-xs hover:opacity-90 transition-all flex items-center gap-2 shadow-lg active:scale-95 border border-[#e3c4a2]/20 cursor-pointer"
                    >
                        <ExcelIcon className="w-4 h-4 text-slate-900" />
                        {t('export_excel', { defaultValue: 'EXPORT EVALUATIONS' })}
                    </button>

                    <div className="glass-card flex items-center px-4 py-2 rounded-2xl shadow-sm border border-white/40 bg-white/40 sticky top-0 backdrop-blur-md">
                        <Calendar className="w-4 h-4 text-slate-500 mr-2" />
                        <input
                            type="month"
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(e.target.value)}
                            className="bg-transparent border-none text-slate-800 font-bold focus:ring-0 text-sm p-0 cursor-pointer"
                        />
                    </div>
                </div>
            </div>
            
            {!isPeriodEnabled && (
                <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl flex items-center gap-3 animate-pulse shadow-sm">
                    <Lock className="w-5 h-5 text-amber-600 flex-shrink-0" />
                    <div>
                        <p className="text-sm font-black text-amber-800 uppercase tracking-wide">Evaluation Period Closed</p>
                        <p className="text-xs text-amber-600 font-medium mt-0.5">Assessment submissions are currently disabled for {selectedMonth}. Please contact HR to enable the evaluation window.</p>
                    </div>
                </div>
            )}

            {/* Top Stats Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="glass-card p-6 rounded-3xl border-l-4 relative overflow-hidden group hover:-translate-y-1 transition-transform duration-300" style={{ borderLeftColor: theme.primary }}>
                    <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/10 rounded-full blur-xl -mr-6 -mt-6 transition-all group-hover:bg-indigo-500/20"></div>
                    <div className="flex items-center justify-between mb-4 relative z-10">
                        <div className="p-3 bg-slate-50/50 rounded-2xl">
                            <User className="w-5 h-5 text-slate-600" />
                        </div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-white/50 px-2 py-1 rounded-md">{t('total_employees')}</span>
                    </div>
                    <p className="text-3xl font-outfit font-bold text-slate-800 relative z-10">{employees.length}</p>
                    <p className="text-sm text-slate-500 mt-1 relative z-10">{t('assigned_employees')}</p>
                </div>

                <div className="glass-card p-6 rounded-3xl border-l-4 border-yellow-400 relative overflow-hidden group hover:-translate-y-1 transition-transform duration-300">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-yellow-400/10 rounded-full blur-xl -mr-6 -mt-6 transition-all group-hover:bg-yellow-400/20"></div>
                    <div className="flex items-center justify-between mb-4 relative z-10">
                        <div className="p-3 bg-yellow-50/50 rounded-2xl text-yellow-600">
                            <Clock className="w-5 h-5" />
                        </div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-white/50 px-2 py-1 rounded-md">{t('pending')}</span>
                    </div>
                    <p className="text-3xl font-outfit font-bold text-slate-800 relative z-10">
                        {employees.length - Object.keys(dirEvals).filter(id => dirEvals[id].locked).length}
                    </p>
                    <p className="text-sm text-slate-500 mt-1 relative z-10">{t('requires_approval')}</p>
                </div>

                <div className="glass-card p-6 rounded-3xl border-l-4 border-emerald-500 relative overflow-hidden group hover:-translate-y-1 transition-transform duration-300">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-xl -mr-6 -mt-6 transition-all group-hover:bg-emerald-500/20"></div>
                    <div className="flex items-center justify-between mb-4 relative z-10">
                        <div className="p-3 bg-emerald-50/50 rounded-2xl text-emerald-600">
                            <TrendingUp className="w-5 h-5" />
                        </div>
                        <div className="flex items-center text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md">
                            <ArrowUpRight className="w-3 h-3 mr-1" /> {t('finish')}
                        </div>
                    </div>
                    <p className="text-3xl font-outfit font-bold text-slate-800 relative z-10">{completionRate}%</p>
                    <p className="text-sm text-slate-500 mt-1 relative z-10">{t('completion_progress')}</p>
                </div>
            </div>

            {/* Table Area */}
            <div className="glass-card rounded-[32px] overflow-hidden shadow-2xl shadow-slate-200/50 border border-white/40">
                {/* Table Header / Filter Bar */}
                <div className="p-6 border-b border-white/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/30 backdrop-blur-md">
                    <div className="relative group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                        <input
                            type="text"
                            placeholder={t('filter_by_name')}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-11 pr-4 py-2.5 bg-white/50 border-white/40 rounded-2xl text-sm focus:ring-2 focus:ring-indigo-100 focus:bg-white transition-all w-full sm:w-80 shadow-sm"
                        />
                    </div>
                    <button className="flex items-center text-xs font-bold text-slate-500 uppercase tracking-widest hover:text-indigo-600 transition-colors bg-white/40 px-3 py-2 rounded-xl border border-white/40">
                        <Filter className="w-4 h-4 mr-2" /> {t('show_all')}
                    </button>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50/80 border-b border-slate-200 text-left">
                                <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest sticky top-0 bg-slate-50/95 backdrop-blur-sm z-10">{t('employee')}</th>
                                <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest sticky top-0 bg-slate-50/95 backdrop-blur-sm z-10">{t('unit_score', { defaultValue: 'UNIT SCORE' })}</th>
                                <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest sticky top-0 bg-slate-50/95 backdrop-blur-sm z-10">{t('dept_score')}</th>
                                <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest sticky top-0 bg-slate-50/95 backdrop-blur-sm z-10">{t('director_score')}</th>
                                <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest sticky top-0 bg-slate-50/95 backdrop-blur-sm z-10">{t('status')}</th>
                                <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right sticky top-0 bg-slate-50/95 backdrop-blur-sm z-10">{t('action')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredEmployees.map((emp) => {
                                const uEval = unitEvals[emp.id];
                                const dEval = deptEvals[emp.id];
                                const diEval = dirEvals[emp.id];
                                const isLocked = diEval?.locked;

                                return (
                                    <tr key={emp.id} className="group hover:bg-slate-50/50 transition-colors">
                                        <td className="px-8 py-4">
                                            <div className="flex items-center">
                                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#541c2c] to-[#aa7a51] flex items-center justify-center text-[#e3c4a2] font-black text-sm mr-4 group-hover:scale-105 transition-transform shadow-md shadow-[#300a15]/50">
                                                    {(emp.fullName || 'U').charAt(0)}
                                                </div>
                                                <div>
                                                    <p className="font-bold text-slate-800 group-hover:text-indigo-700 transition-colors">{emp.fullName}</p>
                                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">{t('id')}: {emp.staffId || emp.id.slice(0, 8)}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-8 py-4">
                                            {uEval ? (
                                                <div className="font-bold text-slate-700 bg-slate-100/50 inline-block px-2 py-1 rounded-lg">{uEval.totalScore?.toFixed(2) || 'N/A'}%</div>
                                            ) : (
                                                <span className="text-slate-400 text-xs italic px-2">Pending</span>
                                            )}
                                        </td>
                                        <td className="px-8 py-4">
                                            {dEval ? (
                                                <div className="font-bold text-slate-700 bg-slate-100/50 inline-block px-2 py-1 rounded-lg">{dEval.totalScore?.toFixed(2) || 'N/A'}%</div>
                                            ) : (
                                                <span className="text-slate-400 text-xs italic px-2">Pending</span>
                                            )}
                                        </td>
                                        <td className="px-8 py-4">
                                            {diEval ? (
                                                <div className="font-bold text-slate-700 bg-slate-100/50 inline-block px-2 py-1 rounded-lg">{diEval.finalScore?.toFixed(2) || 'N/A'}%</div>
                                            ) : (
                                                <span className="text-slate-400 text-xs italic px-2">Pending</span>
                                            )}
                                        </td>
                                        <td className="px-8 py-4">
                                            {isLocked ? (
                                                <div className="inline-flex items-center px-3 py-1 bg-slate-900 text-white rounded-full text-[10px] font-bold shadow-md shadow-slate-900/20">
                                                    <Lock className="w-3 h-3 mr-1.5" /> {t('approved')}
                                                </div>
                                            ) : (
                                                <div className="inline-flex items-center px-3 py-1 bg-amber-50 text-amber-600 rounded-full text-[10px] font-bold ring-1 ring-amber-100">
                                                    {t('in_progress')}
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-8 py-4 text-right">
                                            <div className="flex justify-end gap-2">
                                                {(currentUser?.role === 'HEAD_UNIT' || currentUser?.role === 'SUPER_ADMIN') && !isLocked && isPeriodEnabled && (
                                                    <button
                                                        onClick={() => openEvaluationModal(emp, 'UNIT')}
                                                        className="p-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-900 hover:text-white transition-all shadow-sm hover:shadow-md"
                                                        title="Unit Evaluation"
                                                    >
                                                        <FileText className="w-4 h-4" />
                                                    </button>
                                                )}
                                                {(currentUser?.role === 'HEAD_DEPARTMENT' || currentUser?.role === 'HEAD_DIVISION' || currentUser?.role === 'HEAD_DIRECTOR' || currentUser?.role === 'SUPER_ADMIN') && !isLocked && isPeriodEnabled && (
                                                    <button
                                                        onClick={() => openEvaluationModal(emp, 'DEPT')}
                                                        className="p-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-900 hover:text-white transition-all shadow-sm hover:shadow-md"
                                                        title="Department Evaluation"
                                                    >
                                                        <FileText className="w-4 h-4" />
                                                    </button>
                                                )}
                                                {(currentUser?.role === 'HEAD_DIRECTOR' || currentUser?.role === 'SUPER_ADMIN') && isPeriodEnabled && (
                                                    <button
                                                        onClick={() => openEvaluationModal(emp, 'DIRECTOR')}
                                                        disabled={!!isLocked && currentUser.role !== 'SUPER_ADMIN'}
                                                        className={`p-2 rounded-xl border transition-all shadow-sm hover:shadow-md ${isLocked && currentUser.role !== 'SUPER_ADMIN' ? 'opacity-50 cursor-not-allowed bg-slate-100 border-slate-200 text-slate-400' : 'bg-indigo-50 border-indigo-100 text-indigo-600 hover:bg-indigo-600 hover:text-white'}`}
                                                        title="Final Approval"
                                                    >
                                                        <CheckCircle2 className="w-4 h-4" />
                                                    </button>
                                                )}
                                                {(currentUser?.role === 'PERSONNEL' || currentUser?.role === 'SUPER_ADMIN') && (
                                                    <button
                                                        onClick={() => openEvaluationModal(emp, 'PERSONNEL')}
                                                        className={`p-2 rounded-xl border transition-all shadow-sm hover:shadow-md ${persEvals[emp.id] ? 'bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-600 hover:text-white' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-900 hover:text-white'}`}
                                                        title="Personnel Assessment"
                                                    >
                                                        <FileText className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                            {filteredEmployees.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="px-8 py-20 text-center">
                                        <div className="max-w-xs mx-auto flex flex-col items-center">
                                            <div className="w-16 h-16 bg-slate-50 text-slate-300 rounded-full flex items-center justify-center mb-4 border border-dashed border-slate-200">
                                                <Search className="w-8 h-8" />
                                            </div>
                                            <p className="font-bold text-slate-800">{t('no_results')}</p>
                                            <p className="text-slate-500 text-sm mt-1">{t('no_results_desc')}</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal remains largely similar but with improved styling in its component */}
            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={modalType === 'UNIT' ? t('unit_assessment', { defaultValue: 'Unit Assessment' }) : modalType === 'DEPT' ? t('department_assessment') : modalType === 'DIRECTOR' ? t('director_validation') : t('personnel_evaluation')}
            >
                <form onSubmit={handleSubmit} className="space-y-6 max-h-[70vh] overflow-y-auto pr-2">
                    <div className="flex items-center p-4 bg-slate-50 rounded-2xl border border-slate-100 mb-4 sticky top-0 z-10">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#541c2c] to-[#aa7a51] flex items-center justify-center mr-4 text-[#e3c4a2] font-black shadow-md shadow-[#300a15]/50">
                            {(selectedEmp?.fullName || 'U').charAt(0)}
                        </div>
                        <div>
                            <p className="font-bold text-slate-800 leading-none mb-1">{selectedEmp?.fullName}</p>
                            <p className="text-xs text-slate-500">{selectedMonth} • {t('assessment_period')}</p>
                        </div>
                    </div>

                    {/* Administrative Behavior (25%) */}
                    <div className="space-y-4">
                        <h4 className="text-sm font-black text-slate-700 uppercase tracking-widest border-b pb-2 flex justify-between">
                            {t('administrative_behavior')} <span className="text-indigo-600">25%</span>
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {renderMetricInput(t("relationship_with_colleagues"), "relationshipWithColleagues", 5)}
                            {renderMetricInput(t("teamwork_participation"), "teamworkParticipation", 5)}
                            {renderMetricInput(t("work_organization"), "workOrganization", 5)}
                            {renderMetricInput(t("written_communication"), "communicationSkills", 5)}
                            {renderMetricInput(t("regulatory_compliance"), "regulatoryCompliance", 5)}
                        </div>
                    </div>

                    {/* Executive Performance (40%) */}
                    <div className="space-y-4">
                        <h4 className="text-sm font-black text-slate-700 uppercase tracking-widest border-b pb-2 flex justify-between">
                            {t('executive_performance')} <span className="text-indigo-600">40%</span>
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {renderMetricInput(t("quality_completion"), "taskQuality", 7)}
                            {renderMetricInput(t("time_commitment"), "timeCommitment", 7)}
                            {renderMetricInput(t("organizational_compliance"), "organizationalCompliance", 7)}
                            {renderMetricInput(t("problem_solving"), "problemSolving", 6)}
                            {renderMetricInput(t("performance_pressure"), "pressureHandling", 7)}
                            {renderMetricInput(t("continuous_development"), "continuousDevelopment", 6)}
                        </div>
                    </div>

                    {/* Care and Discipline (15%) */}
                    <div className="space-y-4">
                        <h4 className="text-sm font-black text-slate-700 uppercase tracking-widest border-b pb-2 flex justify-between">
                            {t('care_and_discipline')} <span className="text-indigo-600">15%</span>
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {renderMetricInput(t("regulations_adherence"), "regulationsAdherence", 3)}
                            {renderMetricInput(t("safety_adherence"), "safetyAdherence", 3)}
                            {renderMetricInput(t("workplace_appearance"), "appearanceCommitment", 3)}
                            {renderMetricInput(t("resource_preservation"), "resourcePreservation", 3)}
                            {renderMetricInput(t("data_privacy"), "dataPrivacy", 3)}
                        </div>
                    </div>

                    {(modalType === 'UNIT' || modalType === 'DEPT') && (
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">{t('observer_comments')}</label>
                            <textarea
                                value={modalType === 'UNIT' ? unitForm.comments : deptForm.comments}
                                onChange={(e) => {
                                    if (modalType === 'UNIT') setUnitForm({ ...unitForm, comments: e.target.value });
                                    else setDeptForm({ ...deptForm, comments: e.target.value });
                                }}
                                className="w-full px-4 py-3 bg-slate-50 border-transparent rounded-xl focus:ring-2 focus:ring-slate-100 focus:bg-white transition-all text-slate-700 min-h-[80px]"
                                placeholder={t('add_feedback')}
                            />
                        </div>
                    )}

                    <div className="pt-4 border-t sticky bottom-0 bg-white pb-2 flex gap-4">
                        <button
                            type="button"
                            onClick={() => setIsModalOpen(false)}
                            className="flex-1 px-6 py-4 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 transition-all"
                        >
                            {t('cancel')}
                        </button>
                        <button
                            type="submit"
                            className={`flex-1 px-6 py-4 rounded-xl text-white font-bold shadow-lg transition-all hover:scale-[1.02] active:scale-95 bg-gradient-to-r ${theme.gradient}`}
                        >
                            {(modalType === 'UNIT' || modalType === 'DEPT') ? t('submit_assessment') : modalType === 'PERSONNEL' ? t('save_record') : t('finalize_lock')}
                        </button>
                    </div>
                </form>

                {modalType === 'PERSONNEL' && (
                    <div className="space-y-6 pt-4">
                        {/* Discipline & Incentives */}
                        <div className="space-y-4">
                            <h4 className="text-sm font-black text-slate-700 uppercase tracking-widest border-b pb-2">{t('activity_discipline')}</h4>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-500 uppercase">{t('warning_messages')}</label>
                                    <input type="number" min="0" max="3" value={persForm.warningMessages} onChange={e => setPersForm({ ...persForm, warningMessages: Number(e.target.value) })} className="w-full px-3 py-2 bg-slate-50 border-transparent rounded-lg font-bold" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-500 uppercase">{t('disciplinary_days')}</label>
                                    <input type="number" min="0" max="14" value={persForm.disciplinaryDeduction} onChange={e => setPersForm({ ...persForm, disciplinaryDeduction: Number(e.target.value) })} className="w-full px-3 py-2 bg-slate-50 border-transparent rounded-lg font-bold" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-500 uppercase">{t('appreciation_msg')}</label>
                                    <input type="number" min="0" max="3" value={persForm.appreciationMessages} onChange={e => setPersForm({ ...persForm, appreciationMessages: Number(e.target.value) })} className="w-full px-3 py-2 bg-slate-50 border-transparent rounded-lg font-bold" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-500 uppercase">{t('exceptional_days')}</label>
                                    <input type="number" min="0" max="30" value={persForm.exceptionalAssignments} onChange={e => setPersForm({ ...persForm, exceptionalAssignments: Number(e.target.value) })} className="w-full px-3 py-2 bg-slate-50 border-transparent rounded-lg font-bold" />
                                </div>
                            </div>
                        </div>

                        {/* Training */}
                        <div className="space-y-4">
                            <h4 className="text-sm font-black text-slate-700 uppercase tracking-widest border-b pb-2">{t('training_development')}</h4>
                            <div className="grid grid-cols-2 gap-4">
                                {[
                                    { label: t('specialized_training'), key: 'specializedTraining' },
                                    { label: t('supporting_training'), key: 'supportingTraining' },
                                    { label: t('language_courses'), key: 'languageTraining' },
                                    { label: t('software_electronic'), key: 'softwareTraining' },
                                ].map((item) => (
                                    <div key={item.key} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                                        <span className="text-xs font-bold text-slate-600 uppercase">{item.label}</span>
                                        <button
                                            type="button"
                                            onClick={() => setPersForm(prev => ({ ...prev, [item.key]: !prev[item.key as keyof typeof persForm] }))}
                                            className={`w-12 h-6 rounded-full transition-colors relative ${persForm[item.key as keyof typeof persForm] ? 'bg-indigo-500' : 'bg-slate-300'}`}
                                        >
                                            <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${persForm[item.key as keyof typeof persForm] ? 'translate-x-6' : ''}`} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </Modal>
        </div >
    );
};

export default EvaluationsPage;
