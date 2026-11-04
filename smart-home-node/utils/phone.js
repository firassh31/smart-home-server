// Shared phone-number normalization so every collection stores one format.

// Strips spaces, dashes, and parentheses, and converts a leading 00 to +.
// Returns '' when the result is not a plausible international number.
export function normalizePhone(value) {
    if (typeof value !== 'string') return '';

    let phone = value.replace(/[\s\-().]/g, '');
    if (phone.startsWith('00')) phone = `+${phone.slice(2)}`;

    return /^\+?[0-9]{7,15}$/.test(phone) ? phone : '';
}
