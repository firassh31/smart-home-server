import express from 'express';
import { register, login } from '../controllers/authController.js';
import { sendOtp, verifyOtp } from '../controllers/otpController.js';

const router = express.Router();

// Public authentication routes.
router.post('/register', register);
router.post('/login', login);

// Phone verification via SMS OTP.
router.post('/send-otp', sendOtp);
router.post('/verify-otp', verifyOtp);

export default router;
