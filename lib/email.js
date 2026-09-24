import { signUnsubscribeToken } from '@/lib/emailToken';

// reclipsed.netlify.app is a separate marketing page, deliberately left out of
// sync with the app (see REDESIGN_LOG.md) — never a safe fallback for links
// inside an email. Falling back to the same localhost default .env.example
// uses means a missing env var breaks obviously in dev instead of silently
// sending students to the wrong site in production.
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
const FROM = 'Reclipse <onboarding@resend.dev>';

// Shared by every server-side email sender (cron reminders, activity
// notifications) so user-supplied text (deck/course titles, etc.) always
// goes through the same escaping before landing in an HTML email body.
export function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

export async function sendEmail(userId, to, { subject, html }) {
  const unsubscribeUrl = `${SITE_URL}/api/unsubscribe?token=${signUnsubscribeToken(userId)}`;
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: FROM,
        to,
        subject,
        html: `
          ${html}
          <p style="color:#888;font-size:12px;margin-top:24px;">
            <a href="${unsubscribeUrl}" style="color:#888;">Unsubscribe from these emails</a>
          </p>
        `,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
