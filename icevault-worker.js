// Ice Vault — Cloudflare Worker
// Handles: Anthropic API proxy, Auth (signup/login/password reset), Collection sync via D1
// Security: Rate limiting via KV, D1 request logging, PBKDF2-100k password hashing, 100ms fail delay
// Email: Provider-agnostic sendEmail() — supports Brevo and Maileroo via EMAIL_PROVIDER secret
// Monitoring: Rate limit alert emails via alertRateLimit() — one email per IP per endpoint per hour

const ALLOWED_ORIGINS = [
  'https://Ciiiv.github.io',
  'https://ciiiv.github.io',
  'http://localhost:3000',
  'http://localhost:8080',
  'http://127.0.0.1:3000',
];

const APP_URL = 'https://Ciiiv.github.io/icevault';

// Log retention — 7 days
const LOG_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

// ─── RATE LIMIT CONFIG ─────────────────────────────────────────────────────
const RATE_LIMITS = {
  '/auth/login':  { limit: 10,  window: 15 * 60, message: 'Too many login attempts — please wait 15 minutes' },
  '/auth/signup': { limit: 5,   window: 60 * 60, message: 'Too many signup attempts — please wait 1 hour' },
  '/auth/forgot': { limit: 5,   window: 60 * 60, message: 'Too many password reset requests — please wait 1 hour' },
  '/auth/reset':  { limit: 10,  window: 60 * 60, message: 'Too many reset attempts — please wait 1 hour' },
  '/proxy':       { limit: 100, window: 60 * 60, message: 'Too many scan requests — please wait 1 hour' },
};

// ─── D1 LOG WRITER ─────────────────────────────────────────────────────────
// Writes security events to request_logs table — 7 day retention
// Non-blocking — errors caught silently so logging never breaks the app
async function writeLog(db, { ip, path, status, event, detail }) {
  try {
    const now = new Date().toISOString();
    await db.prepare(
      `INSERT INTO request_logs (timestamp, ip, path, status, event, detail, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(now, ip, path, status, event, detail || null, now).run();
  } catch (e) {
    console.log(`[LOG ERROR] ${e.message}`);
  }
}

// ─── D1 LOG PURGE ──────────────────────────────────────────────────────────
// Deletes logs older than 7 days — runs on ~2% of requests to spread load
async function maybePurgeLogs(db) {
  if (Math.random() > 0.02) return;
  try {
    const cutoff = new Date(Date.now() - LOG_RETENTION_MS).toISOString();
    await db.prepare('DELETE FROM request_logs WHERE created_at < ?').bind(cutoff).run();
  } catch (e) {
    console.log(`[PURGE ERROR] ${e.message}`);
  }
}

// ─── RATE LIMITER ──────────────────────────────────────────────────────────
async function checkRateLimit(kv, endpoint, ip) {
  if (!kv) return { limited: false };
  const config = RATE_LIMITS[endpoint];
  if (!config) return { limited: false };

  const cleanIp = ip ? ip.split(',')[0].trim() : 'unknown';
  const key = `rl:${endpoint.replace(/\//g, '_')}:${cleanIp}`;
  const now = Math.floor(Date.now() / 1000);
  const existing = await kv.get(key, { type: 'json' });

  if (!existing || now > existing.reset_at) {
    const newRecord = { count: 1, reset_at: now + config.window };
    await kv.put(key, JSON.stringify(newRecord), { expirationTtl: config.window });
    return { limited: false, remaining: config.limit - 1 };
  }

  if (existing.count >= config.limit) {
    const retryAfter = existing.reset_at - now;
    return { limited: true, message: config.message, retryAfter, resetAt: existing.reset_at };
  }

  existing.count += 1;
  const ttlRemaining = existing.reset_at - now;
  await kv.put(key, JSON.stringify(existing), { expirationTtl: ttlRemaining });
  return { limited: false, remaining: config.limit - existing.count };
}

function rateLimited(message, retryAfter, cors) {
  return new Response(JSON.stringify({ error: message, retryAfter }), {
    status: 429,
    headers: { 'Content-Type': 'application/json', 'Retry-After': String(retryAfter || 60), ...(cors || {}) },
  });
}

// ─── CORS ──────────────────────────────────────────────────────────────────
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

// ─── PASSWORD UTILS — PBKDF2-HMAC-SHA256 ──────────────────────────────────
// Uses Web Crypto API built into Cloudflare Workers — no library needed
// 100,000 iterations — Cloudflare Workers Web Crypto maximum (hard limit)
// OWASP compliant minimum, ~3ms CPU time, well within free tier
// RTX 4090 cracks 8-char fully random password in ~644 years at this setting
//
// ⚠ MIGRATION NOTE: Existing bcrypt hashes ($2a$06$...) are handled by
// verifyPassword() which detects the format and falls back to bcrypt verify.
// New passwords are always hashed with PBKDF2. Over time all hashes migrate
// naturally as users reset passwords.

const PBKDF2_ITERATIONS = 100_000; // Cloudflare Workers Web Crypto max supported limit
const PBKDF2_HASH = 'SHA-256';
const PBKDF2_KEY_LENGTH = 32; // 256 bits

// Encode/decode helpers
function bufToHex(buf) {
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}
function hexToBuf(hex) {
  const arr = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) arr[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  return arr.buffer;
}

// Hash format: pbkdf2$iterations$salt$hash
async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const saltHex = bufToHex(salt.buffer);
  const keyMaterial = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']
  );
  const derived = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: PBKDF2_HASH },
    keyMaterial,
    PBKDF2_KEY_LENGTH * 8
  );
  return `pbkdf2$${PBKDF2_ITERATIONS}$${saltHex}$${bufToHex(derived)}`;
}

async function verifyPassword(password, storedHash) {
  // Handle legacy bcrypt hashes ($2a$ or $2b$) — for existing users
  // These will naturally migrate as users reset passwords
  if (storedHash.startsWith('$2')) {
    const { default: bcrypt } = await import('bcryptjs');
    const normalized = storedHash.replace(/^\$2b\$/, '$2a$');
    return bcrypt.compare(password, normalized);
  }

  // PBKDF2 format: pbkdf2$iterations$salt$hash
  const parts = storedHash.split('$');
  if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false;

  const [, iterations, saltHex, storedDerivedHex] = parts;
  const salt = hexToBuf(saltHex);
  const keyMaterial = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']
  );
  const derived = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: new Uint8Array(salt), iterations: parseInt(iterations), hash: PBKDF2_HASH },
    keyMaterial,
    PBKDF2_KEY_LENGTH * 8
  );
  // Constant-time comparison — prevents timing attacks
  const derivedHex = bufToHex(derived);
  if (derivedHex.length !== storedDerivedHex.length) return false;
  let diff = 0;
  for (let i = 0; i < derivedHex.length; i++) {
    diff |= derivedHex.charCodeAt(i) ^ storedDerivedHex.charCodeAt(i);
  }
  return diff === 0;
}

function generateToken(length) {
  const array = new Uint8Array(length || 32);
  crypto.getRandomValues(array);
  return Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ─── SESSION ───────────────────────────────────────────────────────────────
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

// ─── EMAIL ─────────────────────────────────────────────────────────────────
// Provider-agnostic — set EMAIL_PROVIDER secret to 'maileroo' to switch
// Maileroo: requires MAILEROO_API_KEY secret + verified sending domain
// Brevo (default): requires BREVO_API_KEY secret — free 300/day, needs custom domain for all users
async function sendEmail(env, to, subject, html) {
  const provider = env.EMAIL_PROVIDER || 'brevo';

  if (provider === 'maileroo') {
    // Docs: https://maileroo.com/docs/email-api/send-basic-email
    // Endpoint: POST https://smtp.maileroo.com/api/v2/emails
    // from must be an address on a domain verified in your Maileroo account
    // Use their free shared domain (e.g. noreply@maileroo.org) or your own
    const fromEmail = env.EMAIL_FROM || 'noreply@maileroo.org';
    const res = await fetch('https://smtp.maileroo.com/api/v2/emails', {
      method: 'POST',
      headers: { 'X-Api-Key': env.MAILEROO_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: { address: fromEmail, display_name: 'Ice Vault' },
        to: [{ address: to }],
        subject,
        html,
      }),
    });
    if (!res.ok) {
      const errText = await res.text();
      console.log(`[MAILEROO ERROR] Status: ${res.status} - ${errText}`);
    }
    return res.ok;
  }

  // Default: Brevo
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': env.BREVO_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sender: { name: 'Ice Vault', email: 'mtouch01@gmail.com' },
      to: [{ email: to }],
      subject,
      htmlContent: html,
    }),
  });
  return res.ok;
}

// ─── RATE LIMIT ALERT ──────────────────────────────────────────────────────
// Sends one alert email per IP per endpoint per hour — deduped via KV
// Fire-and-forget — never awaited so it never delays the 429 response
async function alertRateLimit(env, kv, ip, endpoint) {
  try {
    const alertKey = `alert:${endpoint.replace(/\//g, '_')}:${ip}`;
    const already = await kv.get(alertKey);
    if (already) return; // already alerted for this IP+endpoint this window
    await kv.put(alertKey, '1', { expirationTtl: 3600 }); // 1 hour dedup window
    const alertTo = env.ALERT_EMAIL || 'mtouch01@gmail.com';
    await sendEmail(
      env, alertTo,
      `[Ice Vault] Rate limit hit — ${endpoint}`,
      `<div style="font-family:sans-serif;max-width:500px;">
        <h2 style="color:#C0392B;">⚠ Ice Vault Rate Limit Alert</h2>
        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          <tr><td style="color:#888;padding:6px 0;">Endpoint</td><td><strong>${endpoint}</strong></td></tr>
          <tr><td style="color:#888;padding:6px 0;">IP</td><td><strong>${ip}</strong></td></tr>
          <tr><td style="color:#888;padding:6px 0;">Time</td><td>${new Date().toUTCString()}</td></tr>
        </table>
        <p style="margin-top:16px;color:#555;">This IP has hit the rate limit and is now blocked for this window. You will not receive another alert for this IP+endpoint for 1 hour.</p>
        <p style="color:#555;">Run <code>wrangler tail</code> to see live logs, or query D1:</p>
        <pre style="background:#f5f5f5;padding:10px;border-radius:4px;font-size:12px;">wrangler d1 execute icevault --command="SELECT * FROM request_logs WHERE ip='${ip}' ORDER BY created_at DESC LIMIT 20"</pre>
      </div>`
    );
  } catch (e) {
    console.log(`[ALERT ERROR] ${e.message}`);
  }
}

// ─── MAIN HANDLER ──────────────────────────────────────────────────────────
export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const cors = getCORS(origin);

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

    // ─── IP RESOLUTION ───────────────────────────────────────────────────
    // CF-Connecting-IPv4 only set when client connects over IPv4
    // CF-Connecting-IP always set — may be IPv6
    // Prefer IPv4 for readability in logs
    const ipv4 = request.headers.get('CF-Connecting-IPv4') || null;
    const ipRaw = request.headers.get('CF-Connecting-IP') || 'unknown';
    const ip = ipv4 || ipRaw;
    const ipVersion = ipv4 ? 'v4' : (ipRaw.includes(':') ? 'v6' : 'v4');

    const kv = env.RATE_LIMIT_KV || null;
    const db = env.DB;

    // Probabilistic 7-day log purge — runs ~2% of requests
    maybePurgeLogs(db);

    // ─── ANTHROPIC PROXY ─────────────────────────────────────────────────
    if (path === '/' || path === '') {
      const rl = await checkRateLimit(kv, '/proxy', ip);
      if (rl.limited) {
        console.log(`[RATE LIMITED] ${ip} (${ipVersion}) on /proxy`);
        await writeLog(db, { ip, path: '/proxy', status: 429, event: 'RATE_LIMITED', detail: 'Proxy rate limit exceeded' });
        alertRateLimit(env, kv, ip, '/proxy'); // fire and forget
        return rateLimited(rl.message, rl.retryAfter, cors);
      }
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
        await writeLog(db, { ip, path: '/proxy', status: 500, event: 'ERROR', detail: e.message });
        return err(e.message, 500, cors);
      }
    }

    // ─── AUTH: SIGNUP ────────────────────────────────────────────────────
    if (path === '/auth/signup' && request.method === 'POST') {
      const rl = await checkRateLimit(kv, '/auth/signup', ip);
      if (rl.limited) {
        console.log(`[RATE LIMITED] ${ip} (${ipVersion}) on /auth/signup`);
        await writeLog(db, { ip, path: '/auth/signup', status: 429, event: 'RATE_LIMITED', detail: 'Signup rate limit exceeded' });
        alertRateLimit(env, kv, ip, '/auth/signup'); // fire and forget
        return rateLimited(rl.message, rl.retryAfter, cors);
      }
      try {
        const { email, password } = await request.json();
        if (!email || !password) return err('Email and password required', 400, cors);
        if (password.length < 6) return err('Password must be at least 6 characters', 400, cors);

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) return err('Invalid email address', 400, cors);

        const existing = await db.prepare(
          'SELECT id FROM users WHERE email = ?'
        ).bind(email.toLowerCase()).first();
        if (existing) return err('An account with this email already exists', 400, cors);

        const hash = await hashPassword(password);
        const userId = generateToken(8);
        await db.prepare(
          'INSERT INTO users (id, email, password_hash, created_at) VALUES (?, ?, ?, ?)'
        ).bind(userId, email.toLowerCase(), hash, new Date().toISOString()).run();

        const token = generateToken();
        const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
        await db.prepare(
          'INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)'
        ).bind(token, userId, expires).run();

        await writeLog(db, { ip, path: '/auth/signup', status: 200, event: 'SIGNUP', detail: email.toLowerCase() });

        await sendEmail(
          env, email, 'Welcome to Ice Vault!',
          `<div style="font-family:sans-serif;max-width:500px;margin:0 auto;">
            <h2 style="color:#4A9CC9;">🏒 Welcome to Ice Vault!</h2>
            <p>Your account has been created. Your hockey card collection is now saved to the cloud and syncs across any device.</p>
            <p style="color:#888;font-size:13px;">Your Anthropic and eBay API keys are stored locally on your device only — never saved to your account or our servers.</p>
            <a href="${APP_URL}" style="display:inline-block;background:#4A9CC9;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;margin-top:10px;">Open Ice Vault</a>
          </div>`
        );
        return json({ token, email: email.toLowerCase(), userId }, 200, cors);
      } catch (e) {
        await writeLog(db, { ip, path: '/auth/signup', status: 500, event: 'ERROR', detail: e.message });
        return err(e.message, 500, cors);
      }
    }

    // ─── AUTH: LOGIN ─────────────────────────────────────────────────────
    if (path === '/auth/login' && request.method === 'POST') {
      const rl = await checkRateLimit(kv, '/auth/login', ip);
      if (rl.limited) {
        console.log(`[RATE LIMITED] ${ip} (${ipVersion}) on /auth/login`);
        await writeLog(db, { ip, path: '/auth/login', status: 429, event: 'RATE_LIMITED', detail: 'Login rate limit exceeded' });
        alertRateLimit(env, kv, ip, '/auth/login'); // fire and forget
        return rateLimited(rl.message, rl.retryAfter, cors);
      }
      try {
        const { email, password } = await request.json();
        if (!email || !password) return err('Email and password required', 400, cors);

        const user = await db.prepare(
          'SELECT id, email, password_hash FROM users WHERE email = ?'
        ).bind(email.toLowerCase()).first();

        // Always run verify even if user not found — prevents timing attacks
        const dummyHash = 'pbkdf2$100000$00000000000000000000000000000000$0000000000000000000000000000000000000000000000000000000000000000';
        const hashToCheck = user ? user.password_hash : dummyHash;
        const valid = await verifyPassword(password, hashToCheck);

        if (!user || !valid) {
          // 100ms artificial delay on failed attempts — slows brute force within rate limit window
          await new Promise(resolve => setTimeout(resolve, 100));
          await writeLog(db, { ip, path: '/auth/login', status: 401, event: 'LOGIN_FAILED', detail: email.toLowerCase() });
          return err('Invalid email or password', 401, cors);
        }

        const token = generateToken();
        const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
        await db.prepare(
          'INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)'
        ).bind(token, user.id, expires).run();

        await writeLog(db, { ip, path: '/auth/login', status: 200, event: 'LOGIN_OK', detail: user.email });
        return json({ token, email: user.email, userId: user.id }, 200, cors);
      } catch (e) {
        await writeLog(db, { ip, path: '/auth/login', status: 500, event: 'ERROR', detail: e.message });
        return err(e.message, 500, cors);
      }
    }

    // ─── AUTH: LOGOUT ────────────────────────────────────────────────────
    if (path === '/auth/logout' && request.method === 'POST') {
      const auth = request.headers.get('Authorization');
      if (auth && auth.startsWith('Bearer ')) {
        const token = auth.slice(7);
        await db.prepare('DELETE FROM sessions WHERE token = ?').bind(token).run();
      }
      return json({ ok: true }, 200, cors);
    }

    // ─── AUTH: VERIFY ────────────────────────────────────────────────────
    if (path === '/auth/verify' && request.method === 'GET') {
      const user = await getUser(request, db);
      if (!user) return err('Invalid or expired session', 401, cors);
      return json({ email: user.email, userId: user.id }, 200, cors);
    }

    // ─── AUTH: FORGOT PASSWORD ───────────────────────────────────────────
    if (path === '/auth/forgot' && request.method === 'POST') {
      const rl = await checkRateLimit(kv, '/auth/forgot', ip);
      if (rl.limited) {
        console.log(`[RATE LIMITED] ${ip} (${ipVersion}) on /auth/forgot`);
        await writeLog(db, { ip, path: '/auth/forgot', status: 429, event: 'RATE_LIMITED', detail: 'Forgot rate limit exceeded' });
        alertRateLimit(env, kv, ip, '/auth/forgot'); // fire and forget
        return rateLimited(rl.message, rl.retryAfter, cors);
      }
      try {
        const { email } = await request.json();
        if (!email) return err('Email required', 400, cors);

        const user = await db.prepare(
          'SELECT id, email FROM users WHERE email = ?'
        ).bind(email.toLowerCase()).first();

        if (!user) return json({ ok: true }, 200, cors);

        await db.prepare('DELETE FROM password_resets WHERE user_id = ?').bind(user.id).run();

        const resetToken = generateToken();
        const expires = new Date(Date.now() + 60 * 60 * 1000).toISOString();
        await db.prepare(
          'INSERT INTO password_resets (token, user_id, expires_at) VALUES (?, ?, ?)'
        ).bind(resetToken, user.id, expires).run();

        const resetUrl = `${APP_URL}?reset=${resetToken}`;
        await sendEmail(
          env, user.email, 'Reset your Ice Vault password',
          `<div style="font-family:sans-serif;max-width:500px;margin:0 auto;">
            <h2 style="color:#4A9CC9;">🏒 Password Reset</h2>
            <p>We received a request to reset your Ice Vault password.</p>
            <p>Click the button below to reset your password. This link expires in <strong>1 hour</strong>.</p>
            <a href="${resetUrl}" style="display:inline-block;background:#4A9CC9;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;margin-top:10px;">Reset Password</a>
            <p style="color:#888;font-size:12px;margin-top:20px;">If you didn't request this, you can safely ignore this email.</p>
            <p style="color:#888;font-size:12px;">Or copy this link: ${resetUrl}</p>
          </div>`
        );

        await writeLog(db, { ip, path: '/auth/forgot', status: 200, event: 'PASSWORD_RESET_SENT', detail: user.email });
        return json({ ok: true }, 200, cors);
      } catch (e) {
        await writeLog(db, { ip, path: '/auth/forgot', status: 500, event: 'ERROR', detail: e.message });
        return err(e.message, 500, cors);
      }
    }

    // ─── AUTH: RESET PASSWORD ────────────────────────────────────────────
    if (path === '/auth/reset' && request.method === 'POST') {
      const rl = await checkRateLimit(kv, '/auth/reset', ip);
      if (rl.limited) {
        console.log(`[RATE LIMITED] ${ip} (${ipVersion}) on /auth/reset`);
        await writeLog(db, { ip, path: '/auth/reset', status: 429, event: 'RATE_LIMITED', detail: 'Reset rate limit exceeded' });
        alertRateLimit(env, kv, ip, '/auth/reset'); // fire and forget
        return rateLimited(rl.message, rl.retryAfter, cors);
      }
      try {
        const { token, password } = await request.json();
        if (!token || !password) return err('Token and password required', 400, cors);
        if (password.length < 6) return err('Password must be at least 6 characters', 400, cors);

        const reset = await db.prepare(
          'SELECT user_id, expires_at FROM password_resets WHERE token = ?'
        ).bind(token).first();

        if (!reset) return err('Invalid or expired reset link', 401, cors);
        if (new Date(reset.expires_at) < new Date()) {
          await db.prepare('DELETE FROM password_resets WHERE token = ?').bind(token).run();
          return err('Reset link has expired — please request a new one', 401, cors);
        }

        const hash = await hashPassword(password);
        await db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').bind(hash, reset.user_id).run();
        await db.prepare('DELETE FROM password_resets WHERE token = ?').bind(token).run();
        await db.prepare('DELETE FROM sessions WHERE user_id = ?').bind(reset.user_id).run();

        await writeLog(db, { ip, path: '/auth/reset', status: 200, event: 'PASSWORD_RESET_OK', detail: reset.user_id });
        return json({ ok: true }, 200, cors);
      } catch (e) {
        await writeLog(db, { ip, path: '/auth/reset', status: 500, event: 'ERROR', detail: e.message });
        return err(e.message, 500, cors);
      }
    }

    // ─── COLLECTION: GET ─────────────────────────────────────────────────
    if (path === '/collection' && request.method === 'GET') {
      const user = await getUser(request, db);
      if (!user) return err('Unauthorized', 401, cors);
      const cards = await db.prepare(
        'SELECT card_data FROM cards WHERE user_id = ? ORDER BY created_at DESC'
      ).bind(user.id).all();
      const collection = cards.results.map(r => JSON.parse(r.card_data));
      return json({ collection }, 200, cors);
    }

    // ─── COLLECTION: SAVE ────────────────────────────────────────────────
    if (path === '/collection' && request.method === 'PUT') {
      const user = await getUser(request, db);
      if (!user) return err('Unauthorized', 401, cors);
      const { collection } = await request.json();
      if (!Array.isArray(collection)) return err('Invalid collection data', 400, cors);

      await db.prepare('DELETE FROM cards WHERE user_id = ?').bind(user.id).run();
      for (const card of collection) {
        await db.prepare(
          'INSERT INTO cards (id, user_id, card_data, created_at) VALUES (?, ?, ?, ?)'
        ).bind(card.id.toString(), user.id, JSON.stringify(card), card.addedAt || new Date().toISOString()).run();
      }
      return json({ ok: true, count: collection.length }, 200, cors);
    }

    // ─── COLLECTION: DELETE ONE ──────────────────────────────────────────
    if (path.startsWith('/collection/') && request.method === 'DELETE') {
      const user = await getUser(request, db);
      if (!user) return err('Unauthorized', 401, cors);
      const cardId = path.split('/')[2];
      await db.prepare(
        'DELETE FROM cards WHERE id = ? AND user_id = ?'
      ).bind(cardId, user.id).run();
      return json({ ok: true }, 200, cors);
    }

    return err('Not found', 404, cors);
  }
};
