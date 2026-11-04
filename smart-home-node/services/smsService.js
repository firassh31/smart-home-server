import crypto from 'crypto';

/**
 * SMS OTP delivery via the Twilio REST API (free trial tier).
 *
 * Setup: create a free trial account at twilio.com, get a trial phone number,
 * then set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER in
 * .env. Trial accounts can only text numbers verified in the Twilio console.
 *
 * Without credentials the OTP is printed to the server console instead, so
 * the whole flow is testable in development at zero cost.
 */

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER;

// Cryptographically secure 6-digit code (100000-999999, no modulo bias issue
// at this scale worth extra code).
export function generateOtp() {
    return String(crypto.randomInt(100000, 1000000));
}

export async function sendOtpSms(phoneNumber, otpCode) {
    const body = `Your MSHome verification code is ${otpCode}. It expires in 10 minutes.`;

    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
        console.log(`[sms dev mode] OTP for ${phoneNumber}: ${otpCode}`);
        return;
    }

    const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
    const auth = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64');

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            Authorization: `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
            To: phoneNumber,
            From: TWILIO_PHONE_NUMBER,
            Body: body,
        }),
    });

    if (!response.ok) {
        const detail = await response.json().catch(() => ({}));
        throw new Error(detail.message || `Twilio request failed (${response.status}).`);
    }
}
