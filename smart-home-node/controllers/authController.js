import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { getDB } from '../config/db.js';
import { sendWelcomeEmail } from '../services/emailService.js';
import { normalizePhone } from '../utils/phone.js';

// Fail fast: a missing secret must never silently fall back to a known value.
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    throw new Error('JWT_SECRET is not set. Define it in .env (or the host environment) before starting the server.');
}
const BCRYPT_HASH_PATTERN = /^\$2[aby]\$\d{2}\$/;

function normalizeUsername(value) {
    return typeof value === 'string' ? value.trim() : '';
}

function usernameLookup(username) {
    const escapedUsername = username.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const expression = new RegExp(`^\\s*${escapedUsername}\\s*$`, 'i');

    // Support records created by older clients that stored `username` instead
    // of `name`, including case and surrounding whitespace differences.
    return {
        $or: [
            { name: expression },
            { username: expression },
        ],
    };
}

async function verifyAndUpgradePassword(db, user, submittedPassword) {
    const passwordField = ['password', 'passwordHash', 'hashedPassword']
        .find((field) => typeof user[field] === 'string');

    if (!passwordField) return false;

    const storedPassword = user[passwordField];
    const isBcryptHash = BCRYPT_HASH_PATTERN.test(storedPassword);

    if (isBcryptHash) {
        try {
            return await bcrypt.compare(submittedPassword, storedPassword);
        } catch {
            return false;
        }
    }

    // Some legacy records contain the original password. Verify it once and
    // replace it with bcrypt so future logins never need a plain-text value.
    if (storedPassword !== submittedPassword) return false;

    const upgradedHash = await bcrypt.hash(submittedPassword, 12);
    const result = await db.collection('users').updateOne(
        { _id: user._id, [passwordField]: storedPassword },
        { $set: { password: upgradedHash }, $unset: { [passwordField]: '' } },
    );

    return result.matchedCount === 1;
}

// Creates parent accounts or links child accounts to an existing family code.
export const register = async (req, res) => {
    try {
        const db = getDB();
        const name = normalizeUsername(req.body?.name);
        const email = typeof req.body?.email === 'string' ? req.body.email.trim() : '';
        const phone = normalizePhone(req.body?.phone_number);
        const password = typeof req.body?.password === 'string' ? req.body.password : '';
        const role = req.body?.role === 'child' ? 'child' : 'parent';
        const familyCode = typeof req.body?.familyCode === 'string'
            ? req.body.familyCode.trim().toUpperCase()
            : '';

        if (!name || !email || password.length < 6) {
            return res.status(400).json({ error: 'Enter a username, valid email, and password with at least 6 characters.' });
        }
        if (!phone) {
            return res.status(400).json({ error: 'Enter a valid phone number (e.g. +972501234567).' });
        }

        const users = db.collection('users');
        const existingUser = await users.findOne(usernameLookup(name));
        if (existingUser) return res.status(409).json({ error: 'Username is already taken.' });

        const existingPhone = await users.findOne({ phone_number: phone });
        if (existingPhone) return res.status(409).json({ error: 'This phone number is already registered.' });

        let familyId = null;
        let generatedFamilyCode = null;

        if (role === 'child') {
            const parentUser = await users.findOne({ familyCode, role: 'parent' });
            if (!parentUser) {
                return res.status(400).json({ error: 'Invalid Family Code. Ask your parent for the invite code.' });
            }
            familyId = parentUser.familyId || parentUser._id.toString();
        } else {
            generatedFamilyCode = Math.random().toString(36).substring(2, 8).toUpperCase();
        }

        const now = new Date();
        const newUser = {
            name,
            email,
            phone_number: phone,
            password: await bcrypt.hash(password, 12),
            role,
            familyId,
            familyCode: generatedFamilyCode,
            is_phone_verified: false,
            createdAt: now,
            updatedAt: now,
        };
        const result = await users.insertOne(newUser);

        if (role === 'parent') {
            familyId = result.insertedId.toString();
            await users.updateOne({ _id: result.insertedId }, { $set: { familyId } });
        }

        const token = jwt.sign(
            { id: result.insertedId, role: newUser.role, familyId },
            JWT_SECRET,
            { expiresIn: '24h' },
        );

        // Async notification; a slow or failing mailer never blocks signup.
        sendWelcomeEmail(email, name);

        return res.status(201).json({
            message: 'Account created successfully!',
            token,
            role: newUser.role,
            familyCode: generatedFamilyCode,
            phone_number: phone,
            isPhoneVerified: false,
        });
    } catch (error) {
        console.error('Registration failed:', error.message);
        return res.status(500).json({ error: 'Registration failed.' });
    }
};

// Builds a query matching the identifier as a username, email, or phone.
function identifierLookup(identifier) {
    const conditions = [...usernameLookup(identifier).$or];

    if (identifier.includes('@')) {
        const escaped = identifier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        conditions.push({ email: new RegExp(`^${escaped}$`, 'i') });
    }

    const phone = normalizePhone(identifier);
    if (phone) conditions.push({ phone_number: phone });

    return { $or: conditions };
}

// Authenticates legacy and current user records and returns API JWT claims.
// Accepts a username, email, or phone number as the login identifier.
export const login = async (req, res) => {
    try {
        const db = getDB();
        const identifier = normalizeUsername(req.body?.identifier ?? req.body?.name);
        const password = typeof req.body?.password === 'string' ? req.body.password : '';

        if (!identifier || !password) {
            return res.status(400).json({ error: 'Enter your username, email, or phone and your password.' });
        }

        const user = await db.collection('users').findOne(identifierLookup(identifier));
        if (!user || !(await verifyAndUpgradePassword(db, user, password))) {
            return res.status(401).json({ error: 'Invalid credentials.' });
        }

        const role = user.role === 'child' ? 'child' : 'parent';
        const familyId = user.familyId || (role === 'parent' ? user._id.toString() : null);
        const token = jwt.sign(
            { id: user._id, role, familyId },
            JWT_SECRET,
            { expiresIn: '24h' },
        );

        return res.status(200).json({
            message: 'Login successful!',
            token,
            role,
            familyCode: user.familyCode || null,
            phone_number: user.phone_number || null,
            isPhoneVerified: user.is_phone_verified === true,
        });
    } catch (error) {
        console.error('Login failed:', error.message);
        return res.status(500).json({ error: 'Login failed.' });
    }
};
