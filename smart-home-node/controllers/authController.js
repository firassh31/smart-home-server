import { getDB } from '../config/db.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

const SECRET_KEY = process.env.JWT_SECRET || 'mshome_super_secret_key_2025';

// Registers parent accounts or links child accounts to an existing family code.
export const register = async (req, res) => {
    try {
        const db = getDB();
        const { name, email, password, role, familyCode } = req.body;

        const existingUser = await db.collection('users').findOne({ name });
        if (existingUser) return res.status(400).json({ error: "Username is already taken." });

        let familyId = null;
        let generatedFamilyCode = null;

        if (role === 'child') {
            const parentUser = await db.collection('users').findOne({ familyCode, role: 'parent' });
            if (!parentUser) return res.status(400).json({ error: "Invalid Family Code. Ask your parent for the 6-digit code." });
            familyId = parentUser._id.toString();
        } else {
            generatedFamilyCode = Math.random().toString(36).substring(2, 8).toUpperCase();
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = {
            name,
            email,
            password: hashedPassword,
            role: role === 'child' ? 'child' : 'parent',
            familyId,
            familyCode: generatedFamilyCode
        };
        const result = await db.collection('users').insertOne(newUser);

        // Parent users own a family, so their MongoDB id becomes the family id.
        if (role !== 'child') {
            familyId = result.insertedId.toString();
            await db.collection('users').updateOne({ _id: result.insertedId }, { $set: { familyId } });
        }

        const token = jwt.sign({ id: result.insertedId, role: newUser.role, familyId }, SECRET_KEY, { expiresIn: '24h' });
        res.status(201).json({ message: "Account created successfully!", token, role: newUser.role, familyCode: generatedFamilyCode });
    } catch (error) {
        res.status(500).json({ error: "Registration failed." });
    }
};

// Authenticates by username and returns the role/family claims used by the API.
export const login = async (req, res) => {
    try {
        const db = getDB();
        const { name, password } = req.body;

        const user = await db.collection('users').findOne({ name });
        if (!user) return res.status(401).json({ error: "Invalid username or password." });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(401).json({ error: "Invalid username or password." });

        const token = jwt.sign({ id: user._id, role: user.role, familyId: user.familyId }, SECRET_KEY, { expiresIn: '24h' });
        res.status(200).json({ message: "Login successful!", token, role: user.role, familyCode: user.familyCode });
    } catch (error) {
        res.status(500).json({ error: "Login failed." });
    }
};
