'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { UserPlus, History, Search, ShieldAlert, CheckCircle2 } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface Scope {
    isAdmin: boolean
    department_scope: string | null
    designation_scope: string | null
}

interface EmployeeRow {
    employee_id: string
    name: string
    designation: string
    department: string
    manager_id: string | null
    manager_name: string | null
}

interface ManagerOption {
    employee_id: string
    name: string
    designation: string
}

interface HistoryRow {
    id: string
    manager_id: string
    manager_name: string
    assigned_by_name: string
    valid_from: string
    valid_to: string | null
}

export default function AssignManagerPage() {
    const supabase = createClient()
    const router = useRouter()
    
    const [loading, setLoading] = useState(true)
    const [authorized, setAuthorized] = useState(false)
    const [scope, setScope] = useState<Scope>({ isAdmin: false, department_scope: null, designation_scope: null })
    
    const [employees, setEmployees] = useState<EmployeeRow[]>([])
    const [searchQuery, setSearchQuery] = useState('')
    const [potentialManagers, setPotentialManagers] = useState<ManagerOption[]>([])
    
    // Bulk Selection State
    const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<Set<string>>(new Set())

    // Assignment Modal State
    const [isAssignOpen, setIsAssignOpen] = useState(false)
    const [targetEmps, setTargetEmps] = useState<EmployeeRow[]>([])
    const [newManagerId, setNewManagerId] = useState('')
    const [saving, setSaving] = useState(false)
    const [successMsg, setSuccessMsg] = useState('')

    // History Modal State
    const [isHistoryOpen, setIsHistoryOpen] = useState(false)
    const [selectedEmpForHistory, setSelectedEmpForHistory] = useState<EmployeeRow | null>(null)
    const [historyLogs, setHistoryLogs] = useState<HistoryRow[]>([])
    const [loadingHistory, setLoadingHistory] = useState(false)

    useEffect(() => {
        loadData()
    }, [])

    async function loadData() {
        setLoading(true)
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { router.push('/'); return }

        // Determine if they are Admin
        const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
        const isAdmin = profile?.role === 'admin'

        // Check for delegation rights if not admin
        let deptScope: string | null = null
        let desigScope: string | null = null
        let hasRights = isAdmin

        if (!isAdmin) {
            const { data: rights } = await supabase.from('manager_assignment_rights')
                .select('department_scope, designation_scope')
                .eq('granted_to', user.id)
                .single()
            
            if (rights) {
                hasRights = true
                deptScope = rights.department_scope
                desigScope = rights.designation_scope
            }
        }

        if (!hasRights) {
            setAuthorized(false)
            setLoading(false)
            return
        }

        setScope({ isAdmin, department_scope: deptScope, designation_scope: desigScope })
        setAuthorized(true)

        // Load potential managers
        // We consider 'manager', 'hod', 'cxo', 'admin', 'roster_planners' as potential managers.
        const { data: mgrs } = await supabase.from('employees')
            .select('employee_id, name, designation')
            .in('role', ['manager', 'hod', 'cxo', 'admin', 'roster_planners'])
            .eq('status', 'Active')
            .order('name')
        
        if (mgrs) setPotentialManagers(mgrs)

        // Load employees within scope
        let query = supabase.from('employees').select(`
            employee_id, name, designation, department, manager_id
        `).eq('status', 'Active')

        if (!isAdmin) {
            if (deptScope) query = query.eq('department', deptScope)
            if (desigScope) query = query.eq('designation', desigScope)
        }

        const { data: emps } = await query.order('name')
        
        // We will fetch names for current managers
        const managerIds = [...new Set(emps?.map(e => e.manager_id).filter(Boolean))] as string[]
        
        // Fetch manager names (even if they are outside current scope)
        let managerMap = new Map<string, string>()
        if (managerIds.length > 0) {
            const { data: managers } = await supabase.from('employees').select('employee_id, name').in('employee_id', managerIds)
            managerMap = new Map((managers || []).map(m => [m.employee_id, m.name]))
        }

        if (emps) {
            setEmployees(emps.map(e => ({
                ...e,
                manager_name: e.manager_id ? (managerMap.get(e.manager_id) || 'Unknown') : null
            })))
        }

        setLoading(false)
    }

    async function handleAssignManager(e: React.FormEvent) {
        e.preventDefault()
        if (targetEmps.length === 0 || !newManagerId) return

        setSaving(true)
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        // Validate manager exists from potentialManagers list
        const mgrCheck = potentialManagers.find(m => m.employee_id === newManagerId)
        if (!mgrCheck) {
            alert('Manager Employee ID not found in the valid list!')
            setSaving(false)
            return
        }

        const targetIds = targetEmps.map(emp => emp.employee_id)

        // 1. Close current active assignments in history
        await supabase.from('employee_manager_history')
            .update({ valid_to: new Date().toISOString() })
            .in('employee_id', targetIds)
            .is('valid_to', null)

        // 2. Insert new assignment history for all
        const historyInserts = targetIds.map(empId => ({
            employee_id: empId,
            manager_id: mgrCheck.employee_id,
            assigned_by: user.id
        }))
        const { error: histError } = await supabase.from('employee_manager_history').insert(historyInserts)

        if (histError) {
            alert('Failed to log assignment history: ' + histError.message)
            setSaving(false)
            return
        }

        // 3. Update the quick manager_id pointer
        const { error: updateError } = await supabase.from('employees')
            .update({ manager_id: mgrCheck.employee_id })
            .in('employee_id', targetIds)

        setSaving(false)

        if (!updateError) {
            setSuccessMsg(`Successfully assigned ${mgrCheck.name} as manager for ${targetEmps.length} employee(s)`)
            setIsAssignOpen(false)
            setNewManagerId('')
            setSelectedEmployeeIds(new Set())
            loadData() // Refresh board
            setTimeout(() => setSuccessMsg(''), 5000)
        } else {
            alert('Failed to update employee record: ' + updateError.message)
        }
    }

    async function viewHistory(employee: EmployeeRow) {
        setSelectedEmpForHistory(employee)
        setIsHistoryOpen(true)
        setLoadingHistory(true)
        setHistoryLogs([])

        const { data: history } = await supabase.from('employee_manager_history').select(`
            id, manager_id, valid_from, valid_to,
            users:assigned_by (full_name)
        `).eq('employee_id', employee.employee_id).order('valid_from', { ascending: false })

        if (history) {
            const mIds = [...new Set(history.map(h => h.manager_id))]
            const { data: mData } = await supabase.from('employees').select('employee_id, name').in('employee_id', mIds)
            const map = new Map((mData || []).map(m => [m.employee_id, m.name]))

            setHistoryLogs(history.map(h => ({
                id: h.id,
                manager_id: h.manager_id,
                manager_name: map.get(h.manager_id) || 'Unknown',
                assigned_by_name: (h.users as any)?.full_name || 'System',
                valid_from: h.valid_from,
                valid_to: h.valid_to
            })))
        }
        setLoadingHistory(false)
    }

    const toggleEmployeeSelection = (employeeId: string) => {
        setSelectedEmployeeIds(prev => {
            const next = new Set(prev)
            if (next.has(employeeId)) next.delete(employeeId)
            else next.add(employeeId)
            return next
        })
    }

    const toggleAllEmployees = () => {
        if (selectedEmployeeIds.size === filteredEmployees.length) {
            setSelectedEmployeeIds(new Set())
        } else {
            setSelectedEmployeeIds(new Set(filteredEmployees.map(e => e.employee_id)))
        }
    }

    const filteredEmployees = employees.filter(e => 
        e.employee_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.department?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.designation?.toLowerCase().includes(searchQuery.toLowerCase())
    )

    if (loading) return <div className="p-8 text-center text-muted-foreground">Verifying access...</div>

    if (!authorized) return (
        <div className="p-12 text-center max-w-md mx-auto">
            <ShieldAlert className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-slate-800 mb-2">Unauthorized Access</h2>
            <p className="text-slate-600">You do not have permission to assign managers. If you require this access, please contact an Administrator to configure Delegation Settings.</p>
        </div>
    )

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800">Assign Managers</h2>
                    <p className="text-sm text-slate-500 mt-1">
                        Currently viewing {" "}
                        <span className="font-semibold text-slate-700">
                            {scope.isAdmin ? 'all system employees' : `${scope.department_scope || 'All Depts'} — ${scope.designation_scope || 'All Designations'}`}
                        </span>
                    </p>
                </div>
                
                <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
                    {selectedEmployeeIds.size > 0 && (
                        <Button 
                            className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white" 
                            onClick={() => {
                                setTargetEmps(employees.filter(e => selectedEmployeeIds.has(e.employee_id)))
                                setNewManagerId('')
                                setIsAssignOpen(true)
                            }}
                        >
                            <UserPlus className="h-4 w-4 mr-2" /> Assign Manager to {selectedEmployeeIds.size}
                        </Button>
                    )}
                    <div className="relative w-full sm:w-64">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                        <Input 
                            placeholder="Search employee..." 
                            className="pl-9"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>
            </div>

            {successMsg && (
                <div className="p-3 bg-green-50 text-green-700 text-sm font-medium rounded-md flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4" /> {successMsg}
                </div>
            )}

            <Card>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[50px] pl-6">
                                        <input 
                                            type="checkbox" 
                                            className="rounded border-slate-300"
                                            checked={filteredEmployees.length > 0 && selectedEmployeeIds.size === filteredEmployees.length}
                                            onChange={toggleAllEmployees}
                                        />
                                    </TableHead>
                                    <TableHead>Employee</TableHead>
                                    <TableHead>Designation / Dept</TableHead>
                                    <TableHead>Current Manager</TableHead>
                                    <TableHead className="text-right pr-6">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredEmployees.length > 0 ? (
                                    filteredEmployees.map(emp => (
                                        <TableRow key={emp.employee_id}>
                                            <TableCell className="pl-6">
                                                <input 
                                                    type="checkbox" 
                                                    className="rounded border-slate-300"
                                                    checked={selectedEmployeeIds.has(emp.employee_id)}
                                                    onChange={() => toggleEmployeeSelection(emp.employee_id)}
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <div className="font-medium text-slate-800">{emp.name}</div>
                                                <div className="text-xs text-slate-500 font-mono">{emp.employee_id}</div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="text-sm">{emp.designation || '—'}</div>
                                                <div className="text-xs text-muted-foreground">{emp.department || '—'}</div>
                                            </TableCell>
                                            <TableCell>
                                                {emp.manager_id ? (
                                                    <div>
                                                        <div className="text-sm font-semibold text-indigo-700">{emp.manager_name}</div>
                                                        <div className="text-xs text-slate-500 font-mono">{emp.manager_id}</div>
                                                    </div>
                                                ) : (
                                                    <span className="text-xs text-red-500 font-medium px-2 py-1 bg-red-50 rounded italic">Unassigned</span>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-right pr-6">
                                                <div className="flex items-center justify-end gap-2">
                                                    <Button variant="outline" size="sm" onClick={() => viewHistory(emp)}>
                                                        <History className="h-4 w-4 mr-1" /> History
                                                    </Button>
                                                    <Button size="sm" className="bg-slate-800 hover:bg-slate-900 text-white" onClick={() => { setTargetEmps([emp]); setNewManagerId(''); setIsAssignOpen(true) }}>
                                                        <UserPlus className="h-4 w-4 mr-1" /> Assign
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center py-12 text-slate-500">
                                            No employees found matching the search or delegation scope.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            {/* ASSIGN MANAGER MODAL */}
            <Dialog open={isAssignOpen} onOpenChange={setIsAssignOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Assign Manager</DialogTitle>
                        <DialogDescription>
                            Assign a new manager to {targetEmps.length === 1 ? (
                                <><span className="font-semibold text-slate-900">{targetEmps[0].name}</span> ({targetEmps[0].employee_id})</>
                            ) : (
                                <><span className="font-semibold text-slate-900">{targetEmps.length} selected employees</span></>
                            )}.
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleAssignManager} className="space-y-4 pt-4">
                        <div className="space-y-2">
                            <Label>Select New Manager</Label>
                            <select
                                className="w-full border border-input rounded-md p-2 text-sm bg-white"
                                value={newManagerId}
                                onChange={e => setNewManagerId(e.target.value)}
                                required
                            >
                                <option value="" disabled>Select a manager...</option>
                                {potentialManagers.map(mgr => (
                                    <option key={mgr.employee_id} value={mgr.employee_id}>
                                        {mgr.name} ({mgr.employee_id}) - {mgr.designation || 'Manager'}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="pt-4 flex justify-end gap-2">
                            <Button type="button" variant="outline" onClick={() => setIsAssignOpen(false)}>Cancel</Button>
                            <Button type="submit" disabled={saving || !newManagerId} className="bg-indigo-600 hover:bg-indigo-700">
                                {saving ? 'Assigning...' : 'Confirm Assignment'}
                            </Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>

            {/* HISTORY MODAL */}
            <Dialog open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-indigo-700">
                            <History className="h-5 w-5" /> Manager History
                        </DialogTitle>
                        <DialogDescription>
                            Historical assignment chain for <span className="font-semibold text-slate-900">{selectedEmpForHistory?.name}</span> ({selectedEmpForHistory?.employee_id}).
                        </DialogDescription>
                    </DialogHeader>
                    <div className="pt-4 max-h-[400px] overflow-y-auto">
                        {loadingHistory ? (
                            <p className="text-sm text-center py-8">Loading history...</p>
                        ) : historyLogs.length > 0 ? (
                            <div className="relative border-l-2 border-slate-200 ml-3 pl-6 space-y-6">
                                {historyLogs.map((log, index) => (
                                    <div key={log.id} className="relative">
                                        <div className={`absolute -left-[31px] rounded-full h-4 w-4 border-2 border-white ${index === 0 && !log.valid_to ? 'bg-indigo-500' : 'bg-slate-300'}`} />
                                        <div className="bg-slate-50 p-3 rounded-md border text-sm">
                                            <div className="flex justify-between items-start mb-2">
                                                <div>
                                                    <span className="font-bold text-slate-800 block">{log.manager_name}</span>
                                                    <span className="font-mono text-xs text-slate-500">{log.manager_id}</span>
                                                </div>
                                                <div className="text-right">
                                                    {index === 0 && !log.valid_to ? (
                                                        <span className="text-[10px] font-bold tracking-wider uppercase text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded">Active</span>
                                                    ) : (
                                                        <span className="text-[10px] font-bold tracking-wider uppercase text-slate-500 bg-slate-200 px-2 py-0.5 rounded">Replaced</span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="text-xs text-slate-600 mt-2 pt-2 border-t flex flex-col gap-1">
                                                <span><strong className="text-slate-800">From:</strong> {new Date(log.valid_from).toLocaleString('en-IN')}</span>
                                                {log.valid_to && <span><strong className="text-slate-800">To:</strong> {new Date(log.valid_to).toLocaleString('en-IN')}</span>}
                                                <span className="text-slate-400 italic mt-1 pb-1">Assigned by: {log.assigned_by_name}</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-sm text-slate-500 text-center py-8 italic">No assignment history logged for this employee.</p>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}
