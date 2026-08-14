'use client'

import { useState, useCallback } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { BookOpen, Clock, AlertTriangle, CheckCircle2, History, Download } from 'lucide-react'
import * as XLSX from 'xlsx'
import { DEPT_CREW_MAPPING } from '@/lib/rbac'

const DEPARTMENTS = Object.keys(DEPT_CREW_MAPPING)

type ReportType = 'expiring' | 'expired' | 'active' | 'history'

const REPORT_TYPES: {
    id: ReportType
    label: string
    Icon: React.ElementType
    description: string
    color: string
}[] = [
    {
        id: 'expiring',
        label: 'Expiring Competencies',
        Icon: Clock,
        description: 'Active roles expiring within a chosen threshold',
        color: 'amber',
    },
    {
        id: 'expired',
        label: 'Expired Competencies',
        Icon: AlertTriangle,
        description: 'Active records whose validity has already lapsed',
        color: 'red',
    },
    {
        id: 'active',
        label: 'Active Register',
        Icon: CheckCircle2,
        description: 'All currently active competency assignments',
        color: 'green',
    },
    {
        id: 'history',
        label: 'Full History',
        Icon: History,
        description: 'Complete competency timeline for all or one employee',
        color: 'blue',
    },
]

interface ProcessedRow {
    id: string
    employee_id: string
    empName: string
    department: string
    designation: string
    valid_from: string
    valid_till: string | null
    is_active: boolean
    daysLeft: number | null
}

interface CompetencyClientProps {
    userRole: string
    userDept: string
    allEmployees: { employee_id: string; name: string }[]
    allowedEmpIds: string[] | null
}

export function CompetencyClient({ userRole, userDept, allEmployees, allowedEmpIds }: CompetencyClientProps) {
    const [reportType, setReportType] = useState<ReportType>('expiring')
    const [department, setDepartment] = useState('all')
    const [designation, setDesignation] = useState('all')
    const [threshold, setThreshold] = useState('90')
    const [empFilter, setEmpFilter] = useState('')
    const [month, setMonth] = useState('')

    const [rows, setRows] = useState<ProcessedRow[]>([])
    const [loading, setLoading] = useState(false)
    const [generated, setGenerated] = useState(false)

    const allowedEmpIdsSet = allowedEmpIds ? new Set(allowedEmpIds) : null

    const designationOptions =
        department !== 'all' && DEPT_CREW_MAPPING[department]
            ? DEPT_CREW_MAPPING[department]
            : Array.from(new Set(Object.values(DEPT_CREW_MAPPING).flat()))

    const generateReport = useCallback(async () => {
        setLoading(true)
        setGenerated(true)
        const supabase = createClient()
        const today = new Date()
        const todayStr = today.toISOString().split('T')[0]

        let query = supabase
            .from('employee_competencies')
            .select('*')

        if (month) {
            const year = parseInt(month.split('-')[0])
            const m = parseInt(month.split('-')[1])
            const lastDay = new Date(year, m, 0).getDate()
            const monthStart = `${month}-01`
            const monthEnd = `${month}-${lastDay}`

            if (reportType === 'history' || reportType === 'active') {
                query = query.gte('valid_from', monthStart).lte('valid_from', monthEnd)
            } else {
                query = query.gte('valid_till', monthStart).lte('valid_till', monthEnd)
            }
        } else {
            if (reportType === 'expiring') {
                const cutoff = new Date(today.getTime() + parseInt(threshold) * 86400000)
                    .toISOString().split('T')[0]
                query = query.gte('valid_till', todayStr).lte('valid_till', cutoff)
            } else if (reportType === 'expired') {
                query = query.not('valid_till', 'is', null).lt('valid_till', todayStr)
            } else if (reportType === 'active') {
                query = query.or(`valid_till.gte.${todayStr},valid_till.is.null`)
            }
        }

        if (department !== 'all') query = query.eq('department', department)
        if (designation !== 'all') query = query.eq('designation', designation)
        if (reportType === 'history' && empFilter) query = query.eq('employee_id', empFilter)

        if (reportType === 'expiring' || reportType === 'expired') {
            query = query.order('valid_till', { ascending: true })
        } else {
            query = query.order('valid_from', { ascending: false })
        }

        const { data } = await query

        const nameMap = new Map(allEmployees.map(e => [e.employee_id, e.name]))

        const processed: ProcessedRow[] = (data || [])
            .map((c: any) => ({
                id: c.id,
                employee_id: c.employee_id,
                empName: nameMap.get(c.employee_id) || c.employee_id,
                department: c.department,
                designation: c.designation,
                valid_from: c.valid_from,
                valid_till: c.valid_till,
                is_active: c.valid_till 
                    ? (new Date(c.valid_till).getTime() >= new Date().setHours(0,0,0,0)) 
                    : true,
                daysLeft: c.valid_till
                    ? Math.ceil((new Date(c.valid_till).getTime() - today.getTime()) / 86400000)
                    : null,
            }))
            .filter((r: ProcessedRow) => !allowedEmpIdsSet || allowedEmpIdsSet.has(r.employee_id))

        setRows(processed)
        setLoading(false)
    }, [reportType, department, designation, threshold, empFilter, month, allowedEmpIdsSet, allEmployees])

    function downloadExcel() {
        if (rows.length === 0) return
        const sheetData = rows.map(r => ({
            'Employee ID': r.employee_id,
            'Name': r.empName,
            'Department': r.department,
            'Designation': r.designation,
            'Valid From': r.valid_from,
            'Valid Till': r.valid_till || '—',
            'Days to Expire': r.daysLeft !== null ? r.daysLeft : '—',
            'Active': r.is_active ? 'Yes' : 'No',
        }))
        const ws = XLSX.utils.json_to_sheet(sheetData)
        const wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wb, ws, 'Competency Report')
        XLSX.writeFile(wb, `competency_${reportType}_${new Date().toISOString().split('T')[0]}.xlsx`)
    }

    const selectedReport = REPORT_TYPES.find(r => r.id === reportType)!
    const showDaysCol = true

    const colorMap: Record<string, { border: string; bg: string; icon: string; text: string }> = {
        amber: { border: 'border-amber-400', bg: 'bg-amber-50', icon: 'text-amber-500', text: 'text-amber-700' },
        red: { border: 'border-red-400', bg: 'bg-red-50', icon: 'text-red-500', text: 'text-red-700' },
        green: { border: 'border-green-500', bg: 'bg-green-50', icon: 'text-green-600', text: 'text-green-700' },
        blue: { border: 'border-blue-400', bg: 'bg-blue-50', icon: 'text-blue-500', text: 'text-blue-700' },
    }

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold text-slate-800">Competency Reports</h2>

            {/* Report type selector cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {REPORT_TYPES.map(rt => {
                    const active = reportType === rt.id
                    const c = colorMap[rt.color]
                    return (
                        <button
                            key={rt.id}
                            onClick={() => { setReportType(rt.id); setRows([]); setGenerated(false) }}
                            className={`text-left p-4 rounded-lg border-2 transition-all ${
                                active
                                    ? `${c.border} ${c.bg}`
                                    : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                            }`}
                        >
                            <rt.Icon className={`h-5 w-5 mb-2 ${active ? c.icon : 'text-slate-400'}`} />
                            <p className={`text-sm font-semibold leading-tight ${active ? c.text : 'text-slate-700'}`}>
                                {rt.label}
                            </p>
                            <p className="text-xs text-slate-500 mt-1 leading-snug">{rt.description}</p>
                        </button>
                    )
                })}
            </div>

            {/* Filters */}
            <Card>
                <CardHeader className="pb-3 border-b">
                    <CardTitle className="text-base flex items-center gap-2">
                        <selectedReport.Icon className="h-4 w-4" />
                        {selectedReport.label} — Filters
                    </CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {/* Department */}
                        <div className="space-y-1.5">
                            <Label>Department</Label>
                            <select
                                value={department}
                                onChange={e => { setDepartment(e.target.value); setDesignation('all') }}
                                className="w-full border border-input rounded-md p-2 text-sm bg-white"
                            >
                                <option value="all">All Departments</option>
                                {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                            </select>
                        </div>

                        {/* Designation */}
                        <div className="space-y-1.5">
                            <Label>Designation</Label>
                            <select
                                value={designation}
                                onChange={e => setDesignation(e.target.value)}
                                className="w-full border border-input rounded-md p-2 text-sm bg-white"
                            >
                                <option value="all">All Designations</option>
                                {designationOptions.map(d => <option key={d} value={d}>{d}</option>)}
                            </select>
                        </div>

                        {/* Month Filter */}
                        <div className="space-y-1.5">
                            <Label>Filter Month <span className="text-slate-400 font-normal text-xs">(optional)</span></Label>
                            <input 
                                type="month" 
                                value={month} 
                                onChange={e => { setMonth(e.target.value); setThreshold('90'); }}
                                className="w-full border border-input rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-400"
                            />
                        </div>

                        {/* Threshold (expiring only, hidden if month selected) */}
                        {reportType === 'expiring' && !month && (
                            <div className="space-y-1.5">
                                <Label>Expiry Threshold</Label>
                                <select
                                    value={threshold}
                                    onChange={e => setThreshold(e.target.value)}
                                    className="w-full border border-input rounded-md p-2 text-sm bg-white"
                                >
                                    <option value="30">Within 30 days</option>
                                    <option value="60">Within 60 days</option>
                                    <option value="90">Within 90 days</option>
                                    <option value="180">Within 180 days</option>
                                    <option value="365">Within 1 year</option>
                                </select>
                            </div>
                        )}

                        {/* Employee filter (history only) */}
                        {reportType === 'history' && (
                            <div className="space-y-1.5">
                                <Label>Employee <span className="text-slate-400 font-normal text-xs">(optional)</span></Label>
                                <input
                                    list="report-emp-list"
                                    placeholder="Type ID or name..."
                                    value={empFilter}
                                    onChange={e => setEmpFilter(e.target.value)}
                                    className="w-full border border-input rounded-md px-3 py-2 text-sm bg-yellow-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-400"
                                />
                                <datalist id="report-emp-list">
                                    {allEmployees.map(e => (
                                        <option key={e.employee_id} value={e.employee_id}>{e.name}</option>
                                    ))}
                                </datalist>
                            </div>
                        )}

                        {/* Generate button — always last */}
                        <div className="flex items-end">
                            <Button
                                onClick={generateReport}
                                disabled={loading}
                                className="w-full bg-red-600 hover:bg-red-700 text-white"
                            >
                                {loading ? 'Generating...' : 'Generate Report'}
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Results table */}
            {generated && (
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between border-b pb-3">
                        <CardTitle className="flex items-center gap-2 text-base">
                            <BookOpen className="h-5 w-5" />
                            Results
                            <span className="text-xs font-semibold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                                {rows.length} record{rows.length !== 1 ? 's' : ''}
                            </span>
                        </CardTitle>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={downloadExcel}
                            disabled={rows.length === 0 || loading}
                            className="flex items-center gap-1.5"
                        >
                            <Download className="h-4 w-4" /> Export Excel
                        </Button>
                    </CardHeader>
                    <CardContent className="p-0">
                        {loading ? (
                            <p className="text-sm text-muted-foreground text-center py-10">Generating...</p>
                        ) : rows.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-10">
                                No records match the selected filters.
                            </p>
                        ) : (
                            <div className="overflow-x-auto max-h-[520px] overflow-y-auto">
                                <Table>
                                    <TableHeader className="sticky top-0 bg-white z-10">
                                        <TableRow className="bg-slate-50">
                                            <TableHead>#</TableHead>
                                            <TableHead>Employee</TableHead>
                                            <TableHead>Department</TableHead>
                                            <TableHead>Designation</TableHead>
                                            <TableHead>Valid From</TableHead>
                                            <TableHead>Valid Till</TableHead>
                                            {showDaysCol && <TableHead>Days to Expire</TableHead>}
                                            <TableHead>Status</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {rows.map((r, idx) => (
                                            <TableRow key={r.id}>
                                                <TableCell className="text-xs text-slate-400 w-8">{idx + 1}</TableCell>
                                                <TableCell>
                                                    <div className="font-medium text-sm">{r.empName}</div>
                                                    <div className="text-xs text-slate-400 font-mono">{r.employee_id}</div>
                                                </TableCell>
                                                <TableCell className="text-sm">{r.department}</TableCell>
                                                <TableCell className="text-sm">{r.designation}</TableCell>
                                                <TableCell className="font-mono text-sm">{r.valid_from}</TableCell>
                                                <TableCell className="font-mono text-sm text-slate-500">
                                                    {r.valid_till || '—'}
                                                </TableCell>
                                                {showDaysCol && (
                                                    <TableCell>
                                                        {r.daysLeft !== null ? (
                                                            <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                                                                r.daysLeft < 0
                                                                    ? 'bg-slate-200 text-slate-600'
                                                                    : r.daysLeft <= 30
                                                                    ? 'bg-red-100 text-red-700'
                                                                    : r.daysLeft <= 60
                                                                    ? 'bg-amber-100 text-amber-700'
                                                                    : 'bg-green-100 text-green-700'
                                                            }`}>
                                                                {r.daysLeft < 0
                                                                    ? `${Math.abs(r.daysLeft)}d ago`
                                                                    : `${r.daysLeft}d`}
                                                            </span>
                                                        ) : '—'}
                                                    </TableCell>
                                                )}
                                                <TableCell>
                                                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                                                        r.is_active
                                                            ? 'bg-green-100 text-green-700'
                                                            : 'bg-slate-100 text-slate-500'
                                                    }`}>
                                                        {r.is_active ? 'Active' : 'Inactive'}
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
            )}
        </div>
    )
}
