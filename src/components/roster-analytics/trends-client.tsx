'use client'

import { useState, useMemo, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuCheckboxItem } from '@/components/ui/dropdown-menu'
import { ChevronDown } from 'lucide-react'
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid,
    Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import type { HistoricalMetricsRow, DailyRosterRow } from '@/lib/roster-utils'
import { LEAVE_TYPES } from '@/lib/roster-utils'
import { EmployeeLeaveReport } from '@/components/roster-analytics/employee-leave-report'

function formatDate(d: Date): string {
    return d.toISOString().split('T')[0]
}

interface TrendsClientProps {
    initialData: HistoricalMetricsRow[]
    initialLeaveData?: Partial<DailyRosterRow>[]
    initialFromDate: string
    initialToDate: string
    initialDept?: string
    initialDesig?: string
    initialLeaveType?: string
    departments?: string[]
    designations?: string[]
    userRole?: string
    userDept?: string
}

export function TrendsClient({ 
    initialData, 
    initialLeaveData = [], 
    initialFromDate, 
    initialToDate,
    initialDept = '',
    initialDesig = '',
    initialLeaveType = '',
    departments = [],
    designations = [],
    userRole = 'employee',
    userDept = ''
}: TrendsClientProps) {
    const router = useRouter()
    const pathname = usePathname()
    const [fromDate, setFromDate] = useState<string>(initialFromDate)
    const [toDate, setToDate] = useState<string>(initialToDate)
    const [crewFilter, setCrewFilter] = useState<string>('all')
    const [dept, setDept] = useState<string>(initialDept)
    const [desig, setDesig] = useState<string[]>(initialDesig ? initialDesig.split(',') : [])
    const [leaveType, setLeaveType] = useState<string[]>(initialLeaveType ? initialLeaveType.split(',') : [])
    const [activeTab, setActiveTab] = useState<'trends' | 'leave-report'>('trends')

    useEffect(() => {
        setFromDate(initialFromDate)
        setToDate(initialToDate)
        setDept(initialDept)
        setDesig(initialDesig ? initialDesig.split(',') : [])
        setLeaveType(initialLeaveType ? initialLeaveType.split(',') : [])
    }, [initialFromDate, initialToDate, initialDept, initialDesig, initialLeaveType])

    const applyFilters = (newFrom = fromDate, newTo = toDate, newDept = dept, newDesig = desig, newLeaveType = leaveType) => {
        const params = new URLSearchParams()
        if (newFrom) params.set('from', newFrom)
        if (newTo) params.set('to', newTo)
        if (newDept) params.set('dept', newDept)
        if (newDesig.length > 0) params.set('desig', newDesig.join(','))
        if (newLeaveType.length > 0) params.set('leaveType', newLeaveType.join(','))
        router.push(`${pathname}?${params.toString()}`)
    }

    const handleToggle = (current: string[], value: string) => {
        if (value === 'all') return []
        let next = [...current]
        if (next.includes(value)) {
            next = next.filter(v => v !== value)
        } else {
            next.push(value)
        }
        return next
    }

    const data = initialData
    const crewTypes = useMemo(() => [...new Set(data.map((r: HistoricalMetricsRow) => r.crew_type).filter(Boolean))] as string[], [data])

    // Aggregate by date (across all crew types and departments)
    const chartData = useMemo(() => {
        let filtered = data
        if (crewFilter !== 'all') {
            filtered = filtered.filter(r => r.crew_type === crewFilter)
        }

        const grouped: Record<string, { date: string; onDuty: number; leaves: number; absent: number; weeklyOff: number; total: number }> = {}
        filtered.forEach(r => {
            if (!grouped[r.date]) {
                grouped[r.date] = { date: r.date, onDuty: 0, leaves: 0, absent: 0, weeklyOff: 0, total: 0 }
            }
            grouped[r.date].onDuty += r.on_duty_count
            grouped[r.date].leaves += r.leave_count
            grouped[r.date].absent += r.absent_count
            grouped[r.date].weeklyOff += r.weekly_off_count
            grouped[r.date].total += r.total_rostered
        })
        return Object.values(grouped).sort((a, b) => a.date.localeCompare(b.date))
    }, [data, crewFilter])

    // Summary KPIs
    const summary = useMemo(() => {
        if (chartData.length === 0) return null
        const avgOnDuty = Math.round(chartData.reduce((s, d) => s + d.onDuty, 0) / chartData.length)
        const avgLeaves = Math.round(chartData.reduce((s, d) => s + d.leaves, 0) / chartData.length)
        const avgAbsent = Math.round(chartData.reduce((s, d) => s + d.absent, 0) / chartData.length)
        const totalDays = chartData.length
        return { avgOnDuty, avgLeaves, avgAbsent, totalDays }
    }, [chartData])

    return (
        <div className="space-y-6">
            {/* Tabs Header */}
            <div className="flex border-b">
                <button
                    className={`px-4 py-2 font-medium text-sm focus:outline-none ${activeTab === 'trends' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                    onClick={() => setActiveTab('trends')}
                >
                    Overview Trends
                </button>
                <button
                    className={`px-4 py-2 font-medium text-sm focus:outline-none ${activeTab === 'leave-report' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                    onClick={() => setActiveTab('leave-report')}
                >
                    Employee Leave Report
                </button>
            </div>

            {/* Filters */}
            <Card>
                <CardContent className="pt-6">
                    <div className="flex flex-wrap gap-4 items-center">
                        <div className="flex items-center gap-2">
                            <label className="text-sm text-slate-500">From:</label>
                            <Input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} onBlur={() => applyFilters()} className="w-44" />
                        </div>
                        <div className="flex items-center gap-2">
                            <label className="text-sm text-slate-500">To:</label>
                            <Input type="date" value={toDate} onChange={e => setToDate(e.target.value)} onBlur={() => applyFilters()} className="w-44" />
                        </div>
                        
                        {/* Dept & Designation Filters (for Leave Report, but kept global) */}
                        {userRole !== 'hod' && userRole !== 'manager' && (
                            <select
                                className="border rounded-md px-3 py-2 text-sm bg-white"
                                value={dept}
                                onChange={e => {
                                    setDept(e.target.value)
                                    applyFilters(fromDate, toDate, e.target.value, desig, leaveType)
                                }}
                            >
                                <option value="">All Departments</option>
                                {departments.map(d => <option key={d} value={d}>{d}</option>)}
                            </select>
                        )}
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" className="w-48 justify-between bg-white text-sm font-normal">
                                    {desig.length === 0 ? 'All Designations' : `${desig.length} Designations`}
                                    <ChevronDown className="h-4 w-4 opacity-50" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="w-56">
                                <DropdownMenuCheckboxItem
                                    checked={desig.length === 0}
                                    onCheckedChange={() => {
                                        const newDesig = handleToggle(desig, 'all')
                                        setDesig(newDesig)
                                        applyFilters(fromDate, toDate, dept, newDesig, leaveType)
                                    }}
                                >
                                    All Designations
                                </DropdownMenuCheckboxItem>
                                {designations.map(d => (
                                    <DropdownMenuCheckboxItem
                                        key={d}
                                        checked={desig.includes(d)}
                                        onCheckedChange={() => {
                                            const newDesig = handleToggle(desig, d)
                                            setDesig(newDesig)
                                            applyFilters(fromDate, toDate, dept, newDesig, leaveType)
                                        }}
                                    >
                                        {d}
                                    </DropdownMenuCheckboxItem>
                                ))}
                            </DropdownMenuContent>
                        </DropdownMenu>

                        {activeTab === 'leave-report' && (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="outline" className="w-48 justify-between bg-white text-sm font-normal">
                                        {leaveType.length === 0 ? 'All Leaves & Absent' : `${leaveType.length} Selected`}
                                        <ChevronDown className="h-4 w-4 opacity-50" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent className="w-56">
                                    <DropdownMenuCheckboxItem
                                        checked={leaveType.length === 0}
                                        onCheckedChange={() => {
                                            const newLeave = handleToggle(leaveType, 'all')
                                            setLeaveType(newLeave)
                                            applyFilters(fromDate, toDate, dept, desig, newLeave)
                                        }}
                                    >
                                        All Leaves & Absent
                                    </DropdownMenuCheckboxItem>
                                    {[...LEAVE_TYPES, 'Absent'].map(l => (
                                        <DropdownMenuCheckboxItem
                                            key={l}
                                            checked={leaveType.includes(l)}
                                            onCheckedChange={() => {
                                                const newLeave = handleToggle(leaveType, l)
                                                setLeaveType(newLeave)
                                                applyFilters(fromDate, toDate, dept, desig, newLeave)
                                            }}
                                        >
                                            {l}
                                        </DropdownMenuCheckboxItem>
                                    ))}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        )}

                        {activeTab === 'trends' && (
                            <select
                                className="border rounded-md px-3 py-2 text-sm bg-white"
                                value={crewFilter}
                                onChange={e => setCrewFilter(e.target.value)}
                            >
                                <option value="all">All Crew Types</option>
                                {crewTypes.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                        )}
                        {activeTab === 'trends' && (
                            <div className="flex gap-2">
                                {[7, 14, 30, 60].map(days => (
                                    <Button key={days} variant="outline" size="sm" onClick={() => {
                                        const d = new Date(); d.setDate(d.getDate() - days)
                                        const newFrom = formatDate(d)
                                        const newTo = formatDate(new Date())
                                        setFromDate(newFrom)
                                        setToDate(newTo)
                                        applyFilters(newFrom, newTo, dept, desig, leaveType)
                                    }}>
                                        {days}d
                                    </Button>
                                ))}
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            {activeTab === 'leave-report' ? (
                <EmployeeLeaveReport leaveData={initialLeaveData} />
            ) : (
                <>
                    {/* Summary KPIs */}
                    {summary && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Card className="bg-blue-50">
                        <CardContent className="pt-4 pb-4">
                            <p className="text-2xl font-bold text-blue-700">{summary.avgOnDuty}</p>
                            <p className="text-xs text-slate-500">Avg Daily On-Duty</p>
                        </CardContent>
                    </Card>
                    <Card className="bg-amber-50">
                        <CardContent className="pt-4 pb-4">
                            <p className="text-2xl font-bold text-amber-700">{summary.avgLeaves}</p>
                            <p className="text-xs text-slate-500">Avg Daily Leaves</p>
                        </CardContent>
                    </Card>
                    <Card className="bg-red-50">
                        <CardContent className="pt-4 pb-4">
                            <p className="text-2xl font-bold text-red-700">{summary.avgAbsent}</p>
                            <p className="text-xs text-slate-500">Avg Daily Absent</p>
                        </CardContent>
                    </Card>
                    <Card className="bg-slate-50">
                        <CardContent className="pt-4 pb-4">
                            <p className="text-2xl font-bold text-slate-700">{summary.totalDays}</p>
                            <p className="text-xs text-slate-500">Days Analyzed</p>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* On-Duty Trend Line */}
            <Card>
                <CardHeader><CardTitle className="text-base">Daily On-Duty Trend</CardTitle></CardHeader>
                <CardContent>
                    {chartData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={320}>
                            <LineChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="date" tick={{ fontSize: 10 }} angle={-45} textAnchor="end" height={60} />
                                <YAxis />
                                <Tooltip />
                                <Legend />
                                <Line type="monotone" dataKey="onDuty" stroke="#3b82f6" strokeWidth={2} name="On Duty" dot={false} />
                                <Line type="monotone" dataKey="total" stroke="#94a3b8" strokeWidth={1} strokeDasharray="5 5" name="Total Rostered" dot={false} />
                            </LineChart>
                        </ResponsiveContainer>
                    ) : (
                        <p className="text-sm text-slate-400 text-center py-10">No data for this range</p>
                    )}
                </CardContent>
            </Card>

            {/* Leaves vs Absences Trend */}
            <Card>
                <CardHeader><CardTitle className="text-base">Leaves vs Absences vs Weekly Off</CardTitle></CardHeader>
                <CardContent>
                    {chartData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={320}>
                            <LineChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="date" tick={{ fontSize: 10 }} angle={-45} textAnchor="end" height={60} />
                                <YAxis />
                                <Tooltip />
                                <Legend />
                                <Line type="monotone" dataKey="leaves" stroke="#f59e0b" strokeWidth={2} name="Leaves" dot={false} />
                                <Line type="monotone" dataKey="absent" stroke="#ef4444" strokeWidth={2} name="Absent" dot={false} />
                                <Line type="monotone" dataKey="weeklyOff" stroke="#22c55e" strokeWidth={2} name="Weekly Off" dot={false} />
                            </LineChart>
                        </ResponsiveContainer>
                    ) : (
                        <p className="text-sm text-slate-400 text-center py-10">No data for this range</p>
                    )}
                </CardContent>
            </Card>

            {/* Summary Table */}
            <Card>
                <CardHeader><CardTitle className="text-base">Daily Summary Table</CardTitle></CardHeader>
                <CardContent>
                    <div className="overflow-x-auto max-h-96">
                        <table className="w-full text-xs">
                            <thead className="sticky top-0 bg-white">
                                <tr className="border-b bg-slate-50">
                                    <th className="text-left p-2 font-semibold">Date</th>
                                    <th className="text-right p-2 font-semibold">On Duty</th>
                                    <th className="text-right p-2 font-semibold">Leaves</th>
                                    <th className="text-right p-2 font-semibold">Absent</th>
                                    <th className="text-right p-2 font-semibold">Weekly Off</th>
                                    <th className="text-right p-2 font-semibold">Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                {chartData.map((r, i) => (
                                    <tr key={i} className="border-b hover:bg-slate-50">
                                        <td className="p-2 font-mono">{r.date}</td>
                                        <td className="p-2 text-right text-blue-600 font-semibold">{r.onDuty}</td>
                                        <td className="p-2 text-right text-amber-600">{r.leaves}</td>
                                        <td className="p-2 text-right text-red-600">{r.absent}</td>
                                        <td className="p-2 text-right text-green-600">{r.weeklyOff}</td>
                                        <td className="p-2 text-right font-semibold">{r.total}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {chartData.length === 0 && (
                            <p className="text-sm text-slate-400 text-center py-8">No data found for the selected range</p>
                        )}
                    </div>
                </CardContent>
            </Card>
                </>
            )}
        </div>
    )
}
