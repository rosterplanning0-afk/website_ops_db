import { createClient } from '@/utils/supabase/server'

export interface Instruction {
    id: string
    title: string
    description: string
    category: string
    assigned_roles: string[]
    created_by: string
    created_at: string
    is_active: boolean
}

export async function getInstructions() {
    const supabase = await createClient()
    return supabase.from('instructions').select('*').order('created_at', { ascending: false })
}

export async function getInstructionById(id: string) {
    const supabase = await createClient()
    return supabase.from('instructions').select('*').eq('id', id).single()
}

export async function createInstruction(data: Omit<Instruction, 'id' | 'created_at'>) {
    const supabase = await createClient()
    return supabase.from('instructions').insert(data).select().single()
}

export async function updateInstruction(id: string, data: Partial<Instruction>) {
    const supabase = await createClient()
    return supabase.from('instructions').update(data).eq('id', id).select().single()
}

export async function getPendingAcknowledgments(employeeId: string) {
    const supabase = await createClient()
    return supabase
        .from('instruction_acknowledgments')
        .select('*, instructions(*)')
        .eq('employee_id', employeeId)
        .eq('acknowledged', false)
}

export async function getAcknowledgmentHistory(employeeId: string) {
    const supabase = await createClient()
    return supabase
        .from('instruction_acknowledgments')
        .select('*, instructions(*)')
        .eq('employee_id', employeeId)
        .eq('acknowledged', true)
        .order('acknowledged_at', { ascending: false })
}

export async function acknowledgeInstruction(instructionId: string, employeeId: string) {
    const supabase = await createClient()
    return supabase
        .from('instruction_acknowledgments')
        .update({ acknowledged: true, acknowledged_at: new Date().toISOString() })
        .eq('instruction_id', instructionId)
        .eq('employee_id', employeeId)
}
