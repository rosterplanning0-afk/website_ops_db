'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid,
    Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import type { HistoricalMetricsRow } from '@/lib/roster-utils'

function formatDate(d: Date): string {
    return d.toISOString().split('T')[0]
}

function getDefaultFrom(): string {
    const d = new Date()
    d.setDate(d.getDate() - 30)
    return formatDate(d)
}

export default function HistoricalTrendsPage() {
    const [fromDate, setFromDate] = useState<string>(getDefaultFrom())
    const [toDate, setToDate] = useState<string>(formatDate(new Date()))
    const [crewFilter, setCrewFilter] = useState<string>('all')
    const [data, setData] = useState<HistoricalMetricsRow[]>([])
    const [loading, setLoading] = useState(true)
    const [crewTypes, setCrewTypes] = useState<string[]>([])
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
                .from('v_historical_metrics')
                .select('*')
                .gte('date', fromDate)
                .lte('date', toDate)
                .order('date', { ascending: true })

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
                setData(rows as HistoricalMetricsRow[])
                const types = [...new Set(rows.map((r: HistoricalMetricsRow) => r.crew_type).filter(Boolean))]
                setCrewTypes(types as string[])
            }
            setLoading(false)
        }
        fetchData()
    }, [fromDate, toDate, userRole, userDept, userInfoLoaded])

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
                        <select
                            className="border rounded-md px-3 py-2 text-sm bg-white"
                            value={crewFilter}
                            onChange={e => setCrewFilter(e.target.value)}
                        >
                            <option value="all">All Crew Types</option>
                            {crewTypes.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                        <div className="flex gap-2">
                            {[7, 14, 30, 60].map(days => (
                                <Button key={days} variant="outline" size="sm" onClick={() => {
                                    const d = new Date(); d.setDate(d.getDate() - days)
                                    setFromDate(formatDate(d)); setToDate(formatDate(new Date()))
                                }}>
                                    {days}d
                                </Button>
                            ))}
                        </div>
                    </div>
                </CardContent>
            </Card>

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
        </div>
    )
}
