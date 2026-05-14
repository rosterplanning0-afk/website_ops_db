'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { PlusCircle, Trash2, CheckCircle2, Save } from 'lucide-react'
import type { UserRole } from '@/lib/rbac'

interface EmployeeOption {
    employee_id: string
    name: string
    designation: string
    department: string
}

interface CounsellingRow {
    id: string
    date: string
    timeFrom: string
    timeTo: string
    place: string
    employeeId: string
    empName: string
    areasForImprovement: string
}

export default function GeneralCounsellingPage() {
    const supabase = createClient()
    const [topic, setTopic] = useState('')
    const [rows, setRows] = useState<CounsellingRow[]>([])
    const [availableEmployees, setAvailableEmployees] = useState<EmployeeOption[]>([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [successMsg, setSuccessMsg] = useState('')

    useEffect(() => {
        loadEmployees()
        addRow() // Start with one empty row
    }, [])

    async function loadEmployees() {
        setLoading(true)
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

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

        let empQuery = supabase.from('employees').select('employee_id, name, designation, department, status, manager_id')
        if (userRole !== 'admin' && userDept !== 'all') {
            const userId = profile?.employee_id || ''
            empQuery = empQuery.or(`department.eq."${userDept}",manager_id.eq."${userId}"`)
        }
        
        const { data: emps } = await empQuery.order('name')
        const activeEmps = (emps || []).filter(e => !e.status || e.status === 'Active' || e.status.toLowerCase() === 'active')
        setAvailableEmployees(activeEmps)
        setLoading(false)
    }

    const addRow = () => {
        const today = new Date().toISOString().split('T')[0]
        setRows(prev => [
            ...prev,
            {
                id: crypto.randomUUID(),
                date: today,
                timeFrom: '',
                timeTo: '',
                place: '',
                employeeId: '',
                empName: '',
                areasForImprovement: ''
            }
        ])
    }

    const removeRow = (id: string) => {
        setRows(prev => prev.filter(r => r.id !== id))
    }

    const updateRow = (id: string, field: keyof CounsellingRow, value: string) => {
        setRows(prev => prev.map(row => {
            if (row.id === id) {
                const updatedRow = { ...row, [field]: value }
                
                // Auto-fill name if employeeId changes
                if (field === 'employeeId') {
                    const emp = availableEmployees.find(e => e.employee_id === value)
                    updatedRow.empName = emp ? emp.name : ''
                }
                
                return updatedRow
            }
            return row
        }))
    }

    async function handleSubmit() {
        if (!topic.trim()) {
            alert('Please enter the Topic of Counselling.')
            return
        }

        // Validate rows
        const validRows = rows.filter(r => r.employeeId && r.date)
        if (validRows.length === 0) {
            alert('Please add at least one valid row with an Employee ID and Date.')
            return
        }

        for (const row of validRows) {
            if (!availableEmployees.find(e => e.employee_id === row.employeeId)) {
                alert(`Invalid Employee ID: ${row.employeeId}. Please select from the available list.`)
                return
            }
        }

        setSaving(true)
        setSuccessMsg('')
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { setSaving(false); return }

        // Insert Session
        const { data: session, error: sessionError } = await supabase
            .from('general_counselling_sessions')
            .insert({
                topic: topic,
                created_by: user.id
            })
            .select()
            .single()

        if (sessionError || !session) {
            setSaving(false)
            alert('Failed to save session: ' + (sessionError?.message || 'Unknown error'))
            return
        }

        // Insert Records
        const recordsToInsert = validRows.map(r => ({
            session_id: session.id,
            employee_id: r.employeeId,
            counselling_date: r.date,
            time_from: r.timeFrom || '00:00:00',
            time_to: r.timeTo || '00:00:00',
            place: r.place,
            areas_for_improvement: r.areasForImprovement
        }))

        const { error: recordsError } = await supabase
            .from('general_counselling_records')
            .insert(recordsToInsert)

        setSaving(false)

        if (recordsError) {
            alert('Failed to save records: ' + recordsError.message)
        } else {
            setSuccessMsg(`Successfully saved general counselling session with ${validRows.length} participants.`)
            setTopic('')
            setRows([])
            addRow()
            setTimeout(() => setSuccessMsg(''), 5000)
        }
    }

    if (loading) return <div className="p-8 text-center text-muted-foreground">Loading...</div>

    return (
        <div className="space-y-6 max-w-[1400px] mx-auto">
            <h2 className="text-2xl font-bold text-slate-800">General Counselling of Staff</h2>

            <Card className="border-t-4 border-t-blue-800 shadow-lg">
                <CardHeader className="bg-blue-50 border-b pb-4">
                    <CardTitle className="text-lg flex items-center justify-between">
                        <span className="text-blue-900 font-bold">Counselling of Train Operations staff</span>
                        <Button onClick={handleSubmit} disabled={saving} className="bg-blue-800 hover:bg-blue-900 text-white">
                            <Save className="w-4 h-4 mr-2" />
                            {saving ? 'Saving...' : 'Save All'}
                        </Button>
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    {successMsg && (
                        <div className="m-4 p-3 bg-green-50 text-green-700 text-sm font-medium rounded-md flex items-center gap-2">
                            <CheckCircle2 className="h-5 w-5" /> {successMsg}
                        </div>
                    )}

                    <div className="p-6 border-b border-slate-200">
                        <label className="block text-sm font-bold text-slate-700 mb-2">Topic of Counselling <span className="text-red-500">*</span></label>
                        <Textarea 
                            value={topic}
                            onChange={(e) => setTopic(e.target.value)}
                            placeholder="Enter the main topic and details discussed during the session..."
                            className="min-h-[100px] border-slate-300 shadow-inner resize-y"
                        />
                    </div>

                    <div className="overflow-x-auto w-full">
                        <Table className="min-w-[1200px] border-collapse">
                            <TableHeader className="bg-blue-100/50">
                                <TableRow>
                                    <TableHead className="w-[140px] border-r border-slate-200 text-center font-bold text-slate-700">Date</TableHead>
                                    <TableHead className="w-[110px] border-r border-slate-200 text-center font-bold text-slate-700">Time From</TableHead>
                                    <TableHead className="w-[110px] border-r border-slate-200 text-center font-bold text-slate-700">Time To</TableHead>
                                    <TableHead className="w-[150px] border-r border-slate-200 text-center font-bold text-slate-700">Place</TableHead>
                                    <TableHead className="w-[180px] border-r border-slate-200 text-center font-bold text-slate-700">EMP No <span className="text-red-500">*</span></TableHead>
                                    <TableHead className="w-[200px] border-r border-slate-200 text-center font-bold text-slate-700">Name of TO/TA</TableHead>
                                    <TableHead className="min-w-[300px] border-r border-slate-200 font-bold text-slate-700">Areas recommended for improvement / NBT</TableHead>
                                    <TableHead className="w-[60px] text-center"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {rows.map((row, idx) => (
                                    <TableRow key={row.id} className="hover:bg-slate-50/50 transition-colors">
                                        <TableCell className="p-2 border-r border-slate-200 align-top">
                                            <Input type="date" value={row.date} onChange={(e) => updateRow(row.id, 'date', e.target.value)} className="h-9" />
                                        </TableCell>
                                        <TableCell className="p-2 border-r border-slate-200 align-top">
                                            <Input type="time" value={row.timeFrom} onChange={(e) => updateRow(row.id, 'timeFrom', e.target.value)} className="h-9" />
                                        </TableCell>
                                        <TableCell className="p-2 border-r border-slate-200 align-top">
                                            <Input type="time" value={row.timeTo} onChange={(e) => updateRow(row.id, 'timeTo', e.target.value)} className="h-9" />
                                        </TableCell>
                                        <TableCell className="p-2 border-r border-slate-200 align-top">
                                            <Input placeholder="Location" value={row.place} onChange={(e) => updateRow(row.id, 'place', e.target.value)} className="h-9" />
                                        </TableCell>
                                        <TableCell className="p-2 border-r border-slate-200 align-top">
                                            <Input 
                                                list="employee-options" 
                                                placeholder="e.g. 10001" 
                                                value={row.employeeId} 
                                                onChange={(e) => updateRow(row.id, 'employeeId', e.target.value)} 
                                                className="h-9 bg-yellow-50 focus:bg-white"
                                            />
                                        </TableCell>
                                        <TableCell className="p-2 border-r border-slate-200 align-top">
                                            <Input value={row.empName} readOnly className="h-9 bg-slate-100 text-slate-600 border-slate-200" placeholder="Auto-filled" />
                                        </TableCell>
                                        <TableCell className="p-2 border-r border-slate-200 align-top">
                                            <Textarea 
                                                value={row.areasForImprovement} 
                                                onChange={(e) => updateRow(row.id, 'areasForImprovement', e.target.value)} 
                                                className="min-h-[36px] h-9 resize-y py-2"
                                                placeholder="Remarks..."
                                            />
                                        </TableCell>
                                        <TableCell className="p-2 text-center align-top">
                                            <Button 
                                                variant="ghost" 
                                                size="icon" 
                                                onClick={() => removeRow(row.id)}
                                                className="text-slate-400 hover:text-red-600 hover:bg-red-50 h-9 w-9"
                                                title="Remove Row"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>

                    <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-center">
                        <Button 
                            variant="outline" 
                            onClick={addRow}
                            className="w-full max-w-md border-dashed border-2 border-slate-300 text-slate-600 hover:border-blue-500 hover:text-blue-700 bg-transparent hover:bg-blue-50"
                        >
                            <PlusCircle className="w-4 h-4 mr-2" />
                            Add Another Row
                        </Button>
                    </div>

                </CardContent>
            </Card>

            {/* Datalist for Employee Auto-complete */}
            <datalist id="employee-options">
                {availableEmployees.map(emp => (
                    <option key={emp.employee_id} value={emp.employee_id}>
                        {emp.name} ({emp.designation})
                    </option>
                ))}
            </datalist>

        </div>
    )
}
