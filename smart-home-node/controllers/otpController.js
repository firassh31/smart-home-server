import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { getDB } from '../config/db.js';
import {
    OTP_MAX_ATTEMPTS,
    OTP_RESEND_COOLDOWN_SECONDS,
    OTP_TTL_MINUTES,
    OTP_VERIFICATIONS,
    USERS,
} from '../models/authModels.js';
import { generateOtp, sendOtpSms } from '../services/smsService.js';
import { normalizePhone } from '../utils/phone.js';

const JWT_SECRET = process.env.JWT_SECRET || 'mshome_super_secret_key_2025';

// POST /auth/send-otp { phone_number }
// Generates a hashed 6-digit OTP, stores it with a TTL, and texts the phone.
export const sendOtp = async (req, res) => {
    try {
        const db = getDB();
        const phone = normalizePhone(req.body?.phone_number);
        if (!phone) {
            return res.status(400).json({ error: 'Enter a valid phone number.' });
        }

        const user = await db.collection(USERS).findOne({ phone_number: phone });
        if (!user) {
            return res.status(404).json({ error: 'No account found with this phone number.' });
        }

        const otps = db.collection(OTP_VERIFICATIONS);

        // Resend cooldown prevents SMS spam against the free-tier quota.
        const existing = await otps.findOne({ phone_number: phone });
        if (existing?.createdAt) {
            const ageSeconds = (Date.now() - existing.createdAt.getTime()) / 1000;
            if (ageSeconds < OTP_RESEND_COOLDOWN_SECONDS) {
                const wait = Math.ceil(OTP_RESEND_COOLDOWN_SECONDS - ageSeconds);
                return res.status(429).json({ error: `Please wait ${wait}s before requesting a new code.` });
            }
        }

        const otpCode = generateOtp();
        await otps.replaceOne(
            { phone_number: phone },
            {
                phone_number: phone,
                otp_code: await bcrypt.hash(otpCode, 10),
                attempts: 0,
                expiresAt: new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000),
                createdAt: new Date(),
            },
            { upsert: true },
        );

        await sendOtpSms(phone, otpCode);

        return res.status(200).json({ message: 'Verification code sent via SMS.' });
    } catch (error) {
        console.error('Sending OTP failed:', error.message);
        return res.status(500).json({ error: 'Could not send the verification code. Try again.' });
    }
};

// POST /auth/verify-otp { phone_number, otp }
// Checks the code, marks the phone verified, and returns a fresh JWT session.
export const verifyOtp = async (req, res) => {
    try {
        const db = getDB();
        const phone = normalizePhone(req.body?.phone_number);
        const otp = typeof req.body?.otp === 'string' ? req.body.otp.trim() : '';

        if (!phone || !/^\d{6}$/.test(otp)) {
            return res.status(400).json({ error: 'Enter your phone number and the 6-digit code.' });
        }

        const otps = db.collection(OTP_VERIFICATIONS);
        const record = await otps.findOne({ phone_number: phone });

        if (!record || record.expiresAt < new Date()) {
            return res.status(400).json({ error: 'Code expired or not found. Request a new one.' });
        }

        if (record.attempts >= OTP_MAX_ATTEMPTS) {
            await otps.deleteOne({ _id: record._id });
            return res.status(429).json({ error: 'Too many attempts. Request a new code.' });
        }

        if (!(await bcrypt.compare(otp, record.otp_code))) {
            await otps.updateOne({ _id: record._id }, { $inc: { attempts: 1 } });
            return res.status(400).json({ error: 'Incorrect code. Please try again.' });
        }

        await otps.deleteOne({ _id: record._id });

        const users = db.collection(USERS);
        const user = await users.findOne({ phone_number: phone });
        if (!user) {
            return res.status(404).json({ error: 'No account found with this phone number.' });
        }

        await users.updateOne(
            { _id: user._id },
            { $set: { is_phone_verified: true, updatedAt: new Date() } },
        );

        const role = user.role === 'child' ? 'child' : 'parent';
        const familyId = user.familyId || (role === 'parent' ? user._id.toString() : null);
        const token = jwt.sign({ id: user._id, role, familyId }, JWT_SECRET, { expiresIn: '24h' });

        return res.status(200).json({
            message: 'Phone number verified successfully!',
            token,
            role,
            familyCode: user.familyCode || null,
            isPhoneVerified: true,
        });
    } catch (error) {
        console.error('Verifying OTP failed:', error.message);
        return res.status(500).json({ error: 'Verification failed. Try again.' });
    }
};
