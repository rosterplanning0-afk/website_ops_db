'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { UserCheck, UserX, ShieldCheck, ShieldAlert, Search, History, Users, RefreshCw } from 'lucide-react'

interface EmployeeOption {
    employee_id: string
    name: string
    designation: string | null
    department: string | null
    is_line_inspector: boolean
}

interface HistoryRecord {
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

export function LineInspectorDelegationClient() {
    const supabase = createClient()

    const [loading, setLoading] = useState(true)
    const [employees, setEmployees] = useState<EmployeeOption[]>([])
    const [history, setHistory] = useState<HistoryRecord[]>([])
    const [currentUser, setCurrentUser] = useState<any>(null)

    // Form states
    const [searchQuery, setSearchQuery] = useState('')
    const [selectedDesignation, setSelectedDesignation] = useState('')
    const [selectedEmpId, setSelectedEmpId] = useState('')
    const [processing, setProcessing] = useState(false)
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

    useEffect(() => {
        loadData()
    }, [])

    async function loadData() {
        setLoading(true)
        setMessage(null)
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return
            setCurrentUser(user)

            // Fetch employees list
            const { data: empData, error: empErr } = await supabase
                .from('employees')
                .select('employee_id, name, designation, department, is_line_inspector')
                .order('name')
            if (empErr) throw empErr
            setEmployees(empData || [])

            // Fetch line inspector history
            const { data: histData, error: histErr } = await supabase
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
            if (histErr) throw histErr
            setHistory((histData || []) as any)
        } catch (err: any) {
            setMessage({ type: 'error', text: err.message || 'Failed to load data.' })
        } finally {
            setLoading(false)
        }
    }

    async function handleToggleInspector(employeeId: string, action: 'assigned' | 'removed') {
        if (!currentUser) return
        setProcessing(true)
        setMessage(null)

        try {
            // 1. Update the employee's is_line_inspector status
            const { error: updateErr } = await supabase
                .from('employees')
                .update({ is_line_inspector: action === 'assigned' })
                .eq('employee_id', employeeId)

            if (updateErr) throw updateErr

            // 2. Insert into the audit log history
            const { error: histErr } = await supabase
                .from('line_inspector_history')
                .insert({
                    employee_id: employeeId,
                    action: action,
                    changed_by: currentUser.id
                })

            if (histErr) throw histErr

            setMessage({
                type: 'success',
                text: `Successfully ${action === 'assigned' ? 'assigned' : 'revoked'} Line Inspector privileges.`
            })
            setSelectedEmpId('')
            setSearchQuery('')
            setSelectedDesignation('')
            await loadData()
        } catch (err: any) {
            setMessage({ type: 'error', text: err.message || 'Action failed.' })
        } finally {
            setProcessing(false)
        }
    }

    // Filter for Train Operations employees
    const trainOpsEmployees = employees.filter(e =>
        e.department?.toLowerCase() === 'train operations'
    )

    // Compute unique designations
    const uniqueDesignations = Array.from(new Set(
        trainOpsEmployees
            .map(e => e.designation)
            .filter((d): d is string => !!d)
    )).sort()

    // Filter employees for lookup drop down based on selected designation and search
    const searchedEmployees = trainOpsEmployees.filter(e => {
        const matchesDesignation = selectedDesignation ? e.designation === selectedDesignation : true
        const matchesSearch = searchQuery
            ? (e.name.toLowerCase().includes(searchQuery.toLowerCase()) || e.employee_id.toLowerCase().includes(searchQuery.toLowerCase()))
            : true
        return matchesDesignation && matchesSearch
    })

    // Current selected employee info
    const selectedEmp = trainOpsEmployees.find(e => e.employee_id === selectedEmpId)

    // Active line inspectors
    const activeInspectors = employees.filter(e => e.is_line_inspector)

    if (loading && employees.length === 0) {
        return (
            <div className="p-8 text-center text-muted-foreground flex flex-col items-center gap-2 justify-center min-h-[300px]">
                <RefreshCw className="h-6 w-6 animate-spin text-blue-600" />
                Loading line inspector settings...
            </div>
        )
    }

    return (
        <div className="space-y-6 max-w-7xl mx-auto">
            <div>
                <h2 className="text-2xl font-bold text-slate-800">Line Inspector Delegation</h2>
                <p className="text-slate-500 text-sm mt-0.5">
                    Assign or revoke Line Inspector status for employee staff members. Assigned line inspectors will be able to submit footplate inspection forms and access detailed inspection reports.
                </p>
            </div>

            {message && (
                <div className={`p-4 rounded-lg border text-sm flex items-center gap-3 ${
                    message.type === 'success'
                        ? 'bg-green-50 text-green-800 border-green-200'
                        : 'bg-red-50 text-red-800 border-red-200'
                }`}>
                    {message.type === 'success' ? <ShieldCheck className="h-5 w-5 text-green-600" /> : <ShieldAlert className="h-5 w-5 text-red-600" />}
                    <span>{message.text}</span>
                </div>
            )}

            <div className="grid gap-6 lg:grid-cols-3">
                {/* Assignment Control Card */}
                <Card className="lg:col-span-1 h-fit">
                    <CardHeader className="bg-slate-50 border-b pb-4">
                        <CardTitle className="text-lg flex items-center gap-2">
                            <UserCheck className="h-5 w-5 text-blue-600" /> Privilege Control
                        </CardTitle>
                        <CardDescription>Search and select an employee to modify their status.</CardDescription>
                    </CardHeader>
                    <CardContent className="pt-4 space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="designation-select">Select Designation</Label>
                            <select
                                id="designation-select"
                                className="w-full flex h-10 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                                value={selectedDesignation}
                                onChange={e => {
                                    setSelectedDesignation(e.target.value)
                                    setSelectedEmpId('') // Reset selected employee when designation changes
                                }}
                            >
                                <option value="">-- Select Designation --</option>
                                {uniqueDesignations.map(d => (
                                    <option key={d} value={d}>{d}</option>
                                ))}
                            </select>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="emp-search">Search Employee</Label>
                            <Input
                                id="emp-search"
                                placeholder="Type name or ID to search..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                            />
                            <select
                                className="w-full flex h-10 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent mt-2"
                                value={selectedEmpId}
                                onChange={e => setSelectedEmpId(e.target.value)}
                            >
                                <option value="">-- Select Employee --</option>
                                {searchedEmployees.slice(0, 100).map(e => (
                                    <option key={e.employee_id} value={e.employee_id}>
                                        {e.name} ({e.employee_id}) {e.is_line_inspector ? '⭐ Inspector' : ''}
                                    </option>
                                ))}
                                {searchedEmployees.length === 0 && (
                                    <option value="" disabled>No employees found matching search</option>
                                )}
                            </select>
                        </div>

                        {selectedEmp && (
                            <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-3">
                                <div>
                                    <span className="text-[10px] uppercase font-bold text-slate-400">Selected Employee</span>
                                    <p className="font-semibold text-slate-800 text-sm">{selectedEmp.name}</p>
                                    <p className="text-xs text-slate-500">{selectedEmp.designation || 'No Designation'} · {selectedEmp.department || 'No Department'}</p>
                                </div>
                                <div className="pt-1 flex items-center gap-2">
                                    <span className="text-xs text-slate-600">Current Status:</span>
                                    {selectedEmp.is_line_inspector ? (
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
                                    {selectedEmp.is_line_inspector ? (
                                        <Button
                                            onClick={() => handleToggleInspector(selectedEmp.employee_id, 'removed')}
                                            disabled={processing}
                                            className="w-full bg-red-600 hover:bg-red-700 text-white flex items-center justify-center gap-1.5"
                                        >
                                            <UserX className="h-4 w-4" />
                                            {processing ? 'Revoking...' : 'Revoke Privileges'}
                                        </Button>
                                    ) : (
                                        <Button
                                            onClick={() => handleToggleInspector(selectedEmp.employee_id, 'assigned')}
                                            disabled={processing}
                                            className="w-full bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center gap-1.5"
                                        >
                                            <UserCheck className="h-4 w-4" />
                                            {processing ? 'Assigning...' : 'Assign as Line Inspector'}
                                        </Button>
                                    )}
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Active Line Inspectors list */}
                <Card className="lg:col-span-2">
                    <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                            <Users className="h-5 w-5 text-green-600" /> Active Line Inspectors ({activeInspectors.length})
                        </CardTitle>
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
                                        <TableHead className="text-right">Action</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {activeInspectors.length > 0 ? (
                                        activeInspectors.map(inspector => (
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
                                                        disabled={processing}
                                                        className="text-red-600 hover:bg-red-50 hover:text-red-700 h-8 px-2"
                                                    >
                                                        <UserX className="h-4 w-4" />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    ) : (
                                        <TableRow>
                                            <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
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
                    <CardTitle className="text-lg flex items-center gap-2">
                        <History className="h-5 w-5 text-indigo-600" /> Audit History Log
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto">
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
                                {history.length > 0 ? (
                                    history.map(record => (
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
                                                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
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
                                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
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
    )
}
