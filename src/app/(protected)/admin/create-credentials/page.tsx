'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { UserPlus, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react'
import { createCredentials } from './actions'
import { BulkCreateDialog } from './bulk-create-dialog'

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

export default function CreateCredentialsPage() {
    const [loading, setLoading] = useState(false)
    const [successMsg, setSuccessMsg] = useState('')
    const [errorMsg, setErrorMsg] = useState('')

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()
        setLoading(true)
        setErrorMsg('')
        setSuccessMsg('')

        const formData = new FormData(e.currentTarget)
        const data = {
            employeeId: formData.get('employeeId') as string,
            name: formData.get('name') as string,
            email: formData.get('email') as string,
            password: formData.get('password') as string,
            role: formData.get('role') as string,
            department: formData.get('department') as string,
            designation: formData.get('designation') as string,
            gender: formData.get('gender') as string,
            status: formData.get('status') as string,
            dateJoined: formData.get('dateJoined') as string,
            managerId: formData.get('managerId') as string,
        }

        try {
            await createCredentials(data)
            setSuccessMsg(`Successfully created credentials for ${data.name} (${data.employeeId}).`)
            e.currentTarget.reset()
        } catch (err: any) {
            setErrorMsg(err.message || 'An error occurred while creating credentials.')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <UserPlus className="h-7 w-7 text-red-600" /> Create Login Credentials
                    </h2>
                    <p className="text-sm text-slate-500 mt-1">
                        Register a new user and add their employee details to the system.
                    </p>
                </div>
                <BulkCreateDialog />
            </div>

            <Card>
                <CardHeader className="border-b bg-slate-50/50">
                    <CardTitle className="text-lg">Employee & Account Information</CardTitle>
                    <CardDescription>All fields are required unless marked as optional.</CardDescription>
                </CardHeader>
                <CardContent className="pt-6">
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
                                    <Select name="role" defaultValue="employee" required>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select a role" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {ROLES.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="department">Department <span className="text-red-500">*</span></Label>
                                    <Select name="department" defaultValue="Train Operations" required>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select Department" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {DEPARTMENTS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="designation">Designation <span className="text-red-500">*</span></Label>
                                    <Input id="designation" name="designation" required placeholder="e.g. Train Operator" />
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
                                    <Input id="managerId" name="managerId" placeholder="e.g. MGR98765" />
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 pt-4 border-t">
                            <Button type="reset" variant="outline" disabled={loading}>
                                Clear Form
                            </Button>
                            <Button type="submit" disabled={loading} className="bg-red-600 hover:bg-red-700">
                                {loading ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Creating...
                                    </>
                                ) : (
                                    'Create Credentials'
                                )}
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    )
}
