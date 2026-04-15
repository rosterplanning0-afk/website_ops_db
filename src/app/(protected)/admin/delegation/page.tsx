'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { PlusCircle, ShieldCheck, Trash2, ShieldAlert, KeyRound } from 'lucide-react'
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
    designation_scope: string | null
    user_name: string
    user_role: string
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
    
    // Form Input
    const [selectedUserId, setSelectedUserId] = useState('')
    const [deptScope, setDeptScope] = useState('')
    const [desigScope, setDesigScope] = useState('')
    const [saving, setSaving] = useState(false)
    const [searchUser, setSearchUser] = useState('')

    // Password Reset Form
    const [passwordResetUser, setPasswordResetUser] = useState('')
    const [passwordResetValue, setPasswordResetValue] = useState('')
    const [passwordResetting, setPasswordResetting] = useState(false)

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
        emps?.forEach(e => {
            if (e.department) deptSet.add(e.department)
            if (e.designation) desigSet.add(e.designation)
        })
        setDepartments(Array.from(deptSet).sort())
        setDesignations(Array.from(desigSet).sort())

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
        setLoading(false)
    }

    async function handleGrant(e: React.FormEvent) {
        e.preventDefault()
        if (!selectedUserId) return

        setSaving(true)
        const { error } = await supabase.from('manager_assignment_rights').insert({
            granted_to: selectedUserId,
            department_scope: deptScope || null,
            designation_scope: desigScope || null
        })

        if (!error) {
            setSelectedUserId('')
            setDeptScope('')
            setDesigScope('')
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

    const filteredUsers = availableUsers.filter(u => 
        !delegations.some(d => d.granted_to === u.id) && // hide already delegated users
        ((u.full_name || '').toLowerCase().includes(searchUser.toLowerCase()) || 
         (u.employee_id || '').toLowerCase().includes(searchUser.toLowerCase()))
    )

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
                                <select 
                                    className="w-full flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm text-slate-700"
                                    value={desigScope}
                                    onChange={e => setDesigScope(e.target.value)}
                                >
                                    <option value="">-- All Designations --</option>
                                    {designations.map(d => <option key={d} value={d}>{d}</option>)}
                                </select>
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
                                                    {del.designation_scope ? <span className="text-amber-600 font-semibold">{del.designation_scope}</span> : <span className="text-muted-foreground italic">Universal</span>}
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
        </div>
    )
}
