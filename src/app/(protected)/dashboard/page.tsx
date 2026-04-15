import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { InstructionBlocker } from '@/components/instruction-blocker'
import { DashboardInstructionList } from '@/components/dashboard-instruction-list'
import {
    Users, FileText, Activity, AlertTriangle, CheckCircle,
    TrendingUp, ClipboardCheck, Plus, Clock, BarChart3, UserCheck, MessageCircle
} from 'lucide-react'
import type { UserRole } from '@/lib/rbac'

export default async function DashboardPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/')

    const { data: profile } = await supabase
        .from('users')
        .select('full_name, role, employee_id')
        .eq('id', user.id)
        .single()

    const { data: empData } = profile?.employee_id
        ? await supabase.from('employees').select('role, department').eq('employee_id', profile.employee_id).single()
        : { data: null }

    const role = (empData?.role?.toLowerCase() || profile?.role?.toLowerCase() || 'employee') as UserRole
    const canCreateInstruction = ['admin', 'hod', 'manager'].includes(role)
    const userDepartment = empData?.department || 'all'
    const deptLower = userDepartment.toLowerCase()

    let inspectionLink = '/train-operations/inspection'
    let inspectionLabel = 'New TO Inspection'

    if (deptLower.includes('occ')) {
        inspectionLink = '/occ/inspection'
        inspectionLabel = 'New OCC Inspection'
    } else if (deptLower.includes('station')) {
        inspectionLink = '/station-control/inspection'
        inspectionLabel = 'New Station Inspection'
    }

    // ── Shared data fetches ──
    const { count: totalEmployees } = await supabase.from('employees').select('*', { count: 'exact', head: true })
    const { data: latestInstructions } = await supabase
        .from('instructions')
        .select('id, title, priority, created_at')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(5)

    // ── Pending inspections: employees sorted by most days since last inspection ──
    const { data: allEmployees } = await supabase
        .from('employees')
        .select('employee_id, name, designation, department, gender, manager_id')
        .eq('status', 'Active')
        .order('name')

    // Filter employees for dashboard breakdowns depending on role
    let departmentEmployees = allEmployees || []
    if (role === 'manager') {
        const userId = profile?.employee_id || ''
        departmentEmployees = departmentEmployees.filter(e => e.department === userDepartment || e.manager_id === userId)
    } else if (role !== 'admin' && userDepartment !== 'all') {
        departmentEmployees = departmentEmployees.filter(e => e.department === userDepartment)
    }

    const dashboardTotalEmployees = departmentEmployees.length

    // Calculate Designation & Gender Breakdowns
    const designationBreakdown = departmentEmployees.reduce((acc, emp) => {
        const desig = emp.designation || 'Unknown'
        const gender = (emp.gender || 'Unknown').toLowerCase()
        if (!acc[desig]) acc[desig] = { total: 0, male: 0, female: 0, other: 0 }
        acc[desig].total += 1
        if (gender === 'male' || gender === 'm') acc[desig].male += 1
        else if (gender === 'female' || gender === 'f') acc[desig].female += 1
        else acc[desig].other += 1
        return acc
    }, {} as Record<string, { total: number, male: number, female: number, other: number }>)

    const { data: latestInspections } = await supabase
        .from('footplate_inspections')
        .select('employee_id, inspection_date')
        .order('inspection_date', { ascending: false })

    // Build map: employee_id → latest inspection_date
    const inspectionMap = new Map<string, string>()
    latestInspections?.forEach(insp => {
        if (!inspectionMap.has(insp.employee_id)) {
            inspectionMap.set(insp.employee_id, insp.inspection_date)
        }
    })

    const today = new Date()
    const pendingList = departmentEmployees.map(emp => {
        const lastDate = inspectionMap.get(emp.employee_id)
        const daysPending = lastDate
            ? Math.floor((today.getTime() - new Date(lastDate).getTime()) / 86400000)
            : 999 // Never inspected = highest urgency
        return { ...emp, lastInspectionDate: lastDate || null, daysPending }
    }).sort((a, b) => b.daysPending - a.daysPending)

    // ── Inspector stats (for HoD) ──
    const { data: inspectorStats } = await supabase
        .from('footplate_inspections')
        .select('inspected_by_name, inspected_by_role')
        .not('inspected_by_name', 'is', null)

    const inspectorCounts = new Map<string, number>()
    inspectorStats?.forEach(i => {
        const key = i.inspected_by_name || 'Unknown'
        inspectorCounts.set(key, (inspectorCounts.get(key) || 0) + 1)
    })
    const inspectorList = [...inspectorCounts.entries()]
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)

    // ── Monthly inspection count ──
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0]
    const { count: monthlyInspections } = await supabase
        .from('footplate_inspections')
        .select('*', { count: 'exact', head: true })
        .gte('inspection_date', monthStart)

    // ── Pending ack count ──
    const { count: pendingAcks } = await supabase
        .from('instruction_acknowledgements')
        .select('*', { count: 'exact', head: true })
        .is('acknowledged_at', null)

    // ═══════════════════════════
    //  EMPLOYEE DASHBOARD
    // ═══════════════════════════
    if (role === 'employee') {
        const { data: myCounselling } = profile?.employee_id 
            ? await supabase.from('employee_counselling').select(`
                id, counselling_date, reason, remarks, counselled_by,
                users:counselled_by (full_name)
            `).eq('employee_id', profile.employee_id).order('counselling_date', { ascending: false }).limit(5)
            : { data: [] }

        return (
            <div className="space-y-6">
                <InstructionBlocker userId={user.id} />
                <h2 className="text-2xl font-bold text-slate-800">My Dashboard</h2>
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    <Card className="lg:col-span-2">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <AlertTriangle className="h-5 w-5 text-amber-500" /> Latest Instructions
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <DashboardInstructionList userId={user.id} />
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <MessageCircle className="h-5 w-5 text-slate-500" /> My Counselling
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {myCounselling && myCounselling.length > 0 ? (
                                <ul className="space-y-3">
                                    {myCounselling.map(rec => (
                                        <li key={rec.id} className="p-3 bg-slate-50 rounded-md border border-slate-100">
                                            <div className="flex justify-between items-start mb-1">
                                                <span className="font-semibold text-sm text-slate-800">{rec.reason}</span>
                                                <span className="text-xs text-slate-500 font-medium whitespace-nowrap ml-2">
                                                    {new Date(rec.counselling_date).toLocaleDateString('en-IN')}
                                                </span>
                                            </div>
                                            {rec.remarks && <p className="text-xs text-slate-600 mb-2">{rec.remarks}</p>}
                                            <div className="text-[10px] text-slate-400 font-medium">
                                                Counselled by: {(rec.users as any)?.full_name || 'Admin'}
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="text-sm text-muted-foreground text-center py-6">No recent counselling records.</p>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        )
    }

    // ═══════════════════════════
    //  MANAGER / HOD / ADMIN DASHBOARD
    // ═══════════════════════════
    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <h2 className="text-2xl font-bold text-slate-800">Dashboard</h2>
                {canCreateInstruction && (
                    <Link href={inspectionLink}>
                        <Button className="bg-red-600 hover:bg-red-700"><Plus className="h-4 w-4 mr-1" /> {inspectionLabel}</Button>
                    </Link>
                )}
            </div>

            {/* KPI Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card className="flex flex-col">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Employees</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent className="flex-1 flex flex-col">
                        <div className="text-2xl font-bold">{dashboardTotalEmployees}</div>
                        <p className="text-xs text-muted-foreground mb-4">Active in {role === 'admin' ? 'System' : role === 'manager' ? 'Your Team' : 'Department'}</p>

                        <div className="mt-auto space-y-2 max-h-[120px] overflow-y-auto pr-1">
                            {Object.entries(designationBreakdown).map(([desig, counts]) => (
                                <div key={desig} className="text-xs border-t pt-2 mt-2 first:border-0 first:pt-0 first:mt-0">
                                    <div className="flex justify-between font-semibold text-slate-700">
                                        <span className="truncate pr-2">{desig}</span>
                                        <span>{counts.total}</span>
                                    </div>
                                    <div className="flex gap-2 mt-0.5 text-slate-500 text-[10px]">
                                        {counts.male > 0 && <span>M: {counts.male}</span>}
                                        {counts.female > 0 && <span>F: {counts.female}</span>}
                                        {counts.other > 0 && <span>O: {counts.other}</span>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Monthly Inspections</CardTitle>
                        <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{monthlyInspections ?? 0}</div>
                        <p className="text-xs text-muted-foreground">This month</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Pending Acknowledgements</CardTitle>
                        <Clock className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{pendingAcks ?? 0}</div>
                        <p className="text-xs text-muted-foreground">Awaiting response</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Active Instructions</CardTitle>
                        <FileText className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{latestInstructions?.length || 0}</div>
                        <p className="text-xs text-muted-foreground">Currently published</p>
                    </CardContent>
                </Card>
            </div>

            {/* Two-column: Pending Inspections + Instructions/Inspector Analysis */}
            <div className="grid gap-6 lg:grid-cols-5">
                {/* Pending Inspections — left (wider) */}
                <Card className="lg:col-span-3">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <AlertTriangle className="h-5 w-5 text-amber-500" />
                            Pending Inspections
                            <span className="text-xs font-normal text-muted-foreground ml-2">(sorted by most overdue)</span>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Employee ID</TableHead>
                                        <TableHead>Name</TableHead>
                                        <TableHead>Designation</TableHead>
                                        <TableHead>Last Inspection</TableHead>
                                        <TableHead>Days Pending</TableHead>
                                        <TableHead>Action</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {pendingList.slice(0, 15).map(emp => (
                                        <TableRow key={emp.employee_id}>
                                            <TableCell className="font-mono text-sm">{emp.employee_id}</TableCell>
                                            <TableCell className="font-medium">{emp.name}</TableCell>
                                            <TableCell className="text-sm">{emp.designation || '—'}</TableCell>
                                            <TableCell className="text-sm">
                                                {emp.lastInspectionDate ? new Date(emp.lastInspectionDate).toLocaleDateString('en-IN') : <span className="text-red-500 font-semibold">Never</span>}
                                            </TableCell>
                                            <TableCell>
                                                <span className={`text-xs font-bold px-2 py-0.5 rounded ${emp.daysPending >= 90 ? 'bg-red-100 text-red-700'
                                                    : emp.daysPending >= 30 ? 'bg-amber-100 text-amber-700'
                                                        : 'bg-green-100 text-green-700'
                                                    }`}>
                                                    {emp.daysPending >= 999 ? 'Never' : `${emp.daysPending}d`}
                                                </span>
                                            </TableCell>
                                            <TableCell>
                                                <Link href={inspectionLink}>
                                                    <Button size="sm" variant="outline"><ClipboardCheck className="h-3 w-3 mr-1" /> Inspect</Button>
                                                </Link>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>

                {/* Right column: Latest Instructions + (HoD) Inspector Analysis */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Latest Instructions */}
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5" /> Latest Instructions</CardTitle>
                            {canCreateInstruction && (
                                <Link href="/train-operations/instructions">
                                    <Button size="sm" variant="outline"><Plus className="h-3 w-3 mr-1" /> New</Button>
                                </Link>
                            )}
                        </CardHeader>
                        <CardContent>
                            {latestInstructions && latestInstructions.length > 0 ? (
                                <ul className="space-y-2">
                                    {latestInstructions.map(inst => (
                                        <li key={inst.id} className="flex items-start gap-3 p-2.5 bg-slate-50 rounded-md">
                                            <FileText className="h-4 w-4 mt-0.5 text-red-500 shrink-0" />
                                            <div className="min-w-0">
                                                <p className="text-sm font-medium text-slate-800 truncate">{inst.title}</p>
                                                <p className="text-xs text-slate-400">{inst.created_at ? new Date(inst.created_at).toLocaleDateString('en-IN') : ''}</p>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="text-sm text-muted-foreground text-center py-4">No instructions found.</p>
                            )}
                        </CardContent>
                    </Card>

                    {/* Inspector Analysis — HoD and Admin only */}
                    {(role === 'hod' || role === 'admin') && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2"><UserCheck className="h-5 w-5 text-blue-500" /> Inspector Analysis</CardTitle>
                            </CardHeader>
                            <CardContent>
                                {inspectorList.length > 0 ? (
                                    <ul className="space-y-2">
                                        {inspectorList.slice(0, 8).map((insp, i) => (
                                            <li key={i} className="flex items-center justify-between p-2.5 bg-slate-50 rounded-md">
                                                <div className="flex items-center gap-2">
                                                    <span className="w-6 h-6 rounded-full bg-red-600 text-white text-xs flex items-center justify-center font-bold">{i + 1}</span>
                                                    <span className="text-sm font-medium text-slate-700">{insp.name}</span>
                                                </div>
                                                <span className="text-sm font-bold text-slate-800">{insp.count} <span className="text-xs text-slate-400 font-normal">inspections</span></span>
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <p className="text-sm text-muted-foreground text-center py-4">No inspection data yet.</p>
                                )}
                                <Link href="/reports/inspection-stats" className="block mt-3">
                                    <Button variant="outline" size="sm" className="w-full"><BarChart3 className="h-3 w-3 mr-1" /> View Detailed Report</Button>
                                </Link>
                            </CardContent>
                        </Card>
                    )}

                    {/* Quick Actions */}
                    <Card>
                        <CardHeader><CardTitle>Quick Actions</CardTitle></CardHeader>
                        <CardContent className="space-y-2">
                            <Link href={inspectionLink} className="block w-full p-3 hover:bg-slate-100 rounded-md border text-sm font-medium transition-colors">
                                <ClipboardCheck className="h-4 w-4 inline mr-2" /> {inspectionLabel}
                            </Link>
                            <Link href="/employees" className="block w-full p-3 hover:bg-slate-100 rounded-md border text-sm font-medium transition-colors">
                                <Users className="h-4 w-4 inline mr-2" /> View Employees
                            </Link>
                            <Link href="/reports/instruction-ack" className="block w-full p-3 hover:bg-slate-100 rounded-md border text-sm font-medium transition-colors">
                                <FileText className="h-4 w-4 inline mr-2" /> Instruction Ack Report
                            </Link>
                            <Link href="/reports/inspection-stats" className="block w-full p-3 hover:bg-slate-100 rounded-md border text-sm font-medium transition-colors">
                                <BarChart3 className="h-4 w-4 inline mr-2" /> Inspection Statistics
                            </Link>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    )
}
