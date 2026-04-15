'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
    Users, UserCheck, UserX, Clock, CalendarOff, AlertTriangle,
    ChevronLeft, ChevronRight, Search
} from 'lucide-react'
import {
    PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid,
    Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import type { DailyRosterRow } from '@/lib/roster-utils'
import {
    NON_DUTY_CATEGORIES, LEAVE_TYPES, classifyShift, calculateKPIs, getCategoryColor
} from '@/lib/roster-utils'

const CHART_COLORS = ['#3b82f6', '#22c55e', '#ef4444', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#64748b']

function formatDate(d: Date): string {
    return d.toISOString().split('T')[0]
}

export default function DailyOverviewPage() {
    const [selectedDate, setSelectedDate] = useState<string>(formatDate(new Date()))
    const [crewFilter, setCrewFilter] = useState<string>('all')
    const [searchTerm, setSearchTerm] = useState('')
    const [data, setData] = useState<DailyRosterRow[]>([])
    const [loading, setLoading] = useState(true)
    const [crewTypes, setCrewTypes] = useState<string[]>([])
    const [userRole, setUserRole] = useState<string>('')
    const [userDept, setUserDept] = useState<string>('')
    const supabase = createClient()

    useEffect(() => {
        async function fetchUserInfo() {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            const { data: profile } = await supabase.from('users').select('role, employee_id').eq('id', user.id).single()
            if (profile?.employee_id) {
                const { data: empInfo } = await supabase.from('employees').select('role, department').eq('employee_id', profile.employee_id).single()
                if (empInfo) {
                    setUserRole(empInfo.role?.toLowerCase() || profile.role?.toLowerCase() || '')
                    setUserDept(empInfo.department || '')
                }
            } else if (profile) {
                setUserRole(profile.role?.toLowerCase() || '')
            }
        }
        fetchUserInfo()
    }, [])

    useEffect(() => {
        async function fetchData() {
            if (!userRole && loading) return // Wait for role info unless initial load
            setLoading(true)

            let query = supabase
                .from('v_daily_roster_summary')
                .select('*')
                .eq('date', selectedDate)

            // Filtering based on department mapping for managers/hods
            if ((userRole === 'manager' || userRole === 'hod') && userDept) {
                const { DEPT_CREW_MAPPING } = await import('@/lib/rbac')
                const allowedCrews = DEPT_CREW_MAPPING[userDept] || []
                if (allowedCrews.length > 0) {
                    query = query.in('crew_type', allowedCrews)
                }
            }

            const { data: rows, error } = await query

            if (!error && rows) {
                setData(rows as DailyRosterRow[])
                const types = [...new Set(rows.map((r: DailyRosterRow) => r.crew_type).filter(Boolean))]
                setCrewTypes(types as string[])
            }
            setLoading(false)
        }
        fetchData()
    }, [selectedDate, userRole, userDept])

    const filteredData = useMemo(() => {
        let result = data
        if (crewFilter !== 'all') {
            result = result.filter(r => r.crew_type === crewFilter)
        }
        if (searchTerm) {
            const s = searchTerm.toLowerCase()
            result = result.filter(r =>
                r.emp_id?.toLowerCase().includes(s) ||
                r.name?.toLowerCase().includes(s)
            )
        }
        return result
    }, [data, crewFilter, searchTerm])

    const kpis = useMemo(() => calculateKPIs(filteredData), [filteredData])

    // Shift distribution data
    const shiftDistribution = useMemo(() => {
        const onDutyRows = filteredData.filter(r => !NON_DUTY_CATEGORIES.includes(r.duty_category as (typeof NON_DUTY_CATEGORIES)[number]))
        const groups: Record<string, number> = {}
        onDutyRows.forEach(r => {
            const shift = classifyShift(r.shift_start)
            groups[shift] = (groups[shift] || 0) + 1
        })
        return Object.entries(groups).map(([name, value]) => ({ name, value }))
    }, [filteredData])

    // Duty category distribution for pie chart
    const categoryDistribution = useMemo(() => {
        const groups: Record<string, number> = {}
        filteredData.forEach(r => {
            const cat = r.duty_category || 'Uncategorized'
            groups[cat] = (groups[cat] || 0) + 1
        })
        return Object.entries(groups)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value)
    }, [filteredData])

    // Leave breakdown
    const leaveBreakdown = useMemo(() => {
        const groups: Record<string, number> = {}
        filteredData.forEach(r => {
            if (LEAVE_TYPES.includes(r.duty_category as (typeof LEAVE_TYPES)[number])) {
                groups[r.duty_category] = (groups[r.duty_category] || 0) + 1
            }
        })
        return Object.entries(groups).map(([name, value]) => ({ name, value }))
    }, [filteredData])

    // Navigate dates
    function changeDate(delta: number) {
        const d = new Date(selectedDate)
        d.setDate(d.getDate() + delta)
        setSelectedDate(formatDate(d))
    }

    // Duty breakdown table data
    const dutyTable = useMemo(() => {
        const groups: Record<string, { category: string; code: string; count: number }[]> = {
            'Active Duty': [],
            'Leaves': [],
            'Other': [],
        }
        const codeMap: Record<string, { category: string; count: number }> = {}
        filteredData.forEach(r => {
            const key = r.duty_code || r.duty_code_raw || 'N/A'
            if (!codeMap[key]) codeMap[key] = { category: r.duty_category, count: 0 }
            codeMap[key].count++
        })
        Object.entries(codeMap).forEach(([code, info]) => {
            const entry = { category: info.category, code, count: info.count }
            if (NON_DUTY_CATEGORIES.includes(info.category as (typeof NON_DUTY_CATEGORIES)[number])) {
                if (LEAVE_TYPES.includes(info.category as (typeof LEAVE_TYPES)[number])) {
                    groups['Leaves'].push(entry)
                } else {
                    groups['Other'].push(entry)
                }
            } else {
                groups['Active Duty'].push(entry)
            }
        })
        // Sort each group by count descending
        Object.values(groups).forEach(arr => arr.sort((a, b) => b.count - a.count))
        return groups
    }, [filteredData])

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Header Controls */}
            <Card>
                <CardContent className="pt-6">
                    <div className="flex flex-wrap gap-4 items-center">
                        <div className="flex items-center gap-2">
                            <Button variant="outline" size="icon" onClick={() => changeDate(-1)}>
                                <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <Input
                                type="date"
                                value={selectedDate}
                                onChange={e => setSelectedDate(e.target.value)}
                                className="w-44"
                            />
                            <Button variant="outline" size="icon" onClick={() => changeDate(1)}>
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>
                        <select
                            className="border rounded-md px-3 py-2 text-sm bg-white"
                            value={crewFilter}
                            onChange={e => setCrewFilter(e.target.value)}
                        >
                            <option value="all">All Crew Types</option>
                            {crewTypes.map(t => (
                                <option key={t} value={t}>{t}</option>
                            ))}
                        </select>
                        <div className="relative flex-1 min-w-[200px]">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-4 w-4" />
                            <Input
                                placeholder="Search by name or employee ID..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="pl-9"
                            />
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {[
                    { label: 'Total Rostered', value: kpis.totalRostered, icon: Users, color: 'text-slate-700', bg: 'bg-slate-50' },
                    { label: 'On Duty', value: kpis.onDuty, icon: UserCheck, color: 'text-blue-700', bg: 'bg-blue-50' },
                    { label: 'On Leave', value: kpis.leaves, icon: CalendarOff, color: 'text-amber-700', bg: 'bg-amber-50' },
                    { label: 'Absent', value: kpis.absent, icon: UserX, color: 'text-red-700', bg: 'bg-red-50' },
                    { label: 'Weekly Off', value: kpis.weeklyOff, icon: Clock, color: 'text-green-700', bg: 'bg-green-50' },
                    { label: 'Uncategorized', value: kpis.uncategorized, icon: AlertTriangle, color: 'text-gray-700', bg: 'bg-gray-50' },
                ].map(kpi => (
                    <Card key={kpi.label} className={kpi.bg}>
                        <CardContent className="pt-4 pb-4">
                            <div className="flex items-center gap-3">
                                <kpi.icon className={`h-8 w-8 ${kpi.color} opacity-70`} />
                                <div>
                                    <p className="text-2xl font-bold">{kpi.value}</p>
                                    <p className="text-xs text-slate-500">{kpi.label}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Duty Distribution Pie */}
                <Card>
                    <CardHeader><CardTitle className="text-base">Duty Distribution</CardTitle></CardHeader>
                    <CardContent>
                        {categoryDistribution.length > 0 ? (
                            <ResponsiveContainer width="100%" height={280}>
                                <PieChart>
                                    <Pie
                                        data={categoryDistribution}
                                        cx="50%" cy="50%"
                                        innerRadius={50} outerRadius={100}
                                        dataKey="value"
                                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                        label={(entry: any) => `${entry.name ?? ''} (${(((entry.percent as number) ?? 0) * 100).toFixed(0)}%)`}
                                        labelLine={false}
                                    >
                                        {categoryDistribution.map((_, i) => (
                                            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <p className="text-sm text-slate-400 text-center py-10">No data for this date</p>
                        )}
                    </CardContent>
                </Card>

                {/* Shift Distribution Bar */}
                <Card>
                    <CardHeader><CardTitle className="text-base">Shift Distribution</CardTitle></CardHeader>
                    <CardContent>
                        {shiftDistribution.length > 0 ? (
                            <ResponsiveContainer width="100%" height={280}>
                                <BarChart data={shiftDistribution}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="name" />
                                    <YAxis />
                                    <Tooltip />
                                    <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                                        {shiftDistribution.map((entry, i) => {
                                            const colorMap: Record<string, string> = {
                                                'Early': '#f59e0b',
                                                'General': '#3b82f6',
                                                'Late': '#8b5cf6',
                                                'Night': '#1e293b',
                                                'No Time/Other': '#94a3b8',
                                            }
                                            return <Cell key={i} fill={colorMap[entry.name] || '#64748b'} />
                                        })}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <p className="text-sm text-slate-400 text-center py-10">No data for this date</p>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Leave Breakdown Pie */}
            {leaveBreakdown.length > 0 && (
                <Card>
                    <CardHeader><CardTitle className="text-base">Leave Type Breakdown</CardTitle></CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={250}>
                            <PieChart>
                                <Pie
                                    data={leaveBreakdown}
                                    cx="50%" cy="50%"
                                    innerRadius={40} outerRadius={90}
                                    dataKey="value"
                                    label={({ name, value }) => `${name}: ${value}`}
                                >
                                    {leaveBreakdown.map((_, i) => (
                                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            )}

            {/* Duty Breakdown Table */}
            <Card>
                <CardHeader><CardTitle className="text-base">Duty Code Breakdown</CardTitle></CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {Object.entries(dutyTable).map(([group, items]) => (
                            <div key={group}>
                                <h3 className="font-semibold text-sm text-slate-600 mb-2 border-b pb-1">
                                    {group} ({items.reduce((s, i) => s + i.count, 0)})
                                </h3>
                                <div className="space-y-1 max-h-60 overflow-y-auto">
                                    {items.map((item, i) => (
                                        <div key={i} className="flex justify-between items-center text-xs px-2 py-1 rounded hover:bg-slate-50">
                                            <span className="font-mono">{item.code}</span>
                                            <div className="flex items-center gap-2">
                                                <span className={`px-1.5 py-0.5 rounded text-[10px] ${getCategoryColor(item.category)}`}>
                                                    {item.category}
                                                </span>
                                                <span className="font-semibold">{item.count}</span>
                                            </div>
                                        </div>
                                    ))}
                                    {items.length === 0 && <p className="text-xs text-slate-400">None</p>}
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            {/* Roster Table */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Roster Details ({filteredData.length} records)</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                            <thead>
                                <tr className="border-b bg-slate-50">
                                    <th className="text-left p-2 font-semibold">Emp ID</th>
                                    <th className="text-left p-2 font-semibold">Name</th>
                                    <th className="text-left p-2 font-semibold">Crew Type</th>
                                    <th className="text-left p-2 font-semibold">Duty Code</th>
                                    <th className="text-left p-2 font-semibold">Category</th>
                                    <th className="text-left p-2 font-semibold">Shift</th>
                                    <th className="text-left p-2 font-semibold">Time</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredData.slice(0, 200).map((r, i) => (
                                    <tr key={i} className="border-b hover:bg-slate-50">
                                        <td className="p-2 font-mono">{r.emp_id}</td>
                                        <td className="p-2">{r.name}</td>
                                        <td className="p-2">{r.crew_type}</td>
                                        <td className="p-2 font-mono">{r.duty_code || r.duty_code_raw}</td>
                                        <td className="p-2">
                                            <span className={`px-1.5 py-0.5 rounded text-[10px] ${getCategoryColor(r.duty_category)}`}>
                                                {r.duty_category}
                                            </span>
                                        </td>
                                        <td className="p-2">{classifyShift(r.shift_start)}</td>
                                        <td className="p-2 font-mono">
                                            {r.shift_start && r.shift_end ? `${r.shift_start}–${r.shift_end}` : '—'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {filteredData.length > 200 && (
                            <p className="text-xs text-slate-400 text-center mt-2">Showing first 200 of {filteredData.length} records</p>
                        )}
                        {filteredData.length === 0 && (
                            <p className="text-sm text-slate-400 text-center py-8">No roster data found for {selectedDate}</p>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
