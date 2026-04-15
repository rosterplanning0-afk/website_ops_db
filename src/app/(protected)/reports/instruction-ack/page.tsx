'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { FileCheck, Download, Eye, Bell } from 'lucide-react'

interface InstructionOption {
    id: string
    title: string
}

interface AckRow {
    id: string
    instruction_id: string
    employee_id: string
    acknowledged_at: string | null
    instruction_title?: string
    emp_name?: string
    emp_designation?: string
}

export default function InstructionAckPage() {
    const [instructions, setInstructions] = useState<InstructionOption[]>([])
    const [acks, setAcks] = useState<AckRow[]>([])
    const [selectedInstruction, setSelectedInstruction] = useState('all')
    const [selectedStatus, setSelectedStatus] = useState('all')
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        async function load() {
            const supabase = createClient()
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            const { data: profile } = await supabase.from('users').select('role, employee_id').eq('id', user.id).single()
            let userRole = (profile?.role || 'employee') as string
            let userDept = ''

            if (profile?.employee_id) {
                const { data: empInfo } = await supabase.from('employees').select('role, department').eq('employee_id', profile.employee_id).single()
                if (empInfo) {
                    userRole = (empInfo.role?.toLowerCase() || userRole)
                    userDept = empInfo.department || ''
                }
            }

            // Fetch instructions
            const { data: instData } = await supabase
                .from('instructions')
                .select('id, title')
                .eq('is_active', true)
                .order('created_at', { ascending: false })

            setInstructions(instData || [])

            // 2. Fetch assignments (who needs to see what)
            const { data: assignments } = await supabase
                .from('instruction_designation_assignments')
                .select('instruction_id, designation')

            // 3. Fetch all active employees (filtered by department if manager/hod)
            let empQuery = supabase
                .from('employees')
                .select('employee_id, name, designation, department')
                .eq('status', 'Active')
            
            if ((userRole === 'manager' || userRole === 'hod') && userDept && userDept !== 'all') {
                empQuery = empQuery.eq('department', userDept)
            }
            const { data: activeEmployees } = await empQuery

            // 4. Fetch actual acknowledgements
            const { data: ackData } = await supabase
                .from('instruction_acknowledgements')
                .select('id, instruction_id, employee_id, acknowledged_at')

            // Build data maps
            const instMap = new Map((instData || []).map(i => [i.id, i.title]))
            const empMap = new Map((activeEmployees || []).map(e => [e.employee_id, e]))

            // Ensure we have employee details for those who acknowledged but might be inactive now
            const ackEmpIds = ackData?.map(a => a.employee_id).filter(Boolean) || []
            const missingEmpIds = ackEmpIds.filter(id => !empMap.has(id))
            if (missingEmpIds.length > 0) {
                const { data: missingEmps } = await supabase
                    .from('employees')
                    .select('employee_id, name, designation, department')
                    .in('employee_id', missingEmpIds)
                missingEmps?.forEach(e => empMap.set(e.employee_id, e))
            }

            const allRows: AckRow[] = []
            const actualAckSet = new Set()

            // A. Add all actual acknowledgements first
            if (ackData) {
                ackData.forEach(a => {
                    actualAckSet.add(`${a.instruction_id}_${a.employee_id}`)
                    allRows.push({
                        ...a,
                        instruction_title: instMap.get(a.instruction_id) || '—',
                        emp_name: empMap.get(a.employee_id)?.name || '—',
                        emp_designation: empMap.get(a.employee_id)?.designation || '—',
                    })
                })
            }

            // B. Compute pending users by matching active employees to instruction assignments
            if (instData && assignments && activeEmployees) {
                instData.forEach(inst => {
                    const targetDesigs = assignments.filter(a => a.instruction_id === inst.id).map(a => a.designation)
                    if (targetDesigs.length > 0) {
                        const targetEmps = activeEmployees.filter(e => targetDesigs.includes(e.designation))
                        targetEmps.forEach(emp => {
                            const ackKey = `${inst.id}_${emp.employee_id}`
                            if (!actualAckSet.has(ackKey)) {
                                allRows.push({
                                    id: `pending_${ackKey}`,
                                    instruction_id: inst.id,
                                    employee_id: emp.employee_id,
                                    acknowledged_at: null,
                                    instruction_title: inst.title,
                                    emp_name: emp.name,
                                    emp_designation: emp.designation
                                })
                            }
                        })
                    }
                })
            }

            // Sort: recently acknowledged first, then pending users alphabetically
            allRows.sort((a, b) => {
                if (a.acknowledged_at && b.acknowledged_at) {
                    return new Date(b.acknowledged_at).getTime() - new Date(a.acknowledged_at).getTime()
                }
                if (a.acknowledged_at) return -1
                if (b.acknowledged_at) return 1
                return (a.emp_name || '').localeCompare(b.emp_name || '')
            })

            setAcks(allRows)

            setLoading(false)
        }
        load()
    }, [])

    const filteredAcks = acks.filter(a => {
        const matchInstruction = selectedInstruction === 'all' || a.instruction_id === selectedInstruction
        const matchStatus = selectedStatus === 'all'
            || (selectedStatus === 'acknowledged' && a.acknowledged_at !== null)
            || (selectedStatus === 'pending' && a.acknowledged_at === null)
        return matchInstruction && matchStatus
    })

    if (loading) return <div className="p-8 text-center text-muted-foreground">Loading...</div>

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <h2 className="text-2xl font-bold text-slate-800">Instruction Acknowledgement Status</h2>
                <Button variant="outline" size="sm" onClick={() => window.print()} className="print:hidden"><Download className="h-4 w-4 mr-1" /> Export PDF</Button>
            </div>

            <Card>
                <CardContent className="pt-6">
                    {/* Filters */}
                    <div className="mb-6 grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl print:hidden">
                        <div>
                            <label className="text-sm font-medium text-slate-700 mb-2 block">Select Instruction</label>
                            <select
                                value={selectedInstruction}
                                onChange={e => setSelectedInstruction(e.target.value)}
                                className="w-full border border-input rounded-md p-2 text-sm bg-white"
                            >
                                <option value="all">All Instructions</option>
                                {instructions.map(inst => (
                                    <option key={inst.id} value={inst.id}>{inst.title}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="text-sm font-medium text-slate-700 mb-2 block">Status Filter</label>
                            <select
                                value={selectedStatus}
                                onChange={e => setSelectedStatus(e.target.value)}
                                className="w-full border border-input rounded-md p-2 text-sm bg-white"
                            >
                                <option value="all">All Statuses</option>
                                <option value="acknowledged">Acknowledged Only</option>
                                <option value="pending">Pending Only</option>
                            </select>
                        </div>
                    </div>

                    {/* Acknowledgment Table */}
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Employee ID</TableHead>
                                    <TableHead>Name</TableHead>
                                    <TableHead>Designation</TableHead>
                                    <TableHead>Instruction</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Ack Date</TableHead>
                                    <TableHead>Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredAcks.length > 0 ? (
                                    filteredAcks.map((ack) => (
                                        <TableRow key={ack.id}>
                                            <TableCell className="font-mono text-sm">{ack.employee_id}</TableCell>
                                            <TableCell className="font-medium">{ack.emp_name}</TableCell>
                                            <TableCell className="text-sm">{ack.emp_designation}</TableCell>
                                            <TableCell className="text-sm max-w-[200px] truncate">{ack.instruction_title}</TableCell>
                                            <TableCell>
                                                {ack.acknowledged_at ? (
                                                    <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-semibold rounded">Acknowledged</span>
                                                ) : (
                                                    <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-semibold rounded">Pending</span>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-xs text-slate-500">
                                                {ack.acknowledged_at ? new Date(ack.acknowledged_at).toLocaleString('en-IN') : '—'}
                                            </TableCell>
                                            <TableCell>
                                                {ack.acknowledged_at ? (
                                                    <Button variant="outline" size="sm"><Eye className="h-3 w-3 mr-1" /> View</Button>
                                                ) : (
                                                    <Button variant="outline" size="sm"><Bell className="h-3 w-3 mr-1" /> Remind</Button>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                                            No acknowledgment records found.
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
