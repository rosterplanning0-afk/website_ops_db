'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, Legend, AreaChart, Area,
} from 'recharts'
import {
    BarChart3, PieChart as PieIcon, TrendingUp, UserCheck, Users,
    Download, Search, FileText, ChevronDown, ChevronUp, CheckCircle2, XCircle, CircleDashed
} from 'lucide-react'
import * as XLSX from 'xlsx'

const COLORS = ['#dc2626', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316']

interface Inspection {
    id: number
    employee_id: string
    inspection_date: string
    part_a_total: number
    part_b_total: number
    part_c_total: number
    part_d_total: number
    overall_total: number
    inspected_by_name: string | null
    inspected_by_role: string | null
}

interface Employee {
    employee_id: string
    name: string
    designation: string | null
    department: string | null
}

interface InspectionStatsClientProps {
    initialInspections: Inspection[]
    initialEmployees: Employee[]
    userRole: string
    userDept: string
    isLineInspector: boolean
}

export function InspectionStatsClient({ 
    initialInspections, 
    initialEmployees, 
    userRole, 
    userDept, 
    isLineInspector 
}: InspectionStatsClientProps) {
    const [dateFrom, setDateFrom] = useState('')
    const [dateTo, setDateTo] = useState('')
    const inspections = initialInspections.filter(i => {
        if (dateFrom && i.inspection_date < dateFrom) return false
        if (dateTo && i.inspection_date > dateTo) return false
        return true
    })
    const employees = initialEmployees

    // Tabs & View states
    const isRestricted = userRole === 'employee' && isLineInspector
    const [activeTab, setActiveTab] = useState<'dashboard' | 'employee' | 'designation'>(isRestricted ? 'employee' : 'dashboard')
    
    // Employee Detailed Report State
    const [selectedDesignationDetailed, setSelectedDesignationDetailed] = useState<string>('Train Operator')
    const [selectedEmployeeId, setSelectedEmployeeId] = useState('')
    const [employeeInspections, setEmployeeInspections] = useState<any[]>([])
    const [loadingEmployee, setLoadingEmployee] = useState(false)
    const [expandedInspectionId, setExpandedInspectionId] = useState<number | null>(null)

    // Designation Summary State
    const [selectedDesignationSummary, setSelectedDesignationSummary] = useState<string>('Train Operator')

    // Fetch inspections with individual scores for detailed report
    useEffect(() => {
        if (!selectedEmployeeId) {
            setEmployeeInspections([])
            return
        }
        const isValid = employees.some(e => e.employee_id === selectedEmployeeId)
        if (!isValid) return

        async function fetchEmpInspections() {
            setLoadingEmployee(true)
            const supabase = createClient()
            const { data } = await supabase
                .from('footplate_inspections')
                .select('*, inspection_scores(*)')
                .eq('employee_id', selectedEmployeeId)
                .order('inspection_date', { ascending: false })
            if (data) {
                setEmployeeInspections(data)
            } else {
                setEmployeeInspections([])
            }
            setLoadingEmployee(false)
        }
        fetchEmpInspections()
    }, [selectedEmployeeId, employees])

    const empMap = new Map(employees.map(e => [e.employee_id, e]))

    // ── Chart 1: Monthly inspection count trend ──
    const monthlyMap = new Map<string, number>()
    inspections.forEach(i => {
        const m = i.inspection_date.substring(0, 7) // YYYY-MM
        monthlyMap.set(m, (monthlyMap.get(m) || 0) + 1)
    })
    const monthlyData = [...monthlyMap.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .slice(-12)
        .map(([month, count]) => ({ month, count }))

    // ── Chart 2: Inspector performance (who did the most inspections) ──
    const inspectorMap = new Map<string, number>()
    inspections.forEach(i => {
        const name = i.inspected_by_name || 'Unknown'
        inspectorMap.set(name, (inspectorMap.get(name) || 0) + 1)
    })
    const inspectorData = [...inspectorMap.entries()]
        .map(([name, count]) => ({ name: name.length > 15 ? name.slice(0, 15) + '…' : name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10)

    // ── Chart 3: Inspector role distribution (pie) ──
    const roleMap = new Map<string, number>()
    inspections.forEach(i => {
        const role = i.inspected_by_role || 'Unknown'
        roleMap.set(role, (roleMap.get(role) || 0) + 1)
    })
    const roleData = [...roleMap.entries()].map(([name, value]) => ({ name, value }))

    // ── Chart 4: Average score by employee (top 15, bar chart) ──
    const empScoreMap = new Map<string, { total: number; count: number }>()
    inspections.forEach(i => {
        const prev = empScoreMap.get(i.employee_id) || { total: 0, count: 0 }
        empScoreMap.set(i.employee_id, { total: prev.total + (i.overall_total || 0), count: prev.count + 1 })
    })
    const empScoreData = [...empScoreMap.entries()]
        .map(([id, { total, count }]) => ({
            name: empMap.get(id)?.name || id,
            avg: Math.round((total / count) * 10) / 10,
            count,
        }))
        .sort((a, b) => a.avg - b.avg) // lowest first = most attention needed
        .slice(0, 15)

    // Restrict summary selection to 'Train Operator' and 'Train Attendant' as requested
    const availableDesignations = ['Train Operator', 'Train Attendant']

    // Compute employee performance averages for the selected designation
    const employeeDesignationStats = employees
        .filter(emp => emp.designation === selectedDesignationSummary)
        .map(emp => {
            const empInspections = inspections.filter(i => i.employee_id === emp.employee_id)
            if (empInspections.length === 0) return null

            const total = empInspections.length
            const partA = empInspections.reduce((sum, i) => sum + (i.part_a_total || 0), 0)
            const partB = empInspections.reduce((sum, i) => sum + (i.part_b_total || 0), 0)
            const partC = empInspections.reduce((sum, i) => sum + (i.part_c_total || 0), 0)
            const partD = empInspections.reduce((sum, i) => sum + (i.part_d_total || 0), 0)
            const overall = empInspections.reduce((sum, i) => sum + (i.overall_total || 0), 0)

            return {
                employee_id: emp.employee_id,
                name: emp.name,
                designation: emp.designation,
                totalInspections: total,
                avgDriving: partA / total,
                avgSafety: partB / total,
                avgComm: partC / total,
                avgGen: partD / total,
                avgOverall: overall / total,
            }
        })
        .filter((stat): stat is NonNullable<typeof stat> => stat !== null)
        .sort((a, b) => b.avgOverall - a.avgOverall)

    // Excel export for a specific employee detailed report
    function downloadEmployeeDetailedExcel() {
        if (employeeInspections.length === 0) return
        const emp = empMap.get(selectedEmployeeId)
        const empName = emp?.name || selectedEmployeeId
        const designation = emp?.designation || 'Unknown'
        
        const exportRows: any[] = []

        employeeInspections.forEach(insp => {
            const scores = insp.inspection_scores || []
            scores.forEach((s: any) => {
                exportRows.push({
                    'Employee ID': selectedEmployeeId,
                    'Employee Name': empName,
                    'Designation': designation,
                    'Inspection Date': insp.inspection_date,
                    'Inspected By': insp.inspected_by_name || '—',
                    'Inspector Role': insp.inspected_by_role || '—',
                    'Section Total (Driving /3)': insp.part_a_total ?? 0,
                    'Section Total (Safety /3)': insp.part_b_total ?? 0,
                    'Section Total (Comm /2)': insp.part_c_total ?? 0,
                    'Section Total (Gen /2)': insp.part_d_total ?? 0,
                    'Overall Score (/10)': insp.overall_total ?? 0,
                    'Section': s.section || s.part,
                    'Item No': s.item_no,
                    'Question Text': s.item_text || '',
                    'Marks Awarded': s.marks_awarded,
                    'Status': s.marks_awarded === 1 ? 'OK' : 'NOT OK',
                    'Remark': s.remark || '—',
                })
            })
        })

        const ws = XLSX.utils.json_to_sheet(exportRows)
        const wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wb, ws, 'Detailed Report')
        XLSX.writeFile(wb, `detailed_inspection_${selectedEmployeeId}_${new Date().toISOString().split('T')[0]}.xlsx`)
    }

    // Excel export for designation summary
    function downloadDesignationSummaryExcel() {
        if (employeeDesignationStats.length === 0) return
        const exportRows = employeeDesignationStats.map(s => ({
            'Employee ID': s.employee_id,
            'Name': s.name,
            'Designation': s.designation || 'Unknown',
            'Avg. Driving (/3)': Number(s.avgDriving.toFixed(2)),
            'Avg. Safety (/3)': Number(s.avgSafety.toFixed(2)),
            'Avg. Comm (/2)': Number(s.avgComm.toFixed(2)),
            'Avg. Gen (/2)': Number(s.avgGen.toFixed(2)),
            'Avg. Overall (/10)': Number(s.avgOverall.toFixed(2)),
            'Total Inspections': s.totalInspections,
        }))

        const wsSummary = XLSX.utils.json_to_sheet(exportRows)
        const wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wb, wsSummary, `${selectedDesignationSummary || 'Designation'} Summary`)

        // Add detailed sheet
        const detailedInspections = inspections.filter(i => {
            const emp = empMap.get(i.employee_id)
            return emp?.designation === selectedDesignationSummary
        })

        const detailedRows = detailedInspections.map(insp => {
            const emp = empMap.get(insp.employee_id)
            return {
                'Inspection Date': insp.inspection_date,
                'Employee ID': insp.employee_id,
                'Employee Name': emp?.name || insp.employee_id,
                'Designation': emp?.designation || '—',
                'Inspector Name': insp.inspected_by_name || '—',
                'Inspector Role': insp.inspected_by_role || '—',
                'Part A (Driving)': insp.part_a_total || 0,
                'Part B (Safety)': insp.part_b_total || 0,
                'Part C (Comm)': insp.part_c_total || 0,
                'Part D (General)': insp.part_d_total || 0,
                'Overall Score': insp.overall_total || 0,
            }
        })

        const wsDetailed = XLSX.utils.json_to_sheet(detailedRows)
        XLSX.utils.book_append_sheet(wb, wsDetailed, 'Detailed Inspections')

        XLSX.writeFile(wb, `${(selectedDesignationSummary || 'designation').toLowerCase().replace(/\s+/g, '_')}_summary_${new Date().toISOString().split('T')[0]}.xlsx`)
    }

    // Helper to render section questions details inside the UI
    // Excel export for all fetched inspections
    function downloadAllInspectionsExcel() {
        if (inspections.length === 0) return
        const exportRows = inspections.map(insp => {
            const emp = empMap.get(insp.employee_id)
            return {
                'Inspection Date': insp.inspection_date,
                'Employee ID': insp.employee_id,
                'Employee Name': emp?.name || insp.employee_id,
                'Designation': emp?.designation || '—',
                'Inspector Name': insp.inspected_by_name || '—',
                'Inspector Role': insp.inspected_by_role || '—',
                'Part A (Driving)': insp.part_a_total || 0,
                'Part B (Safety)': insp.part_b_total || 0,
                'Part C (Comm)': insp.part_c_total || 0,
                'Part D (General)': insp.part_d_total || 0,
                'Overall Score': insp.overall_total || 0,
            }
        })
        const ws = XLSX.utils.json_to_sheet(exportRows)
        const wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wb, ws, 'All Inspections')
        XLSX.writeFile(wb, `all_inspections_${new Date().toISOString().split('T')[0]}.xlsx`)
    }

    function renderInspectionDetailsSection(title: string, scores: any[], maxScore: number, partCode: string) {
        const sectionScores = scores.filter(s => s.part === partCode)
        if (sectionScores.length === 0) return null

        const okCount = sectionScores.filter(s => s.marks_awarded === 1).length
        const totalCount = sectionScores.length
        const proportionScore = totalCount > 0 ? (okCount / totalCount) * maxScore : 0

        return (
            <div className="bg-slate-50 rounded-lg p-4 border border-slate-100 space-y-2">
                <div className="flex justify-between items-center border-b pb-2 mb-2">
                    <span className="font-bold text-sm text-slate-800">{title}</span>
                    <span className="text-xs font-semibold bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full">
                        Score: {proportionScore.toFixed(2)}/{maxScore}
                    </span>
                </div>
                <div className="space-y-2 max-h-[180px] overflow-y-auto pr-1">
                    {sectionScores.map((s, idx) => (
                        <div key={idx} className="text-xs flex flex-col gap-1 py-1.5 border-b border-dashed border-slate-100 last:border-b-0">
                            <div className="flex justify-between items-start gap-4">
                                <span className="text-slate-700 font-medium leading-normal">{s.item_text}</span>
                                <span className={`font-bold shrink-0 ${s.marks_awarded === 1 ? 'text-green-600' : 'text-red-600'}`}>
                                    {s.marks_awarded === 1 ? 'OK' : 'NOT OK'}
                                </span>
                            </div>
                            {s.marks_awarded === 0 && (
                                <div className="text-[11px] bg-red-50 text-red-700 border border-red-100 rounded px-2 py-1 italic mt-1">
                                    Remark: {s.remark || 'No remark provided'}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        )
    }

    // ── Table: Recent inspections ──
    const recentInspections = inspections.slice(0, 20)

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800">Inspection Reports & Analytics</h2>
                    <p className="text-slate-500 text-sm mt-0.5">View aggregated metrics, employee reports, or designation summaries.</p>
                </div>
                <div className="flex items-center gap-4 bg-slate-50 p-2 rounded-md border border-slate-200">
                    <div className="flex items-center gap-2">
                        <Label htmlFor="date-from" className="text-sm font-semibold text-slate-700 whitespace-nowrap">From:</Label>
                        <input 
                            type="date" 
                            id="date-from"
                            value={dateFrom} 
                            onChange={e => setDateFrom(e.target.value)}
                            className="border border-slate-300 rounded-md p-1.5 text-sm bg-white"
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <Label htmlFor="date-to" className="text-sm font-semibold text-slate-700 whitespace-nowrap">To:</Label>
                        <input 
                            type="date" 
                            id="date-to"
                            value={dateTo} 
                            onChange={e => setDateTo(e.target.value)}
                            className="border border-slate-300 rounded-md p-1.5 text-sm bg-white"
                        />
                    </div>
                </div>
            </div>

            {/* Tabs Selector */}
            <div className="flex border-b border-slate-200 gap-2">
                {!isRestricted && (
                    <button
                        onClick={() => setActiveTab('dashboard')}
                        className={`px-4 py-2 text-sm font-semibold border-b-2 transition-all flex items-center gap-2 ${
                            activeTab === 'dashboard'
                                ? 'border-blue-600 text-blue-600'
                                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                        }`}
                    >
                        <BarChart3 className="h-4 w-4" /> Dashboard & Charts
                    </button>
                )}
                <button
                    onClick={() => setActiveTab('employee')}
                    className={`px-4 py-2 text-sm font-semibold border-b-2 transition-all flex items-center gap-2 ${
                        activeTab === 'employee'
                            ? 'border-blue-600 text-blue-600'
                            : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                    }`}
                >
                    <Users className="h-4 w-4" /> Detailed Employee Report
                </button>
                <button
                    onClick={() => setActiveTab('designation')}
                    className={`px-4 py-2 text-sm font-semibold border-b-2 transition-all flex items-center gap-2 ${
                        activeTab === 'designation'
                            ? 'border-blue-600 text-blue-600'
                            : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                    }`}
                >
                    <FileText className="h-4 w-4" /> Designation Summary
                </button>
            </div>

            {/* ═════════════════════════════════════════════════════════════════════════ */}
            {/* VIEW 1: DASHBOARD & CHARTS                                                */}
            {/* ═════════════════════════════════════════════════════════════════════════ */}
            {activeTab === 'dashboard' && !isRestricted && (
                <>
                    {/* Row 1: Monthly Trend + Role Distribution */}
                    <div className="grid gap-6 lg:grid-cols-3">
                        <Card className="lg:col-span-2">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2"><TrendingUp className="h-5 w-5" /> Monthly Inspection Trend</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <ResponsiveContainer width="100%" height={280}>
                                    <AreaChart data={monthlyData}>
                                        <defs>
                                            <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#dc2626" stopOpacity={0.3} />
                                                <stop offset="95%" stopColor="#dc2626" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                        <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                                        <YAxis tick={{ fontSize: 12 }} />
                                        <Tooltip />
                                        <Area type="monotone" dataKey="count" stroke="#dc2626" fillOpacity={1} fill="url(#colorCount)" strokeWidth={2} />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2"><PieIcon className="h-5 w-5" /> By Inspector Role</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <ResponsiveContainer width="100%" height={280}>
                                    <PieChart>
                                        <Pie data={roleData} cx="50%" cy="50%" outerRadius={90} dataKey="value" label={(entry: any) => entry.name}>
                                            {roleData.map((_, i) => (
                                                <Cell key={i} fill={COLORS[i % COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <Tooltip />
                                        <Legend />
                                    </PieChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Row 2: Inspector Performance + Employee Scores */}
                    <div className="grid gap-6 lg:grid-cols-2">
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2"><UserCheck className="h-5 w-5 text-blue-500" /> Inspector Performance</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <ResponsiveContainer width="100%" height={320}>
                                    <BarChart data={inspectorData} layout="vertical" margin={{ left: 10 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                        <XAxis type="number" tick={{ fontSize: 12 }} />
                                        <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={120} />
                                        <Tooltip />
                                        <Bar dataKey="count" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5 text-amber-500" /> Employee Avg. Score (Needs Attention)</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <ResponsiveContainer width="100%" height={320}>
                                    <BarChart data={empScoreData} layout="vertical" margin={{ left: 10 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                        <XAxis type="number" tick={{ fontSize: 12 }} />
                                        <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={120} />
                                        <Tooltip />
                                        <Bar dataKey="avg" radius={[0, 4, 4, 0]}>
                                            {empScoreData.map((entry, i) => (
                                                <Cell key={i} fill={entry.avg < 5 ? '#dc2626' : entry.avg < 8 ? '#f59e0b' : '#10b981'} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>
                    </div>

                {/* Recent Inspections Table */}
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                        <CardTitle className="flex items-center gap-2"><BarChart3 className="h-5 w-5" /> All Inspections ({inspections.length})</CardTitle>
                        <Button variant="outline" size="sm" onClick={downloadAllInspectionsExcel} disabled={inspections.length === 0}>
                            <Download className="h-4 w-4 mr-2" />
                            Export Excel
                        </Button>
                    </CardHeader>
                        <CardContent>
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Date</TableHead>
                                            <TableHead>Employee</TableHead>
                                            <TableHead>Designation</TableHead>
                                            <TableHead>Score</TableHead>
                                            <TableHead>Inspector</TableHead>
                                            <TableHead>Role</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {inspections.map(insp => {
                                            const emp = empMap.get(insp.employee_id)
                                            return (
                                                <TableRow key={insp.id}>
                                                    <TableCell className="text-sm">{new Date(insp.inspection_date).toLocaleDateString('en-IN')}</TableCell>
                                                    <TableCell className="font-medium">{emp?.name || insp.employee_id}</TableCell>
                                                    <TableCell className="text-sm">{emp?.designation || '—'}</TableCell>
                                                    <TableCell>
                                                        <span className={`text-sm font-bold ${(insp.overall_total || 0) < 5 ? 'text-red-600' : (insp.overall_total || 0) < 8 ? 'text-amber-600' : 'text-green-600'}`}>
                                                            {(insp.overall_total ?? 0).toFixed(2)}
                                                        </span>
                                                    </TableCell>
                                                    <TableCell className="text-sm">{insp.inspected_by_name || '—'}</TableCell>
                                                    <TableCell className="text-xs text-slate-500">{insp.inspected_by_role || '—'}</TableCell>
                                                </TableRow>
                                            )
                                        })}
                                        {inspections.length === 0 && (
                                            <TableRow>
                                                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No inspections found.</TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                </>
            )}

            {/* ═════════════════════════════════════════════════════════════════════════ */}
            {/* VIEW 2: DETAILED EMPLOYEE REPORT                                         */}
            {/* ═════════════════════════════════════════════════════════════════════════ */}
            {activeTab === 'employee' && (
                <div className="space-y-6">
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base flex items-center gap-2">
                                <Search className="h-4 w-4 text-blue-600" />
                                Search Operator Detailed Inspections
                            </CardTitle>
                            <CardDescription>
                                Select a train operator to view all past assessments, detailed item marks, and remarks.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="pt-2">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                                <div className="space-y-1.5">
                                    <Label htmlFor="designation-detailed-select">Select Designation</Label>
                                    <select
                                        id="designation-detailed-select"
                                        className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                                        value={selectedDesignationDetailed}
                                        onChange={e => {
                                            setSelectedDesignationDetailed(e.target.value)
                                            setSelectedEmployeeId('')
                                            setEmployeeInspections([])
                                            setExpandedInspectionId(null)
                                        }}
                                    >
                                        {availableDesignations.map(d => (
                                            <option key={d} value={d}>{d}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="employee-detailed-select">Select Employee</Label>
                                    <select
                                        id="employee-detailed-select"
                                        className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                                        value={selectedEmployeeId}
                                        onChange={e => {
                                            setSelectedEmployeeId(e.target.value)
                                            setExpandedInspectionId(null)
                                        }}
                                    >
                                        <option value="">-- Select Employee --</option>
                                        {employees
                                            .filter(e => e.designation === selectedDesignationDetailed)
                                            .sort((a, b) => a.name.localeCompare(b.name))
                                            .map(e => (
                                                <option key={e.employee_id} value={e.employee_id}>
                                                    {e.name} ({e.employee_id})
                                                </option>
                                            ))}
                                    </select>
                                </div>
                                <div>
                                    {selectedEmployeeId && employeeInspections.length > 0 ? (
                                        <Button
                                            onClick={downloadEmployeeDetailedExcel}
                                            className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2 w-full h-10 justify-center"
                                        >
                                            <Download className="h-4 w-4" /> Download Detailed Excel
                                        </Button>
                                    ) : (
                                        <div className="h-10" />
                                    )}
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Inspections timeline */}
                    {selectedEmployeeId && (
                        <div className="space-y-4">
                            {loadingEmployee ? (
                                <div className="text-center py-12 text-slate-500 flex items-center justify-center gap-2">
                                    <CircleDashed className="h-5 w-5 animate-spin text-blue-600" />
                                    Loading employee records...
                                </div>
                            ) : employeeInspections.length === 0 ? (
                                <div className="text-center py-12 bg-white border border-slate-100 rounded-lg text-slate-400">
                                    No inspections found for this employee ID.
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <h3 className="font-semibold text-slate-800 text-sm flex items-center gap-2 px-1">
                                        <span>All Footplate Inspections ({employeeInspections.length})</span>
                                        <span className="text-xs text-slate-400 font-normal">Click any inspection to view detailed scoring & remarks</span>
                                    </h3>

                                    {employeeInspections.map((insp) => {
                                        const isExpanded = expandedInspectionId === insp.id
                                        const notOkCount = insp.inspection_scores?.filter((s: any) => s.marks_awarded === 0).length || 0

                                        return (
                                            <Card key={insp.id} className="border-slate-200 overflow-hidden shadow-sm transition-all">
                                                {/* Header Bar */}
                                                <div
                                                    onClick={() => setExpandedInspectionId(isExpanded ? null : insp.id)}
                                                    className="px-5 py-4 cursor-pointer hover:bg-slate-50/50 flex flex-wrap justify-between items-center gap-4 transition-colors"
                                                >
                                                    <div className="flex items-center gap-3">
                                                        {isExpanded ? (
                                                            <ChevronUp className="h-5 w-5 text-slate-400 shrink-0" />
                                                        ) : (
                                                            <ChevronDown className="h-5 w-5 text-slate-400 shrink-0" />
                                                        )}
                                                        <div>
                                                            <span className="font-bold text-slate-800 text-sm">
                                                                {new Date(insp.inspection_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                            </span>
                                                            <span className="text-slate-400 text-xs mx-2">·</span>
                                                            <span className="text-slate-500 text-xs font-medium">Inspected by: {insp.inspected_by_name || '—'} ({insp.inspected_by_role || '—'})</span>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center gap-3 self-end sm:self-auto">
                                                        {notOkCount > 0 ? (
                                                            <span className="bg-red-50 text-red-700 border border-red-100 text-xs font-semibold px-2 py-0.5 rounded-full flex items-center gap-1">
                                                                <XCircle className="w-3 h-3 text-red-500" />
                                                                {notOkCount} Issue{notOkCount > 1 ? 's' : ''}
                                                            </span>
                                                        ) : (
                                                            <span className="bg-green-50 text-green-700 border border-green-100 text-xs font-semibold px-2 py-0.5 rounded-full flex items-center gap-1">
                                                                <CheckCircle2 className="w-3 h-3 text-green-500" />
                                                                Perfect OK
                                                            </span>
                                                        )}
                                                        <span className={`text-sm font-bold px-3 py-1 rounded-full ${
                                                            insp.overall_total < 5 ? 'bg-red-100 text-red-800' :
                                                            insp.overall_total < 8 ? 'bg-amber-100 text-amber-800' :
                                                            'bg-green-100 text-green-800'
                                                        }`}>
                                                            Overall: {(insp.overall_total ?? 0).toFixed(2)}/10
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* Expanded Details Panel */}
                                                {isExpanded && (
                                                    <CardContent className="border-t border-slate-100 pt-5 space-y-6">
                                                        {/* Section Scores Breakdown Card */}
                                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                                            <div className="bg-slate-50 border rounded p-3 text-center">
                                                                <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Driving Skill</span>
                                                                <div className="text-lg font-bold text-slate-800 mt-0.5">{(insp.part_a_total ?? 0).toFixed(2)}/3</div>
                                                            </div>
                                                            <div className="bg-slate-50 border rounded p-3 text-center">
                                                                <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Safety</span>
                                                                <div className="text-lg font-bold text-slate-800 mt-0.5">{(insp.part_b_total ?? 0).toFixed(2)}/3</div>
                                                            </div>
                                                            <div className="bg-slate-50 border rounded p-3 text-center">
                                                                <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Communication</span>
                                                                <div className="text-lg font-bold text-slate-800 mt-0.5">{(insp.part_c_total ?? 0).toFixed(2)}/2</div>
                                                            </div>
                                                            <div className="bg-slate-50 border rounded p-3 text-center">
                                                                <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">General</span>
                                                                <div className="text-lg font-bold text-slate-800 mt-0.5">{(insp.part_d_total ?? 0).toFixed(2)}/2</div>
                                                            </div>
                                                        </div>

                                                        {/* Question Details Grid */}
                                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                                            {renderInspectionDetailsSection('Driving Skill', insp.inspection_scores || [], 3, 'A')}
                                                            {renderInspectionDetailsSection('Safety', insp.inspection_scores || [], 3, 'B')}
                                                            {renderInspectionDetailsSection('Communication', insp.inspection_scores || [], 2, 'C')}
                                                            {renderInspectionDetailsSection('General', insp.inspection_scores || [], 2, 'D')}
                                                        </div>

                                                        {/* Written Observations */}
                                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-slate-100">
                                                            <div className="text-xs bg-slate-50/50 border rounded-lg p-3">
                                                                <span className="font-bold text-slate-800 block mb-1">Observations</span>
                                                                <p className="text-slate-600 leading-relaxed whitespace-pre-line">{insp.observations || '—'}</p>
                                                            </div>
                                                            <div className="text-xs bg-red-50/30 border border-red-100 rounded-lg p-3">
                                                                <span className="font-bold text-red-800 block mb-1">Defects Identified</span>
                                                                <p className="text-red-700 leading-relaxed whitespace-pre-line">{insp.defects_identified || '—'}</p>
                                                            </div>
                                                            <div className="text-xs bg-green-50/30 border border-green-100 rounded-lg p-3">
                                                                <span className="font-bold text-green-800 block mb-1">Corrective Actions Required</span>
                                                                <p className="text-green-700 leading-relaxed whitespace-pre-line">{insp.corrective_actions || '—'}</p>
                                                            </div>
                                                        </div>
                                                    </CardContent>
                                                )}
                                            </Card>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* ═════════════════════════════════════════════════════════════════════════ */}
            {/* VIEW 3: SUMMARIZED DESIGNATION REPORT                                     */}
            {/* ═════════════════════════════════════════════════════════════════════════ */}
            {activeTab === 'designation' && (
                <div className="space-y-6">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between border-b pb-4 flex-wrap gap-4">
                            <div className="space-y-1">
                                <CardTitle className="text-base flex items-center gap-2">
                                    <FileText className="h-5 w-5 text-blue-600" />
                                    Designation Performance Summary
                                </CardTitle>
                                <CardDescription>
                                    Aggregated metrics and section score averages for employees in the selected designation.
                                </CardDescription>
                            </div>
                            <div className="flex items-center gap-4 flex-wrap">
                                <div className="flex items-center gap-2">
                                    <Label htmlFor="designation-summary-select" className="text-xs font-semibold text-slate-600 whitespace-nowrap">Designation:</Label>
                                    <select
                                        id="designation-summary-select"
                                        className="flex h-9 rounded-md border border-slate-200 bg-white px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent min-w-[180px]"
                                        value={selectedDesignationSummary}
                                        onChange={e => setSelectedDesignationSummary(e.target.value)}
                                    >
                                        {availableDesignations.map(d => (
                                            <option key={d} value={d}>{d}</option>
                                        ))}
                                    </select>
                                </div>
                                <Button
                                    onClick={downloadDesignationSummaryExcel}
                                    disabled={employeeDesignationStats.length === 0}
                                    className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2 h-9"
                                >
                                    <Download className="h-4 w-4" /> Export Summary Excel
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            {selectedDesignationSummary === '' ? (
                                <p className="text-sm text-slate-500 text-center py-12">Please select a designation to view the performance summary report.</p>
                            ) : employeeDesignationStats.length === 0 ? (
                                <p className="text-sm text-slate-500 text-center py-12">No inspection data available for designation "{selectedDesignationSummary}".</p>
                            ) : (
                                <div className="overflow-x-auto">
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="bg-slate-50/80">
                                                <TableHead>Employee ID</TableHead>
                                                <TableHead>Name</TableHead>
                                                <TableHead>Designation</TableHead>
                                                <TableHead className="text-center">Avg. Driving (/3)</TableHead>
                                                <TableHead className="text-center">Avg. Safety (/3)</TableHead>
                                                <TableHead className="text-center">Avg. Comm (/2)</TableHead>
                                                <TableHead className="text-center">Avg. Gen (/2)</TableHead>
                                                <TableHead className="text-center">Avg. Overall (/10)</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {employeeDesignationStats.map((stat, idx) => (
                                                <TableRow key={idx}>
                                                    <TableCell className="font-mono text-slate-600 text-sm">{stat.employee_id}</TableCell>
                                                    <TableCell className="font-semibold text-slate-800">{stat.name}</TableCell>
                                                    <TableCell className="text-sm text-slate-600">{stat.designation || '—'}</TableCell>
                                                    <TableCell className="text-center font-mono">{stat.avgDriving.toFixed(2)}</TableCell>
                                                    <TableCell className="text-center font-mono">{stat.avgSafety.toFixed(2)}</TableCell>
                                                    <TableCell className="text-center font-mono">{stat.avgComm.toFixed(2)}</TableCell>
                                                    <TableCell className="text-center font-mono">{stat.avgGen.toFixed(2)}</TableCell>
                                                    <TableCell className="text-center">
                                                        <span className={`font-bold px-2 py-0.5 rounded ${
                                                            stat.avgOverall < 5 ? 'bg-red-50 text-red-700' :
                                                            stat.avgOverall < 8 ? 'bg-amber-50 text-amber-700' :
                                                            'bg-green-50 text-green-700'
                                                        }`}>
                                                            {stat.avgOverall.toFixed(2)}
                                                        </span>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    )
}
