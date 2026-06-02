import { NextResponse } from 'next/server';
import { z, ZodError } from 'zod';
import { rateLimit } from '@/lib/rate-limit';
import { createClient } from '@/utils/supabase/server';

// Example Zod Schema
const ExampleSchema = z.object({
    name: z.string().min(2),
    role: z.enum(['admin', 'executive', 'to', 'employee']),
});

export async function POST(req: Request) {
    try {
        // 1. IP Rate Limiting (Using x-forwarded-for or default)
        const rateLimitRes = rateLimit(req, { limit: 60, windowMs: 60000 });
        if (!rateLimitRes.success) return rateLimitRes.response;

        // 2. Authentication check
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // 3. Request parsing & Validation
        const body = await req.json();
        const parsedData = ExampleSchema.parse(body);

        // 4. Handle Logic securely...

        return NextResponse.json({ success: true, data: parsedData });

    } catch (error) {
        if (error instanceof ZodError) {
            return NextResponse.json({ error: 'Invalid input', details: error.flatten().fieldErrors }, { status: 400 });
        }
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
