import crypto from 'crypto';

// Lets an unsubscribe link in an email work without the student logging in
// first: the link carries a token proving it really was issued for that
// user, without needing a session. Never accepts a token we can't verify.
const SECRET = process.env.EMAIL_UNSUBSCRIBE_SECRET || '';

function sign(userId) {
  return crypto.createHmac('sha256', SECRET).update(userId).digest('base64url');
}

export function signUnsubscribeToken(userId) {
  return `${Buffer.from(userId, 'utf-8').toString('base64url')}.${sign(userId)}`;
}

export function verifyUnsubscribeToken(token) {
  if (!SECRET || !token || typeof token !== 'string') return null;
  const [encoded, sig] = token.split('.');
  if (!encoded || !sig) return null;

  let userId;
  try { userId = Buffer.from(encoded, 'base64url').toString('utf-8'); } catch { return null; }

  const expected = Buffer.from(sign(userId));
  const given = Buffer.from(sig);
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) return null;
  return userId;
}
