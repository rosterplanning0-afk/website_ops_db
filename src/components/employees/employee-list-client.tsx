'use client'

import { useState, useRef, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Users, Search, Filter, Edit, Download, UserPlus } from 'lucide-react'
import { EditEmployeeDialog } from '@/components/employees/edit-employee-dialog'
import { AddEmployeeDialog } from '@/components/employees/add-employee-dialog'
import * as XLSX from 'xlsx'
import { useRouter } from 'next/navigation'

interface EmployeeListClientProps {
    initialEmployees: any[]
    userRoleState: string
    userDept: string
    isAdmin: boolean
    canEdit: boolean
    userDelegations: any[]
}

export function EmployeeListClient({
    initialEmployees,
    userRoleState,
    userDept,
    isAdmin,
    canEdit,
    userDelegations,
}: EmployeeListClientProps) {
    const router = useRouter()
    const [employees, setEmployees] = useState<any[]>(initialEmployees)
    const [selectedEmployee, setSelectedEmployee] = useState<any | null>(null)
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
    const [isUploading, setIsUploading] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)

    // Sync state when props change
    useEffect(() => {
        setEmployees(initialEmployees)
    }, [initialEmployees])

    // Filters
    const [searchId, setSearchId] = useState('')
    const [selectedDesignation, setSelectedDesignation] = useState('all')
    const [selectedDepartment, setSelectedDepartment] = useState('all')
    const [selectedStatus, setSelectedStatus] = useState('all')

    const refreshData = () => {
        router.refresh()
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
        const searchLower = searchId.toLowerCase()
        const matchIdOrName = (emp.employee_id || '').toLowerCase().includes(searchLower) || 
                              (emp.name || '').toLowerCase().includes(searchLower)
        const matchDesig = selectedDesignation === 'all' || emp.designation === selectedDesignation
        const matchDept = selectedDepartment === 'all' || emp.department === selectedDepartment
        const matchStatus = selectedStatus === 'all' || (emp.status || 'Active') === selectedStatus
        return matchIdOrName && matchDesig && matchDept && matchStatus
    })

    const downloadExcel = () => {
        if (!filteredEmployees || filteredEmployees.length === 0) return

        const exportData = filteredEmployees.map(emp => ({
            'Employee ID': emp.employee_id,
            'Name': emp.name,
            'Designation': emp.designation,
            'Department': emp.department,
            'Gender': emp.gender,
            'Status': emp.status || 'Active',
            'Role': emp.role || 'employee',
            'Manager ID': emp.manager_id,
            'Geo Location Link': emp.geo_location_link,
            'Latitude': emp.latitude,
            'Longitude': emp.longitude,
            'Full Address': emp.full_address,
            'Date Joined': emp.date_joined,
            'Date Resigned': emp.date_resigned,
            'Date Relieved': emp.date_relived,
            'Last Updated At': emp.last_updated_at ? new Date(emp.last_updated_at).toLocaleString('en-IN') : '—'
        }))

        const worksheet = XLSX.utils.json_to_sheet(exportData)
        const workbook = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Employees')
        XLSX.writeFile(workbook, `employee_list_${new Date().toISOString().split('T')[0]}.xlsx`)
    }

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        setIsUploading(true)
        const reader = new FileReader()

        reader.onload = async (event) => {
            try {
                const data = new Uint8Array(event.target?.result as ArrayBuffer)
                const workbook = XLSX.read(data, { type: 'array' })
                const sheetName = workbook.SheetNames[0]
                const worksheet = workbook.Sheets[sheetName]
                const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet)

                const formattedData = jsonData.map((row: any) => ({
                    employee_id: row['Employee ID'],
                    name: row['Name'],
                    designation: row['Designation'],
                    department: row['Department'],
                    gender: row['Gender'],
                    status: row['Status'],
                    role: row['Role'],
                    manager_id: row['Manager ID'],
                    geo_location_link: row['Geo Location Link'],
                    latitude: row['Latitude'],
                    longitude: row['Longitude'],
                    full_address: row['Full Address'],
                    date_joined: row['Date Joined'],
                    date_resigned: row['Date Resigned'],
                    date_relived: row['Date Relieved']
                })).filter(row => row.employee_id)

                if (formattedData.length === 0) {
                    alert('No valid employee data found in the file.')
                    setIsUploading(false)
                    return
                }

                const res = await fetch('/api/employees/bulk', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ employees: formattedData })
                })

                if (res.ok) {
                    alert('Employees updated successfully!')
                    refreshData()
                } else {
                    const errorData = await res.json()
                    alert(`Error updating employees: ${errorData.error}`)
                }
            } catch (error) {
                console.error('Error processing file:', error)
                alert('Failed to process Excel file.')
            } finally {
                setIsUploading(false)
                if (fileInputRef.current) {
                    fileInputRef.current.value = ''
                }
            }
        }

        reader.onerror = () => {
            alert('Failed to read file')
            setIsUploading(false)
        }

        reader.readAsArrayBuffer(file)
    }

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
                            <label className="text-sm font-medium text-slate-700">Search by ID or Name</label>
                            <div className="relative">
                                <Search className="absolute left-2 top-2.5 h-4 w-4 text-slate-400" />
                                <Input
                                    placeholder="Enter ID or Name..."
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
                                    setSelectedDesignation('all')
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
                        <div className="flex items-center gap-4">
                            {(isAdmin || userRoleState === 'roster_planners') && (
                                <Button 
                                    onClick={() => setIsAddDialogOpen(true)}
                                    className="bg-red-600 hover:bg-red-700 flex items-center gap-2"
                                >
                                    <UserPlus className="h-4 w-4" />
                                    Add Employee
                                </Button>
                            )}
                            {userRoleState !== 'employee' && (
                                <div className="flex items-center gap-2">
                                    <input
                                        type="file"
                                        accept=".xlsx, .xls"
                                        className="hidden"
                                        ref={fileInputRef}
                                        onChange={handleFileUpload}
                                    />
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => fileInputRef.current?.click()}
                                        className="flex items-center gap-2"
                                        disabled={isUploading}
                                    >
                                        <Download className="h-4 w-4 rotate-180" />
                                        {isUploading ? 'Uploading...' : 'Upload Excel'}
                                    </Button>
                                    <Button variant="outline" size="sm" onClick={downloadExcel} className="flex items-center gap-2">
                                        <Download className="h-4 w-4" />
                                        Download Excel
                                    </Button>
                                </div>
                            )}
                            <span className="text-sm font-medium bg-red-100 text-red-800 px-3 py-1 rounded-full">{filteredEmployees.length} Results</span>
                        </div>
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
                                {filteredEmployees.length > 0 ? (
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
                userDelegations={userDelegations}
            />

            <AddEmployeeDialog
                open={isAddDialogOpen}
                onOpenChange={setIsAddDialogOpen}
                onSuccess={refreshData}
                isAdmin={isAdmin}
                userDelegations={userDelegations}
            />
        </div>
    )
}
