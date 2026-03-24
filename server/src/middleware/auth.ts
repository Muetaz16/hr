import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthRequest extends Request {
    user?: any;
}

export const authenticateToken = (req: AuthRequest, res: Response, next: NextFunction) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        console.warn(`[AUTH DEBUG] No token provided for ${req.method} ${req.url}`);
        return res.status(401).json({ error: 'Access token required' });
    }

    jwt.verify(token, process.env.JWT_SECRET as string, (err: any, user: any) => {
        if (err) {
            console.error(`[AUTH][ERROR] JWT Verification Failed for ${req.method} ${req.url}`);
            console.error(`  - Reason: ${err.message}`);
            console.error(`  - Secret used: ${process.env.JWT_SECRET?.substring(0, 3)}...`);
            console.error(`  - Token Prefix: ${token.substring(0, 10)}...`);
            console.error(`  - Action: Sending 401 Unauthorized`);
            return res.status(401).json({ error: 'Invalid or expired token', detailed: err.message });
        }
        console.log(`[AUTH][OK] User: ${user.fullName} (${user.role}) -> ${req.url}`);
        req.user = user;
        next();
    });
};
export const authorizeRoles = (...allowedRoles: string[]) => {
    return (req: AuthRequest, res: Response, next: NextFunction) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Not authenticated' });
        }

        if (!allowedRoles.includes(req.user.role)) {
            console.warn(`[AUTH][DENIED] User ${req.user.fullName} (${req.user.role}) is NOT in [${allowedRoles}]. Sending 403.`);
            return res.status(403).json({ error: 'Forbidden: Insufficient permissions' });
        }

        next();
    };
};
