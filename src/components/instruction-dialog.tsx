'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { InstructionAssurancePreview } from './instruction-assurance-preview'

interface InstructionDialogProps {
    instructionId: string | null
    open: boolean
    onOpenChange: (open: boolean) => void
    employeeId?: string // If provided, check/allow acknowledgement
    onAcknowledged?: () => void
}

export function InstructionDialog({ instructionId, open, onOpenChange, employeeId, onAcknowledged }: InstructionDialogProps) {
    const [instruction, setInstruction] = useState<any>(null)
    const [loading, setLoading] = useState(false)
    const [acknowledged, setAcknowledged] = useState(false)
    const [acking, setAcking] = useState(false)

    useEffect(() => {
        if (open && instructionId) {
            loadData()
        } else {
            setInstruction(null)
            setAcknowledged(false)
        }
    }, [open, instructionId, employeeId])

    async function loadData() {
        setLoading(true)
        const supabase = createClient()

        // Fetch instruction details, creator, and assigned designations
        const { data: inst } = await supabase
            .from('instructions')
            .select(`
                id, title, content, created_at,
                creator:employees(name, designation),
                assignments:instruction_designation_assignments(designation)
            `)
            .eq('id', instructionId)
            .single()

        setInstruction(inst)

        if (employeeId) {
            // Check if acknowledged
            const { data: ackData } = await supabase
                .from('instruction_acknowledgements')
                .select('id')
                .eq('instruction_id', instructionId)
                .eq('employee_id', employeeId)
                .single()

            setAcknowledged(!!ackData)
        }

        setLoading(false)
    }

    async function handleAcknowledge() {
        if (!employeeId || !instructionId) return
        setAcking(true)
        const supabase = createClient()

        await supabase
            .from('instruction_acknowledgements')
            .insert({
                instruction_id: instructionId,
                employee_id: employeeId,
                acknowledged_at: new Date().toISOString()
            })

        setAcknowledged(true)
        setAcking(false)
        if (onAcknowledged) onAcknowledged()
    }

    if (!instruction && !loading) return null

    const dateObj = instruction?.created_at ? new Date(instruction.created_at) : new Date()
    const dateStr = dateObj.toLocaleDateString('en-GB')
    const timeStr = dateObj.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
    const creatorName = instruction?.creator?.name ? `Mr/Ms. ${instruction.creator.name}` : 'Admin'
    const applicableFor = instruction?.assignments?.map((d: any) => d.designation).join(', ') || 'All'

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-3xl p-0 overflow-hidden">
                <DialogHeader className="p-3 bg-blue-600 text-white m-0">
                    <DialogTitle className="text-center text-lg font-bold tracking-wide">
                        Instruction Assurance
                    </DialogTitle>
                </DialogHeader>

                <div className="p-5 bg-white">
                    {loading ? (
                        <p className="text-center py-10 text-slate-500">Loading details...</p>
                    ) : (
                        <InstructionAssurancePreview
                            instruction={instruction}
                            acknowledged={acknowledged}
                            employeeId={employeeId}
                            onAcknowledge={handleAcknowledge}
                            loading={acking}
                        />
                    )}
                </div>
            </DialogContent>
        </Dialog>
    )
}
