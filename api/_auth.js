import crypto from 'node:crypto';

function matchesSecret(expected, supplied) {
  const a = Buffer.from(expected);
  const b = Buffer.from(supplied);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function suppliedKey(req) {
  const direct = String(req.headers['x-bandd-key'] || '');
  if (direct) return direct;
  const authorization = String(req.headers.authorization || '');
  return authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
}

export function requireKey(req, res) {
  const allowedKeys = [
    process.env.BANDD_SYNC_KEY,
    process.env.BANDD_GPT_KEY,
    process.env.BANDD_CLAUDE_KEY,
    process.env.BANDD_GROK_KEY,
  ].filter(Boolean);
  if (!allowedKeys.length) {
    res.status(503).json({ ok:false, error:'No B&D agent key is configured on Vercel.' });
    return false;
  }
  const got = suppliedKey(req);
  if (!got || !allowedKeys.some((expected) => matchesSecret(expected, got))) {
    res.status(401).json({ ok:false, error:'Unauthorized' });
    return false;
  }
  return true;
}

export function blobAuth() {
  if (process.env.BLOB_READ_WRITE_TOKEN) return { token: process.env.BLOB_READ_WRITE_TOKEN };
  if (process.env.VERCEL_OIDC_TOKEN) return { oidcToken: process.env.VERCEL_OIDC_TOKEN };
  return {};
}
