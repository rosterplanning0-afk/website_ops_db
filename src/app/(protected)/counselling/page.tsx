'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { MessageCircle, Search, PlusCircle, CheckCircle2 } from 'lucide-react'
import type { UserRole } from '@/lib/rbac'

interface EmployeeOption {
    employee_id: string
    name: string
    designation: string
    department: string
}

interface CounsellingRecord {
    id: string
    employee_id: string
    counselling_date: string
    reason: string
    remarks: string
    emp_name?: string
    counselled_by_name?: string
}

export default function CounsellingPage() {
    const supabase = createClient()
    const [role, setRole] = useState<UserRole>('employee')
    const [department, setDepartment] = useState<string>('all')
    const [availableEmployees, setAvailableEmployees] = useState<EmployeeOption[]>([])
    const [records, setRecords] = useState<CounsellingRecord[]>([])
    
    // Form state
    const [searchEmpId, setSearchEmpId] = useState('')
    const [selectedEmpId, setSelectedEmpId] = useState('')
    const [date, setDate] = useState(new Date().toISOString().split('T')[0])
    const [reason, setReason] = useState('')
    const [remarks, setRemarks] = useState('')
    const [dropdownOpen, setDropdownOpen] = useState(false)
    
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [successMsg, setSuccessMsg] = useState('')

    useEffect(() => {
        loadData()
    }, [])

    async function loadData() {
        setLoading(true)
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        // Get user role & department
        const { data: profile } = await supabase.from('users').select('role, employee_id').eq('id', user.id).single()
        let userRole = (profile?.role || 'employee') as UserRole
        let userDept = 'all'

        if (profile?.employee_id) {
            const { data: empInfo } = await supabase.from('employees').select('role, department').eq('employee_id', profile.employee_id).single()
            if (empInfo) {
                userRole = (empInfo.role?.toLowerCase() || userRole) as UserRole
                userDept = empInfo.department || 'all'
            }
        }
        setRole(userRole)
        setDepartment(userDept)

        // Load employees for the form dropdown (filtered by department or if assigned to manager)
        let empQuery = supabase.from('employees').select('employee_id, name, designation, department, status, manager_id')
        if (userRole !== 'admin' && userDept !== 'all') {
            const userId = profile?.employee_id || ''
            empQuery = empQuery.or(`department.eq."${userDept}",manager_id.eq."${userId}"`)
        }
        const { data: emps } = await empQuery.order('name')
        const activeEmps = (emps || []).filter(e => !e.status || e.status === 'Active' || e.status.toLowerCase() === 'active')
        setAvailableEmployees(activeEmps)

        // Load counselling records (Admin sees all, others see their department's employees)
        let recordsQuery = supabase.from('employee_counselling').select(`
            id, employee_id, counselling_date, reason, remarks, counselled_by,
            users:counselled_by (full_name)
        `).order('counselling_date', { ascending: false }).limit(100)
        
        const { data: history } = await recordsQuery
        
        if (history) {
            // map emp names
            const empMap = new Map((emps || []).map(e => [e.employee_id, e.name]))
            
            // If manager/hod, we need to filter the records manually since employee_counselling doesn't have department
            const enriched = history.map(r => ({
                id: r.id,
                employee_id: r.employee_id,
                counselling_date: r.counselling_date,
                reason: r.reason,
                remarks: r.remarks,
                emp_name: empMap.get(r.employee_id) || 'Unknown (Out of Dept)',
                counselled_by_name: (r.users as any)?.full_name || 'Admin'
            }))
            
            // Filter
            const visibleRecords = userRole === 'admin' 
                ? enriched 
                : enriched.filter(r => empMap.has(r.employee_id)) // Only show if the employee is in their dept map
            
            setRecords(visibleRecords)
        }

        setLoading(false)
    }

    // Filter dropdown based on search input
    const safeSearch = searchEmpId.toLowerCase()
    const filteredEmployees = availableEmployees.filter(e => 
        (e.employee_id || '').toLowerCase().includes(safeSearch) ||
        (e.name || '').toLowerCase().includes(safeSearch)
    )

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        if (!selectedEmpId || !reason || !date) return

        setSaving(true)
        setSuccessMsg('')
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { setSaving(false); return }

        const { error } = await supabase.from('employee_counselling').insert({
            employee_id: selectedEmpId,
            counselled_by: user.id,
            counselling_date: date,
            reason: reason,
            remarks: remarks || null
        })

        setSaving(false)
        if (!error) {
            setSuccessMsg('Counselling record saved successfully.')
            setSelectedEmpId('')
            setReason('')
            setRemarks('')
            setSearchEmpId('')
            loadData() // Refresh table
            setTimeout(() => setSuccessMsg(''), 5000)
        } else {
            alert('Failed to save record: ' + error.message)
        }
    }

    if (loading) return <div className="p-8 text-center text-muted-foreground">Loading counselling data...</div>

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold text-slate-800">Employee Counselling</h2>

            <div className="grid gap-6 md:grid-cols-3">
                
                {/* FORM COLUMN */}
                <Card className="md:col-span-1 h-fit">
                    <CardHeader className="bg-slate-50 border-b pb-4">
                        <CardTitle className="text-lg flex items-center gap-2">
                            <PlusCircle className="h-5 w-5 text-red-600" /> New Record
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-4">
                        {successMsg && (
                            <div className="mb-4 p-3 bg-green-50 text-green-700 text-sm font-medium rounded-md flex items-center gap-2">
                                <CheckCircle2 className="h-4 w-4" /> {successMsg}
                            </div>
                        )}
                        <form onSubmit={handleSubmit} className="space-y-4">
                            {/* Combined Search & Select Combobox */}
                            <div className="space-y-2 relative">
                                <Label className="text-red-700">Search & Select Employee *</Label>
                                <div className="relative">
                                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                                    <Input 
                                        placeholder="Type name or ID to search..." 
                                        className="pl-9 bg-white"
                                        value={searchEmpId}
                                        onChange={e => {
                                            setSearchEmpId(e.target.value)
                                            setDropdownOpen(true)
                                            setSelectedEmpId('') // Reset selection when typing
                                        }}
                                        onFocus={() => setDropdownOpen(true)}
                                        onBlur={() => setTimeout(() => setDropdownOpen(false), 200)}
                                        required={!selectedEmpId}
                                    />
                                </div>
                                {dropdownOpen && (
                                    <div className="absolute z-20 w-full mt-1 bg-white border border-slate-200 rounded-md shadow-lg max-h-60 overflow-y-auto">
                                        {filteredEmployees.length > 0 ? (
                                            filteredEmployees.map(emp => (
                                                <div 
                                                    key={emp.employee_id} 
                                                    className={`px-3 py-2 cursor-pointer hover:bg-slate-100 text-sm ${selectedEmpId === emp.employee_id ? 'bg-red-50 text-red-900 font-medium' : 'text-slate-700'}`}
                                                    onClick={() => {
                                                        setSelectedEmpId(emp.employee_id)
                                                        setSearchEmpId(`${emp.employee_id} - ${emp.name || 'Unknown'}`)
                                                        setDropdownOpen(false)
                                                    }}
                                                >
                                                    <span className="font-semibold text-slate-900">{emp.employee_id}</span> - {emp.name || 'Unknown'} 
                                                    <span className="text-slate-500 text-xs ml-1">{emp.designation ? `(${emp.designation})` : ''}</span>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="px-3 py-2 text-sm text-slate-500">No matching employees found.</div>
                                        )}
                                    </div>
                                )}
                            </div>

                            <div className="space-y-2">
                                <Label>Date of Counselling *</Label>
                                <Input type="date" value={date} onChange={e => setDate(e.target.value)} required max={new Date().toISOString().split('T')[0]} />
                            </div>

                            <div className="space-y-2">
                                <Label>Reason for Counselling *</Label>
                                <Input value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g., Signal Violation, Late Arrival" required />
                            </div>

                            <div className="space-y-2">
                                <Label>Remarks / Actions Taken</Label>
                                <Textarea value={remarks} onChange={e => setRemarks(e.target.value)} placeholder="Detailed notes..." rows={3} />
                            </div>

                            <Button type="submit" className="w-full bg-red-600 hover:bg-red-700" disabled={saving || !selectedEmpId}>
                                {saving ? 'Saving...' : 'Save Record'}
                            </Button>
                        </form>
                    </CardContent>
                </Card>

                {/* TABLE COLUMN */}
                <Card className="md:col-span-2">
                    <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                            <MessageCircle className="h-5 w-5 text-slate-500" /> Recent Counselling Records
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Date</TableHead>
                                        <TableHead>Employee</TableHead>
                                        <TableHead>Reason</TableHead>
                                        <TableHead>Counselled By</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {records.length > 0 ? (
                                        records.map(rec => (
                                            <TableRow key={rec.id}>
                                                <TableCell className="whitespace-nowrap text-sm font-medium">
                                                    {new Date(rec.counselling_date).toLocaleDateString('en-IN')}
                                                </TableCell>
                                                <TableCell>
                                                    <div className="font-medium">{rec.emp_name}</div>
                                                    <div className="text-xs text-slate-500 font-mono">{rec.employee_id}</div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="text-sm font-semibold">{rec.reason}</div>
                                                    {rec.remarks && <div className="text-xs text-slate-500 line-clamp-2 mt-0.5">{rec.remarks}</div>}
                                                </TableCell>
                                                <TableCell className="text-sm text-slate-600">{rec.counselled_by_name}</TableCell>
                                            </TableRow>
                                        ))
                                    ) : (
                                        <TableRow>
                                            <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                                                No counselling records found.
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
