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

    // Optional: fetch user info to set cookies if needed for middleware RBAC, 
    // but Supabase session naturally handles authentication state.

    revalidatePath('/', 'layout')
    redirect('/dashboard')
}
