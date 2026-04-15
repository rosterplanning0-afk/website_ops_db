import { NextResponse } from 'next/server';
import { z, ZodError } from 'zod';
import { limiter } from '@/lib/rate-limit';
import { createClient } from '@/utils/supabase/server';

// Example Zod Schema
const ExampleSchema = z.object({
    name: z.string().min(2),
    role: z.enum(['admin', 'executive', 'to', 'employee']),
});

export async function POST(req: Request) {
    try {
        // 1. IP Rate Limiting (Using x-forwarded-for or default)
        const ip = req.headers.get('x-forwarded-for') ?? '127.0.0.1';
        await limiter.check(60, ip); // 60 requests per minute

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
        if (error === 'Rate limit exceeded') {
            return NextResponse.json({ error: 'Too Many Requests' }, { status: 429 });
        }
        if (error instanceof ZodError) {
            return NextResponse.json({ error: 'Invalid input', details: error.flatten().fieldErrors }, { status: 400 });
        }
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
