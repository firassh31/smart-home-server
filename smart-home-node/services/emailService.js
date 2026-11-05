import nodemailer from 'nodemailer';

/**
 * Email notifications via Gmail SMTP (free).
 *
 * Setup: enable 2-Step Verification on the Gmail account, create an App
 * Password (Google Account -> Security -> App passwords), then set
 * GMAIL_USER and GMAIL_APP_PASSWORD in .env. Without credentials the service
 * logs the email to the console so development keeps working.
 *
 * Every send is fire-and-forget: a failed email never fails the API request.
 */

const GMAIL_USER = process.env.GMAIL_USER;
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD;

const transporter = GMAIL_USER && GMAIL_APP_PASSWORD
    ? nodemailer.createTransport({
        service: 'gmail',
        auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD },
    })
    : null;

async function sendEmail({ to, subject, html }) {
    if (!to) return;

    if (!transporter) {
        console.log(`[email dev mode] To: ${to} | Subject: ${subject}`);
        return;
    }

    try {
        await transporter.sendMail({
            from: `"MSHome" <${GMAIL_USER}>`,
            to,
            subject,
            html,
        });
    } catch (error) {
        console.error(`Failed to send "${subject}" email to ${to}:`, error.message);
    }
}

const wrap = (title, body) => `
    <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; border: 1px solid #eee; border-radius: 12px; overflow: hidden;">
        <div style="background: #34400A; color: #ffffff; padding: 18px 24px;">
            <h2 style="margin: 0;">MSHome</h2>
        </div>
        <div style="padding: 24px; color: #121212;">
            <h3 style="margin-top: 0;">${title}</h3>
            ${body}
        </div>
    </div>`;

// Fired after a successful registration. Intentionally not awaited by callers.
export function sendWelcomeEmail(to, name) {
    sendEmail({
        to,
        subject: 'Welcome to MSHome!',
        html: wrap(`Welcome, ${name}!`, `
            <p>Your MSHome account was created successfully.</p>
            <p>You can now manage your smart home devices from the mobile app or the web dashboard.</p>`),
    });
}
