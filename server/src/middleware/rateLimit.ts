import { Request, Response, NextFunction } from 'express';

interface RateLimitOptions {
    windowMs: number; // time window in milliseconds
    max: number;      // max requests per IP within the window
    message?: string;
}

// Minimal in-memory fixed-window rate limiter. Good enough for a single-instance
// server; swap for a Redis-backed limiter if the API is ever scaled horizontally.
export const rateLimit = ({ windowMs, max, message }: RateLimitOptions) => {
    const hits = new Map<string, { count: number; reset: number }>();

    return (req: Request, res: Response, next: NextFunction) => {
        const now = Date.now();
        const key = req.ip || req.socket.remoteAddress || 'unknown';

        // Opportunistic cleanup so the map doesn't grow unbounded.
        if (hits.size > 5000) {
            for (const [k, v] of hits) if (v.reset < now) hits.delete(k);
        }

        let entry = hits.get(key);
        if (!entry || entry.reset < now) {
            entry = { count: 0, reset: now + windowMs };
            hits.set(key, entry);
        }
        entry.count++;

        if (entry.count > max) {
            const retryAfter = Math.ceil((entry.reset - now) / 1000);
            res.setHeader('Retry-After', String(retryAfter));
            return res.status(429).json({ error: message || 'Too many requests. Please try again later.' });
        }
        next();
    };
};
