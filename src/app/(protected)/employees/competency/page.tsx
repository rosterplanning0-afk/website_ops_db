'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { BookOpen, CheckCircle2, PlusCircle, Search, UserCircle } from 'lucide-react'
import { DEPT_CREW_MAPPING } from '@/lib/rbac'
import { BulkCompetencyDialog } from '@/components/employees/bulk-competency-dialog'

const DEPARTMENTS = Object.keys(DEPT_CREW_MAPPING)

interface Employee {
    employee_id: string
    name: string
    designation: string
    department: string
}

interface Competency {
    id: string
    employee_id: string
    department: string
    designation: string
    train_type?: string | null
    valid_from: string
    valid_till: string | null
    created_at: string
}

export default function EmployeeCompetencyPage() {
    const [employees, setEmployees] = useState<Employee[]>([])
    const [selectedEmpId, setSelectedEmpId] = useState('')
    const [selectedEmp, setSelectedEmp] = useState<Employee | null>(null)
    const [competencies, setCompetencies] = useState<Competency[]>([])
    const [loadingHistory, setLoadingHistory] = useState(false)

    const [department, setDepartment] = useState('')
    const [designation, setDesignation] = useState('')
    const [validFrom, setValidFrom] = useState('')
    const [validTill, setValidTill] = useState('')
    const [trainType, setTrainType] = useState('')
    const [saving, setSaving] = useState(false)
    const [successMsg, setSuccessMsg] = useState('')
    const [formError, setFormError] = useState('')

    const [canManage, setCanManage] = useState(false)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        async function init() {
            const supabase = createClient()
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            const { data: profile } = await supabase
                .from('users')
                .select('role, employee_id')
                .eq('id', user.id)
                .single()

            let userRole = profile?.role || 'employee'
            if (profile?.employee_id) {
                const { data: empInfo } = await supabase
                    .from('employees')
                    .select('role')
                    .eq('employee_id', profile.employee_id)
                    .single()
                if (empInfo?.role) userRole = empInfo.role.toLowerCase()
            }

            setCanManage(['admin', 'hod', 'roster_planners'].includes(userRole))

            const { data: emps } = await supabase
                .from('employees')
                .select('employee_id, name, designation, department')
                .order('name')
            setEmployees(emps || [])
            setLoading(false)
        }
        init()
    }, [])

    // Equivalent to @st.cache_data — data is fetched fresh on demand;
    // calling this after save acts as "cache clear + rerun"
    const loadCompetencies = useCallback(async (empId: string) => {
        setLoadingHistory(true)
        const supabase = createClient()
        const { data } = await supabase
            .from('employee_competencies')
            .select('*')
            .eq('employee_id', empId)
            .order('valid_from', { ascending: false })
        setCompetencies(data || [])
        setLoadingHistory(false)
    }, [])

    function handleEmployeeChange(empId: string) {
        setSelectedEmpId(empId)
        const emp = employees.find(e => e.employee_id === empId) || null
        setSelectedEmp(emp)
        setCompetencies([])
        if (emp) loadCompetencies(empId)
    }

    const designationOptions = DEPT_CREW_MAPPING[department] || []

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setFormError('')

        if (!selectedEmpId) { setFormError('Please select an employee.'); return }
        if (!department) { setFormError('Department is required.'); return }
        if (!designation.trim()) { setFormError('Designation is required.'); return }
        if (!validFrom) { setFormError('Valid From date is required.'); return }
        if (validTill && validTill < validFrom) { setFormError('Valid Till must be on or after Valid From.'); return }
        if (designation === 'Train Operators' && !trainType) { setFormError('Please select Train Type (RRTS/MRTS).'); return }

        setSaving(true)
        const supabase = createClient()
        const { error } = await supabase.from('employee_competencies').insert({
            employee_id: selectedEmpId,
            department,
            designation: designation.trim(),
            train_type: designation === 'Train Operators' ? trainType : null,
            valid_from: validFrom,
            valid_till: validTill || null,
        })
        setSaving(false)

        if (error) {
            setFormError('Failed to save: ' + error.message)
            return
        }

        setDepartment('')
        setDesignation('')
        setValidFrom('')
        setValidTill('')
        setTrainType('')
        setSuccessMsg('Competency record saved successfully.')
        setTimeout(() => setSuccessMsg(''), 4000)
        // Re-fetch history — equivalent to load_competencies.clear() + st.rerun()
        loadCompetencies(selectedEmpId)
    }

    if (loading) return <div className="p-8 text-center text-muted-foreground">Loading...</div>

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-slate-800">Employee Competency Register</h2>
                {canManage && (
                    <BulkCompetencyDialog 
                        onSuccess={() => {
                            if (selectedEmpId) loadCompetencies(selectedEmpId)
                        }} 
                    />
                )}
            </div>

            {/* Employee Selection */}
            <Card>
                <CardHeader className="pb-3 border-b mb-4">
                    <CardTitle className="flex items-center gap-2 text-lg">
                        <Search className="h-5 w-5" /> Select Employee
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label className="text-sm font-medium text-slate-700">Employee ID</Label>
                            <Input
                                list="emp-datalist"
                                placeholder="Type ID or name to search..."
                                value={selectedEmpId}
                                onChange={e => handleEmployeeChange(e.target.value)}
                                className="bg-yellow-50 focus:bg-white"
                            />
                            <datalist id="emp-datalist">
                                {employees.map(emp => (
                                    <option key={emp.employee_id} value={emp.employee_id}>
                                        {emp.name} — {emp.department}
                                    </option>
                                ))}
                            </datalist>
                            <p className="text-xs text-slate-400">Select from the dropdown or type the employee ID directly.</p>
                        </div>
                        {selectedEmp && (
                            <div className="flex items-center gap-3 p-3 bg-slate-50 border rounded-md">
                                <UserCircle className="h-9 w-9 text-slate-400 shrink-0" />
                                <div>
                                    <p className="font-semibold text-slate-800">{selectedEmp.name}</p>
                                    <p className="text-xs text-slate-500 font-mono">{selectedEmp.employee_id}</p>
                                    <p className="text-xs text-slate-600 mt-0.5">
                                        {selectedEmp.designation} — {selectedEmp.department}
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Competency History */}
            {selectedEmp && (
                <Card>
                    <CardHeader className="pb-3 border-b">
                        <CardTitle className="flex items-center gap-2 text-lg">
                            <BookOpen className="h-5 w-5" /> Competency History
                            <span className="text-base font-normal text-slate-500">— {selectedEmp.name}</span>
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        {loadingHistory ? (
                            <p className="text-sm text-muted-foreground text-center py-8">Loading history...</p>
                        ) : competencies.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-8">
                                No competency records found for this employee.
                            </p>
                        ) : (
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-slate-50">
                                            <TableHead>Department</TableHead>
                                            <TableHead>Designation</TableHead>
                                            <TableHead>Type</TableHead>
                                            <TableHead>Valid From</TableHead>
                                            <TableHead>Valid Till</TableHead>
                                            <TableHead>Days to Expire</TableHead>
                                            <TableHead>Status</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {competencies.map(c => {
                                            const today = new Date()
                                            today.setHours(0, 0, 0, 0)
                                            const validTillDate = c.valid_till ? new Date(c.valid_till) : null
                                            if (validTillDate) validTillDate.setHours(0, 0, 0, 0)

                                            const isExpired = validTillDate ? validTillDate < today : false
                                            const effectiveStatus = validTillDate 
                                                ? (isExpired ? 'Inactive' : 'Active') 
                                                : 'Active'

                                            let daysToExpirStr = '—'
                                            let expiryColor = 'text-slate-500'

                                            if (validTillDate) {
                                                const diffTime = validTillDate.getTime() - today.getTime()
                                                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
                                                daysToExpirStr = diffDays.toString()

                                                if (diffDays > 60) {
                                                    expiryColor = 'text-green-600 font-bold'
                                                } else if (diffDays >= 30) {
                                                    expiryColor = 'text-yellow-600 font-bold'
                                                } else {
                                                    expiryColor = 'text-red-600 font-bold'
                                                }
                                            }

                                            return (
                                                <TableRow key={c.id}>
                                                    <TableCell className="text-sm">{c.department}</TableCell>
                                                    <TableCell className="font-medium text-sm">{c.designation}</TableCell>
                                                    <TableCell className="text-sm">
                                                        {c.train_type ? (
                                                            <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-[10px] font-bold">
                                                                {c.train_type}
                                                            </span>
                                                        ) : '—'}
                                                    </TableCell>
                                                    <TableCell className="font-mono text-sm">{c.valid_from}</TableCell>
                                                    <TableCell className="font-mono text-sm text-slate-500">
                                                        {c.valid_till || '—'}
                                                    </TableCell>
                                                    <TableCell className={`font-mono text-sm ${expiryColor}`}>
                                                        {daysToExpirStr}
                                                    </TableCell>
                                                    <TableCell>
                                                        <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${
                                                            effectiveStatus === 'Active'
                                                                ? 'bg-green-100 text-green-700'
                                                                : 'bg-slate-100 text-slate-500'
                                                        }`}>
                                                            {effectiveStatus}
                                                        </span>
                                                    </TableCell>
                                                </TableRow>
                                            )
                                        })}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* Assignment Form — visible only to admin / hod / roster_planners */}
            {canManage && selectedEmp && (
                <Card>
                    <CardHeader className="pb-3 border-b">
                        <CardTitle className="flex items-center gap-2 text-lg">
                            <PlusCircle className="h-5 w-5" /> Assign New Competency
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-5">
                        {successMsg && (
                            <div className="flex items-center gap-2 p-3 mb-4 bg-green-50 border border-green-200 rounded-md text-green-700 text-sm font-medium">
                                <CheckCircle2 className="h-4 w-4 shrink-0" />
                                {successMsg}
                            </div>
                        )}
                        {formError && (
                            <div className="p-3 mb-4 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
                                {formError}
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <div className="space-y-2">
                                <Label>
                                    Department <span className="text-red-500">*</span>
                                </Label>
                                <select
                                    value={department}
                                    onChange={e => { setDepartment(e.target.value); setDesignation('') }}
                                    className="w-full border border-input rounded-md p-2 text-sm bg-white"
                                >
                                    <option value="">Select department...</option>
                                    {DEPARTMENTS.map(d => (
                                        <option key={d} value={d}>{d}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="space-y-2">
                                <Label>
                                    Designation <span className="text-red-500">*</span>
                                </Label>
                                {designationOptions.length > 0 ? (
                                    <select
                                        value={designation}
                                        onChange={e => setDesignation(e.target.value)}
                                        className="w-full border border-input rounded-md p-2 text-sm bg-white"
                                    >
                                        <option value="">Select designation...</option>
                                        {designationOptions.map(d => (
                                            <option key={d} value={d}>{d}</option>
                                        ))}
                                    </select>
                                ) : (
                                    <Input
                                        placeholder="Enter designation..."
                                        value={designation}
                                        onChange={e => setDesignation(e.target.value)}
                                    />
                                )}
                            </div>

                            <div className="space-y-2">
                                <Label>
                                    Valid From <span className="text-red-500">*</span>
                                </Label>
                                <Input
                                    type="date"
                                    value={validFrom}
                                    onChange={e => setValidFrom(e.target.value)}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>
                                    Valid Till{' '}
                                    <span className="text-slate-400 font-normal text-xs">(optional)</span>
                                </Label>
                                <Input
                                    type="date"
                                    value={validTill}
                                    min={validFrom || undefined}
                                    onChange={e => setValidTill(e.target.value)}
                                />
                            </div>

                            {designation === 'Train Operators' && (
                                <div className="space-y-2">
                                    <Label>
                                        Train Type <span className="text-red-500">*</span>
                                    </Label>
                                    <select
                                        value={trainType}
                                        onChange={e => setTrainType(e.target.value)}
                                        className="w-full border border-input rounded-md p-2 text-sm bg-white"
                                    >
                                        <option value="">Select train type...</option>
                                        <option value="RRTS">RRTS</option>
                                        <option value="MRTS">MRTS</option>
                                    </select>
                                </div>
                            )}



                            <div className="md:col-span-2">
                                <Button
                                    type="submit"
                                    disabled={saving}
                                    className="bg-red-600 hover:bg-red-700 text-white"
                                >
                                    {saving ? 'Saving...' : 'Save Competency Record'}
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            )}
        </div>
    )
}
