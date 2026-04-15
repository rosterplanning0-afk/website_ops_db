'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, Legend, LineChart, Line, AreaChart, Area,
} from 'recharts'
import { BarChart3, PieChart as PieIcon, TrendingUp, UserCheck, Users } from 'lucide-react'

const COLORS = ['#dc2626', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316']

interface Inspection {
    id: number
    employee_id: string
    inspection_date: string
    overall_total: number
    inspected_by_name: string | null
    inspected_by_role: string | null
}

interface Employee {
    employee_id: string
    name: string
    designation: string | null
}

export default function InspectionStatsPage() {
    const [inspections, setInspections] = useState<Inspection[]>([])
    const [employees, setEmployees] = useState<Employee[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        async function load() {
            const supabase = createClient()
            setLoading(true)

            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            const { data: profile } = await supabase.from('users').select('role, employee_id').eq('id', user.id).single()
            let userRole = (profile?.role || 'employee') as string
            let userDept = ''

            if (profile?.employee_id) {
                const { data: empInfo } = await supabase.from('employees').select('role, department').eq('employee_id', profile.employee_id).single()
                if (empInfo) {
                    userRole = (empInfo.role?.toLowerCase() || userRole)
                    userDept = empInfo.department || ''
                }
            }

            let empQuery = supabase.from('employees').select('employee_id, name, designation, department')
            if (userRole !== 'admin' && userDept && userDept !== 'all') {
                empQuery = empQuery.eq('department', userDept)
            }
            const { data: empList } = await empQuery
            const filteredEmpIds = (empList || []).map(e => e.employee_id)

            let inspQuery = supabase.from('footplate_inspections').select('id, employee_id, inspection_date, overall_total, inspected_by_name, inspected_by_role').order('inspection_date', { ascending: false })
            if (userRole !== 'admin' && userDept && userDept !== 'all') {
                inspQuery = inspQuery.in('employee_id', filteredEmpIds)
            }
            const { data: inspList } = await inspQuery

            setInspections(inspList || [])
            setEmployees(empList || [])
            setLoading(false)
        }
        load()
    }, [])

    if (loading) return <div className="p-8 text-center text-muted-foreground">Loading inspection data...</div>

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

    // ── Table: Recent inspections ──
    const recentInspections = inspections.slice(0, 20)

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold text-slate-800">Inspection Statistics & Analysis</h2>

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
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><BarChart3 className="h-5 w-5" /> Recent Inspections</CardTitle>
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
                                {recentInspections.map(insp => {
                                    const emp = empMap.get(insp.employee_id)
                                    return (
                                        <TableRow key={insp.id}>
                                            <TableCell className="text-sm">{new Date(insp.inspection_date).toLocaleDateString('en-IN')}</TableCell>
                                            <TableCell className="font-medium">{emp?.name || insp.employee_id}</TableCell>
                                            <TableCell className="text-sm">{emp?.designation || '—'}</TableCell>
                                            <TableCell>
                                                <span className={`text-sm font-bold ${(insp.overall_total || 0) < 5 ? 'text-red-600' : (insp.overall_total || 0) < 8 ? 'text-amber-600' : 'text-green-600'}`}>
                                                    {insp.overall_total ?? 0}
                                                </span>
                                            </TableCell>
                                            <TableCell className="text-sm">{insp.inspected_by_name || '—'}</TableCell>
                                            <TableCell className="text-xs text-slate-500">{insp.inspected_by_role || '—'}</TableCell>
                                        </TableRow>
                                    )
                                })}
                                {recentInspections.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No inspections found.</TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
