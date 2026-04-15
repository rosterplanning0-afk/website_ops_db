import { z } from 'zod';
import { createClient } from '@/utils/supabase/server';

// -----------------------------------------------------------------------------
// ZOD VALIDATORS
// -----------------------------------------------------------------------------

export const EmployeeSchema = z.object({
    employee_id: z.string(),
    name: z.string(),
    created_at: z.string().optional(), // timestamp
    designation: z.string().nullable().optional(),
    department: z.string().nullable().optional(),
    gender: z.string().nullable().optional(),
    status: z.string().nullable().optional(),
    date_joined: z.string().nullable().optional(), // date
    date_resigned: z.string().nullable().optional(),
    date_relived: z.string().nullable().optional(),
});
export type Employee = z.infer<typeof EmployeeSchema>;

export const FootplateInspectionSchema = z.object({
    id: z.number().optional(),
    employee_id: z.string(),
    inspection_date: z.string(), // date
    submitted_at: z.string().optional(),
    part_a_total: z.number().default(0),
    part_b_total: z.number().default(0),
    part_c_total: z.number().default(0),
    overall_total: z.number().default(0),
    status: z.string().default('Pending'),
    observations: z.string().nullable().optional(),
    defects_identified: z.string().nullable().optional(),
    corrective_actions: z.string().nullable().optional(),
    ip_address: z.string().nullable().optional(),
    device_info: z.string().nullable().optional(),
    inspected_by_user_id: z.string().uuid().nullable().optional(),
    inspected_by_name: z.string().nullable().optional(),
    inspected_by_role: z.string().nullable().optional(),
});
export type FootplateInspection = z.infer<typeof FootplateInspectionSchema>;

export const InspectionScoreSchema = z.object({
    id: z.number().optional(),
    inspection_id: z.number(),
    part: z.string().length(1),
    section: z.string().nullable().optional(),
    item_no: z.number(),
    item_text: z.string().nullable().optional(),
    max_marks: z.number().default(1),
    marks_awarded: z.number().default(0),
});
export type InspectionScore = z.infer<typeof InspectionScoreSchema>;

export const InstructionSchema = z.object({
    id: z.string().uuid().optional(),
    title: z.string().min(1, 'Title is required'),
    content: z.string().min(1, 'Content is required'),
    created_at: z.string().optional(),
    created_by: z.string().nullable().optional(),
    is_active: z.boolean().default(true),
    priority: z.string().default('Normal'),
    valid_until: z.string().nullable().optional(),
});
export type Instruction = z.infer<typeof InstructionSchema>;

export const InstructionAcknowledgementSchema = z.object({
    id: z.string().uuid().optional(),
    instruction_id: z.string().uuid(),
    employee_id: z.string(),
    acknowledged_at: z.string().optional(),
});
export type InstructionAcknowledgement = z.infer<typeof InstructionAcknowledgementSchema>;

export const InstructionDesignationAssignmentSchema = z.object({
    id: z.string().uuid().optional(),
    instruction_id: z.string().uuid(),
    designation: z.string(),
    assigned_at: z.string().optional(),
});
export type InstructionDesignationAssignment = z.infer<typeof InstructionDesignationAssignmentSchema>;

export const UserSchema = z.object({
    id: z.string().uuid(),
    employee_id: z.string().nullable().optional(),
    email: z.string().email(),
    full_name: z.string().nullable().optional(),
    role: z.string().default('manager'),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
});
export type User = z.infer<typeof UserSchema>;

// -----------------------------------------------------------------------------
// SUPABASE QUERY SERVICES
// -----------------------------------------------------------------------------

export async function getEmployees() {
    const supabase = await createClient();
    return supabase.from('employees').select('*').order('name');
}

export async function getEmployeeByEmployeeId(employeeId: string) {
    const supabase = await createClient();
    return supabase.from('employees').select('*').eq('employee_id', employeeId).single();
}

export async function getInspections() {
    const supabase = await createClient();
    return supabase.from('footplate_inspections').select('*, employees(*)').order('submitted_at', { ascending: false });
}

export async function createInspection(data: Omit<FootplateInspection, 'id' | 'submitted_at'>) {
    const supabase = await createClient();
    return supabase.from('footplate_inspections').insert(data).select().single();
}

export async function getInstructions() {
    const supabase = await createClient();
    return supabase.from('instructions').select('*').order('created_at', { ascending: false });
}

export async function createInstruction(data: Omit<Instruction, 'id' | 'created_at'>) {
    const supabase = await createClient();
    return supabase.from('instructions').insert(data).select().single();
}

export async function assignInstructionToDesignation(instructionId: string, designation: string) {
    const supabase = await createClient();
    return supabase.from('instruction_designation_assignments').insert({
        instruction_id: instructionId,
        designation,
    }).select().single();
}

export async function getPendingAcknowledgements(employeeId: string) {
    const supabase = await createClient();
    // Fetch assignments based on employee's designation
    const employeeResponse = await supabase.from('employees').select('designation').eq('employee_id', employeeId).single();
    if (!employeeResponse.data?.designation) return { data: [], error: null };
    const designation = employeeResponse.data.designation;

    return supabase.rpc('get_pending_instructions', { p_employee_id: employeeId, p_designation: designation });
}

export async function acknowledgeInstruction(instructionId: string, employeeId: string) {
    const supabase = await createClient();
    return supabase.from('instruction_acknowledgements').insert({
        instruction_id: instructionId,
        employee_id: employeeId,
    });
}
