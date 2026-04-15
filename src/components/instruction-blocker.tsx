'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { AlertTriangle } from 'lucide-react'
import { InstructionAssurancePreview } from './instruction-assurance-preview'

interface PendingInstruction {
    id: string
    title: string
    content: string
    created_at: string
}

export function InstructionBlocker({ userId }: { userId: string }) {
    const [pending, setPending] = useState<PendingInstruction[]>([])
    const [currentIndex, setCurrentIndex] = useState(0)
    const [loading, setLoading] = useState(false)
    const [open, setOpen] = useState(false)

    useEffect(() => {
        fetchPending()
    }, [userId])

    async function fetchPending() {
        const supabase = createClient()

        // 1. Get employee_id and designation
        const { data: userProfile } = await supabase.from('users').select('employee_id').eq('id', userId).single()
        if (!userProfile?.employee_id) return

        const { data: empRecord } = await supabase.from('employees').select('designation').eq('employee_id', userProfile.employee_id).single()
        if (!empRecord?.designation) return

        const empId = userProfile.employee_id
        const designation = empRecord.designation

        // 2. Get all active instructions for this designation
        const { data: assigned } = await supabase
            .from('instruction_designation_assignments')
            .select(`
                instruction_id, 
                instructions!inner(
                    id, title, content, created_at, is_active, 
                    creator:employees(name, designation),
                    instruction_designation_assignments(designation)
                )
            `)
            .eq('designation', designation)
            .eq('instructions.is_active', true)

        if (!assigned || assigned.length === 0) return

        const allAssignedInstructions = assigned.map((a: any) => a.instructions)

        // 3. Get all existing acknowledgements for this employee
        const { data: acks } = await supabase
            .from('instruction_acknowledgements')
            .select('instruction_id')
            .eq('employee_id', empId)

        const ackedIds = new Set(acks?.map(a => a.instruction_id) || [])

        // 4. Find pending instructions (assigned but not in acks)
        const pendingInstructions = allAssignedInstructions.filter(inst => !ackedIds.has(inst.id))

        if (pendingInstructions.length > 0) {
            // Sort by oldest first so they acknowledge them in chronological order
            pendingInstructions.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
            setPending(pendingInstructions)
            setOpen(true)
        }
    }

    async function handleAcknowledge(instructionId: string) {
        setLoading(true)
        const supabase = createClient()

        // Need the employee_id again to insert
        const { data: userProfile } = await supabase.from('users').select('employee_id').eq('id', userId).single()
        const empId = userProfile?.employee_id

        if (empId) {
            await supabase
                .from('instruction_acknowledgements')
                .insert({
                    instruction_id: instructionId,
                    employee_id: empId,
                    acknowledged_at: new Date().toISOString()
                })
        }

        if (currentIndex < pending.length - 1) {
            setCurrentIndex((prev) => prev + 1)
        } else {
            setOpen(false)
            setPending([])
        }
        setLoading(false)
    }

    if (!open || pending.length === 0) return null

    const current: any = pending[currentIndex]

    // Format date and time
    const dateObj = current?.created_at ? new Date(current.created_at) : new Date()
    const dateStr = dateObj.toLocaleDateString('en-GB') // DD/MM/YYYY
    const timeStr = dateObj.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
    const creatorName = current?.creator?.name ? `Mr/Ms. ${current.creator.name}` : 'Admin'
    const applicableFor = current?.instruction_designation_assignments?.map((d: any) => d.designation).join(', ') || 'All'

    return (
        <Dialog open={open} onOpenChange={() => { }}>
            <DialogContent className="sm:max-w-3xl [&>button]:hidden p-0 overflow-hidden" onPointerDownOutside={(e) => e.preventDefault()}>
                <DialogHeader className="p-3 bg-blue-600 text-white m-0">
                    <DialogTitle className="text-center text-lg font-bold tracking-wide">Instruction Assurance</DialogTitle>
                </DialogHeader>

                <div className="p-5 bg-white">
                    <InstructionAssurancePreview
                        instruction={current}
                        currentIndex={currentIndex}
                        totalPending={pending.length}
                        acknowledged={false}
                        employeeId={userId}
                        onAcknowledge={() => handleAcknowledge(current?.id)}
                        loading={loading}
                    />
                </div>
            </DialogContent>
        </Dialog>
    )
}
