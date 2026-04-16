'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Users, Search, Filter, Edit } from 'lucide-react'
import { EditEmployeeDialog } from '@/components/employees/edit-employee-dialog'

export default function EmployeeListPage() {
    const [employees, setEmployees] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [canEdit, setCanEdit] = useState(false)
    const [isAdmin, setIsAdmin] = useState(false)
    const [selectedEmployee, setSelectedEmployee] = useState<any | null>(null)
    const [isDialogOpen, setIsDialogOpen] = useState(false)

    // Filters
    const [searchId, setSearchId] = useState('')
    const [selectedDesignation, setSelectedDesignation] = useState('all')
    const [selectedDepartment, setSelectedDepartment] = useState('all')
    const [selectedStatus, setSelectedStatus] = useState('all')

    useEffect(() => {
        async function fetchEmployees() {
            const supabase = createClient()
            setLoading(true)
            
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            const { data: profile } = await supabase.from('users').select('role, employee_id').eq('id', user.id).single()
            let userRole = (profile?.role || 'employee') as string
            let userDept = 'all'

            if (profile?.employee_id) {
                const { data: empInfo } = await supabase.from('employees').select('role, department').eq('employee_id', profile.employee_id).single()
                if (empInfo) {
                    userRole = (empInfo.role?.toLowerCase() || userRole)
                    userDept = empInfo.department || 'all'
                }
            }

            setCanEdit(userRole === 'admin' || userRole === 'roster_planners')
            setIsAdmin(userRole === 'admin')

            let query = supabase.from('employees').select('*').order('name', { ascending: true })
            
            // Apply department filter for non-admins
            if (userRole !== 'admin' && userDept !== 'all') {
                query = query.eq('department', userDept)
            }

            const { data } = await query
            setEmployees(data || [])
            setLoading(false)
        }
        fetchEmployees()
    }, [])

    const refreshData = async () => {
        const supabase = createClient()
        const { data } = await supabase.from('employees').select('*').order('name', { ascending: true })
        setEmployees(data || [])
    }

    const uniqueDepartments = Array.from(new Set(employees.map(e => e.department).filter(Boolean)))
    
    // Filter designations based on selected department
    const uniqueDesignations = Array.from(new Set(
        employees
            .filter(e => selectedDepartment === 'all' || e.department === selectedDepartment)
            .map(e => e.designation)
            .filter(Boolean)
    ))

    const uniqueStatuses = Array.from(new Set(employees.map(e => e.status || 'Active')))

    const filteredEmployees = employees.filter(emp => {
        const matchId = (emp.employee_id || '').toLowerCase().includes(searchId.toLowerCase())
        const matchDesig = selectedDesignation === 'all' || emp.designation === selectedDesignation
        const matchDept = selectedDepartment === 'all' || emp.department === selectedDepartment
        const matchStatus = selectedStatus === 'all' || (emp.status || 'Active') === selectedStatus
        return matchId && matchDesig && matchDept && matchStatus
    })

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold text-slate-800">Employee List</h2>

            <Card>
                <CardHeader className="pb-3 border-b mb-4">
                    <CardTitle className="flex items-center gap-2 text-lg"><Filter className="h-5 w-5" /> Filters</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-700">Search by ID</label>
                            <div className="relative">
                                <Search className="absolute left-2 top-2.5 h-4 w-4 text-slate-400" />
                                <Input
                                    placeholder="Enter Employee ID..."
                                    className="pl-8"
                                    value={searchId}
                                    onChange={(e) => setSearchId(e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-700">Department</label>
                            <select
                                value={selectedDepartment}
                                onChange={e => {
                                    setSelectedDepartment(e.target.value)
                                    setSelectedDesignation('all') // Reset designation on department change
                                }}
                                className="w-full border border-input rounded-md p-2 text-sm bg-white"
                            >
                                <option value="all">All Departments</option>
                                {uniqueDepartments.map(d => <option key={d as string} value={d as string}>{d}</option>)}
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-700">Designation</label>
                            <select
                                value={selectedDesignation}
                                onChange={e => setSelectedDesignation(e.target.value)}
                                className="w-full border border-input rounded-md p-2 text-sm bg-white"
                            >
                                <option value="all">All Designations</option>
                                {uniqueDesignations.map(d => <option key={d as string} value={d as string}>{d}</option>)}
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-700">Status</label>
                            <select
                                value={selectedStatus}
                                onChange={e => setSelectedStatus(e.target.value)}
                                className="w-full border border-input rounded-md p-2 text-sm bg-white"
                            >
                                <option value="all">All Statuses</option>
                                {uniqueStatuses.map(s => <option key={s as string} value={s as string}>{s}</option>)}
                            </select>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" /> All Employees</CardTitle>
                        <span className="text-sm font-medium bg-red-100 text-red-800 px-3 py-1 rounded-full">{filteredEmployees.length} Results</span>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Employee ID</TableHead>
                                    <TableHead>Name</TableHead>
                                    <TableHead>Designation</TableHead>
                                    <TableHead>Department</TableHead>
                                    <TableHead>Status</TableHead>
                                    {canEdit && <TableHead className="text-right">Actions</TableHead>}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Loading employees...</TableCell></TableRow>
                                ) : filteredEmployees.length > 0 ? (
                                    filteredEmployees.map((emp: any) => (
                                        <TableRow key={emp.employee_id}>
                                            <TableCell className="font-mono text-sm">{emp.employee_id}</TableCell>
                                            <TableCell className="font-medium">{emp.name}</TableCell>
                                            <TableCell>{emp.designation}</TableCell>
                                            <TableCell>{emp.department}</TableCell>
                                            <TableCell>
                                                <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${emp.status === 'Active' ? 'bg-green-100 text-green-700' : emp.status === 'Notice Period' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>
                                                    {emp.status || 'Active'}
                                                </span>
                                            </TableCell>
                                            {canEdit && (
                                                <TableCell className="text-right">
                                                    <Button 
                                                        variant="ghost" 
                                                        size="sm"
                                                        onClick={() => {
                                                            setSelectedEmployee(emp)
                                                            setIsDialogOpen(true)
                                                        }}
                                                    >
                                                        <Edit className="h-4 w-4 mr-2" />
                                                        Edit
                                                    </Button>
                                                </TableCell>
                                            )}
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No employees match your filters.</TableCell></TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            <EditEmployeeDialog 
                employee={selectedEmployee}
                open={isDialogOpen}
                onOpenChange={setIsDialogOpen}
                onSuccess={refreshData}
                isAdmin={isAdmin}
            />
        </div>
    )
}
