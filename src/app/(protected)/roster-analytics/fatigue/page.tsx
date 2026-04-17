'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ShieldAlert, Clock, AlertTriangle, Award, TrendingUp, Search } from 'lucide-react'
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid,
    Tooltip, Legend, ResponsiveContainer,
    PieChart, Pie, Cell,
} from 'recharts'
import type { DailyRosterRow } from '@/lib/roster-utils'
import {
    NON_DUTY_CATEGORIES, classifyShift, calcWorkingHours, detectFatigueViolation,
} from '@/lib/roster-utils'

const CHART_COLORS = ['#3b82f6', '#22c55e', '#ef4444', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#64748b']

function formatDate(d: Date): string { return d.toISOString().split('T')[0] }
function getMonthStart(): string {
    const d = new Date(); d.setDate(1); return formatDate(d)
}

interface EmployeeDay {
    emp_id: string
    name: string
    date: string
    duty_category: string
    duty_code: string
    duty_code_raw: string
    shift_start: string | null
    shift_end: string | null
    shift_type: string
    crew_type: string
}

export default function FatigueManagementPage() {
    const [fromDate, setFromDate] = useState<string>(getMonthStart())
    const [toDate, setToDate] = useState<string>(formatDate(new Date()))
    const [crewFilter, setCrewFilter] = useState<string>('all')
    const [data, setData] = useState<DailyRosterRow[]>([])
    const [loading, setLoading] = useState(true)
    const [crewTypes, setCrewTypes] = useState<string[]>([])
    const [activeTab, setActiveTab] = useState<'grid' | 'hours' | 'compliance'>('grid')
    const [leaderboardSearch, setLeaderboardSearch] = useState('')
    const [sortKey, setSortKey] = useState<'name' | 'totalHours' | 'totalShifts' | 'violations'>('totalHours')
    const [sortAsc, setSortAsc] = useState(false)
    const supabase = createClient()

    useEffect(() => {
        async function fetchData() {
            setLoading(true)
            let allRows: DailyRosterRow[] = []
            let offset = 0
            const limit = 1000
            let hasMore = true

            while (hasMore) {
                const { data: rows, error } = await supabase
                    .from('v_daily_roster_summary')
                    .select('*')
                    .gte('date', fromDate)
                    .lte('date', toDate)
                    .order('date', { ascending: true })
                    .range(offset, offset + limit - 1)

                if (error || !rows) {
                    hasMore = false
                } else {
                    allRows = [...allRows, ...(rows as DailyRosterRow[])]
                    if (rows.length < limit) {
                        hasMore = false
                    } else {
                        offset += limit
                    }
                }
            }

            if (allRows.length > 0) {
                setData(allRows)
                const types = [...new Set(allRows.map(r => r.crew_type).filter(Boolean))]
                setCrewTypes(types as string[])
            }
            setLoading(false)
        }
        fetchData()
    }, [fromDate, toDate])

    const filteredData = useMemo(() => {
        if (crewFilter === 'all') return data
        return data.filter(r => r.crew_type === crewFilter)
    }, [data, crewFilter])

    // Build pivot: employees x dates
    const { employees, dates, pivot } = useMemo(() => {
        const empMap: Record<string, string> = {}
        const pivotMap: Record<string, Record<string, DailyRosterRow>> = {}

        filteredData.forEach(r => {
            empMap[r.emp_id] = r.name
            if (!pivotMap[r.emp_id]) pivotMap[r.emp_id] = {}
            pivotMap[r.emp_id][r.date] = r
        })

        const employeeList = Object.entries(empMap).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name))

        const datesRange: string[] = []
        if (fromDate && toDate) {
            let current = new Date(fromDate)
            const end = new Date(toDate)
            while (current <= end) {
                datesRange.push(formatDate(current))
                current.setDate(current.getDate() + 1)
            }
        }

        return { employees: employeeList, dates: datesRange, pivot: pivotMap }
    }, [filteredData, fromDate, toDate])

    // Calculate per-employee statistics
    const employeeStats = useMemo(() => {
        return employees.map(emp => {
            const empDays = dates.map(d => pivot[emp.id]?.[d]).filter(Boolean)
            let totalHours = 0
            let totalShifts = 0
            const shiftTypes: Record<string, number> = {}
            let violations = 0
            let prevShiftType: string | null = null

            empDays.forEach(day => {
                if (day && !NON_DUTY_CATEGORIES.includes(day.duty_category as (typeof NON_DUTY_CATEGORIES)[number])) {
                    const hours = calcWorkingHours(day.shift_start, day.shift_end)
                    totalHours += hours
                    totalShifts++
                    const st = classifyShift(day.shift_start)
                    shiftTypes[st] = (shiftTypes[st] || 0) + 1

                    if (detectFatigueViolation(prevShiftType, st).hasViolation) violations++
                    prevShiftType = st
                } else {
                    prevShiftType = null
                }
            })

            return { ...emp, totalHours: Math.round(totalHours * 10) / 10, totalShifts, shiftTypes, violations }
        })
    }, [employees, dates, pivot])

    // Cycle hours tracking (hours between Weekly Offs)
    const cycleData = useMemo(() => {
        return employees.map(emp => {
            const cycles: { startDate: string; endDate: string; hours: number }[] = []
            let currentCycleStart: string | null = null
            let currentCycleHours = 0

            dates.forEach(d => {
                const day = pivot[emp.id]?.[d]
                if (!day || day.duty_category === 'Weekly Off' || day.duty_category === 'Public Holiday') {
                    if (currentCycleStart && currentCycleHours > 0) {
                        cycles.push({ startDate: currentCycleStart, endDate: d, hours: Math.round(currentCycleHours * 10) / 10 })
                    }
                    currentCycleStart = null
                    currentCycleHours = 0
                } else {
                    if (!currentCycleStart) currentCycleStart = d
                    if (!NON_DUTY_CATEGORIES.includes(day.duty_category as (typeof NON_DUTY_CATEGORIES)[number])) {
                        currentCycleHours += calcWorkingHours(day.shift_start, day.shift_end)
                    }
                }
            })
            // Close any open cycle
            if (currentCycleStart && currentCycleHours > 0) {
                cycles.push({ startDate: currentCycleStart, endDate: dates[dates.length - 1] || currentCycleStart, hours: Math.round(currentCycleHours * 10) / 10 })
            }

            return { ...emp, cycles }
        })
    }, [employees, dates, pivot])

    // KPIs
    const kpis = useMemo(() => {
        const allHours = employeeStats.map(e => e.totalHours)
        const avgHours = allHours.length ? Math.round(allHours.reduce((s, h) => s + h, 0) / allHours.length * 10) / 10 : 0
        const maxHours = allHours.length ? Math.max(...allHours) : 0
        const maxCycleHours = cycleData.reduce((max, e) => {
            const maxC = e.cycles.reduce((m, c) => Math.max(m, c.hours), 0)
            return Math.max(max, maxC)
        }, 0)
        const totalViolations = employeeStats.reduce((s, e) => s + e.violations, 0)

        return { avgHours, maxHours, maxCycleHours: Math.round(maxCycleHours * 10) / 10, totalViolations }
    }, [employeeStats, cycleData])

    // Top 20 violators (Cycle > 48h)
    const top20Violators = useMemo(() => {
        return cycleData.map(emp => {
            const maxCycle = emp.cycles.length > 0 ? Math.max(...emp.cycles.map(c => c.hours)) : 0
            return { ...emp, maxCycle }
        }).filter(e => e.maxCycle > 48).sort((a, b) => b.maxCycle - a.maxCycle).slice(0, 20)
    }, [cycleData])

    // Sorted Leaderboard
    const sortedLeaderboard = useMemo(() => {
        let result = employeeStats

        if (leaderboardSearch) {
            const s = leaderboardSearch.toLowerCase()
            result = result.filter(e => e.name.toLowerCase().includes(s) || e.id.toLowerCase().includes(s))
        }

        return [...result].sort((a, b) => {
            let valA: any = a[sortKey]
            let valB: any = b[sortKey]
            if (typeof valA === 'string') valA = valA.toLowerCase()
            if (typeof valB === 'string') valB = valB.toLowerCase()

            if (valA < valB) return sortAsc ? -1 : 1
            if (valA > valB) return sortAsc ? 1 : -1
            return 0
        })
    }, [employeeStats, leaderboardSearch, sortKey, sortAsc])

    function handleSort(key: typeof sortKey) {
        if (sortKey === key) {
            setSortAsc(!sortAsc)
        } else {
            setSortKey(key)
            setSortAsc(false)
        }
    }

    // Cell style helper
    function getCellStyle(day: DailyRosterRow | undefined): string {
        if (!day) return 'bg-gray-50 text-gray-400'
        if (day.duty_category === 'Weekly Off' || day.duty_category === 'Public Holiday') return 'bg-green-100 text-green-800'
        if (day.duty_category === 'Absent') return 'bg-red-200 text-red-800'
        if (['Casual Leave', 'Earned Leave', 'Sick Leave', 'Optional Holiday', 'Compensatory OFF'].includes(day.duty_category)) return 'bg-red-100 text-red-700'
        return 'bg-blue-100 text-blue-800'
    }

    // Date header format
    function fmtDateHeader(d: string): string {
        const dt = new Date(d)
        const day = dt.getDate().toString().padStart(2, '0')
        const mon = (dt.getMonth() + 1).toString().padStart(2, '0')
        const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dt.getDay()]
        return `${day}.${mon}\n${weekday}`
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Filters */}
            <Card>
                <CardContent className="pt-6">
                    <div className="flex flex-wrap gap-4 items-center">
                        <div className="flex items-center gap-2">
                            <label className="text-sm text-slate-500">From:</label>
                            <Input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="w-44" />
                        </div>
                        <div className="flex items-center gap-2">
                            <label className="text-sm text-slate-500">To:</label>
                            <Input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="w-44" />
                        </div>
                        <select className="border rounded-md px-3 py-2 text-sm bg-white" value={crewFilter} onChange={e => setCrewFilter(e.target.value)}>
                            <option value="all">All Crew Types</option>
                            {crewTypes.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                    </div>
                </CardContent>
            </Card>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="bg-blue-50">
                    <CardContent className="pt-4 pb-4 flex items-center gap-3">
                        <Clock className="h-8 w-8 text-blue-600 opacity-70" />
                        <div>
                            <p className="text-2xl font-bold text-blue-700">{kpis.avgHours}h</p>
                            <p className="text-xs text-slate-500">Avg Working Hours</p>
                        </div>
                    </CardContent>
                </Card>
                <Card className="bg-amber-50">
                    <CardContent className="pt-4 pb-4 flex items-center gap-3">
                        <TrendingUp className="h-8 w-8 text-amber-600 opacity-70" />
                        <div>
                            <p className="text-2xl font-bold text-amber-700">{kpis.maxHours}h</p>
                            <p className="text-xs text-slate-500">Highest Monthly Hours</p>
                        </div>
                    </CardContent>
                </Card>
                <Card className={kpis.maxCycleHours > 48 ? 'bg-red-50' : 'bg-green-50'}>
                    <CardContent className="pt-4 pb-4 flex items-center gap-3">
                        <ShieldAlert className={`h-8 w-8 ${kpis.maxCycleHours > 48 ? 'text-red-600' : 'text-green-600'} opacity-70`} />
                        <div>
                            <p className={`text-2xl font-bold ${kpis.maxCycleHours > 48 ? 'text-red-700' : 'text-green-700'}`}>
                                {kpis.maxCycleHours}h {kpis.maxCycleHours > 48 && '⚠️'}
                            </p>
                            <p className="text-xs text-slate-500">Highest Cycle Hours</p>
                        </div>
                    </CardContent>
                </Card>
                <Card className={kpis.totalViolations > 0 ? 'bg-red-50' : 'bg-green-50'}>
                    <CardContent className="pt-4 pb-4 flex items-center gap-3">
                        <AlertTriangle className={`h-8 w-8 ${kpis.totalViolations > 0 ? 'text-red-600' : 'text-green-600'} opacity-70`} />
                        <div>
                            <p className={`text-2xl font-bold ${kpis.totalViolations > 0 ? 'text-red-700' : 'text-green-700'}`}>{kpis.totalViolations}</p>
                            <p className="text-xs text-slate-500">Fatigue Violations</p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 border-b">
                {[
                    { key: 'grid' as const, label: 'Master Roster Grid' },
                    { key: 'hours' as const, label: 'Daily Working Hours' },
                    { key: 'compliance' as const, label: 'Weekly Compliance' },
                ].map(tab => (
                    <button
                        key={tab.key}
                        className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                            activeTab === tab.key
                                ? 'border-blue-600 text-blue-600'
                                : 'border-transparent text-slate-500 hover:text-slate-700'
                        }`}
                        onClick={() => setActiveTab(tab.key)}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Tab 1: Master Roster Grid */}
            {activeTab === 'grid' && (
                <Card>
                    <CardHeader><CardTitle className="text-base">Master Roster Grid</CardTitle></CardHeader>
                    <CardContent>
                        <div className="overflow-x-auto max-h-[600px]">
                            <table className="text-[10px] border-collapse">
                                <thead className="sticky top-0 z-10">
                                    <tr className="bg-slate-100">
                                        <th className="p-1 border text-left sticky left-0 bg-slate-100 z-20 min-w-[50px]">ID</th>
                                        <th className="p-1 border text-left sticky left-[50px] bg-slate-100 z-20 min-w-[100px]">Name</th>
                                        {dates.map(d => (
                                            <th key={d} className="p-1 border text-center whitespace-pre-line min-w-[60px]">
                                                {fmtDateHeader(d)}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {employees.map(emp => {
                                        let prevShift: string | null = null
                                        return (
                                            <tr key={emp.id}>
                                                <td className="p-1 border font-mono sticky left-0 bg-white z-10">{emp.id}</td>
                                                <td className="p-1 border sticky left-[50px] bg-white z-10 truncate max-w-[100px]">{emp.name}</td>
                                                {dates.map(d => {
                                                    const day = pivot[emp.id]?.[d]
                                                    const currentShift = day ? classifyShift(day.shift_start) : null
                                                    const violationResult = detectFatigueViolation(prevShift, currentShift)
                                                    const hasViolation = violationResult.hasViolation
                                                    if (day && !NON_DUTY_CATEGORIES.includes(day.duty_category as (typeof NON_DUTY_CATEGORIES)[number])) {
                                                        prevShift = currentShift
                                                    } else {
                                                        prevShift = null
                                                    }
                                                    return (
                                                        <td
                                                            key={d}
                                                            className={`p-1 border text-center ${hasViolation ? 'bg-red-300 text-red-900 font-bold' : getCellStyle(day)}`}
                                                            title={day ? `${day.duty_category} | ${day.shift_start || ''}–${day.shift_end || ''}${hasViolation ? `\n⚠️ ${violationResult.reason}` : ''}` : 'No data'}
                                                        >
                                                            {hasViolation && '⚠️'}
                                                            {day?.duty_code || day?.duty_code_raw || '—'}
                                                        </td>
                                                    )
                                                })}
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                            {employees.length === 0 && (
                                <p className="text-sm text-slate-400 text-center py-8">No data</p>
                            )}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Tab 2: Daily Working Hours */}
            {activeTab === 'hours' && (
                <Card>
                    <CardHeader><CardTitle className="text-base">Daily Working Hours Grid</CardTitle></CardHeader>
                    <CardContent>
                        <div className="overflow-x-auto max-h-[600px]">
                            <table className="text-[10px] border-collapse">
                                <thead className="sticky top-0 z-10">
                                    <tr className="bg-slate-100">
                                        <th className="p-1 border text-left sticky left-0 bg-slate-100 z-20 min-w-[50px]">ID</th>
                                        <th className="p-1 border text-left sticky left-[50px] bg-slate-100 z-20 min-w-[100px]">Name</th>
                                        {dates.map(d => (
                                            <th key={d} className="p-1 border text-center whitespace-pre-line min-w-[55px]">
                                                {fmtDateHeader(d)}
                                            </th>
                                        ))}
                                        <th className="p-1 border text-center bg-slate-200 font-bold min-w-[50px]">Total</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {employees.map(emp => {
                                        let cumulativeHours = 0
                                        let totalHours = 0
                                        return (
                                            <tr key={emp.id}>
                                                <td className="p-1 border font-mono sticky left-0 bg-white z-10">{emp.id}</td>
                                                <td className="p-1 border sticky left-[50px] bg-white z-10 truncate max-w-[100px]">{emp.name}</td>
                                                {dates.map(d => {
                                                    const day = pivot[emp.id]?.[d]
                                                    if (!day) return <td key={d} className="p-1 border text-center bg-gray-50 text-gray-400">—</td>

                                                    if (day.duty_category === 'Weekly Off' || day.duty_category === 'Public Holiday') {
                                                        cumulativeHours = 0
                                                        return <td key={d} className="p-1 border text-center bg-green-100 text-green-800">WO</td>
                                                    }
                                                    if (NON_DUTY_CATEGORIES.includes(day.duty_category as (typeof NON_DUTY_CATEGORIES)[number])) {
                                                        return <td key={d} className="p-1 border text-center bg-red-50 text-red-600 text-[9px]">{day.duty_category.slice(0, 6)}</td>
                                                    }

                                                    const hours = calcWorkingHours(day.shift_start, day.shift_end)
                                                    cumulativeHours += hours
                                                    totalHours += hours
                                                    const isOver48 = cumulativeHours > 48

                                                    return (
                                                        <td
                                                            key={d}
                                                            className={`p-1 border text-center font-mono ${isOver48 ? 'bg-red-200 text-red-900 font-bold' : 'bg-blue-50 text-blue-800'}`}
                                                            title={`Day: ${hours.toFixed(1)}h | Cycle: ${cumulativeHours.toFixed(1)}h`}
                                                        >
                                                            {hours.toFixed(1)}
                                                            {isOver48 && ' ⚠️'}
                                                        </td>
                                                    )
                                                })}
                                                <td className="p-1 border text-center bg-slate-100 font-bold font-mono">{totalHours.toFixed(1)}</td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                            {employees.length === 0 && (
                                <p className="text-sm text-slate-400 text-center py-8">No data</p>
                            )}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Tab 3: Weekly Compliance */}
            {activeTab === 'compliance' && (
                <Card>
                    <CardHeader><CardTitle className="text-base">Weekly Hours Compliance (48h Rule)</CardTitle></CardHeader>
                    <CardContent>
                        <div className="overflow-x-auto max-h-[600px]">
                            <table className="w-full text-xs border-collapse">
                                <thead className="sticky top-0 z-10">
                                    <tr className="bg-slate-100">
                                        <th className="p-2 border text-left">Emp ID</th>
                                        <th className="p-2 border text-left">Name</th>
                                        {cycleData.length > 0 && cycleData[0].cycles.length > 0 &&
                                            cycleData[0].cycles.map((_, i) => (
                                                <th key={i} className="p-2 border text-center" colSpan={2}>
                                                    Cycle {i + 1}
                                                </th>
                                            ))
                                        }
                                    </tr>
                                    <tr className="bg-slate-50">
                                        <th className="p-1 border"></th>
                                        <th className="p-1 border"></th>
                                        {cycleData.length > 0 && cycleData[0].cycles.length > 0 &&
                                            cycleData[0].cycles.map((_, i) => (
                                                <>
                                                    <th key={`d${i}`} className="p-1 border text-center text-[10px]">Date Range</th>
                                                    <th key={`h${i}`} className="p-1 border text-center text-[10px]">Hours</th>
                                                </>
                                            ))
                                        }
                                    </tr>
                                </thead>
                                <tbody>
                                    {cycleData.map(emp => (
                                        <tr key={emp.id}>
                                            <td className="p-2 border font-mono">{emp.id}</td>
                                            <td className="p-2 border">{emp.name}</td>
                                            {emp.cycles.map((c, i) => (
                                                <>
                                                    <td key={`d${i}`} className="p-1 border text-center text-[10px] font-mono">
                                                        {c.startDate.slice(5)} → {c.endDate.slice(5)}
                                                    </td>
                                                    <td
                                                        key={`h${i}`}
                                                        className={`p-1 border text-center font-bold ${c.hours > 48 ? 'bg-red-200 text-red-900' : 'text-green-700'}`}
                                                    >
                                                        {c.hours}h {c.hours > 48 && '⚠️'}
                                                    </td>
                                                </>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {cycleData.length === 0 && (
                                <p className="text-sm text-slate-400 text-center py-8">No data</p>
                            )}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Top 20 > 48h Weekly */}
                <Card>
                    <CardHeader><CardTitle className="text-base text-red-700 flex items-center gap-2"><ShieldAlert className="h-4 w-4"/> Top 20 Violators ({'>'} 48h Weekly Cycle)</CardTitle></CardHeader>
                    <CardContent className="p-0">
                        <div className="overflow-x-auto max-h-[320px]">
                            <table className="w-full text-xs">
                                <thead className="sticky top-0 bg-slate-50 shadow-sm">
                                    <tr className="border-b">
                                        <th className="p-2 text-left">Emp ID</th>
                                        <th className="p-2 text-left">Name</th>
                                        <th className="p-2 text-right">Max Weekly Hrs</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {top20Violators.map(v => (
                                        <tr key={v.id} className="border-b hover:bg-red-50">
                                            <td className="p-2 font-mono">{v.id}</td>
                                            <td className="p-2 font-medium">{v.name}</td>
                                            <td className="p-2 text-right font-bold text-red-600">{v.maxCycle}h</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {top20Violators.length === 0 && (
                                <p className="text-sm text-slate-400 text-center py-8">No employees exceeded 48 hours</p>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Working Hours Histogram (top 20 by hours) */}
                <Card>
                    <CardHeader><CardTitle className="text-base">Top 20 — Working Hours</CardTitle></CardHeader>
                    <CardContent>
                        {employeeStats.length > 0 ? (
                            <ResponsiveContainer width="100%" height={280}>
                                <BarChart data={[...employeeStats].sort((a, b) => b.totalHours - a.totalHours).slice(0, 20)} layout="vertical">
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis type="number" />
                                    <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 9 }} />
                                    <Tooltip />
                                    <Bar dataKey="totalHours" fill="#3b82f6" radius={[0, 4, 4, 0]} name="Hours" />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : <p className="text-sm text-slate-400 text-center py-10">No data</p>}
                    </CardContent>
                </Card>
            </div>

            {/* Leaderboard Table */}
            <Card>
                <CardHeader className="flex flex-row items-center justify-between border-b pb-3">
                    <CardTitle className="text-base flex items-center gap-2"><Award className="h-4 w-4" /> Leaderboard</CardTitle>
                    <div className="relative w-64 mt-[-6px]">
                        <Input
                            placeholder="Search name or ID..."
                            value={leaderboardSearch}
                            onChange={e => setLeaderboardSearch(e.target.value)}
                            className="bg-white"
                        />
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto max-h-96">
                        <table className="w-full text-xs">
                            <thead className="sticky top-0 bg-slate-50 shadow-sm z-10">
                                <tr className="border-b">
                                    <th className="text-left p-3">#</th>
                                    <th className="text-left p-3 cursor-pointer hover:bg-slate-100 uppercase text-[10px] tracking-wider" onClick={() => handleSort('name')}>
                                        Name {sortKey === 'name' ? (sortAsc ? '↑' : '↓') : '↕'}
                                    </th>
                                    <th className="text-left p-3 uppercase text-[10px] tracking-wider">Emp ID</th>
                                    <th className="text-right p-3 cursor-pointer hover:bg-slate-100 uppercase text-[10px] tracking-wider" onClick={() => handleSort('totalHours')}>
                                        Total Hours {sortKey === 'totalHours' ? (sortAsc ? '↑' : '↓') : '↕'}
                                    </th>
                                    <th className="text-right p-3 cursor-pointer hover:bg-slate-100 uppercase text-[10px] tracking-wider" onClick={() => handleSort('totalShifts')}>
                                        Total Shifts {sortKey === 'totalShifts' ? (sortAsc ? '↑' : '↓') : '↕'}
                                    </th>
                                    <th className="text-right p-3 cursor-pointer hover:bg-slate-100 uppercase text-[10px] tracking-wider" onClick={() => handleSort('violations')}>
                                        Violations {sortKey === 'violations' ? (sortAsc ? '↑' : '↓') : '↕'}
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {sortedLeaderboard.map((e, i) => (
                                    <tr key={e.id} className="border-b hover:bg-slate-50">
                                        <td className="p-2 font-semibold text-slate-400">{i + 1}</td>
                                        <td className="p-2">{e.name}</td>
                                        <td className="p-2 font-mono">{e.id}</td>
                                        <td className="p-2 text-right font-semibold">{e.totalHours}h</td>
                                        <td className="p-2 text-right">{e.totalShifts}</td>
                                        <td className={`p-2 text-right ${e.violations > 0 ? 'text-red-600 font-bold' : 'text-green-600'}`}>
                                            {e.violations} {e.violations > 0 && '⚠️'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {employeeStats.length === 0 && (
                            <p className="text-sm text-slate-400 text-center py-8">No data</p>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
