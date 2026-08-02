// mailer.js — sends verification emails via Resend (https://resend.com).
//
// Setup:
//   1. Create a free Resend account, verify a sending domain (or use their
//      shared onboarding domain for testing).
//   2. Set these env vars on the server: RESEND_API_KEY, EMAIL_FROM (e.g.
//      "IELTS Prep <onboarding@resend.dev>" for testing, or your own domain
//      once verified), and APP_URL (e.g. https://ieltspreps.vercel.app —
//      used to build the verification link).
//
// If RESEND_API_KEY isn't set, emails are just logged to the console instead
// of failing — so local dev / first deploy doesn't break signup.

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM || 'IELTS Prep <onboarding@resend.dev>';
const APP_URL = process.env.APP_URL || 'http://localhost:5173';

async function sendMail({ to, subject, html }) {
  if (!RESEND_API_KEY) {
    console.log(`[mailer] RESEND_API_KEY not set — would have sent to ${to}: ${subject}`);
    return { skipped: true };
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ from: EMAIL_FROM, to, subject, html })
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    console.error('[mailer] Resend error', res.status, body);
    throw new Error('Could not send email');
  }
  return res.json();
}

function sendVerificationEmail(user, token) {
  const link = `${APP_URL.replace(/\/$/, '')}/verify-email?token=${encodeURIComponent(token)}`;
  return sendMail({
    to: user.email,
    subject: 'Verify your IELTS Prep account',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h2>Welcome, ${user.name}!</h2>
        <p>Confirm your email address to activate your IELTS Prep account.</p>
        <p><a href="${link}" style="display:inline-block;background:#5651c9;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600">Verify email</a></p>
        <p style="color:#888;font-size:13px">Or paste this link into your browser: ${link}</p>
      </div>
    `
  });
}

module.exports = { sendMail, sendVerificationEmail };
