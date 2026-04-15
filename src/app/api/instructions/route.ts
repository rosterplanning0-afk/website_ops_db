import { NextResponse } from 'next/server'
import { z, ZodError } from 'zod'
import { limiter } from '@/lib/rate-limit'
import { createClient } from '@/utils/supabase/server'

const CreateInstructionPayload = z.object({
    title: z.string().min(3, 'Title must be at least 3 characters'),
    content: z.string().min(10, 'Content must be at least 10 characters'),
    priority: z.string().default('Normal'),
    valid_until: z.string().nullable().optional(),
    assigned_designations: z.array(z.string()).min(1, 'Assign to at least one designation'),
    is_active: z.boolean().default(true),
})

export async function GET(req: Request) {
    try {
        const ip = req.headers.get('x-forwarded-for') ?? '127.0.0.1'
        await limiter.check(60, ip)

        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const { data, error } = await supabase
            .from('instructions')
            .select('*, instruction_designation_assignments(designation)')
            .order('created_at', { ascending: false })

        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        return NextResponse.json({ data })
    } catch (error) {
        if (error === 'Rate limit exceeded') return NextResponse.json({ error: 'Too Many Requests' }, { status: 429 })
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}

export async function POST(req: Request) {
    try {
        const ip = req.headers.get('x-forwarded-for') ?? '127.0.0.1'
        await limiter.check(60, ip)

        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        // RBAC check — only admin/hod/manager can create instructions
        const { data: profile } = await supabase
            .from('users')
            .select('role, employee_id')
            .eq('id', user.id)
            .single()

        if (!profile || !['admin', 'hod', 'manager'].includes(profile.role)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        const body = await req.json()
        const parsed = CreateInstructionPayload.parse(body)

        // Note: created_by has a FK to employees table — only set it if the
        // employee_id actually exists in the employees table to avoid constraint errors.
        // We verify this first before including it.
        let createdBy: string | null = null
        if (profile.employee_id) {
            const { data: empCheck } = await supabase
                .from('employees')
                .select('employee_id')
                .eq('employee_id', profile.employee_id)
                .single()
            if (empCheck) createdBy = profile.employee_id
        }

        const insertData: Record<string, any> = {
            title: parsed.title,
            content: parsed.content,
            priority: parsed.priority,
            valid_until: parsed.valid_until || null,
            is_active: parsed.is_active,
            ...(createdBy ? { created_by: createdBy } : {}),
        }

        const { data: instruction, error: instError } = await supabase
            .from('instructions')
            .insert(insertData)
            .select()
            .single()

        if (instError) {
            console.error('[instructions insert error]', instError)
            return NextResponse.json({ error: instError.message }, { status: 500 })
        }

        // Insert designation assignments
        const assignments = parsed.assigned_designations.map(designation => ({
            instruction_id: instruction.id,
            designation,
        }))

        const { error: assignError } = await supabase
            .from('instruction_designation_assignments')
            .insert(assignments)

        if (assignError) {
            console.error('[designation assignments error]', assignError)
            return NextResponse.json({ error: assignError.message }, { status: 500 })
        }

        return NextResponse.json({ data: instruction }, { status: 201 })
    } catch (error) {
        if (error === 'Rate limit exceeded') return NextResponse.json({ error: 'Too Many Requests' }, { status: 429 })
        if (error instanceof ZodError) return NextResponse.json({ error: 'Invalid input', details: error.flatten().fieldErrors }, { status: 400 })
        console.error('[POST /api/instructions]', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
