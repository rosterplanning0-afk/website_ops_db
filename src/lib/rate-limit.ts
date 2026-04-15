export function rateLimit(options: { interval: number; uniqueTokenPerInterval: number }) {
    const tokenCache = new Map<string, number[]>();

    return {
        check: (limit: number, token: string) =>
            new Promise<void>((resolve, reject) => {
                const tokenCount = tokenCache.get(token) || [0];
                if (tokenCount[0] === 0) {
                    tokenCache.set(token, tokenCount);
                }
                tokenCount[0] += 1;

                const currentUsage = tokenCount[0];
                const isRateLimited = currentUsage >= limit;

                // Cleanup interval
                setTimeout(() => {
                    tokenCount[0] -= 1;
                }, options.interval);

                if (isRateLimited) {
                    reject('Rate limit exceeded');
                } else {
                    resolve();
                }
            }),
    };
}

export const limiter = rateLimit({
    interval: 60000, // 60 seconds
    uniqueTokenPerInterval: 500, // Max 500 users per second
});
