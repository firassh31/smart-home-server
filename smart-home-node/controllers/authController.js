import { getDB } from '../config/db.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

const SECRET_KEY = process.env.JWT_SECRET || 'mshome_super_secret_key_2025';

export const register = async (req, res) => {
    try {
        const db = getDB();
        const { name, email, password, role, parentName } = req.body;

        const existingUser = await db.collection('users').findOne({ name });
        if (existingUser) return res.status(400).json({ error: "Username is already taken." });

        let familyId = null;

        // 1. LINK THE CHILD TO THE PARENT
        if (role === 'child') {
            const parentUser = await db.collection('users').findOne({ name: parentName, role: 'parent' });
            if (!parentUser) return res.status(400).json({ error: "Parent username not found. Ask your parent for their exact username." });
            familyId = parentUser._id.toString();
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = {
            name, email, password: hashedPassword,
            role: role === 'child' ? 'child' : 'parent',
            familyId: familyId // Null for parents initially
        };
        const result = await db.collection('users').insertOne(newUser);

        // 2. PARENTS BECOME THEIR OWN FAMILY ID
        if (role !== 'child') {
            familyId = result.insertedId.toString();
            await db.collection('users').updateOne({ _id: result.insertedId }, { $set: { familyId } });
        } else {
            await db.collection('users').updateOne({ _id: result.insertedId }, { $set: { familyId } });
        }

        // 3. PACK THE FAMILY ID INTO THE TOKEN
        const token = jwt.sign({ id: result.insertedId, role: newUser.role, familyId }, SECRET_KEY, { expiresIn: '24h' });

        res.status(201).json({ message: "Account created successfully!", token, role: newUser.role });
    } catch (error) {
        console.error("🔥 REGISTRATION CRASH LOG:", error);
        res.status(500).json({ error: "Registration failed." });
    }
};

export const login = async (req, res) => {
    try {
        const db = getDB();
        const { name, password } = req.body;

        const user = await db.collection('users').findOne({ name });
        if (!user) return res.status(401).json({ error: "Invalid username or password." });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(401).json({ error: "Invalid username or password." });

        // Include the user's familyId in the digital ID card!
        const token = jwt.sign({ id: user._id, role: user.role, familyId: user.familyId }, SECRET_KEY, { expiresIn: '24h' });

        res.status(200).json({ message: "Login successful!", token, role: user.role });
    } catch (error) {
        console.error("🔥 LOGIN CRASH LOG:", error);
        res.status(500).json({ error: "Login failed." });
    }
};