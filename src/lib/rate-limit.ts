import { LRUCache } from 'lru-cache'
import { NextResponse } from 'next/server'

interface RateLimiterOptions {
    limit: number
    windowMs: number
}

const tokenCache = new LRUCache<string, number>({
    max: 500, // Maximum number of users to track
    ttl: 60000, // Default TTL
})

export function rateLimit(request: Request, options: RateLimiterOptions) {
    const ip = request.headers.get('x-forwarded-for') ?? 
               request.headers.get('x-real-ip') ?? 
               '127.0.0.1'

    const tokenCount = tokenCache.get(ip) || 0

    if (tokenCount >= options.limit) {
        return {
            success: false,
            response: NextResponse.json(
                { error: 'Too many requests, please try again later.' },
                { status: 429 }
            )
        }
    }

    tokenCache.set(ip, tokenCount + 1, { ttl: options.windowMs })
    return { success: true }
}
