import bcrypt from 'bcryptjs';

// Ice Vault — Cloudflare Worker
// Handles: Anthropic API proxy, Auth (signup/login/password reset), Collection sync via D1

const ALLOWED_ORIGINS = [
  'https://Ciiiv.github.io',
  'https://ciiiv.github.io',
  'http://localhost:3000',
  'http://localhost:8080',
  'http://127.0.0.1:3000',
];

const APP_URL = 'https://Ciiiv.github.io/icevault';

function getCORS(origin) {
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-api-key, anthropic-version, Authorization',
    'Vary': 'Origin',
  };
}

function json(data, status, cors) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: { 'Content-Type': 'application/json', ...(cors || {}) }
  });
}

function err(msg, status, cors) {
  return json({ error: msg }, status || 400, cors);
}

// bcrypt password hashing — much stronger than SHA-256
// Cost factor 12 = ~300ms per hash, making brute force impractical
async function hashPassword(password) {
  const salt = await bcrypt.genSalt(12);
  return bcrypt.hash(password, salt);
}

async function verifyPassword(password, hash) {
  // Normalize $2b$ to $2a$ for cross-implementation compatibility
  const normalizedHash = hash.replace(/^\$2b\$/, '$2a$');
  return bcrypt.compare(password, normalizedHash);
}

function generateToken(length) {
  const array = new Uint8Array(length || 32);
  crypto.getRandomValues(array);
  return Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function getUser(request, db) {
  const auth = request.headers.get('Authorization');
  if (!auth || !auth.startsWith('Bearer ')) return null;
  const token = auth.slice(7);
  const session = await db.prepare(
    'SELECT user_id, expires_at FROM sessions WHERE token = ?'
  ).bind(token).first();
  if (!session) return null;
  if (new Date(session.expires_at) < new Date()) return null;
  const user = await db.prepare(
    'SELECT id, email FROM users WHERE id = ?'
  ).bind(session.user_id).first();
  return user;
}

async function sendEmail(brevoKey, to, subject, html) {
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': brevoKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      sender: { name: 'Ice Vault', email: 'icevault@smtp-brevo.com' },
      to: [{ email: to }],
      subject,
      htmlContent: html,
    }),
  });
  return res.ok;
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const cors = getCORS(origin);

    // Block requests from unknown origins
    if (origin && !ALLOWED_ORIGINS.includes(origin)) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': 'null' }
      });
    }

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: cors });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    // ─── ANTHROPIC PROXY ───────────────────────────────────────────────
    if (path === '/' || path === '') {
      try {
        const body = await request.text();
        const apiKey = request.headers.get('x-api-key');
        if (!apiKey) return err('Missing x-api-key', 401, cors);
        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
          },
          body,
        });
        const data = await response.text();
        return new Response(data, {
          status: response.status,
          headers: { 'Content-Type': 'application/json', ...cors }
        });
      } catch (e) {
        return err(e.message, 500, cors);
      }
    }

    // ─── AUTH: SIGNUP ──────────────────────────────────────────────────
    if (path === '/auth/signup' && request.method === 'POST') {
      try {
        const { email, password } = await request.json();
        if (!email || !password) return err('Email and password required', 400, cors);
        if (password.length < 6) return err('Password must be at least 6 characters', 400, cors);

        // Basic email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) return err('Invalid email address', 400, cors);

        const existing = await env.DB.prepare(
          'SELECT id FROM users WHERE email = ?'
        ).bind(email.toLowerCase()).first();
        if (existing) return err('An account with this email already exists', 400, cors);

        // bcrypt hash — strong, slow, production-grade
        const hash = await hashPassword(password);
        const userId = generateToken(8);
        await env.DB.prepare(
          'INSERT INTO users (id, email, password_hash, created_at) VALUES (?, ?, ?, ?)'
        ).bind(userId, email.toLowerCase(), hash, new Date().toISOString()).run();

        const token = generateToken();
        const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
        await env.DB.prepare(
          'INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)'
        ).bind(token, userId, expires).run();

        await sendEmail(
          env.BREVO_API_KEY,
          email,
          'Welcome to Ice Vault!',
          `<div style="font-family:sans-serif;max-width:500px;margin:0 auto;">
            <h2 style="color:#4A9CC9;">🏒 Welcome to Ice Vault!</h2>
            <p>Your account has been created. Your hockey card collection is now saved to the cloud and syncs across any device.</p>
            <p style="color:#888;font-size:13px;">Your Anthropic and eBay API keys are stored locally on your device only — never saved to your account or our servers.</p>
            <a href="${APP_URL}" style="display:inline-block;background:#4A9CC9;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;margin-top:10px;">Open Ice Vault</a>
          </div>`
        );

        return json({ token, email: email.toLowerCase(), userId }, 200, cors);
      } catch (e) {
        return err(e.message, 500, cors);
      }
    }

    // ─── AUTH: LOGIN ───────────────────────────────────────────────────
    if (path === '/auth/login' && request.method === 'POST') {
      try {
        const { email, password } = await request.json();
        if (!email || !password) return err('Email and password required', 400, cors);

        const user = await env.DB.prepare(
          'SELECT id, email, password_hash FROM users WHERE email = ?'
        ).bind(email.toLowerCase()).first();

        // Always run bcrypt compare even if user not found to prevent timing attacks
        const dummyHash = '$2a$12$dummy.hash.to.prevent.timing.attacks.padding';
        const hashToCheck = user ? user.password_hash : dummyHash;
        const valid = await verifyPassword(password, hashToCheck);

        if (!user || !valid) return err('Invalid email or password', 401, cors);

        const token = generateToken();
        const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
        await env.DB.prepare(
          'INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)'
        ).bind(token, user.id, expires).run();

        return json({ token, email: user.email, userId: user.id }, 200, cors);
      } catch (e) {
        return err(e.message, 500, cors);
      }
    }

    // ─── AUTH: LOGOUT ──────────────────────────────────────────────────
    if (path === '/auth/logout' && request.method === 'POST') {
      const auth = request.headers.get('Authorization');
      if (auth && auth.startsWith('Bearer ')) {
        const token = auth.slice(7);
        await env.DB.prepare('DELETE FROM sessions WHERE token = ?').bind(token).run();
      }
      return json({ ok: true }, 200, cors);
    }

    // ─── AUTH: VERIFY ──────────────────────────────────────────────────
    if (path === '/auth/verify' && request.method === 'GET') {
      const user = await getUser(request, env.DB);
      if (!user) return err('Invalid or expired session', 401, cors);
      return json({ email: user.email, userId: user.id }, 200, cors);
    }

    // ─── AUTH: FORGOT PASSWORD ─────────────────────────────────────────
    if (path === '/auth/forgot' && request.method === 'POST') {
      try {
        const { email } = await request.json();
        if (!email) return err('Email required', 400, cors);

        const user = await env.DB.prepare(
          'SELECT id, email FROM users WHERE email = ?'
        ).bind(email.toLowerCase()).first();

        // Always return success to prevent email enumeration
        if (!user) return json({ ok: true }, 200, cors);

        await env.DB.prepare(
          'DELETE FROM password_resets WHERE user_id = ?'
        ).bind(user.id).run();

        const resetToken = generateToken();
        const expires = new Date(Date.now() + 60 * 60 * 1000).toISOString();
        await env.DB.prepare(
          'INSERT INTO password_resets (token, user_id, expires_at) VALUES (?, ?, ?)'
        ).bind(resetToken, user.id, expires).run();

        const resetUrl = `${APP_URL}?reset=${resetToken}`;
        await sendEmail(
          env.BREVO_API_KEY,
          user.email,
          'Reset your Ice Vault password',
          `<div style="font-family:sans-serif;max-width:500px;margin:0 auto;">
            <h2 style="color:#4A9CC9;">🏒 Password Reset</h2>
            <p>We received a request to reset your Ice Vault password.</p>
            <p>Click the button below to reset your password. This link expires in <strong>1 hour</strong>.</p>
            <a href="${resetUrl}" style="display:inline-block;background:#4A9CC9;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;margin-top:10px;">Reset Password</a>
            <p style="color:#888;font-size:12px;margin-top:20px;">If you didn't request this, you can safely ignore this email.</p>
            <p style="color:#888;font-size:12px;">Or copy this link: ${resetUrl}</p>
          </div>`
        );

        return json({ ok: true }, 200, cors);
      } catch (e) {
        return err(e.message, 500, cors);
      }
    }

    // ─── AUTH: RESET PASSWORD ──────────────────────────────────────────
    if (path === '/auth/reset' && request.method === 'POST') {
      try {
        const { token, password } = await request.json();
        if (!token || !password) return err('Token and password required', 400, cors);
        if (password.length < 6) return err('Password must be at least 6 characters', 400, cors);

        const reset = await env.DB.prepare(
          'SELECT user_id, expires_at FROM password_resets WHERE token = ?'
        ).bind(token).first();

        if (!reset) return err('Invalid or expired reset link', 401, cors);
        if (new Date(reset.expires_at) < new Date()) {
          await env.DB.prepare('DELETE FROM password_resets WHERE token = ?').bind(token).run();
          return err('Reset link has expired — please request a new one', 401, cors);
        }

        const hash = await hashPassword(password);
        await env.DB.prepare(
          'UPDATE users SET password_hash = ? WHERE id = ?'
        ).bind(hash, reset.user_id).run();

        await env.DB.prepare('DELETE FROM password_resets WHERE token = ?').bind(token).run();
        await env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(reset.user_id).run();

        return json({ ok: true }, 200, cors);
      } catch (e) {
        return err(e.message, 500, cors);
      }
    }

    // ─── COLLECTION: GET ───────────────────────────────────────────────
    if (path === '/collection' && request.method === 'GET') {
      const user = await getUser(request, env.DB);
      if (!user) return err('Unauthorized', 401, cors);
      const cards = await env.DB.prepare(
        'SELECT card_data FROM cards WHERE user_id = ? ORDER BY created_at DESC'
      ).bind(user.id).all();
      const collection = cards.results.map(r => JSON.parse(r.card_data));
      return json({ collection }, 200, cors);
    }

    // ─── COLLECTION: SAVE ──────────────────────────────────────────────
    if (path === '/collection' && request.method === 'PUT') {
      const user = await getUser(request, env.DB);
      if (!user) return err('Unauthorized', 401, cors);
      const { collection } = await request.json();
      if (!Array.isArray(collection)) return err('Invalid collection data', 400, cors);

      await env.DB.prepare('DELETE FROM cards WHERE user_id = ?').bind(user.id).run();
      for (const card of collection) {
        await env.DB.prepare(
          'INSERT INTO cards (id, user_id, card_data, created_at) VALUES (?, ?, ?, ?)'
        ).bind(card.id.toString(), user.id, JSON.stringify(card), card.addedAt || new Date().toISOString()).run();
      }
      return json({ ok: true, count: collection.length }, 200, cors);
    }

    // ─── COLLECTION: DELETE ONE ────────────────────────────────────────
    if (path.startsWith('/collection/') && request.method === 'DELETE') {
      const user = await getUser(request, env.DB);
      if (!user) return err('Unauthorized', 401, cors);
      const cardId = path.split('/')[2];
      await env.DB.prepare(
        'DELETE FROM cards WHERE id = ? AND user_id = ?'
      ).bind(cardId, user.id).run();
      return json({ ok: true }, 200, cors);
    }

    return err('Not found', 404, cors);
  }
};
