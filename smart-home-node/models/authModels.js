/**
 * Auth collection schemas and indexes.
 *
 * The backend uses the native MongoDB driver, so the "models" are documented
 * shapes plus the indexes that enforce them.
 *
 * users:
 *   name                string   display / login name
 *   email               string   login identifier, welcome + alert emails
 *   phone_number        string   normalized E.164-like (+9725...), unique
 *   password            string   bcrypt hash
 *   role                'parent' | 'child'
 *   familyId            string | null
 *   familyCode          string | null (parents only)
 *   is_phone_verified   boolean  default false, set true by /auth/verify-otp
 *   is_email_verified   boolean  default false
 *   createdAt/updatedAt Date
 *
 * otp_verifications:
 *   phone_number        string   normalized, one active OTP per phone
 *   otp_code            string   bcrypt hash of the 6-digit code
 *   attempts            number   failed verify attempts (max 5)
 *   expiresAt           Date     TTL index removes the doc automatically
 *   createdAt           Date     used for the resend cooldown
 */

export const USERS = 'users';
export const OTP_VERIFICATIONS = 'otp_verifications';

export const OTP_TTL_MINUTES = 10;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_RESEND_COOLDOWN_SECONDS = 60;

// Called once at startup so lookups stay fast and constraints are enforced
// by the database rather than application code.
export async function ensureAuthIndexes(db) {
    const users = db.collection(USERS);
    const otps = db.collection(OTP_VERIFICATIONS);

    // Sparse: legacy user documents without a phone number stay valid.
    await users.createIndex(
        { phone_number: 1 },
        { unique: true, sparse: true, name: 'phone_number_unique' },
    );
    await users.createIndex({ email: 1 }, { name: 'email_lookup' });

    await otps.createIndex({ phone_number: 1 }, { name: 'otp_phone_lookup' });

    // TTL: MongoDB deletes each OTP document once expiresAt passes.
    await otps.createIndex(
        { expiresAt: 1 },
        { expireAfterSeconds: 0, name: 'otp_ttl' },
    );
}
