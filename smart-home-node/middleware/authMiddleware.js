import jwt from 'jsonwebtoken';

const SECRET_KEY = process.env.JWT_SECRET;

// Verifies the Bearer token and exposes its claims on req.user.
export const verifyToken = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(403).json({ error: "Access Denied. Please log in." });

    try {
        const verified = jwt.verify(token, SECRET_KEY);
        req.user = verified;
        next();
    } catch (err) {
        res.status(401).json({ error: "Invalid or expired token." });
    }
};

// Restricts inventory-changing routes to parent accounts.
export const verifyParent = (req, res, next) => {
    if (!req.user || req.user.role !== 'parent') {
        return res.status(403).json({ error: "Access Denied. Parents only." });
    }
    next();
};
