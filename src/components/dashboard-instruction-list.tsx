'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { FileText, CheckCircle } from 'lucide-react'
import { InstructionDialog } from './instruction-dialog'

interface InstructionListProps {
    userId: string
}

export function DashboardInstructionList({ userId }: InstructionListProps) {
    const [instructions, setInstructions] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [selectedId, setSelectedId] = useState<string | null>(null)

    useEffect(() => {
        if (userId) load()
    }, [userId])

    async function load() {
        setLoading(true)
        const supabase = createClient()

        // 1. Get user designation
        const { data: userProfile } = await supabase.from('users').select('employee_id').eq('id', userId).single()
        if (!userProfile?.employee_id) return

        const { data: empRecord } = await supabase.from('employees').select('designation').eq('employee_id', userProfile.employee_id).single()
        if (!empRecord?.designation) return

        const designation = empRecord.designation
        const empId = userProfile.employee_id

        // 2. Fetch assigned active instructions
        const { data: assigned } = await supabase
            .from('instruction_designation_assignments')
            .select(`
                instruction_id, 
                instructions!inner(id, title, priority, created_at, is_active)
            `)
            .eq('designation', designation)
            .eq('instructions.is_active', true)

        if (!assigned || assigned.length === 0) {
            setInstructions([])
            setLoading(false)
            return
        }

        const allAssigned = assigned.map((a: any) => a.instructions)
        allAssigned.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

        // 3. Get acknowledgements
        const { data: acks } = await supabase
            .from('instruction_acknowledgements')
            .select('instruction_id')
            .eq('employee_id', empId)

        const ackedIds = new Set(acks?.map(a => a.instruction_id) || [])

        const finalInstructions = allAssigned.map(inst => ({
            ...inst,
            acknowledged: ackedIds.has(inst.id),
            employee_id: empId
        }))

        setInstructions(finalInstructions)
        setLoading(false)
    }

    if (loading) return <p className="text-sm text-muted-foreground text-center py-4">Loading instructions...</p>
    if (instructions.length === 0) return <p className="text-sm text-muted-foreground text-center py-4">No instructions found for your designation.</p>

    return (
        <>
            <ul className="space-y-2">
                {instructions.map(inst => (
                    <li
                        key={inst.id}
                        onClick={() => setSelectedId(inst.id)}
                        className="flex items-start gap-3 p-3 bg-slate-50 hover:bg-blue-50 cursor-pointer rounded-md transition-colors border border-transparent hover:border-blue-100"
                    >
                        {inst.acknowledged ? (
                            <CheckCircle className="h-4 w-4 mt-0.5 text-green-500 shrink-0" />
                        ) : (
                            <FileText className="h-4 w-4 mt-0.5 text-red-500 shrink-0" />
                        )}

                        <div className="flex-1">
                            <p className="text-sm font-medium text-slate-800 group-hover:text-blue-700">{inst.title}</p>
                            <p className="text-xs text-slate-400 mt-0.5">
                                {inst.created_at ? new Date(inst.created_at).toLocaleDateString('en-IN') : ''}
                            </p>
                        </div>

                        <div className="flex flex-col items-end gap-1">
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${inst.priority === 'Urgent' ? 'bg-red-100 text-red-700' : inst.priority === 'High' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>
                                {inst.priority}
                            </span>
                            {inst.acknowledged && (
                                <span className="text-[10px] text-green-600 font-medium">Acknowledged</span>
                            )}
                        </div>
                    </li>
                ))}
            </ul>

            <InstructionDialog
                instructionId={selectedId}
                open={!!selectedId}
                onOpenChange={(op) => !op && setSelectedId(null)}
                employeeId={instructions[0]?.employee_id}
                onAcknowledged={() => load()}
            />
        </>
    )
}
