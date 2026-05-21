'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { z } from 'zod'

const loginSchema = z.object({
    email: z.string().email('Please enter a valid email address'),
    password: z.string().min(1, 'Password is required'),
})

export async function login(formData: FormData) {
    const supabase = await createClient()

    const rawData = {
        email: formData.get('email') as string,
        password: formData.get('password') as string,
    }

    const validatedData = loginSchema.safeParse(rawData)

    if (!validatedData.success) {
        return { error: validatedData.error.issues[0]?.message || 'Invalid input data.' }
    }

    const { email, password } = validatedData.data

    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
    })

    if (error) {
        return { error: error.message }
    }

    if (data.user) {
        // Cache user info in an HTTP-only cookie for immediate middleware access
        const { data: profile } = await supabase
            .from('users')
            .select('role, employee_id')
            .eq('id', data.user.id)
            .single()

        if (profile) {
            let userRole = profile.role
            
            if (profile.employee_id) {
                const { data: empData } = await supabase
                    .from('employees')
                    .select('role')
                    .eq('employee_id', profile.employee_id)
                    .single()
                    
                if (empData?.role) {
                    userRole = empData.role
                }
            }

            // Using Next.js cookies to set an encrypted role token (simple encoding for now, session JWT is secure)
            const cookieStore = await import('next/headers').then(m => m.cookies())
            cookieStore.set('cached_role', userRole.toLowerCase(), {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax',
                maxAge: 60 * 60 * 24 * 7 // 1 week
            })
        }
    }

    revalidatePath('/', 'layout')
    redirect('/dashboard')
}
