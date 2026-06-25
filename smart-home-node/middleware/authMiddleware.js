// smart-home-node/middleware/authMiddleware.js
import jwt from 'jsonwebtoken';

const SECRET_KEY = process.env.JWT_SECRET || 'mshome_super_secret_key_2025';

// 1. Checks if the user is logged in
export const verifyToken = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1]; // "Bearer <token>"
    if (!token) return res.status(403).json({ error: "Access Denied. Please log in." });

    try {
        const verified = jwt.verify(token, SECRET_KEY);
        req.user = verified; // This attaches { id, role } to the request!
        next();
    } catch (err) {
        res.status(401).json({ error: "Invalid or expired token." });
    }
};

// 2. Checks if the logged-in user is a Parent
export const verifyParent = (req, res, next) => {
    if (req.user.role !== 'parent') {
        return res.status(403).json({ error: "Access Denied. Parents only." });
    }
    next();
};