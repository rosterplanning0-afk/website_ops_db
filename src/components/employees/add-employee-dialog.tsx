'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { DEPT_CREW_MAPPING } from '@/lib/rbac'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2, CheckCircle2, AlertTriangle, UserPlus } from 'lucide-react'
import { createCredentials } from '@/app/(protected)/admin/create-credentials/actions'

const ROLES = [
    { value: 'admin', label: 'Admin' },
    { value: 'cxo', label: 'CXO' },
    { value: 'hod', label: 'HoD' },
    { value: 'manager', label: 'Manager' },
    { value: 'roster_planners', label: 'Roster Planner' },
    { value: 'employee', label: 'Employee' }
]

const DEPARTMENTS = [
    'Train Operations',
    'Station Operations',
    'OCC',
    'Maintenance',
    'Management',
    'HR',
    'Other'
]

const STATUSES = ['Active', 'Inactive', 'Notice Period']
const GENDERS = ['Male', 'Female', 'Other']

interface AddEmployeeDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onSuccess: () => void
    isAdmin: boolean
    userDelegations: { department_scope: string, designation_scope: any }[]
}

const getDesigs = (scope: any) => {
    if (!scope) return []
    if (Array.isArray(scope)) return scope
    if (typeof scope === 'string') return scope.split(',').map(s => s.trim()).filter(Boolean)
    return []
}

export function AddEmployeeDialog({ open, onOpenChange, onSuccess, isAdmin, userDelegations }: AddEmployeeDialogProps) {
    const [loading, setLoading] = useState(false)
    const [successMsg, setSuccessMsg] = useState('')
    const [errorMsg, setErrorMsg] = useState('')

    const initialDept = isAdmin ? 'Train Operations' : (userDelegations?.[0]?.department_scope || 'Train Operations')
    const initialDesig = isAdmin ? '' : (getDesigs(userDelegations?.[0]?.designation_scope)[0] || '')

    const [department, setDepartment] = useState(initialDept)
    const [designation, setDesignation] = useState(initialDesig)
    const [managers, setManagers] = useState<{employee_id: string, name: string}[]>([])

    // Update derived states when dialog opens or delegations change
    useEffect(() => {
        if (open) {
            setSuccessMsg('')
            setErrorMsg('')
            if (!isAdmin && userDelegations.length > 0) {
                const desig = getDesigs(userDelegations[0].designation_scope)[0] || ''
                setDesignation(desig)
                setDepartment(userDelegations[0].department_scope || 'Train Operations')
            } else if (isAdmin) {
                setDepartment('Train Operations')
                setDesignation('')
            }
        }
    }, [open, isAdmin, userDelegations])

    useEffect(() => {
        async function loadManagers() {
            if (!department) {
                setManagers([])
                return
            }
            const supabase = createClient()
            const { data } = await supabase
                .from('employees')
                .select('employee_id, name, role')
                .eq('department', department)
            
            const validManagers = (data || []).filter(e => {
                const r = (e.role || '').toLowerCase()
                return r === 'manager' || r === 'hod' || r === 'admin'
            })
            setManagers(validManagers)
        }
        loadManagers()
    }, [department])



    let designationOptions = []
    if (isAdmin) {
        designationOptions = DEPT_CREW_MAPPING[department as keyof typeof DEPT_CREW_MAPPING] || []
    } else {
        // Unique designations from delegations
        const allDesigs = userDelegations.flatMap(d => getDesigs(d.designation_scope))
        designationOptions = Array.from(new Set(allDesigs))
    }

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()
        setLoading(true)
        setErrorMsg('')
        setSuccessMsg('')

        const form = e.currentTarget
        const formData = new FormData(form)
        const data = {
            employeeId: formData.get('employeeId') as string,
            name: formData.get('name') as string,
            email: formData.get('email') as string,
            password: formData.get('password') as string,
            role: isAdmin ? (formData.get('role') as string) : 'employee',
            department: department, // Use state since it might be disabled
            designation: designation, // Use state since it might be handled differently
            gender: formData.get('gender') as string,
            status: formData.get('status') as string,
            dateJoined: formData.get('dateJoined') as string,
            managerId: formData.get('managerId') === 'none' ? '' : (formData.get('managerId') as string),
        }

        try {
            const res = await createCredentials(data)
            if (res && res.error) {
                setErrorMsg(res.error)
                setLoading(false)
                return
            }
            
            setSuccessMsg(`Successfully created credentials for ${data.name} (${data.employeeId}).`)
            form.reset()
            if (isAdmin) {
                setDepartment('Train Operations')
                setDesignation('')
            } else if (userDelegations.length > 0) {
                const desig = getDesigs(userDelegations[0].designation_scope)[0] || ''
                setDesignation(desig)
                setDepartment(userDelegations[0].department_scope || 'Train Operations')
            }
            onSuccess()
            // Optional: Close dialog after short delay
            setTimeout(() => onOpenChange(false), 2000)
        } catch (err: any) {
            setErrorMsg(err.message || 'An error occurred while creating credentials.')
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-xl">
                        <UserPlus className="h-6 w-6 text-red-600" />
                        Add New Employee
                    </DialogTitle>
                    <DialogDescription>
                        Register a new user and add their employee details to the system.
                    </DialogDescription>
                </DialogHeader>

                <div className="mt-4">
                    {successMsg && (
                        <div className="mb-6 p-4 bg-green-50 border border-green-200 text-green-700 rounded-lg flex items-center gap-2">
                            <CheckCircle2 className="h-5 w-5" />
                            {successMsg}
                        </div>
                    )}
                    {errorMsg && (
                        <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg flex items-center gap-2">
                            <AlertTriangle className="h-5 w-5 shrink-0" />
                            <p>{errorMsg}</p>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-6">
                        {/* Account Details */}
                        <div>
                            <h3 className="text-sm font-semibold text-slate-900 mb-3 uppercase tracking-wider">Account Credentials</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="email">Email Address <span className="text-red-500">*</span></Label>
                                    <Input id="email" name="email" type="email" required placeholder="john.doe@deutschebahn.com" />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="password">Temporary Password</Label>
                                    <Input id="password" name="password" type="password" placeholder="Leave empty for DBrrts@123" minLength={6} />
                                    <p className="text-xs text-slate-500">User will be forced to change password on first login.</p>
                                </div>
                            </div>
                        </div>

                        <hr className="border-slate-100" />

                        {/* Employee Details */}
                        <div>
                            <h3 className="text-sm font-semibold text-slate-900 mb-3 uppercase tracking-wider">Employee Data</h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="employeeId">Employee ID <span className="text-red-500">*</span></Label>
                                    <Input id="employeeId" name="employeeId" required placeholder="EMP12345" />
                                </div>
                                <div className="space-y-2 md:col-span-2">
                                    <Label htmlFor="name">Full Name <span className="text-red-500">*</span></Label>
                                    <Input id="name" name="name" required placeholder="John Doe" />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="role">System Role <span className="text-red-500">*</span></Label>
                                    <Select name="role" defaultValue="employee" disabled={!isAdmin} required>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select a role" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {isAdmin ? (
                                                ROLES.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)
                                            ) : (
                                                <SelectItem value="employee">Employee</SelectItem>
                                            )}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="designation">Designation <span className="text-red-500">*</span></Label>
                                    {designationOptions.length > 0 ? (
                                        <Select name="designation" value={designation} onValueChange={setDesignation} required>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select Designation" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {designationOptions.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    ) : (
                                        <Input id="designation" name="designation" value={designation} onChange={e => setDesignation(e.target.value)} required placeholder="e.g. Developer" disabled={!isAdmin} />
                                    )}
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="department">Department <span className="text-red-500">*</span></Label>
                                    <Select name="department" value={department} onValueChange={(val) => { setDepartment(val); if (isAdmin) setDesignation(''); }} required>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select Department" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {DEPARTMENTS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="gender">Gender <span className="text-red-500">*</span></Label>
                                    <Select name="gender" defaultValue="Male" required>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select Gender" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {GENDERS.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="status">Status <span className="text-red-500">*</span></Label>
                                    <Select name="status" defaultValue="Active" required>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select Status" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="dateJoined">Date Joined <span className="text-red-500">*</span></Label>
                                    <Input id="dateJoined" name="dateJoined" type="date" required />
                                </div>

                                <div className="space-y-2 md:col-span-3">
                                    <Label htmlFor="managerId">Manager Employee ID (Optional)</Label>
                                    <Select name="managerId" defaultValue="none">
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select Manager" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="none">None</SelectItem>
                                            {managers.map(m => (
                                                <SelectItem key={m.employee_id} value={m.employee_id}>
                                                    {m.name} ({m.employee_id})
                                                </SelectItem>
                                            ))}
                                            {managers.length === 0 && (
                                                <SelectItem value="not_found" disabled>No managers/HODs found in {department}</SelectItem>
                                            )}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 pt-4 border-t">
                            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
                                Cancel
                            </Button>
                            <Button type="submit" disabled={loading} className="bg-red-600 hover:bg-red-700">
                                {loading ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Creating...
                                    </>
                                ) : (
                                    'Create Employee'
                                )}
                            </Button>
                        </div>
                    </form>
                </div>
            </DialogContent>
        </Dialog>
    )
}
