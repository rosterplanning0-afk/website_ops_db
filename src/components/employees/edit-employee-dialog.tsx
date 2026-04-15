'use client'

import { useState, useEffect } from 'react'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { createClient } from '@/utils/supabase/client'

interface Employee {
    employee_id: string
    name: string
    designation: string
    department: string
    gender: string
    status: string
    role: string
    manager_id: string
    date_joined?: string
    date_resigned?: string
    date_relived?: string
}

interface EditEmployeeDialogProps {
    employee: Employee | null
    open: boolean
    onOpenChange: (open: boolean) => void
    onSuccess: () => void
}

export function EditEmployeeDialog({ employee, open, onOpenChange, onSuccess }: EditEmployeeDialogProps) {
    const [formData, setFormData] = useState<Partial<Employee>>({
        name: '',
        designation: '',
        department: '',
        gender: '',
        status: 'Active',
        role: 'employee',
        manager_id: '',
        date_joined: '',
        date_resigned: '',
        date_relived: ''
    })
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        if (employee) {
            setFormData({
                name: employee.name || '',
                designation: employee.designation || '',
                department: employee.department || '',
                gender: employee.gender || '',
                status: employee.status || 'Active',
                role: employee.role || 'employee',
                manager_id: employee.manager_id || '',
                date_joined: employee.date_joined || '',
                date_resigned: employee.date_resigned || '',
                date_relived: employee.date_relived || ''
            })
        }
    }, [employee])

    async function handleUpdate() {
        if (!employee) return

        // Validation for status-dependent dates
        if (formData.status === 'Notice Period' && !formData.date_resigned) {
            window.alert('Resignation date is mandatory for Notice Period status')
            return
        }
        if (formData.status === 'Relieved' && !formData.date_relived) {
            window.alert('Relieving date is mandatory for Relieved status')
            return
        }

        setLoading(true)
        const supabase = createClient()

        const { error } = await supabase
            .from('employees')
            .update({
                name: formData.name,
                designation: formData.designation,
                department: formData.department,
                gender: formData.gender,
                status: formData.status,
                role: formData.role,
                manager_id: formData.manager_id?.trim() || null,
                date_joined: formData.date_joined || null,
                date_resigned: formData.status === 'Notice Period' || formData.status === 'Relieved' ? (formData.date_resigned || null) : null,
                date_relived: formData.status === 'Relieved' ? (formData.date_relived || null) : null
            })
            .eq('employee_id', employee.employee_id)

        setLoading(false)

        if (error) {
            window.alert('Failed to update employee: ' + error.message)
        } else {
            window.alert('Employee details updated successfully')
            onSuccess()
            onOpenChange(false)
        }
    }

    const handleChange = (field: keyof Employee, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }))
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Edit Employee: {employee?.name} ({employee?.employee_id})</DialogTitle>
                </DialogHeader>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-4">
                    <div className="grid gap-2">
                        <Label htmlFor="employee_id">Employee ID (Readonly)</Label>
                        <Input id="employee_id" value={employee?.employee_id || ''} disabled className="bg-slate-50" />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="name">Full Name</Label>
                        <Input 
                            id="name" 
                            value={formData.name} 
                            onChange={e => handleChange('name', e.target.value)} 
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="department">Department</Label>
                        <Input 
                            id="department" 
                            value={formData.department} 
                            onChange={e => handleChange('department', e.target.value)} 
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="designation">Designation</Label>
                        <Input 
                            id="designation" 
                            value={formData.designation} 
                            onChange={e => handleChange('designation', e.target.value)} 
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="gender">Gender</Label>
                        <select
                            id="gender"
                            value={formData.gender}
                            onChange={e => handleChange('gender', e.target.value)}
                            className="w-full border border-input rounded-md p-2 text-sm bg-white"
                        >
                            <option value="">Select Gender</option>
                            <option value="Male">Male</option>
                            <option value="Female">Female</option>
                            <option value="Other">Other</option>
                        </select>
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="role">App Role</Label>
                        <select
                            id="role"
                            value={formData.role}
                            onChange={e => handleChange('role', e.target.value)}
                            className="w-full border border-input rounded-md p-2 text-sm bg-white"
                        >
                            <option value="employee">Employee</option>
                            <option value="manager">Manager</option>
                            <option value="admin">Admin</option>
                        </select>
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="manager_id">Manager ID</Label>
                        <Input 
                            id="manager_id" 
                            value={formData.manager_id} 
                            onChange={e => handleChange('manager_id', e.target.value)} 
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="status">Status</Label>
                        <select
                            id="status"
                            value={formData.status}
                            onChange={e => handleChange('status', e.target.value)}
                            className="w-full border border-input rounded-md p-2 text-sm bg-white"
                        >
                            <option value="Active">Active</option>
                            <option value="Notice Period">Notice Period</option>
                            <option value="Relieved">Relieved</option>
                        </select>
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="date_joined">Date Joined</Label>
                        <Input 
                            id="date_joined" 
                            type="date" 
                            value={formData.date_joined} 
                            onChange={e => handleChange('date_joined', e.target.value)} 
                        />
                    </div>
                    {(formData.status === 'Notice Period' || formData.status === 'Relieved') && (
                        <div className="grid gap-2">
                            <Label htmlFor="date_resigned">Date Resigned</Label>
                            <Input 
                                id="date_resigned" 
                                type="date" 
                                value={formData.date_resigned} 
                                onChange={e => handleChange('date_resigned', e.target.value)} 
                            />
                        </div>
                    )}
                    {formData.status === 'Relieved' && (
                        <div className="grid gap-2">
                            <Label htmlFor="date_relived">Date Relieved</Label>
                            <Input 
                                id="date_relived" 
                                type="date" 
                                value={formData.date_relived} 
                                onChange={e => handleChange('date_relived', e.target.value)} 
                            />
                        </div>
                    )}
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
                        Cancel
                    </Button>
                    <Button onClick={handleUpdate} disabled={loading} className="bg-red-600 hover:bg-red-700">
                        {loading ? 'Saving...' : 'Save Changes'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
