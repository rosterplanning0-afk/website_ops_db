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
    const [categoryFilter, setCategoryFilter] = useState<string>('all')
    const [userRole, setUserRole] = useState<string>('')
    const [userDept, setUserDept] = useState<string>('')
    const [userInfoLoaded, setUserInfoLoaded] = useState(false)
    const supabase = createClient()

    useEffect(() => {
        async function fetchUserInfo() {
            const { data: { user } } = await supabase.auth.getUser()
            if (user) {
                const { data: profile } = await supabase.from('users').select('role, employee_id').eq('id', user.id).single()
                if (profile?.employee_id) {
                    const { data: empInfo } = await supabase.from('employees').select('role, department').eq('employee_id', profile.employee_id).single()
                    setUserRole(empInfo?.role?.toLowerCase() || profile.role?.toLowerCase() || '')
                    setUserDept(empInfo?.department || '')
                } else if (profile) {
                    setUserRole(profile.role?.toLowerCase() || '')
                }
            }
            setUserInfoLoaded(true)
        }
        fetchUserInfo()
    }, [])

    useEffect(() => {
        async function fetchData() {
            if (!userInfoLoaded) return
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
    }, [selectedDate, userRole, userDept, userInfoLoaded])

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

    const categories = useMemo(() => {
        const cats = new Set(filteredData.map(r => r.duty_category).filter(Boolean))
        return Array.from(cats).sort()
    }, [filteredData])

    const tableData = useMemo(() => {
        if (categoryFilter === 'all') return filteredData;
        return filteredData.filter(r => r.duty_category === categoryFilter)
    }, [filteredData, categoryFilter])

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
        const groups: Record<string, { category: string; count: number }[]> = {
            'Active Duty': [],
            'Leaves': [],
            'Other': [],
        }
        const catMap: Record<string, number> = {}
        filteredData.forEach(r => {
            let key = r.duty_category || 'Uncategorized'
            if (key === 'Uncategorized') {
                key = `Uncategorized (${r.duty_code || r.duty_code_raw || 'N/A'})`
            }
            catMap[key] = (catMap[key] || 0) + 1
        })
        Object.entries(catMap).forEach(([category, count]) => {
            const entry = { category, count }
            const baseCategory = category.split(' (')[0]

            if (NON_DUTY_CATEGORIES.includes(baseCategory as (typeof NON_DUTY_CATEGORIES)[number])) {
                if (LEAVE_TYPES.includes(baseCategory as (typeof LEAVE_TYPES)[number])) {
                    groups['Leaves'].push(entry)
                } else if (baseCategory !== 'Uncategorized') {
                    groups['Other'].push(entry)
                } else {
                    groups['Active Duty'].push(entry)
                }
            } else {
                groups['Active Duty'].push(entry)
            }
        })

        // Custom Sort for Active Duty: RRTS -> MRTS -> General -> Training -> Others
        const getSortWeight = (cat: string) => {
            const c = cat.toUpperCase()
            if (c.includes('RRTS')) return 1
            if (c.includes('MRTS')) return 2
            if (c.includes('GENERAL')) return 3
            if (c.includes('TRAINING')) return 4
            return 5
        }

        groups['Active Duty'].sort((a, b) => {
            const wA = getSortWeight(a.category)
            const wB = getSortWeight(b.category)
            if (wA !== wB) return wA - wB
            return b.count - a.count
        })

        Object.values(groups).forEach(arr => {
            if (arr !== groups['Active Duty']) {
                arr.sort((a, b) => b.count - a.count)
            }
        })
        return groups
    }, [filteredData])

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            </div>
        )
    }

    const weeklyOffTarget = Math.round(kpis.totalRostered / 7)
    const maxLeavesTarget = Math.floor(kpis.totalRostered * 0.12)

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
            <Card className="flex flex-col">
                <CardHeader className="border-b"><CardTitle className="text-base">Duty Category Breakdown</CardTitle></CardHeader>
                <CardContent className="pt-6 flex-1">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {Object.entries(dutyTable).map(([group, items]) => (
                            <div key={group}>
                                <h3 className="font-bold text-xs text-slate-400 uppercase mb-3 border-b pb-1 tracking-wider flex justify-between">
                                    {group} <span>{items.reduce((s, i) => s + i.count, 0)}</span>
                                </h3>
                                <div className="space-y-1.5 max-h-72 overflow-y-auto pr-2">
                                    {items.map((item, i) => (
                                        <div key={i} className="flex justify-between items-center text-xs p-2 rounded-md bg-slate-50 hover:bg-slate-100 transition-colors">
                                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${getCategoryColor(item.category.split(' (')[0])}`}>
                                                {item.category}
                                            </span>
                                            <span className="font-bold text-slate-800">{item.count}</span>
                                        </div>
                                    ))}
                                    {items.length === 0 && <p className="text-xs text-slate-400 italic">None</p>}
                                </div>
                                {group === 'Active Duty' && items.length > 0 && (
                                    <div className="mt-4 pt-2 border-t flex justify-between items-center px-2">
                                        <span className="text-[10px] font-bold text-slate-500 uppercase">Total Active</span>
                                        <span className="text-sm font-black text-blue-700">{items.reduce((s, i) => s + i.count, 0)}</span>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </CardContent>
                <div className="p-4 bg-slate-50 border-t flex flex-wrap gap-8 justify-center items-center rounded-b-lg">
                    <div className="text-center">
                        <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">Max Leaves (Target)</p>
                        <div className="flex items-center gap-3">
                            <span className="text-xl font-black text-slate-700">{maxLeavesTarget}</span>
                            <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${kpis.leaves > maxLeavesTarget ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                                Current: {kpis.leaves}
                            </span>
                        </div>
                    </div>
                    <div className="text-center">
                        <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">Weekly Off Target</p>
                        <div className="flex items-center gap-3">
                            <span className="text-xl font-black text-slate-700">{weeklyOffTarget}</span>
                            <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${Math.abs(kpis.weeklyOff - weeklyOffTarget) > 5 ? 'bg-amber-100 text-amber-600' : 'bg-green-100 text-green-600'}`}>
                                Current: {kpis.weeklyOff}
                            </span>
                        </div>
                    </div>
                </div>
            </Card>

            {/* Roster Table */}
            <Card>
                <CardHeader className="border-b flex flex-row items-center justify-between">
                    <CardTitle className="text-base">Roster Details ({tableData.length} records)</CardTitle>
                    <select
                        className="border rounded-md px-2 py-1 text-xs font-normal normal-case bg-white shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                        value={categoryFilter}
                        onChange={e => setCategoryFilter(e.target.value)}
                    >
                        <option value="all">All Categories</option>
                        {categories.map(c => (
                            <option key={c} value={c}>{c}</option>
                        ))}
                    </select>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                            <thead>
                                <tr className="border-b bg-slate-50">
                                    <th className="text-left p-3 font-semibold text-slate-600 uppercase">Emp ID</th>
                                    <th className="text-left p-3 font-semibold text-slate-600 uppercase">Name</th>
                                    <th className="text-left p-3 font-semibold text-slate-600 uppercase">Duty Code</th>
                                    <th className="text-left p-3 font-semibold text-slate-600 uppercase">Category</th>
                                    <th className="text-left p-3 font-semibold text-slate-600 uppercase">Shift</th>
                                    <th className="text-left p-3 font-semibold text-slate-600 uppercase">Time</th>
                                </tr>
                            </thead>
                            <tbody>
                                {tableData.slice(0, 200).map((r, i) => (
                                    <tr key={i} className="border-b hover:bg-slate-50 transition-colors">
                                        <td className="p-3 font-mono text-slate-500">{r.emp_id}</td>
                                        <td className="p-3 font-medium text-slate-800">{r.name}</td>
                                        <td className="p-3"><code className="bg-slate-100 px-1.5 py-0.5 rounded text-[10px] font-bold text-slate-600">{r.duty_code || r.duty_code_raw}</code></td>
                                        <td className="p-3">
                                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${getCategoryColor(r.duty_category)}`}>
                                                {r.duty_category}
                                            </span>
                                        </td>
                                        <td className="p-3 text-slate-600">{classifyShift(r.shift_start)}</td>
                                        <td className="p-3 font-mono text-slate-500">
                                            {r.shift_start && r.shift_end ? `${r.shift_start}–${r.shift_end}` : <span className="text-slate-300">—</span>}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {tableData.length > 200 && (
                            <p className="text-xs text-slate-400 text-center mt-2">Showing first 200 of {tableData.length} records</p>
                        )}
                        {tableData.length === 0 && (
                            <p className="text-sm text-slate-400 text-center py-8">No roster data found for {selectedDate}</p>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
