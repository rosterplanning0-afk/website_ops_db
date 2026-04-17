'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
    Users, UserCheck, UserX, Clock, CalendarOff, AlertTriangle,
    ChevronLeft, ChevronRight, Search, TrendingUp
} from 'lucide-react'
import {
    PieChart, Pie, Cell, ResponsiveContainer, Tooltip
} from 'recharts'
import type { DailyRosterRow } from '@/lib/roster-utils'
import {
    NON_DUTY_CATEGORIES, LEAVE_TYPES, calculateKPIs, getCategoryColor
} from '@/lib/roster-utils'
import Link from 'next/link'

const CHART_COLORS = ['#3b82f6', '#22c55e', '#ef4444', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#64748b']

function formatDate(d: Date): string {
    return d.toISOString().split('T')[0]
}

export function RosterPlannerDashboardView() {
    const [selectedDate, setSelectedDate] = useState<string>(formatDate(new Date()))
    const [crewFilter, setCrewFilter] = useState<string>('all')
    const [searchTerm, setSearchTerm] = useState('')
    const [data, setData] = useState<DailyRosterRow[]>([])
    const [loading, setLoading] = useState(true)
    const [crewTypes, setCrewTypes] = useState<string[]>([])
    const [categoryFilter, setCategoryFilter] = useState<string>('all')
    const supabase = createClient()

    useEffect(() => {
        async function fetchData() {
            setLoading(true)
            const { data: rows, error } = await supabase
                .from('v_daily_roster_summary')
                .select('*')
                .eq('date', selectedDate)

            if (!error && rows) {
                setData(rows as DailyRosterRow[])
                const types = [...new Set(rows.map((r: DailyRosterRow) => r.crew_type).filter(Boolean))]
                setCrewTypes(types as string[])
            }
            setLoading(false)
        }
        fetchData()
    }, [selectedDate])

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
                    // Regular non-duty like Weekly Off, Absent
                    groups['Other'].push(entry)
                } else {
                    // Uncategorized is treated as Active Duty for breakdown sorting but special label
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
            return b.count - a.count // Secondary sort by count
        })

        Object.values(groups).forEach(arr => {
            if (arr !== groups['Active Duty']) {
                arr.sort((a, b) => b.count - a.count)
            }
        })

        return groups
    }, [filteredData])

    function changeDate(delta: number) {
        const d = new Date(selectedDate)
        d.setDate(d.getDate() + delta)
        setSelectedDate(formatDate(d))
    }

    if (loading && data.length === 0) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600" />
            </div>
        )
    }

    // Calculations for targets
    const weeklyOffTarget = Math.round(kpis.totalRostered / 7)
    const maxLeavesTarget = Math.floor(kpis.totalRostered * 0.12) // Assuming 12% as a reasonable max leave target

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-slate-800">Roster Planner Dashboard</h2>
            </div>

            {/* Filters Section */}
            <Card className="border-none shadow-sm bg-white/50 backdrop-blur-sm">
                <CardContent className="p-4">
                    <div className="flex flex-wrap gap-4 items-center">
                        <div className="flex items-center gap-1 bg-white border rounded-md p-1 shadow-sm">
                            <Button variant="ghost" size="icon" onClick={() => changeDate(-1)} className="h-8 w-8">
                                <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <Input
                                type="date"
                                value={selectedDate}
                                onChange={e => setSelectedDate(e.target.value)}
                                className="border-none shadow-none focus-visible:ring-0 w-36 h-8 text-sm px-1"
                            />
                            <Button variant="ghost" size="icon" onClick={() => changeDate(1)} className="h-8 w-8">
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>

                        <select
                            className="border rounded-md px-3 py-1.5 text-sm bg-white shadow-sm focus:outline-none focus:ring-1 focus:ring-red-500"
                            value={crewFilter}
                            onChange={e => setCrewFilter(e.target.value)}
                        >
                            <option value="all">All Crew Types</option>
                            {crewTypes.map(t => (
                                <option key={t} value={t}>{t}</option>
                            ))}
                        </select>

                        <div className="relative flex-1 min-w-[250px]">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-4 w-4" />
                            <Input
                                placeholder="Search by name or employee ID..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="pl-9 h-9 bg-white shadow-sm"
                            />
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {[
                    { label: 'Total Rostered', value: kpis.totalRostered, icon: Users, color: 'text-slate-600', bg: 'bg-white', iconColor: 'text-slate-400' },
                    { label: 'On Duty', value: kpis.onDuty, icon: UserCheck, color: 'text-blue-700', bg: 'bg-blue-50/50', iconColor: 'text-blue-400' },
                    { label: 'On Leave', value: kpis.leaves, icon: CalendarOff, color: 'text-amber-700', bg: 'bg-amber-50/50', iconColor: 'text-amber-500' },
                    { label: 'Absent', value: kpis.absent, icon: UserX, color: 'text-red-700', bg: 'bg-red-50/50', iconColor: 'text-red-400' },
                    { label: 'Weekly Off', value: kpis.weeklyOff, icon: Clock, color: 'text-green-700', bg: 'bg-green-50/50', iconColor: 'text-green-500' },
                    { label: 'Uncategorized', value: kpis.uncategorized, icon: AlertTriangle, color: 'text-slate-700', bg: 'bg-slate-50/50', iconColor: 'text-slate-400' },
                ].map(kpi => (
                    <Card key={kpi.label} className={`${kpi.bg} border-none shadow-sm`}>
                        <CardContent className="p-4">
                            <div className="flex items-center gap-3">
                                <kpi.icon className={`h-8 w-8 ${kpi.iconColor}`} />
                                <div className="min-w-0">
                                    <p className={`text-2xl font-bold ${kpi.color}`}>{kpi.value}</p>
                                    <p className="text-[10px] text-slate-500 font-medium uppercase tracking-tight truncate">{kpi.label}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Duty Category Breakdown */}
                <Card className="lg:col-span-2 shadow-sm flex flex-col">
                    <CardHeader className="pb-2 border-b">
                        <CardTitle className="text-sm font-semibold text-slate-700 uppercase tracking-wider">Duty Category Breakdown</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-4 flex-1">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {Object.entries(dutyTable).map(([group, items]) => (
                                <div key={group}>
                                    <h3 className="font-bold text-[11px] text-slate-400 uppercase mb-3 tracking-widest flex justify-between border-b pb-1">
                                        {group} <span>{items.reduce((s, i) => s + i.count, 0)}</span>
                                    </h3>
                                    <div className="space-y-1.5 max-h-72 overflow-y-auto pr-2">
                                        {items.map((item, i) => (
                                            <div key={i} className="flex justify-between items-center text-xs p-2 rounded-md bg-slate-50/50 border border-transparent hover:border-slate-200 transition-colors">
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${getCategoryColor(item.category.split(' (')[0])}`}>
                                                    {item.category}
                                                </span>
                                                <span className="font-bold text-slate-800">{item.count}</span>
                                            </div>
                                        ))}
                                        {items.length === 0 && <p className="text-xs text-slate-400 italic">No records</p>}
                                    </div>
                                    {group === 'Active Duty' && items.length > 0 && (
                                        <div className="mt-3 pt-2 border-t flex justify-between items-center px-2">
                                            <span className="text-[10px] font-bold text-slate-500 uppercase">Total Active</span>
                                            <span className="text-sm font-black text-blue-700">{items.reduce((s, i) => s + i.count, 0)}</span>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </CardContent>
                    <div className="p-4 bg-slate-50 border-t flex flex-wrap gap-6 justify-around items-center rounded-b-lg">
                        <div className="text-center">
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Max Leaves (Target)</p>
                            <div className="flex items-center gap-2">
                                <span className="text-lg font-black text-slate-700">{maxLeavesTarget}</span>
                                <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${kpis.leaves > maxLeavesTarget ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                                    Current: {kpis.leaves}
                                </span>
                            </div>
                        </div>
                        <div className="text-center">
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Weekly Off Target (Daily)</p>
                            <div className="flex items-center gap-2">
                                <span className="text-lg font-black text-slate-700">{weeklyOffTarget}</span>
                                <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${Math.abs(kpis.weeklyOff - weeklyOffTarget) > 5 ? 'bg-amber-100 text-amber-600' : 'bg-green-100 text-green-600'}`}>
                                    Current: {kpis.weeklyOff}
                                </span>
                            </div>
                        </div>
                    </div>
                </Card>

                {/* Quick Actions */}
                <Card className="shadow-sm h-full">
                    <CardHeader className="pb-2 border-b">
                        <CardTitle className="text-sm font-semibold text-slate-700 uppercase tracking-wider">Quick Actions</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-4 space-y-3">
                        <Link href="/employees" className="flex items-center gap-3 w-full p-4 hover:bg-red-50 rounded-lg border border-slate-100 text-sm font-semibold transition-all group">
                            <div className="bg-red-100 p-2 rounded-md group-hover:bg-red-600 group-hover:text-white transition-colors">
                                <Users className="h-5 w-5" />
                            </div>
                            <span className="text-slate-700">View Employees</span>
                        </Link>
                        <Link href="/roster-analytics/trends" className="flex items-center gap-3 w-full p-4 hover:bg-blue-50 rounded-lg border border-slate-100 text-sm font-semibold transition-all group">
                            <div className="bg-blue-100 p-2 rounded-md group-hover:bg-blue-600 group-hover:text-white transition-colors">
                                <TrendingUp className="h-5 w-5" />
                            </div>
                            <span className="text-slate-700">Historical Trends</span>
                        </Link>
                    </CardContent>
                </Card>
            </div>

            {/* Roster Details Table - Added Back */}
            <Card className="shadow-sm overflow-hidden">
                <CardHeader className="bg-slate-50/50 border-b">
                    <CardTitle className="text-sm font-semibold text-slate-700 uppercase tracking-wider flex justify-between items-center">
                        Roster Details
                        <div className="flex items-center gap-4">
                            <select
                                className="border rounded-md px-2 py-1 text-xs font-normal normal-case bg-white shadow-sm focus:outline-none focus:ring-1 focus:ring-red-500"
                                value={categoryFilter}
                                onChange={e => setCategoryFilter(e.target.value)}
                            >
                                <option value="all">All Categories</option>
                                {categories.map(c => (
                                    <option key={c} value={c}>{c}</option>
                                ))}
                            </select>
                            <span className="text-[10px] font-normal text-slate-400 normal-case italic">Showing up to 200 items</span>
                        </div>
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                            <thead>
                                <tr className="border-b bg-slate-100/50">
                                    <th className="text-left p-3 font-bold text-slate-600 uppercase tracking-tighter">Emp ID</th>
                                    <th className="text-left p-3 font-bold text-slate-600 uppercase tracking-tighter">Name</th>
                                    <th className="text-left p-3 font-bold text-slate-600 uppercase tracking-tighter">Duty Code</th>
                                    <th className="text-left p-3 font-bold text-slate-600 uppercase tracking-tighter">Category</th>
                                    <th className="text-left p-3 font-bold text-slate-600 uppercase tracking-tighter">Shift Time</th>
                                </tr>
                            </thead>
                            <tbody>
                                {tableData.slice(0, 200).map((r, i) => (
                                    <tr key={i} className="border-b hover:bg-slate-50/80 transition-colors">
                                        <td className="p-3 font-mono font-medium text-slate-500">{r.emp_id}</td>
                                        <td className="p-3 font-semibold text-slate-800">{r.name}</td>
                                        <td className="p-3"><code className="bg-slate-100 px-1.5 py-0.5 rounded text-[10px] font-bold text-slate-600">{r.duty_code || r.duty_code_raw}</code></td>
                                        <td className="p-3">
                                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${getCategoryColor(r.duty_category)}`}>
                                                {r.duty_category}
                                            </span>
                                        </td>
                                        <td className="p-3 font-mono text-slate-500">
                                            {r.shift_start && r.shift_end ? `${r.shift_start}–${r.shift_end}` : <span className="text-slate-300">—</span>}
                                        </td>
                                    </tr>
                                ))}
                                {tableData.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="p-8 text-center text-slate-400 italic">No records found for the selected filters</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
