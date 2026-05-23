import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
    let supabaseResponse = NextResponse.next({
        request,
    });

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll();
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value));
                    supabaseResponse = NextResponse.next({
                        request,
                    });
                    cookiesToSet.forEach(({ name, value, options }) =>
                        supabaseResponse.cookies.set(name, value, options)
                    );
                },
            },
        }
    );

    const {
        data: { user },
    } = await supabase.auth.getUser();

    const isAuthPage = request.nextUrl.pathname === '/';
    const isApi = request.nextUrl.pathname.startsWith('/api');

    // Extract cached role from cookie set at login
    const userRole = request.cookies.get('cached_role')?.value || 'employee';

    // Import RBAC checker dynamically or directly if it's available in edge
    // Edge middleware cannot use some Node.js modules, but rbac.ts only has strings and arrays.
    // Instead of importing, we can enforce some basic rules here or let the layout handle complex overrides.
    // We already optimized layout.tsx and API routes, so basic redirect for missing auth is enough,
    // but we can block known admin routes.
    
    if (!user && !isAuthPage && !isApi) {
        const url = request.nextUrl.clone();
        url.pathname = '/';
        return NextResponse.redirect(url);
    }

    if (user && isAuthPage) {
        const url = request.nextUrl.clone();
        url.pathname = '/dashboard';
        return NextResponse.redirect(url);
    }

    // Basic admin route edge protection
    if (user && request.nextUrl.pathname.startsWith('/admin')) {
        if (userRole !== 'admin') {
            const url = request.nextUrl.clone();
            url.pathname = '/dashboard';
            return NextResponse.redirect(url);
        }
    }

    // Fatigue management route protection (only admin and roster_planners allowed)
    if (user && request.nextUrl.pathname.startsWith('/roster-analytics/fatigue')) {
        if (userRole !== 'admin' && userRole !== 'roster_planners') {
            const url = request.nextUrl.clone();
            url.pathname = '/dashboard';
            return NextResponse.redirect(url);
        }
    }

    return supabaseResponse;
}
