import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

export async function POST(req: Request) {
    try {
        const body = await req.json()
        const { employees } = body

        if (!employees || !Array.isArray(employees)) {
            return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
        }

        // Secure route: verify JWT and check for admin or roster_planners role
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
        const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
        const supabase = createClient(supabaseUrl, supabaseAnonKey, {
            global: {
                headers: {
                    Authorization: req.headers.get('Authorization') || '',
                },
            },
        })

        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { data: profile } = await supabase
            .from('users')
            .select('role')
            .eq('id', user.id)
            .single()

        if (!profile || !['admin', 'roster_planners'].includes(profile.role.toLowerCase())) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        // Use service role key to bypass RLS for bulk operations
        const supabaseAdmin = createClient(supabaseUrl, supabaseKey)
        
        const upsertData = employees.map(emp => ({
            employee_id: emp.employee_id?.toString()?.trim(),
            name: emp.name?.toString()?.trim(),
            designation: emp.designation?.toString()?.trim() || null,
            department: emp.department?.toString()?.trim() || null,
            gender: emp.gender?.toString()?.trim() || null,
            status: emp.status?.toString()?.trim() || 'Active',
            role: emp.role?.toString()?.trim() || 'employee',
            manager_id: emp.manager_id?.toString()?.trim() || null,
            geo_location_link: emp.geo_location_link?.toString()?.trim() || null,
            latitude: emp.latitude ? parseFloat(emp.latitude) : null,
            longitude: emp.longitude ? parseFloat(emp.longitude) : null,
            full_address: emp.full_address?.toString()?.trim() || null,
            date_joined: emp.date_joined ? new Date(emp.date_joined).toISOString() : null,
            date_resigned: emp.date_resigned ? new Date(emp.date_resigned).toISOString() : null,
            date_relived: emp.date_relived ? new Date(emp.date_relived).toISOString() : null,
        })).filter(emp => emp.employee_id) // Ensure employee_id exists

        if (upsertData.length === 0) {
            return NextResponse.json({ error: 'No valid employee data found' }, { status: 400 })
        }

        const { data, error } = await supabaseAdmin
            .from('employees')
            .upsert(upsertData, { onConflict: 'employee_id' })
            .select()

        if (error) {
            console.error('Error in bulk upsert:', error)
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        return NextResponse.json({ success: true, count: data.length })

    } catch (error: any) {
        console.error('Bulk API Error:', error)
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
    }
}
