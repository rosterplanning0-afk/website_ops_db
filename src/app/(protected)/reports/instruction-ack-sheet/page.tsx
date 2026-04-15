'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Button } from '@/components/ui/button'
import { Printer, ClipboardList, Eye, EyeOff } from 'lucide-react'
import { InstructionAssurancePreview } from '@/components/instruction-assurance-preview'

interface InstructionOption {
    id: string
    title: string
    created_at: string
}

interface EmployeeRow {
    employee_id: string
    name: string
    designation: string | null
    acknowledged_at?: string | null
}

export default function InstructionAckSheetPage() {
    const [instructions, setInstructions] = useState<InstructionOption[]>([])
    const [selectedId, setSelectedId] = useState('')

    // Details for the currently selected instruction
    const [fullInstruction, setFullInstruction] = useState<any>(null)
    const [employees, setEmployees] = useState<EmployeeRow[]>([])
    const [showPreview, setShowPreview] = useState(false)

    const [initialLoading, setInitialLoading] = useState(true)
    const [dataLoading, setDataLoading] = useState(false)

    useEffect(() => {
        async function loadInitial() {
            const supabase = createClient()
            const { data } = await supabase
                .from('instructions')
                .select('id, title, created_at')
                .eq('is_active', true)
                .order('created_at', { ascending: false })

            setInstructions(data || [])
            if (data?.[0]) setSelectedId(data[0].id)
            setInitialLoading(false)
        }
        loadInitial()
    }, [])

    useEffect(() => {
        if (!selectedId) return

        async function loadDetails() {
            setDataLoading(true)
            const supabase = createClient()

            // 1. Fetch full instruction details
            const { data: inst } = await supabase
                .from('instructions')
                .select(`
                    id, title, content, created_at,
                    creator:employees(name, designation),
                    assignments:instruction_designation_assignments(designation)
                `)
                .eq('id', selectedId)
                .single()

            setFullInstruction(inst)

            // 2. Determine applicable designations
            const designations = inst?.assignments?.map((a: any) => a.designation) || []

            // 3. Fetch employees with those designations
            let empsQuery = supabase.from('employees').select('employee_id, name, designation').eq('status', 'Active')
            if (designations.length > 0) {
                empsQuery = empsQuery.in('designation', designations)
            }
            const { data: emps } = await empsQuery.order('name')

            // 4. Fetch acknowledgements for this instruction
            const { data: acks } = await supabase
                .from('instruction_acknowledgements')
                .select('employee_id, acknowledged_at')
                .eq('instruction_id', selectedId)

            // 5. Merge
            const ackMap = new Map((acks || []).map(a => [a.employee_id, a.acknowledged_at]))
            const merged: EmployeeRow[] = (emps || []).map(e => ({
                ...e,
                acknowledged_at: ackMap.get(e.employee_id) || null
            }))

            // Sort merged so pending are on top, then by name
            merged.sort((a, b) => {
                if (a.acknowledged_at && !b.acknowledged_at) return 1
                if (!a.acknowledged_at && b.acknowledged_at) return -1
                return a.name.localeCompare(b.name)
            })

            setEmployees(merged)
            setDataLoading(false)
        }
        loadDetails()
    }, [selectedId])

    if (initialLoading) return <div className="p-8 text-center text-muted-foreground">Loading...</div>

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <h2 className="text-2xl font-bold text-slate-800">Generate Acknowledgement Sheet</h2>
                <Button onClick={() => window.print()} className="bg-red-600 hover:bg-red-700 print:hidden">
                    <Printer className="h-4 w-4 mr-1" /> Print Signature Sheet
                </Button>
            </div>

            {/* Instruction Selector */}
            <div className="max-w-md print:hidden space-y-2">
                <label className="text-sm font-medium text-slate-700 block">Select Instruction to View Report</label>
                <div className="flex gap-2">
                    <select
                        value={selectedId}
                        onChange={e => setSelectedId(e.target.value)}
                        className="flex-1 border border-input rounded-md p-2 text-sm bg-white"
                        disabled={dataLoading}
                    >
                        {instructions.map(inst => (
                            <option key={inst.id} value={inst.id}>{inst.title}</option>
                        ))}
                    </select>
                    <Button
                        variant="outline"
                        onClick={() => setShowPreview(!showPreview)}
                        disabled={dataLoading || !fullInstruction}
                        title="Toggle Instruction Preview"
                    >
                        {showPreview ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                </div>
            </div>

            {showPreview && fullInstruction && (
                <div className="border rounded-md shadow-sm overflow-hidden bg-white print:hidden">
                    <div className="bg-blue-600 text-white p-3 text-center font-bold tracking-wide">
                        Instruction Preview
                    </div>
                    <div className="p-4">
                        <InstructionAssurancePreview instruction={fullInstruction} />
                    </div>
                </div>
            )}

            {/* Printable/Viewable Report */}
            {dataLoading ? (
                <div className="bg-white border rounded-lg p-8 shadow-sm text-center text-slate-500">
                    Loading report data...
                </div>
            ) : (
                <div className="bg-white border rounded-lg p-8 shadow-sm">
                    <div className="text-center mb-8 pb-4 border-b-2 border-red-600">
                        <h2 className="text-xl font-bold text-slate-800 flex items-center justify-center gap-2">
                            <ClipboardList className="h-6 w-6 text-red-600" />
                            STAFF INSTRUCTION ACKNOWLEDGEMENT
                        </h2>
                        <p className="text-sm text-slate-500 mt-1">Please read the instruction carefully before signing below.</p>
                    </div>

                    <div className="flex flex-wrap justify-between text-sm font-medium text-slate-700 mb-6 gap-4">
                        <div><strong>Instruction:</strong> {fullInstruction?.title || '—'}</div>
                        <div><strong>Date Issued:</strong> {fullInstruction?.created_at ? new Date(fullInstruction.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</div>
                    </div>

                    <div className="flex justify-between items-center mb-4 print:hidden">
                        <h3 className="font-bold text-slate-700">Assigned Employees ({employees.length})</h3>
                        <div className="flex items-center gap-4 text-sm">
                            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500"></span> Acknowledged ({employees.filter(e => e.acknowledged_at).length})</span>
                            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500"></span> Pending ({employees.filter(e => !e.acknowledged_at).length})</span>
                        </div>
                    </div>

                    <table className="w-full border-collapse">
                        <thead>
                            <tr>
                                <th className="border border-slate-300 bg-slate-50 px-4 py-3 text-xs font-bold uppercase text-slate-600 w-12 text-center">S.No.</th>
                                <th className="border border-slate-300 bg-slate-50 px-4 py-3 text-xs font-bold uppercase text-slate-600 text-left">Employee ID</th>
                                <th className="border border-slate-300 bg-slate-50 px-4 py-3 text-xs font-bold uppercase text-slate-600 text-left">Employee Name</th>
                                <th className="border border-slate-300 bg-slate-50 px-4 py-3 text-xs font-bold uppercase text-slate-600 text-left">Designation</th>
                                <th className="border border-slate-300 bg-slate-50 px-4 py-3 text-xs font-bold uppercase text-slate-600 text-center">Status</th>
                                <th className="border border-slate-300 bg-slate-50 px-4 py-3 text-xs font-bold uppercase text-slate-600 text-center">Date of Ack</th>
                                <th className="border border-slate-300 bg-slate-50 px-4 py-3 text-xs font-bold uppercase text-slate-600 text-left hidden print:table-cell">Signature</th>
                            </tr>
                        </thead>
                        <tbody>
                            {employees.map((emp, i) => (
                                <tr key={emp.employee_id} className={emp.acknowledged_at ? "bg-slate-50/50" : ""}>
                                    <td className="border border-slate-300 px-4 py-3 text-center text-sm">{i + 1}</td>
                                    <td className="border border-slate-300 px-4 py-3 text-sm font-mono">{emp.employee_id}</td>
                                    <td className="border border-slate-300 px-4 py-3 text-sm font-medium">{emp.name}</td>
                                    <td className="border border-slate-300 px-4 py-3 text-sm">{emp.designation || '—'}</td>
                                    <td className="border border-slate-300 px-4 py-3 text-sm text-center">
                                        {emp.acknowledged_at ? (
                                            <span className="inline-block px-2 py-0.5 bg-green-100 text-green-700 text-xs font-bold rounded-md">Acknowledged</span>
                                        ) : (
                                            <span className="inline-block px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-bold rounded-md">Pending</span>
                                        )}
                                    </td>
                                    <td className="border border-slate-300 px-4 py-3 text-sm text-center font-mono">
                                        {emp.acknowledged_at ? new Date(emp.acknowledged_at).toLocaleDateString('en-GB') : '—'}
                                    </td>
                                    <td className="border border-slate-300 px-4 py-3 text-sm hidden print:table-cell"></td>
                                </tr>
                            ))}
                            {employees.length === 0 && (
                                <tr>
                                    <td colSpan={7} className="border border-slate-300 px-4 py-8 text-center text-sm text-muted-foreground">
                                        No active employees found with the assigning designation(s).
                                    </td>
                                </tr>
                            )}
                            {[...Array(employees.length > 0 ? 3 : 0)].map((_, i) => (
                                <tr key={`empty-${i}`} className="hidden print:table-row">
                                    <td className="border border-slate-300 px-4 py-3 text-center text-sm">{employees.length + i + 1}</td>
                                    <td className="border border-slate-300 px-4 py-3 text-sm"></td>
                                    <td className="border border-slate-300 px-4 py-3 text-sm"></td>
                                    <td className="border border-slate-300 px-4 py-3 text-sm"></td>
                                    <td className="border border-slate-300 px-4 py-3 text-sm text-center"></td>
                                    <td className="border border-slate-300 px-4 py-3 text-sm text-center">______________</td>
                                    <td className="border border-slate-300 px-4 py-3 text-sm"></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    )
}
