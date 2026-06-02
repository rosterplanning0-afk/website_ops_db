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
import { RosterPlannerDashboardView } from '@/components/dashboard/roster-planner-view'

// Safe locale-agnostic date formatter (returns DD/MM/YYYY) to prevent hydration mismatches
function formatSafeDate(dateInput: string | Date | null | undefined): string {
    if (!dateInput) return '—'
    const str = typeof dateInput === 'string' ? dateInput : new Date(dateInput).toISOString()
    const cleanDate = str.split('T')[0]
    const parts = cleanDate.split('-')
    if (parts.length === 3) {
        const [year, month, day] = parts
        return `${day}/${month}/${year}`
    }
    return '—'
}

// Safe locale-agnostic date time formatter (returns "DD MMM, HH:MM") to prevent hydration mismatches
function formatSafeDateTime(dateInput: string | Date | null | undefined): string {
    if (!dateInput) return '—'
    const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput
    if (isNaN(d.getTime())) return '—'
    const day = d.getDate().toString().padStart(2, '0')
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    const month = months[d.getMonth()]
    const hours = d.getHours().toString().padStart(2, '0')
    const minutes = d.getMinutes().toString().padStart(2, '0')
    return `${day} ${month}, ${hours}:${minutes}`
}

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
        ? await supabase.from('employees').select('role, department, designation, is_line_inspector').eq('employee_id', profile.employee_id).single()
        : { data: null }

    const role = (empData?.role?.toLowerCase() || profile?.role?.toLowerCase() || 'employee') as UserRole
    const isCrewController = empData?.designation?.toLowerCase().includes('crew controller') ?? false
    const isLineInspector = !!empData?.is_line_inspector
    const canCreateInstruction = ['admin', 'hod', 'manager'].includes(role)
    const userDepartment = empData?.department || 'all'
    const deptLower = userDepartment.toLowerCase()

    let inspectionLink = '/train-operations/new-inspection'
    let inspectionLabel = 'New Inspection Form'

    if (deptLower.includes('occ')) {
        inspectionLink = '/occ/inspection'
        inspectionLabel = 'New OCC Inspection'
    } else if (deptLower.includes('station')) {
        inspectionLink = '/station-control/inspection'
        inspectionLabel = 'New Station Inspection'
    }

    // ── Shared data fetches ──
    const { count: totalEmployees } = await supabase.from('employees').select('*', { count: 'exact', head: true })

    // ── Pending inspections: employees sorted by most days since last inspection ──
    const { data: allEmployees } = await supabase
        .from('employees')
        .select('employee_id, name, designation, department, gender, manager_id')
        .in('status', ['Active', 'Notice Period'])
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
    
    // Extract unique designations under this manager/hod
    const allowedDesignations = Array.from(new Set(departmentEmployees.map(e => e.designation).filter(Boolean)))

    let instructionsQuery = supabase
        .from('instructions')
        .select(role === 'admin' 
            ? 'id, title, priority, created_at' 
            : 'id, title, priority, created_at, instruction_designation_assignments!inner(designation)'
        )
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(5)

    if (role !== 'admin' && allowedDesignations.length > 0) {
        instructionsQuery = instructionsQuery.in('instruction_designation_assignments.designation', [...allowedDesignations, 'All Staff'])
    } else if (role !== 'admin') {
        // If they have no employees, they only see All Staff
        instructionsQuery = instructionsQuery.eq('instruction_designation_assignments.designation', 'All Staff')
    }

    const { data: latestInstructions } = await instructionsQuery

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
    let inspectorQuery = supabase
        .from('footplate_inspections')
        .select('inspected_by_name, inspected_by_role')
        .not('inspected_by_name', 'is', null)

    if (role !== 'admin' && departmentEmployees.length > 0) {
        inspectorQuery = inspectorQuery.in('employee_id', departmentEmployees.map(e => e.employee_id))
    }

    const { data: inspectorStats } = await inspectorQuery

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
    let monthlyInspectionsQuery = supabase
        .from('footplate_inspections')
        .select('*', { count: 'exact', head: true })
        .gte('inspection_date', monthStart)
    
    if (role !== 'admin' && departmentEmployees.length > 0) {
        monthlyInspectionsQuery = monthlyInspectionsQuery.in('employee_id', departmentEmployees.map(e => e.employee_id))
    }
    const { count: monthlyInspections } = await monthlyInspectionsQuery

    // ── Pending ack count ──
    let pendingAcksQuery = supabase
        .from('instruction_acknowledgements')
        .select('*', { count: 'exact', head: true })
        .is('acknowledged_at', null)
    
    if (role !== 'admin' && departmentEmployees.length > 0) {
        pendingAcksQuery = pendingAcksQuery.in('employee_id', departmentEmployees.map(e => e.employee_id))
    }
    const { count: pendingAcks } = await pendingAcksQuery

    // ── Recent Line Defects (for crew controllers, managers, HOD, admin) ──
    const showLineDefects = role === 'admin' || role === 'hod' || role === 'manager' || isCrewController
    
    let lineDefectsQuery = supabase
        .from('line_defects')
        .select('id, emp_name, emp_id, failure_related_to, location, details, reported_at, status')
        .order('reported_at', { ascending: false })
        .limit(5)
    
    if (role !== 'admin' && departmentEmployees.length > 0) {
        lineDefectsQuery = lineDefectsQuery.in('emp_id', departmentEmployees.map(e => e.employee_id))
    }

    const { data: recentLineDefects } = showLineDefects ? await lineDefectsQuery : { data: null }

    // ── Expiring Competencies (expires in 90 days or less) ──
    const showExpiringCompetencies = role === 'admin' || role === 'hod' || role === 'manager' || role === 'roster_planners'
    const ninetyDaysFromNow = new Date(today.getTime() + 90 * 86400000).toISOString().split('T')[0]
    const todayStr = today.toISOString().split('T')[0]

    const { data: expiringCompetencies } = showExpiringCompetencies
        ? await supabase
            .from('employee_competencies')
            .select('*')
            .lte('valid_till', ninetyDaysFromNow)
            .gte('valid_till', todayStr)
            .order('valid_till', { ascending: true })
        : { data: null }

    const nameMap = new Map(allEmployees?.map(e => [e.employee_id, e.name]) || [])
    let expiringCompetencyList = expiringCompetencies?.map((c: any) => {
        const validTillDate = new Date(c.valid_till)
        const diffTime = validTillDate.getTime() - today.getTime()
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
        return { ...c, diffDays, empName: nameMap.get(c.employee_id) || 'Unknown' }
    }) || []

    // Filter by department/delegation for non-admin roles
    if (role !== 'admin') {
        const allowedEmpIds = new Set(departmentEmployees.map(e => e.employee_id))
        expiringCompetencyList = expiringCompetencyList.filter(c => allowedEmpIds.has(c.employee_id))
    }

    // ═══════════════════════════
    //  EMPLOYEE DASHBOARD
    // ═══════════════════════════
    if (role === 'employee') {
        const { data: myCounselling } = profile?.employee_id
            ? await supabase.from('employee_counselling').select('score').eq('employee_id', profile.employee_id)
            : { data: [] }

        let goodScore = 0;
        let badScore = 0;
        myCounselling?.forEach(rec => {
            if ((rec.score || 0) > 0) goodScore += rec.score;
            if ((rec.score || 0) < 0) badScore += rec.score;
        });
        const netScore = goodScore + badScore;

        return (
            <div className="space-y-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <h2 className="text-2xl font-bold text-slate-800">My Dashboard</h2>
                    {isLineInspector && (
                        <Link href={inspectionLink}>
                            <Button className="bg-red-600 hover:bg-red-700">
                                <Plus className="h-4 w-4 mr-1" /> {inspectionLabel}
                            </Button>
                        </Link>
                    )}
                </div>

                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    <Card className="lg:col-span-2">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <AlertTriangle className="h-5 w-5 text-amber-500" /> Latest Assurance
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
                            <div className="grid grid-cols-3 gap-4 mb-4 text-center">
                                <div className="p-4 bg-green-50 rounded-lg border border-green-100">
                                    <p className="text-xs font-bold text-green-700 uppercase tracking-wider mb-1">Good</p>
                                    <p className="text-2xl font-black text-green-600">+{goodScore}</p>
                                </div>
                                <div className="p-4 bg-red-50 rounded-lg border border-red-100">
                                    <p className="text-xs font-bold text-red-700 uppercase tracking-wider mb-1">Bad</p>
                                    <p className="text-2xl font-black text-red-600">{badScore}</p>
                                </div>
                                <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                                    <p className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Net</p>
                                    <p className={`text-2xl font-black ${netScore > 0 ? 'text-green-600' : netScore < 0 ? 'text-red-600' : 'text-slate-800'}`}>
                                        {netScore > 0 ? `+${netScore}` : netScore}
                                    </p>
                                </div>
                            </div>
                            <div className="border-t pt-4 text-center">
                                <Link href="/counselling/my-counselling">
                                    <Button variant="outline" className="w-full font-medium">
                                        View Detailed Counselling History
                                    </Button>
                                </Link>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {isLineInspector && (
                    <Card className="w-full">
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
                                                <TableCell className="text-sm" suppressHydrationWarning>
                                                    {emp.lastInspectionDate ? formatSafeDate(emp.lastInspectionDate) : <span className="text-red-500 font-semibold">Never</span>}
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
                )}

                {/* Crew Controller: Recent Line Defects */}
                {isCrewController && recentLineDefects && (
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle className="flex items-center gap-2">
                                <AlertTriangle className="h-5 w-5 text-amber-500" /> Recent Line Defects
                            </CardTitle>
                            <Link href="/train-operations/line-defects">
                                <Button size="sm" variant="outline">View All</Button>
                            </Link>
                        </CardHeader>
                        <CardContent className="p-0">
                            {recentLineDefects.length === 0 ? (
                                <p className="text-sm text-muted-foreground text-center py-6">No defects reported recently.</p>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-xs">
                                        <thead>
                                            <tr className="border-b bg-slate-50">
                                                <th className="text-left py-2 px-4 font-semibold text-slate-500 uppercase">Time</th>
                                                <th className="text-left py-2 px-4 font-semibold text-slate-500 uppercase">By</th>
                                                <th className="text-left py-2 px-4 font-semibold text-slate-500 uppercase">Failure</th>
                                                <th className="text-left py-2 px-4 font-semibold text-slate-500 uppercase">Location</th>
                                                <th className="text-left py-2 px-4 font-semibold text-slate-500 uppercase">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {recentLineDefects.map((d: any) => (
                                                <tr key={d.id} className="border-b hover:bg-slate-50">
                                                    <td className="py-2 px-4 font-mono text-slate-400 whitespace-nowrap" suppressHydrationWarning>
                                                        {formatSafeDateTime(d.reported_at)}
                                                    </td>
                                                    <td className="py-2 px-4 font-medium text-slate-700">{d.emp_name}</td>
                                                    <td className="py-2 px-4">
                                                        <span className="px-1.5 py-0.5 bg-amber-50 border border-amber-200 text-amber-700 rounded text-[10px] font-semibold">
                                                            {d.failure_related_to}
                                                        </span>
                                                    </td>
                                                    <td className="py-2 px-4 text-slate-600">{d.location}</td>
                                                    <td className="py-2 px-4">
                                                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${d.status === 'open' ? 'bg-red-100 text-red-700' : d.status === 'in_progress' ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
                                                            {d.status}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                )}
            </div>
        )
    }

    // ═══════════════════════════
    //  ROSTER PLANNER DASHBOARD
    // ═══════════════════════════
    if (role === 'roster_planners') {
        return <RosterPlannerDashboardView 
            department={userDepartment} 
            allowedEmployeeIds={departmentEmployees.map(e => e.employee_id)} 
        />
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
                        <CardTitle className="text-sm font-medium">Active Assurance</CardTitle>
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
                                            <TableCell className="text-sm" suppressHydrationWarning>
                                                {emp.lastInspectionDate ? formatSafeDate(emp.lastInspectionDate) : <span className="text-red-500 font-semibold">Never</span>}
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
                            <CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5" /> Latest Assurance</CardTitle>
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
                                                <p className="text-xs text-slate-400" suppressHydrationWarning>{inst.created_at ? formatSafeDate(inst.created_at) : ''}</p>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="text-sm text-muted-foreground text-center py-4">No assurance found.</p>
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

                    {/* Recent Line Defects */}
                    {recentLineDefects && (
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between">
                                <CardTitle className="flex items-center gap-2 text-sm">
                                    <AlertTriangle className="h-4 w-4 text-amber-500" /> Recent Line Defects
                                </CardTitle>
                                <Link href="/train-operations/line-defects">
                                    <Button size="sm" variant="outline" className="text-xs h-7">View All</Button>
                                </Link>
                            </CardHeader>
                            <CardContent>
                                {recentLineDefects.length === 0 ? (
                                    <p className="text-sm text-muted-foreground text-center py-4">No defects reported recently.</p>
                                ) : (
                                    <ul className="space-y-2">
                                        {recentLineDefects.map((d: any) => (
                                            <li key={d.id} className="p-2.5 bg-slate-50 rounded-md border border-slate-100">
                                                <div className="flex items-start justify-between gap-2 mb-1">
                                                    <span className="px-1.5 py-0.5 bg-amber-50 border border-amber-200 text-amber-700 rounded text-[10px] font-bold uppercase">
                                                        {d.failure_related_to}
                                                    </span>
                                                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase shrink-0 ${d.status === 'open' ? 'bg-red-100 text-red-700' : d.status === 'in_progress' ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
                                                        {d.status}
                                                    </span>
                                                </div>
                                                <p className="text-xs font-medium text-slate-700 truncate">{d.location}</p>
                                                <p className="text-xs text-slate-400 mt-0.5" suppressHydrationWarning>
                                                    {d.emp_name} · {formatSafeDateTime(d.reported_at)}
                                                </p>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </CardContent>
                        </Card>
                    )}


                </div>
            </div>

            {/* Expiring Competencies — full width, always visible for admin/hod/manager */}
            {showExpiringCompetencies && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Activity className="h-5 w-5 text-red-500" />
                            Expiring Competencies
                            <span className="text-xs font-normal text-muted-foreground ml-2">(active roles expiring within 90 days · sorted by earliest expiry)</span>
                            {expiringCompetencyList.length > 0 && (
                                <span className="ml-auto text-xs font-semibold bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                                    {expiringCompetencyList.length} record{expiringCompetencyList.length !== 1 ? 's' : ''}
                                </span>
                            )}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        {expiringCompetencyList.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-8">
                                No competencies expiring within the next 90 days.
                            </p>
                        ) : (
                            <div className="overflow-x-auto max-h-[360px] overflow-y-auto">
                                <Table>
                                    <TableHeader className="sticky top-0 bg-white z-10">
                                        <TableRow className="bg-slate-50">
                                            <TableHead>Employee</TableHead>
                                            <TableHead>Designation</TableHead>
                                            <TableHead>Department</TableHead>
                                            <TableHead>Expiry Date</TableHead>
                                            <TableHead>Days Left</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody suppressHydrationWarning>
                                        {expiringCompetencyList.map(c => (
                                            <TableRow key={c.id}>
                                                <TableCell>
                                                    <div className="font-medium text-sm">{c.empName}</div>
                                                    <div className="text-xs text-slate-400 font-mono">{c.employee_id}</div>
                                                </TableCell>
                                                <TableCell className="text-sm">{c.designation}</TableCell>
                                                <TableCell className="text-sm">{c.department}</TableCell>
                                                <TableCell className="text-sm font-mono" suppressHydrationWarning>
                                                    {formatSafeDate(c.valid_till)}
                                                </TableCell>
                                                <TableCell>
                                                    <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                                                        c.diffDays > 60 ? 'bg-green-100 text-green-700'
                                                        : c.diffDays >= 30 ? 'bg-amber-100 text-amber-700'
                                                        : 'bg-red-100 text-red-700'
                                                    }`}>
                                                        {c.diffDays}d
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
