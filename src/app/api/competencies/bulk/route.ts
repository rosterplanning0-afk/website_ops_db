import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'
import { rateLimit } from '@/lib/rate-limit'
import { DEPT_CREW_MAPPING } from '@/lib/rbac'

export async function POST(req: Request) {
    try {
        const rateLimitRes = rateLimit(req, { limit: 120, windowMs: 60000 })
        if (!rateLimitRes.success) return rateLimitRes.response

        const supabase = await createClient()
        
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { data: profile } = await supabase
            .from('users')
            .select('role')
            .eq('id', user.id)
            .single()

        if (!profile || !['admin', 'roster_planners', 'hod'].includes(profile.role.toLowerCase())) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }
        const { competencies } = await req.json()

        if (!competencies || !Array.isArray(competencies)) {
            return NextResponse.json({ error: 'Invalid data format' }, { status: 400 })
        }

        // 1. Get all employee IDs from database to validate existence
        const { data: existingEmps } = await supabase
            .from('employees')
            .select('employee_id')
        
        const existingEmpIds = new Set(existingEmps?.map(e => e.employee_id) || [])

        const validRecords: any[] = []
        const invalidRecords: any[] = []

        // 2. Validate records
        competencies.forEach((row, index) => {
            const empId = String(row.employee_id || '').trim()
            
            if (!empId) {
                invalidRecords.push({ row: index + 2, employee_id: 'MISSING', reason: 'Employee ID is required' })
                return
            }

            if (!existingEmpIds.has(empId)) {
                invalidRecords.push({ row: index + 2, employee_id: empId, reason: 'Employee ID not found in database' })
                return
            }

            if (!row.department || !row.designation || !row.valid_from) {
                invalidRecords.push({ row: index + 2, employee_id: empId, reason: 'Missing required fields (Department, Designation, or Valid From)' })
                return
            }

            const deptNormalized = String(row.department).trim()
            const desigNormalized = String(row.designation).trim()

            const matchedDeptKey = Object.keys(DEPT_CREW_MAPPING).find(
                key => key.toLowerCase() === deptNormalized.toLowerCase()
            )

            if (!matchedDeptKey) {
                const validDeptsList = Object.keys(DEPT_CREW_MAPPING).filter(k => k !== 'Station Control') // omit alias from main list
                invalidRecords.push({ 
                    row: index + 2, 
                    employee_id: empId, 
                    reason: `Invalid Department '${deptNormalized}'. Must be one of: ${validDeptsList.join(', ')}`
                })
                return
            }

            const validDesignations = DEPT_CREW_MAPPING[matchedDeptKey]
            const matchedDesignation = validDesignations.find(
                desig => desig.toLowerCase() === desigNormalized.toLowerCase()
            )

            if (!matchedDesignation) {
                invalidRecords.push({
                    row: index + 2,
                    employee_id: empId,
                    reason: `Invalid Designation '${desigNormalized}' for department '${matchedDeptKey}'. Must be one of: ${validDesignations.join(', ')}`
                })
                return
            }

            validRecords.push({
                employee_id: empId,
                department: matchedDeptKey, // use normalized/original-cased department name
                designation: matchedDesignation, // use normalized/original-cased designation name
                train_type: (matchedDesignation === 'Train Operators' || matchedDesignation === 'Train Attendants') ? row.train_type : null,
                valid_from: row.valid_from,
                valid_till: row.valid_till || null,
            })
        })

        // 3. Batch insert valid records
        let insertedCount = 0
        if (validRecords.length > 0) {
            // Use service role key to bypass RLS for bulk operations
            const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
            const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
            const { createClient: createSupabaseClient } = await import('@supabase/supabase-js')
            const supabaseAdmin = createSupabaseClient(supabaseUrl, supabaseKey)

            const { error: insertError } = await supabaseAdmin
                .from('employee_competencies')
                .insert(validRecords)
            
            if (insertError) {
                console.error('Batch insert error:', insertError)
                return NextResponse.json({ error: 'Failed to insert records: ' + insertError.message }, { status: 500 })
            }
            insertedCount = validRecords.length
        }

        return NextResponse.json({
            success: true,
            summary: {
                total: competencies.length,
                inserted: insertedCount,
                failed: invalidRecords.length
            },
            failed_records: invalidRecords
        })

    } catch (error: any) {
        console.error('Bulk competency error:', error)
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
    }
}
