'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { PlusCircle, ShieldCheck, Trash2, ShieldAlert, KeyRound, UserCheck, UserX, Users, History } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { useRouter } from 'next/navigation'
import { resetEmployeePassword } from '@/app/(protected)/employees/actions'

interface UserOption {
    id: string
    full_name: string
    role: string
    employee_id: string
}

interface DelegationRecord {
    id: string
    granted_to: string
    department_scope: string | null
    designation_scope: string[] | null
    user_name: string
    user_role: string
}

interface InspectorHistoryRecord {
    id: string
    employee_id: string
    action: 'assigned' | 'removed'
    changed_at: string
    employees: {
        name: string
        designation: string | null
    } | null
    users: {
        full_name: string | null
    } | null
}

export default function DelegationSettingsPage() {
    const supabase = createClient()
    const router = useRouter()
    
    const [loading, setLoading] = useState(true)
    const [allUsers, setAllUsers] = useState<UserOption[]>([])
    const [availableUsers, setAvailableUsers] = useState<UserOption[]>([])
    const [delegations, setDelegations] = useState<DelegationRecord[]>([])
    const [departments, setDepartments] = useState<string[]>([])
    const [designations, setDesignations] = useState<string[]>([])
    const [deptToDesigMap, setDeptToDesigMap] = useState<Record<string, string[]>>({})
    
    // Form Input
    const [selectedUserId, setSelectedUserId] = useState('')
    const [deptScope, setDeptScope] = useState('')
    const [desigScope, setDesigScope] = useState<string[]>([])
    const [saving, setSaving] = useState(false)
    const [searchUser, setSearchUser] = useState('')

    // Password Reset Form
    const [passwordResetUser, setPasswordResetUser] = useState('')
    const [passwordResetValue, setPasswordResetValue] = useState('')
    const [passwordResetting, setPasswordResetting] = useState(false)

    // Line Inspector Delegation State
    const [employeesList, setEmployeesList] = useState<any[]>([])
    const [inspectorHistory, setInspectorHistory] = useState<InspectorHistoryRecord[]>([])
    const [searchInspectorQuery, setSearchInspectorQuery] = useState('')
    const [selectedInspectorDesignation, setSelectedInspectorDesignation] = useState('')
    const [selectedInspectorId, setSelectedInspectorId] = useState('')
    const [inspectorActionLoading, setInspectorActionLoading] = useState(false)

    useEffect(() => {
        loadData()
    }, [])

    async function loadData() {
        setLoading(true)
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { router.push('/'); return }

        // Check Admin
        const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
        if (profile?.role !== 'admin') {
            router.push('/dashboard')
            return
        }

        // Load distinct departments and designations
        const { data: emps } = await supabase.from('employees').select('department, designation')
        const deptSet = new Set<string>()
        const desigSet = new Set<string>()
        const mapping: Record<string, Set<string>> = {}

        emps?.forEach(e => {
            if (e.department) {
                deptSet.add(e.department)
                if (!mapping[e.department]) mapping[e.department] = new Set()
                if (e.designation) mapping[e.department].add(e.designation)
            }
            if (e.designation) desigSet.add(e.designation)
        })

        const finalMapping: Record<string, string[]> = {}
        Object.keys(mapping).forEach(d => {
            finalMapping[d] = Array.from(mapping[d]).sort()
        })

        setDepartments(Array.from(deptSet).sort())
        setDesignations(Array.from(desigSet).sort())
        setDeptToDesigMap(finalMapping)

        // Load users to delegate to
        const { data: userData } = await supabase.from('users').select('id, full_name, role, employee_id').order('full_name')
        setAllUsers(userData || [])
        setAvailableUsers((userData || []).filter(u => u.role !== 'admin'))

        // Load existing delegations
        const { data: rights } = await supabase.from('manager_assignment_rights').select(`
            id, granted_to, department_scope, designation_scope,
            users:granted_to (full_name, role)
        `)
        
        if (rights) {
            setDelegations(rights.map(r => ({
                id: r.id,
                granted_to: r.granted_to,
                department_scope: r.department_scope,
                designation_scope: r.designation_scope,
                user_name: (r.users as any)?.full_name || 'Unknown',
                user_role: (r.users as any)?.role || '—'
            })))
        }

        // Load employees for Line Inspectors
        const { data: allEmps } = await supabase
            .from('employees')
            .select('employee_id, name, designation, department, is_line_inspector')
            .order('name')
        setEmployeesList(allEmps || [])

        // Load line inspector history
        const { data: hist } = await supabase
            .from('line_inspector_history')
            .select(`
                id,
                employee_id,
                action,
                changed_at,
                employees (
                    name,
                    designation
                ),
                users (
                    full_name
                )
            `)
            .order('changed_at', { ascending: false })
        setInspectorHistory((hist || []) as any)
        setLoading(false)
    }

    async function handleGrant(e: React.FormEvent) {
        e.preventDefault()
        if (!selectedUserId) return

        setSaving(true)
        const { error } = await supabase.from('manager_assignment_rights').insert({
            granted_to: selectedUserId,
            department_scope: deptScope || null,
            designation_scope: desigScope.length > 0 ? desigScope : null
        })

        if (!error) {
            setSelectedUserId('')
            setDeptScope('')
            setDesigScope([])
            setSearchUser('')
            await loadData()
        } else {
            alert(error.message)
        }
        setSaving(false)
    }

    async function handleRevoke(id: string) {
        if (!confirm('Are you sure you want to revoke these rights?')) return
        await supabase.from('manager_assignment_rights').delete().eq('id', id)
        await loadData()
    }

    async function handlePasswordReset() {
        if (!passwordResetUser || passwordResetValue.length < 8) return
        if (!confirm('Are you certain you want to forcefully reset this user\'s password?')) return
        
        setPasswordResetting(true)
        try {
            await resetEmployeePassword(passwordResetUser, passwordResetValue)
            alert('Password successfully reset. User will be forced to change it on their next login.')
            setPasswordResetUser('')
            setPasswordResetValue('')
        } catch (err: any) {
            alert('Failed to reset password: ' + err.message)
        }
        setPasswordResetting(false)
    }

    async function handleToggleInspector(employeeId: string, action: 'assigned' | 'removed') {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        setInspectorActionLoading(true)
        try {
            const { error: updateErr } = await supabase
                .from('employees')
                .update({ is_line_inspector: action === 'assigned' })
                .eq('employee_id', employeeId)

            if (updateErr) throw updateErr

            const { error: histErr } = await supabase
                .from('line_inspector_history')
                .insert({
                    employee_id: employeeId,
                    action: action,
                    changed_by: user.id
                })

            if (histErr) throw histErr

            alert(`Successfully ${action === 'assigned' ? 'assigned' : 'revoked'} Line Inspector status.`)
            setSelectedInspectorId('')
            setSearchInspectorQuery('')
            setSelectedInspectorDesignation('')
            await loadData()
        } catch (err: any) {
            alert('Failed to update Line Inspector: ' + err.message)
        } finally {
            setInspectorActionLoading(false)
        }
    }

    // Filter employees to only Train Operations
    const trainOpsInspectorsList = employeesList.filter(e =>
        e.department?.toLowerCase() === 'train operations'
    )

    // Compute unique designations
    const uniqueInspectorDesignations = Array.from(new Set(
        trainOpsInspectorsList
            .map(e => e.designation)
            .filter((d): d is string => !!d)
    )).sort()

    // Filter employees for lookup drop down based on selected designation and search
    const filteredInspectorsList = trainOpsInspectorsList.filter(e => {
        const matchesDesignation = selectedInspectorDesignation ? e.designation === selectedInspectorDesignation : true
        const matchesSearch = searchInspectorQuery
            ? (e.name.toLowerCase().includes(searchInspectorQuery.toLowerCase()) || e.employee_id.toLowerCase().includes(searchInspectorQuery.toLowerCase()))
            : true
        return matchesDesignation && matchesSearch
    })

    const selectedInspector = trainOpsInspectorsList.find(e => e.employee_id === selectedInspectorId)
    const activeLineInspectors = employeesList.filter(e => e.is_line_inspector)

    const filteredUsers = availableUsers.filter(u => 
        !delegations.some(d => d.granted_to === u.id) && // hide already delegated users
        ((u.full_name || '').toLowerCase().includes(searchUser.toLowerCase()) || 
         (u.employee_id || '').toLowerCase().includes(searchUser.toLowerCase()))
    )

    const toggleDesignation = (d: string) => {
        setDesigScope(prev => 
            prev.includes(d) ? prev.filter(item => item !== d) : [...prev, d]
        )
    }

    if (loading) return <div className="p-8 text-center">Loading security settings...</div>

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-2">
                <ShieldCheck className="h-6 w-6 text-indigo-600" />
                <h2 className="text-2xl font-bold text-slate-800">Delegation Settings</h2>
            </div>
            
            <p className="text-sm text-muted-foreground">
                Grant specific users the right to assign managers to employees. By default, only Admins hold this universal right. Scope limitations (Department or Designation) restrict which employees they can manage.
            </p>

            <div className="grid gap-6 md:grid-cols-3">
                
                {/* FORM COLUMN */}
                <Card className="h-fit">
                    <CardHeader className="bg-slate-50 border-b pb-4">
                        <CardTitle className="text-lg flex items-center gap-2">
                            <PlusCircle className="h-5 w-5 text-indigo-600" /> Grant Rights
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-4">
                        <form onSubmit={handleGrant} className="space-y-4">
                            <div className="space-y-2">
                                <Label>Select User</Label>
                                <Input 
                                    placeholder="Search user..." 
                                    value={searchUser}
                                    onChange={e => setSearchUser(e.target.value)}
                                    className="mb-2"
                                />
                                <select 
                                    className="w-full flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                                    value={selectedUserId}
                                    onChange={e => setSelectedUserId(e.target.value)}
                                    required
                                >
                                    <option value="" disabled>-- Choose User --</option>
                                    {filteredUsers.map(u => (
                                        <option key={u.id} value={u.id}>
                                            {u.full_name} ({u.employee_id || u.role})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="space-y-2">
                                <Label>Department Scope (Optional)</Label>
                                <select 
                                    className="w-full flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm text-slate-700"
                                    value={deptScope}
                                    onChange={e => setDeptScope(e.target.value)}
                                >
                                    <option value="">-- All Departments --</option>
                                    {departments.map(d => <option key={d} value={d}>{d}</option>)}
                                </select>
                            </div>

                            <div className="space-y-2">
                                <Label>Designation Scope (Optional)</Label>
                                <div className="border rounded-md p-3 max-h-48 overflow-y-auto space-y-2 bg-white">
                                    <div className="flex items-center gap-2 pb-2 border-b mb-2">
                                        <input 
                                            type="checkbox" 
                                            id="all-desig"
                                            checked={desigScope.length === 0}
                                            onChange={() => setDesigScope([])}
                                            className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-600"
                                        />
                                        <label htmlFor="all-desig" className="text-sm font-medium text-slate-700 italic">Universal (All Designations)</label>
                                    </div>
                                    {(!deptScope ? designations : (deptToDesigMap[deptScope] || []))
                                        .map(d => (
                                            <div key={d} className="flex items-center gap-2">
                                                <input 
                                                    type="checkbox" 
                                                    id={`desig-${d}`}
                                                    checked={desigScope.includes(d)}
                                                    onChange={() => toggleDesignation(d)}
                                                    className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-600"
                                                />
                                                <label htmlFor={`desig-${d}`} className="text-sm text-slate-700">{d}</label>
                                            </div>
                                        ))
                                    }
                                </div>
                            </div>

                            <div className="pt-2">
                                <Button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700" disabled={saving || !selectedUserId}>
                                    {saving ? 'Granting...' : 'Grant Assignment Rights'}
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>

                {/* ACTIVE DELEGATIONS */}
                <Card className="md:col-span-2">
                    <CardHeader>
                        <CardTitle className="text-lg">Active Delegations</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>User Name</TableHead>
                                        <TableHead>Role</TableHead>
                                        <TableHead>Department Scope</TableHead>
                                        <TableHead>Designation Scope</TableHead>
                                        <TableHead className="text-right">Action</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {delegations.length > 0 ? (
                                        delegations.map(del => (
                                            <TableRow key={del.id}>
                                                <TableCell className="font-medium text-sm">{del.user_name}</TableCell>
                                                <TableCell>
                                                    <span className="capitalize text-xs bg-slate-100 text-slate-700 px-2 py-1 rounded">
                                                        {del.user_role}
                                                    </span>
                                                </TableCell>
                                                <TableCell className="text-sm">
                                                    {del.department_scope ? <span className="text-blue-600 font-semibold">{del.department_scope}</span> : <span className="text-muted-foreground italic">Universal</span>}
                                                </TableCell>
                                                <TableCell className="text-sm">
                                                    {del.designation_scope && del.designation_scope.length > 0 ? (
                                                        <div className="flex flex-wrap gap-1">
                                                            {del.designation_scope.map(d => (
                                                                <span key={d} className="text-[10px] bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded font-medium">
                                                                    {d}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <span className="text-muted-foreground italic">Universal</span>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <Button variant="ghost" size="sm" onClick={() => handleRevoke(del.id)} className="text-red-500 hover:bg-red-50 hover:text-red-700 h-8 px-2">
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    ) : (
                                        <TableRow>
                                            <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                                                <ShieldAlert className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                                No delegated assignment rights found.<br/>Only Admins currently have this capability.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* PASSWORD RESET SECTION */}
            <div className="pt-6 border-t mt-8">
                <Card className="border-red-200">
                    <CardHeader className="bg-red-50 border-b pb-4">
                        <CardTitle className="text-lg flex items-center gap-2 text-red-700">
                            <KeyRound className="h-5 w-5" /> Universal Password Reset
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6">
                        <p className="text-sm text-slate-600 mb-6">
                            As an Administrator, you may forcefully reset the password of any user. They will be mandated to configure a new password immediately upon their next successful login.
                        </p>
                        <div className="flex flex-col md:flex-row gap-4 max-w-4xl items-start">
                            <div className="flex-1 space-y-2 w-full">
                                <Label>User</Label>
                                <select 
                                    className="w-full flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm text-slate-700"
                                    value={passwordResetUser}
                                    onChange={e => setPasswordResetUser(e.target.value)}
                                >
                                    <option value="">-- Choose User --</option>
                                    {allUsers.map(u => <option key={u.id} value={u.employee_id || ''}>{u.full_name} ({u.employee_id || 'Unknown ID'})</option>)}
                                </select>
                            </div>
                            <div className="flex-1 space-y-2 w-full">
                                <Label>New Temporary Password</Label>
                                <Input 
                                    type="password" 
                                    value={passwordResetValue}
                                    onChange={e => setPasswordResetValue(e.target.value)}
                                    placeholder="Enter minimum 8 characters" 
                                />
                            </div>
                            <div className="flex align-bottom items-end pt-2 md:pt-6">
                                <Button 
                                    type="button"
                                    className="w-full bg-red-600 hover:bg-red-700 flex gap-2 h-10" 
                                    disabled={!passwordResetUser || passwordResetValue.length < 8 || passwordResetting}
                                    onClick={handlePasswordReset}
                                >
                                    <KeyRound className="h-4 w-4" /> 
                                    {passwordResetting ? 'Resetting...' : 'Force Reset Password'}
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* LINE INSPECTOR DELEGATION SECTION */}
            <div className="pt-6 border-t mt-8 space-y-6">
                <div className="flex items-center gap-2">
                    <ShieldCheck className="h-6 w-6 text-blue-600" />
                    <h3 className="text-xl font-bold text-slate-800">Line Inspector Privilege Settings</h3>
                </div>

                <div className="grid gap-6 md:grid-cols-3">
                    {/* Privilege Assignment Control */}
                    <Card className="h-fit">
                        <CardHeader className="bg-slate-50 border-b pb-4">
                            <CardTitle className="text-base flex items-center gap-2">
                                <UserCheck className="h-5 w-5 text-blue-600" /> Manage Inspector Privileges
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-4 space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="inspector-designation-select">Select Designation</Label>
                                <select
                                    id="inspector-designation-select"
                                    className="w-full flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm text-slate-700"
                                    value={selectedInspectorDesignation}
                                    onChange={e => {
                                        setSelectedInspectorDesignation(e.target.value)
                                        setSelectedInspectorId('') // Reset selected inspector when designation changes
                                    }}
                                >
                                    <option value="">-- Select Designation --</option>
                                    {uniqueInspectorDesignations.map(d => (
                                        <option key={d} value={d}>{d}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="inspector-search">Search Employee</Label>
                                <Input
                                    id="inspector-search"
                                    placeholder="Search by name or ID..."
                                    value={searchInspectorQuery}
                                    onChange={e => setSearchInspectorQuery(e.target.value)}
                                />
                                <select
                                    className="w-full flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm text-slate-700 mt-2"
                                    value={selectedInspectorId}
                                    onChange={e => setSelectedInspectorId(e.target.value)}
                                >
                                    <option value="">-- Choose Employee --</option>
                                    {filteredInspectorsList.slice(0, 100).map(e => (
                                        <option key={e.employee_id} value={e.employee_id}>
                                            {e.name} ({e.employee_id}) {e.is_line_inspector ? '⭐ Inspector' : ''}
                                        </option>
                                    ))}
                                    {filteredInspectorsList.length === 0 && (
                                        <option value="" disabled>No employees found matching search</option>
                                    )}
                                </select>
                            </div>

                            {selectedInspector && (
                                <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-3">
                                    <div>
                                        <span className="text-[10px] uppercase font-bold text-slate-400">Selected Employee</span>
                                        <p className="font-semibold text-slate-800 text-sm">{selectedInspector.name}</p>
                                        <p className="text-xs text-slate-500">{selectedInspector.designation || 'No Designation'} · {selectedInspector.department || 'No Department'}</p>
                                    </div>
                                    <div className="pt-1 flex items-center gap-2">
                                        <span className="text-xs text-slate-600">Current Status:</span>
                                        {selectedInspector.is_line_inspector ? (
                                            <span className="bg-green-100 text-green-800 text-[11px] font-semibold px-2 py-0.5 rounded-full">
                                                Line Inspector
                                            </span>
                                        ) : (
                                            <span className="bg-slate-200 text-slate-700 text-[11px] font-semibold px-2 py-0.5 rounded-full">
                                                Standard Employee
                                            </span>
                                        )}
                                    </div>

                                    <div className="pt-2">
                                        {selectedInspector.is_line_inspector ? (
                                            <Button
                                                onClick={() => handleToggleInspector(selectedInspector.employee_id, 'removed')}
                                                disabled={inspectorActionLoading}
                                                className="w-full bg-red-600 hover:bg-red-700 text-white flex items-center justify-center gap-1.5"
                                            >
                                                <UserX className="h-4 w-4" />
                                                {inspectorActionLoading ? 'Revoking...' : 'Revoke Privileges'}
                                            </Button>
                                        ) : (
                                            <Button
                                                onClick={() => handleToggleInspector(selectedInspector.employee_id, 'assigned')}
                                                disabled={inspectorActionLoading}
                                                className="w-full bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center gap-1.5"
                                            >
                                                <UserCheck className="h-4 w-4" />
                                                {inspectorActionLoading ? 'Assigning...' : 'Assign as Line Inspector'}
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Active Inspectors List */}
                    <Card className="md:col-span-2">
                        <CardHeader>
                            <CardTitle className="text-base flex items-center gap-2">
                                <Users className="h-5 w-5 text-green-600" /> Active Line Inspectors ({activeLineInspectors.length})
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="overflow-x-auto max-h-[300px] overflow-y-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Employee ID</TableHead>
                                            <TableHead>Name</TableHead>
                                            <TableHead>Designation</TableHead>
                                            <TableHead>Department</TableHead>
                                            <TableHead className="text-right">Action</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {activeLineInspectors.length > 0 ? (
                                            activeLineInspectors.map(inspector => (
                                                <TableRow key={inspector.employee_id}>
                                                    <TableCell className="font-mono text-xs">{inspector.employee_id}</TableCell>
                                                    <TableCell className="font-medium text-sm text-slate-800">{inspector.name}</TableCell>
                                                    <TableCell className="text-sm">{inspector.designation || '—'}</TableCell>
                                                    <TableCell className="text-sm">{inspector.department || '—'}</TableCell>
                                                    <TableCell className="text-right">
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => handleToggleInspector(inspector.employee_id, 'removed')}
                                                            disabled={inspectorActionLoading}
                                                            className="text-red-600 hover:bg-red-50 hover:text-red-700 h-8 px-2"
                                                        >
                                                            <UserX className="h-4 w-4" />
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        ) : (
                                            <TableRow>
                                                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground text-sm">
                                                    No active line inspectors assigned yet.
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Audit History Log */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                            <History className="h-5 w-5 text-indigo-600" /> Assignment History Log
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="overflow-x-auto max-h-[300px] overflow-y-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Date & Time</TableHead>
                                        <TableHead>Employee Name (ID)</TableHead>
                                        <TableHead>Designation</TableHead>
                                        <TableHead>Action Logged</TableHead>
                                        <TableHead>Changed By</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {inspectorHistory.length > 0 ? (
                                        inspectorHistory.map(record => (
                                            <TableRow key={record.id}>
                                                <TableCell className="text-xs text-slate-500">
                                                    {new Date(record.changed_at).toLocaleString('en-IN', {
                                                        day: '2-digit', month: 'short', year: 'numeric',
                                                        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true
                                                    })}
                                                </TableCell>
                                                <TableCell className="font-medium text-sm text-slate-800">
                                                    {record.employees?.name || 'Unknown'} ({record.employee_id})
                                                </TableCell>
                                                <TableCell className="text-sm">
                                                    {record.employees?.designation || '—'}
                                                </TableCell>
                                                <TableCell>
                                                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                                                        record.action === 'assigned'
                                                            ? 'bg-green-50 text-green-700 border border-green-200'
                                                            : 'bg-red-50 text-red-700 border border-red-200'
                                                    }`}>
                                                        {record.action === 'assigned' ? 'Privileges Granted' : 'Privileges Revoked'}
                                                    </span>
                                                </TableCell>
                                                <TableCell className="text-sm text-slate-600">
                                                    {record.users?.full_name || 'System / Admin'}
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    ) : (
                                        <TableRow>
                                            <TableCell colSpan={5} className="text-center py-8 text-muted-foreground text-sm">
                                                No assignment logs or audit history found.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
