// Ice Vault — Cloudflare Worker
// Handles: Anthropic API proxy, Auth (signup/login/password reset), Collection sync via D1, R2 image upload
// Security: Rate limiting via KV, D1 request logging, PBKDF2-HMAC-SHA256 100k password hashing, 100ms fail delay
// Email: Maileroo via sendEmail()
// Monitoring: Rate limit alert emails via alertRateLimit() — one email per IP per endpoint per hour
// Images: Cloudflare R2 bucket (icevault-images) — cards/{userId}/{cardId}.jpg

const ALLOWED_ORIGINS = [
  'https://Ciiiv.github.io',
  'https://ciiiv.github.io',
  'http://localhost:3000',
  'http://localhost:8080',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5500',  // VS Code Live Server
  'http://localhost:5500',   // VS Code Live Server
];

const APP_URL = 'https://Ciiiv.github.io/icevault';
const R2_PUBLIC_URL = 'https://pub-8fa31d4e964e401e8d40e2c4244f2868.r2.dev';

// Log retention — 7 days
const LOG_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

// ─── RATE LIMIT CONFIG ─────────────────────────────────────────────────────
const RATE_LIMITS = {
  '/auth/login':  { limit: 10,  window: 15 * 60, message: 'Too many login attempts — please wait 15 minutes' },
  '/auth/signup': { limit: 5,   window: 60 * 60, message: 'Too many signup attempts — please wait 1 hour' },
  '/auth/forgot': { limit: 5,   window: 60 * 60, message: 'Too many password reset requests — please wait 1 hour' },
  '/auth/reset':  { limit: 10,  window: 60 * 60, message: 'Too many reset attempts — please wait 1 hour' },
  '/proxy':       { limit: 100, window: 60 * 60, message: 'Too many scan requests — please wait 1 hour' },
  '/auth/change-password': { limit: 5, window: 60 * 60, message: 'Too many password change attempts — please wait 1 hour' },
  '/share/generate':  { limit: 5,   window: 60 * 60, message: 'Too many share requests — please wait 1 hour' },
  '/share/view':      { limit: 60,  window: 60 * 60, message: 'Too many requests — please wait 1 hour' },
  '/collection/put':  { limit: 200, window: 60 * 60, message: 'Too many card saves — please wait 1 hour' },
  '/collection/bulk':     { limit: 10,  window: 60 * 60, message: 'Too many bulk syncs — please wait 1 hour' },
  '/auth/display-name':  { limit: 10,  window: 60 * 60, message: 'Too many display name changes — please wait 1 hour' },
  '/upload':             { limit: 50,  window: 60 * 60, message: 'Too many image uploads — please wait 1 hour' },
};

// ─── INPUT LIMITS ──────────────────────────────────────────────────────────
const LIMITS = {
  email: 254,           // RFC 5321 max email length
  password: 1024,       // no legitimate reason for longer
  token: 128,           // reset/session tokens are 64 hex chars
  cardCount: 2000,      // max cards per user
  cardDataSize: 10000,  // max bytes per card JSON (metadata only, no base64)
  imageSize: 8 * 1024 * 1024,  // 8MB max image upload
  imageMimes: ['image/jpeg', 'image/png', 'image/webp', 'image/heic'],
};

function validateEmail(email) {
  if (!email || typeof email !== 'string') return 'Email required';
  const trimmed = email.trim().toLowerCase();
  if (trimmed.length > LIMITS.email) return 'Email too long';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return 'Invalid email address';
  return null; // valid
}

function validatePassword(password, strong = false) {
  if (!password || typeof password !== 'string') return 'Password required';
  if (password.length > LIMITS.password) return 'Password too long';
  if (strong) {
    // Strong password rules — used for change password
    if (password.length < 8) return 'Password must be at least 8 characters';
    if (!/[a-zA-Z]/.test(password)) return 'Password must contain at least one letter';
    if (!/[0-9]/.test(password)) return 'Password must contain at least one number';
    if (!/[^a-zA-Z0-9]/.test(password)) return 'Password must contain at least one symbol';
  } else {
    if (password.length < 6) return 'Password must be at least 6 characters';
  }
  return null;
}

function validateToken(token) {
  if (!token || typeof token !== 'string') return 'Token required';
  if (token.length > LIMITS.token) return 'Invalid token';
  if (!/^[a-f0-9]+$/i.test(token)) return 'Invalid token format';
  return null;
}


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

// ─── SESSION PURGE ────────────────────────────────────────────────────────
// Deletes expired sessions — runs on ~5% of requests to spread load
// Also called explicitly on login to clean up the logging-in user's old sessions
async function maybePurgeSessions(db) {
  if (Math.random() > 0.05) return;
  try {
    const now = new Date().toISOString();
    const result = await db.prepare('DELETE FROM sessions WHERE expires_at < ?').bind(now).run();
    if (result.meta?.changes > 0) console.log(`[SESSION PURGE] Deleted ${result.meta.changes} expired sessions`);
  } catch (e) {
    console.log(`[SESSION PURGE ERROR] ${e.message}`);
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
    'Access-Control-Allow-Headers': 'Content-Type, x-api-key, anthropic-version, Authorization, x-openai-key, x-gemini-key, x-ximilar-key',
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
    'SELECT id, email, display_name FROM users WHERE id = ?'
  ).bind(session.user_id).first();
  return user;
}

// ─── EMAIL ─────────────────────────────────────────────────────────────────
// Maileroo — https://maileroo.com/docs/email-api/send-basic-email
// Requires: MAILEROO_API_KEY secret + EMAIL_FROM secret
// from address must be on a domain/SMTP account registered in Maileroo dashboard
async function sendEmail(env, to, subject, html) {
  const fromEmail = env.EMAIL_FROM || 'noreply@af4c1dd0a43e50da.maileroo.org';
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

    // ─── OPENAI PROXY ─────────────────────────────────────────────────────
    if (path === '/proxy/openai' && request.method === 'POST') {
      const rl = await checkRateLimit(kv, '/proxy', ip);
      if (rl.limited) {
        await writeLog(db, { ip, path: '/proxy/openai', status: 429, event: 'RATE_LIMITED', detail: 'OpenAI proxy rate limit exceeded' });
        alertRateLimit(env, kv, ip, '/proxy');
        return rateLimited(rl.message, rl.retryAfter, cors);
      }
      try {
        const body = await request.text();
        const apiKey = request.headers.get('x-openai-key');
        if (!apiKey) return err('Missing x-openai-key', 401, cors);
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey },
          body,
        });
        const data = await response.text();
        return new Response(data, { status: response.status, headers: { 'Content-Type': 'application/json', ...cors } });
      } catch (e) {
        await writeLog(db, { ip, path: '/proxy/openai', status: 500, event: 'ERROR', detail: e.message });
        return err(e.message, 500, cors);
      }
    }

    // ─── GEMINI PROXY ─────────────────────────────────────────────────────
    if (path === '/proxy/gemini' && request.method === 'POST') {
      const rl = await checkRateLimit(kv, '/proxy', ip);
      if (rl.limited) {
        await writeLog(db, { ip, path: '/proxy/gemini', status: 429, event: 'RATE_LIMITED', detail: 'Gemini proxy rate limit exceeded' });
        alertRateLimit(env, kv, ip, '/proxy');
        return rateLimited(rl.message, rl.retryAfter, cors);
      }
      try {
        const body = await request.json();
        const apiKey = request.headers.get('x-gemini-key');
        if (!apiKey) return err('Missing x-gemini-key', 401, cors);
        const model = body.model || 'gemini-2.5-flash';
        delete body.model;
        const response = await fetch(
          'https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent?key=' + apiKey,
          { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
        );
        const data = await response.text();
        return new Response(data, { status: response.status, headers: { 'Content-Type': 'application/json', ...cors } });
      } catch (e) {
        await writeLog(db, { ip, path: '/proxy/gemini', status: 500, event: 'ERROR', detail: e.message });
        return err(e.message, 500, cors);
      }
    }

    // ─── XIMILAR PROXY ────────────────────────────────────────────────────
    if (path === '/proxy/ximilar' && request.method === 'POST') {
      const rl = await checkRateLimit(kv, '/proxy', ip);
      if (rl.limited) {
        await writeLog(db, { ip, path: '/proxy/ximilar', status: 429, event: 'RATE_LIMITED', detail: 'Ximilar proxy rate limit exceeded' });
        alertRateLimit(env, kv, ip, '/proxy');
        return rateLimited(rl.message, rl.retryAfter, cors);
      }
      try {
        const body = await request.text();
        const apiKey = request.headers.get('x-ximilar-key');
        if (!apiKey) return err('Missing x-ximilar-key', 401, cors);
        const response = await fetch('https://api.ximilar.com/card-grader/v2/grade', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Token ' + apiKey },
          body,
        });
        const data = await response.text();
        return new Response(data, { status: response.status, headers: { 'Content-Type': 'application/json', ...cors } });
      } catch (e) {
        await writeLog(db, { ip, path: '/proxy/ximilar', status: 500, event: 'ERROR', detail: e.message });
        return err(e.message, 500, cors);
      }
    }

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
        const body = await request.json();
        const email = (body.email || '').trim().toLowerCase();
        const password = body.password || '';
        const displayName = (body.displayName || '').trim();
        const emailErr = validateEmail(email);
        if (emailErr) return err(emailErr, 400, cors);
        const passErr = validatePassword(password);
        if (passErr) return err(passErr, 400, cors);
        if (!displayName) return err('Display name required', 400, cors);
        if (displayName.length > 32) return err('Display name must be 32 characters or less', 400, cors);
        if (!/^[a-zA-Z0-9 _\-\.]+$/.test(displayName)) return err('Display name can only contain letters, numbers, spaces, and _ - .', 400, cors);
        const emailPrefix = email.split('@')[0].toLowerCase();
        if (displayName.toLowerCase() === emailPrefix || displayName.toLowerCase().includes(emailPrefix)) {
          return err('Display name cannot match or contain your email username — choose something different', 400, cors);
        }

        const nameTaken = await db.prepare(
          'SELECT id FROM users WHERE display_name = ?'
        ).bind(displayName).first();
        if (nameTaken) return err('Display name already taken — choose a different one', 400, cors);

        const existing = await db.prepare(
          'SELECT id FROM users WHERE email = ?'
        ).bind(email.toLowerCase()).first();
        if (existing) return err('An account with this email already exists', 400, cors);

        const hash = await hashPassword(password);
        const userId = generateToken(8);
        await db.prepare(
          'INSERT INTO users (id, email, password_hash, display_name, created_at) VALUES (?, ?, ?, ?, ?)'
        ).bind(userId, email.toLowerCase(), hash, displayName, new Date().toISOString()).run();

        const token = generateToken();
        const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
        await db.prepare(
          'INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)'
        ).bind(token, userId, expires).run();

        await writeLog(db, { ip, path: '/auth/signup', status: 200, event: 'SIGNUP', detail: email.toLowerCase() });

        // Send email verification
        const verifyToken = generateToken(16); // 32 hex chars
        const verifyExpires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24 hours
        await db.prepare('INSERT INTO email_verifications (token, user_id, expires_at) VALUES (?, ?, ?)')
          .bind(verifyToken, userId, verifyExpires).run();
        const verifyUrl = `${APP_URL}?verify=${verifyToken}`;
        await sendEmail(
          env, email, 'Verify your Ice Vault email',
          `<div style="font-family:sans-serif;max-width:500px;margin:0 auto;">
            <h2 style="color:#4A9CC9;">🏒 Welcome to Ice Vault!</h2>
            <p>Click the button below to verify your email address and activate your account.</p>
            <a href="${verifyUrl}" style="display:inline-block;background:#4A9CC9;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;margin-top:10px;">Verify Email Address</a>
            <p style="color:#888;font-size:12px;margin-top:20px;">This link expires in <strong>24 hours</strong>.</p>
            <p style="color:#C0392B;font-size:12px;margin-top:8px;">⚠ <strong>Check your spam/junk folder</strong> if you don't see this email in your inbox.</p>
            <p style="color:#888;font-size:12px;">Or copy this link: ${verifyUrl}</p>
          </div>`
        );
        return json({ needsVerification: true, email: email.toLowerCase() }, 200, cors);
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
        const body = await request.json();
        const email = (body.email || '').trim().toLowerCase();
        const password = body.password || '';
        const emailErr = validateEmail(email);
        if (emailErr) return err(emailErr, 400, cors);
        if (!password) return err('Password required', 400, cors);
        if (password.length > LIMITS.password) return err('Password too long', 400, cors);

        const user = await db.prepare(
          'SELECT id, email, password_hash, display_name, verified FROM users WHERE email = ?'
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

        // Check email verification
        if (!user.verified) {
          await writeLog(db, { ip, path: '/auth/login', status: 403, event: 'LOGIN_UNVERIFIED', detail: user.email });
          return err('Please verify your email address before signing in. Check your inbox and spam folder.', 403, cors);
        }

        const token = generateToken();
        const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
        // Clean up this user's expired sessions before creating a new one
        await db.prepare('DELETE FROM sessions WHERE user_id = ? AND expires_at < ?')
          .bind(user.id, new Date().toISOString()).run();
        await db.prepare(
          'INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)'
        ).bind(token, user.id, expires).run();

        await writeLog(db, { ip, path: '/auth/login', status: 200, event: 'LOGIN_OK', detail: user.email });
        return json({ token, email: user.email, userId: user.id, displayName: user.display_name || null }, 200, cors);
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
      return json({ email: user.email, userId: user.id, displayName: user.display_name || null }, 200, cors);
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
        const body = await request.json();
        const email = (body.email || '').trim().toLowerCase();
        const emailErr = validateEmail(email);
        if (emailErr) return err(emailErr, 400, cors);

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
        const body = await request.json();
        const { token, password } = body;
        const tokenErr = validateToken(token);
        if (tokenErr) return err(tokenErr, 400, cors);
        const passErr = validatePassword(password);
        if (passErr) return err(passErr, 400, cors);

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

    // ─── IMAGE UPLOAD TO R2 ──────────────────────────────────────────────
    // Accepts: multipart/form-data with 'image' file + 'cardId' field
    // Returns: { url } — public R2 URL to store in card data instead of base64
    // Key format: cards/{userId}/{cardId}.{ext}
    if (path === '/upload' && request.method === 'POST') {
      const rl = await checkRateLimit(kv, '/upload', ip);
      if (rl.limited) {
        console.log(`[RATE LIMITED] ${ip} (${ipVersion}) on /upload`);
        await writeLog(db, { ip, path: '/upload', status: 429, event: 'RATE_LIMITED', detail: 'Upload rate limit exceeded' });
        alertRateLimit(env, kv, ip, '/upload');
        return rateLimited(rl.message, rl.retryAfter, cors);
      }
      const user = await getUser(request, db);
      if (!user) return err('Unauthorized', 401, cors);
      try {
        const formData = await request.formData();
        const image = formData.get('image');
        const cardId = formData.get('cardId');
        if (!image) return err('No image provided', 400, cors);
        if (image.size > LIMITS.imageSize) return err(`Image too large — max ${LIMITS.imageSize / 1024 / 1024}MB`, 400, cors);
        if (cardId && (typeof cardId !== 'string' || cardId.length > 32)) return err('Invalid cardId', 400, cors);

        // Determine extension from content type
        const contentType = image.type || 'image/jpeg';
        if (!LIMITS.imageMimes.includes(contentType)) return err(`Invalid image type — allowed: ${LIMITS.imageMimes.join(', ')}`, 400, cors);
        const ext = contentType === 'image/png' ? 'png' : 'jpg';
        const key = `cards/${user.id}/${cardId || Date.now()}.${ext}`;

        // Upload to R2
        const imageBuffer = await image.arrayBuffer();
        await env.IMAGES.put(key, imageBuffer, {
          httpMetadata: { contentType },
        });

        // Return the R2 URL — served via Workers or public bucket URL
        const url = `${R2_PUBLIC_URL}/${key}`;
        console.log(`[R2 UPLOAD] ${user.email} uploaded ${key} (${imageBuffer.byteLength} bytes)`);
        return json({ url, key }, 200, cors);
      } catch (e) {
        console.log(`[R2 ERROR] ${e.message}`);
        return err('Upload failed: ' + e.message, 500, cors);
      }
    }

    // ─── AUTH: CHANGE PASSWORD ──────────────────────────────────────────
    if (path === '/auth/change-password' && request.method === 'POST') {
      const rl = await checkRateLimit(kv, '/auth/change-password', ip);
      if (rl.limited) {
        console.log(`[RATE LIMITED] ${ip} (${ipVersion}) on /auth/change-password`);
        await writeLog(db, { ip, path: '/auth/change-password', status: 429, event: 'RATE_LIMITED', detail: 'Change password rate limit exceeded' });
        alertRateLimit(env, kv, ip, '/auth/change-password');
        return rateLimited(rl.message, rl.retryAfter, cors);
      }
      const user = await getUser(request, db);
      if (!user) return err('Unauthorized', 401, cors);
      try {
        const body = await request.json();
        const { currentPassword, newPassword } = body;
        if (!currentPassword) return err('Current password required', 400, cors);
        // Strong password rules — 8+ chars, letter + number + symbol
        const passErr = validatePassword(newPassword, true);
        if (passErr) return err(passErr, 400, cors);

        // Fetch current hash
        const row = await db.prepare(
          'SELECT password_hash FROM users WHERE id = ?'
        ).bind(user.id).first();
        if (!row) return err('User not found', 404, cors);

        // Verify current password
        const valid = await verifyPassword(currentPassword, row.password_hash);
        if (!valid) {
          await new Promise(r => setTimeout(r, 100)); // delay on wrong pw
          await writeLog(db, { ip, path: '/auth/change-password', status: 401, event: 'LOGIN_FAILED', detail: user.email });
          return err('Current password is incorrect', 401, cors);
        }

        // Reject if new password is same as current
        const sameAsCurrent = await verifyPassword(newPassword, row.password_hash);
        if (sameAsCurrent) return err('New password must be different from current password', 400, cors);

        // Hash and save new password
        const newHash = await hashPassword(newPassword);
        await db.prepare('UPDATE users SET password_hash = ? WHERE id = ?')
          .bind(newHash, user.id).run();

        await writeLog(db, { ip, path: '/auth/change-password', status: 200, event: 'PASSWORD_CHANGED', detail: user.email });
        return json({ ok: true }, 200, cors);
      } catch (e) {
        await writeLog(db, { ip, path: '/auth/change-password', status: 500, event: 'ERROR', detail: e.message });
        return err(e.message, 500, cors);
      }
    }

     // ─── COLLECTION: META (lightweight sync check) ──────────────────────────
    if (path === '/collection/meta' && request.method === 'GET') {
      const user = await getUser(request, db);
      if (!user) return err('Unauthorized', 401, cors);
      try {
        const result = await db.prepare(
          'SELECT COUNT(*) as count, MAX(COALESCE(updated_at, created_at)) as lastUpdated FROM cards WHERE user_id = ?'
        ).bind(user.id).first();
        return json({ count: result.count || 0, lastUpdated: result.lastUpdated || null }, 200, cors);
      } catch (e) {
        return err(e.message, 500, cors);
      }
    }

    // ─── COLLECTION: UPSERT SINGLE CARD ─────────────────────────────────────
    if (path.startsWith('/collection/') && request.method === 'PUT') {
      const rl = await checkRateLimit(kv, '/collection/put', ip);
      if (rl.limited) return rateLimited(rl.message, rl.retryAfter, cors);
      const user = await getUser(request, db);
      if (!user) return err('Unauthorized', 401, cors);
      const cardId = path.split('/')[2];
      if (!cardId) return err('Card ID required', 400, cors);
      try {
        const body = await request.json();
        const { card } = body;
        if (!card || !card.id || !card.player) return err('Invalid card data', 400, cors);
        const cardJson = JSON.stringify(card);
        if (cardJson.length > LIMITS.cardDataSize) return err('Card data too large', 400, cors);
        const now = new Date().toISOString();
        await db.prepare(
          'INSERT INTO cards (id, user_id, card_data, created_at, updated_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(id, user_id) DO UPDATE SET card_data = excluded.card_data, updated_at = excluded.updated_at'
        ).bind(cardId.toString(), user.id, cardJson, card.addedAt || now, now).run();
        return json({ ok: true }, 200, cors);
      } catch (e) {
        return err(e.message, 500, cors);
      }
    }

   // ─── COLLECTION: GET (paginated + server-side search) ───────────────────
    if (path === '/collection' && request.method === 'GET') {
      const user = await getUser(request, db);
      if (!user) return err('Unauthorized', 401, cors);
      try {
        const params = url.searchParams;
        const page = Math.max(1, parseInt(params.get('page') || '1'));
        const limit = Math.min(200, Math.max(1, parseInt(params.get('limit') || '100')));
        const search = (params.get('search') || '').trim().toLowerCase();
        const colFilter = (params.get('collection') || '').trim();
        const sort = params.get('sort') || 'date-desc';
        const gradeFilter = (params.get('grade') || '').trim();
        const valueFilter = (params.get('value') || '').trim();
        const dateFilter = (params.get('date') || '').trim();
        const offset = (page - 1) * limit;

        // Build WHERE clause
        let where = 'user_id = ?';
        const binds = [user.id];

        if (search) {
          where += ' AND LOWER(card_data) LIKE ?';
          binds.push('%' + search + '%');
        }
        if (colFilter) {
          where += ' AND LOWER(card_data) LIKE ?';
          binds.push('%"collection":"' + colFilter.toLowerCase() + '"%');
          // When explicitly filtering for Sold, only show sold cards
          // When filtering for anything else, exclude sold cards
          if (colFilter.toLowerCase() === 'sold') {
            where += ' AND LOWER(card_data) LIKE ?';
            binds.push('%"sold":true%');
          } else {
            where += ' AND (LOWER(card_data) NOT LIKE ? OR LOWER(card_data) LIKE ?)';
            binds.push('%"sold":true%', '%"sold":false%');
          }
        } else {
          // Default — hide sold cards unless explicitly requested
          where += ' AND (LOWER(card_data) NOT LIKE ? OR LOWER(card_data) LIKE ?)';
          binds.push('%"sold":true%', '%"sold":false%');
        }

        // Sort order
        const orderMap = {
          'date-desc': 'created_at DESC',
          'date-asc': 'created_at ASC',
          'updated-desc': 'COALESCE(updated_at, created_at) DESC',
        };
        const orderBy = orderMap[sort] || 'created_at DESC';

        // Count total matching
        const countResult = await db.prepare(
          `SELECT COUNT(*) as total FROM cards WHERE ${where}`
        ).bind(...binds).first();
        const total = countResult?.total || 0;
        const pages = Math.ceil(total / limit);

        // Fetch page
        const cards = await db.prepare(
          `SELECT card_data FROM cards WHERE ${where} ORDER BY ${orderBy} LIMIT ? OFFSET ?`
        ).bind(...binds, limit, offset).all();

        let collection = cards.results.map(r => JSON.parse(r.card_data));

        // Apply grade/value/date filters (stored in JSON blob, can't SQL filter)
        if (gradeFilter) {
          collection = collection.filter(c => {
            const g = parseFloat(c.grade?.overall) || 0;
            if (gradeFilter === '9') return g >= 9;
            if (gradeFilter === '8') return g >= 8;
            if (gradeFilter === '7') return g >= 7;
            if (gradeFilter === 'sub7') return g > 0 && g < 7;
            return true;
          });
        }
        if (valueFilter) {
          collection = collection.filter(c => {
            const v = parseFloat(c.estimatedValue) || 0;
            if (valueFilter === '0-25') return v < 25;
            if (valueFilter === '25-100') return v >= 25 && v < 100;
            if (valueFilter === '100-500') return v >= 100 && v < 500;
            if (valueFilter === '500+') return v >= 500;
            return true;
          });
        }
        if (dateFilter) {
          const days = parseInt(dateFilter);
          const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
          collection = collection.filter(c => new Date(c.addedAt).getTime() >= cutoff);
        }

        // Apply sorts that can't be done in SQL (player, value, grade)
        if (sort === 'player-asc') collection.sort((a,b) => (a.player||'').localeCompare(b.player||''));
        else if (sort === 'player-desc') collection.sort((a,b) => (b.player||'').localeCompare(a.player||''));
        else if (sort === 'value-desc') collection.sort((a,b) => (parseFloat(b.estimatedValue)||0)-(parseFloat(a.estimatedValue)||0));
        else if (sort === 'value-asc') collection.sort((a,b) => (parseFloat(a.estimatedValue)||0)-(parseFloat(b.estimatedValue)||0));
        else if (sort === 'grade-desc') collection.sort((a,b) => (parseFloat(b.grade?.overall)||0)-(parseFloat(a.grade?.overall)||0));
        else if (sort === 'grade-asc') collection.sort((a,b) => (parseFloat(a.grade?.overall)||0)-(parseFloat(b.grade?.overall)||0));

        return json({ collection, total, page, pages, limit }, 200, cors);
      } catch (e) {
        return err(e.message, 500, cors);
      }
    }

    // ─── COLLECTION: SAVE ────────────────────────────────────────────────
    if (path === '/collection' && request.method === 'PUT') {
      const user = await getUser(request, db);
      if (!user) return err('Unauthorized', 401, cors);
      const body = await request.json();
      const { collection } = body;
      if (!Array.isArray(collection)) return err('Invalid collection data', 400, cors);
      if (collection.length > LIMITS.cardCount) return err(`Collection too large — max ${LIMITS.cardCount} cards`, 400, cors);

      // Validate each card before writing
      const validCards = [];
      for (const card of collection) {
        if (!card || typeof card !== 'object') continue;
        if (!card.id || !card.player) continue; // skip malformed cards
        const cardJson = JSON.stringify(card);
        if (cardJson.length > LIMITS.cardDataSize) {
          console.log(`[VALIDATION] Card ${card.id} too large (${cardJson.length} bytes) — skipping`);
          continue; // skip oversized cards (likely still has base64 imageData)
        }
        validCards.push(card);
      }

      // Build all statements for atomic batch execution — all-or-nothing, no partial writes
      const now = new Date().toISOString();
      const statements = [
        db.prepare('DELETE FROM cards WHERE user_id = ?').bind(user.id),
        ...validCards.map(card =>
          db.prepare(
            'INSERT INTO cards (id, user_id, card_data, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
          ).bind(card.id.toString(), user.id, JSON.stringify(card), card.addedAt || now, now)
        )
      ];
      await db.batch(statements);
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

    // ─── SHARE: GENERATE TOKEN ──────────────────────────────────────────
    if (path === '/share/generate' && request.method === 'POST') {
      const rl = await checkRateLimit(kv, '/share/generate', ip);
      if (rl.limited) {
        console.log(`[RATE LIMITED] ${ip} (${ipVersion}) on /share/generate`);
        await writeLog(db, { ip, path: '/share/generate', status: 429, event: 'RATE_LIMITED', detail: 'Share generate rate limit exceeded' });
        alertRateLimit(env, kv, ip, '/share/generate');
        return rateLimited(rl.message, rl.retryAfter, cors);
      }
      const user = await getUser(request, db);
      if (!user) return err('Unauthorized', 401, cors);
      try {
        // Delete any existing token for this user
        await db.prepare('DELETE FROM share_tokens WHERE user_id = ?').bind(user.id).run();
        // Generate new token
        const token = generateToken(32); // 64 hex chars
        await db.prepare(
          'INSERT INTO share_tokens (token, user_id, created_at) VALUES (?, ?, ?)'
        ).bind(token, user.id, new Date().toISOString()).run();
        await writeLog(db, { ip, path: '/share/generate', status: 200, event: 'SHARE_GENERATED', detail: user.email });
        return json({ token, url: `${APP_URL}?collection=${token}` }, 200, cors);
      } catch (e) {
        await writeLog(db, { ip, path: '/share/generate', status: 500, event: 'ERROR', detail: e.message });
        return err(e.message, 500, cors);
      }
    }

    // ─── SHARE: REVOKE TOKEN ─────────────────────────────────────────────
    if (path === '/share/revoke' && request.method === 'DELETE') {
      const user = await getUser(request, db);
      if (!user) return err('Unauthorized', 401, cors);
      try {
        await db.prepare('DELETE FROM share_tokens WHERE user_id = ?').bind(user.id).run();
        await writeLog(db, { ip, path: '/share/revoke', status: 200, event: 'SHARE_REVOKED', detail: user.email });
        return json({ ok: true }, 200, cors);
      } catch (e) {
        return err(e.message, 500, cors);
      }
    }

    // ─── SHARE: GET STATUS ───────────────────────────────────────────────
    // Returns current share token for the signed-in user (if any)
    if (path === '/share/status' && request.method === 'GET') {
      const user = await getUser(request, db);
      if (!user) return err('Unauthorized', 401, cors);
      try {
        const row = await db.prepare(
          'SELECT token, created_at FROM share_tokens WHERE user_id = ?'
        ).bind(user.id).first();
        if (!row) return json({ sharing: false }, 200, cors);
        return json({ sharing: true, token: row.token, url: `${APP_URL}?collection=${row.token}`, createdAt: row.created_at }, 200, cors);
      } catch (e) {
        return err(e.message, 500, cors);
      }
    }

    // ─── SHARE: VIEW COLLECTION (PUBLIC) ─────────────────────────────────
    // No auth required — rate limited to prevent scraping
    if (path.startsWith('/share/') && request.method === 'GET' && path !== '/share/status') {
      const rl = await checkRateLimit(kv, '/share/view', ip);
      if (rl.limited) {
        return rateLimited(rl.message, rl.retryAfter, cors);
      }
      try {
        const token = path.split('/')[2];
        if (!token || token.length > 128) return err('Invalid token', 400, cors);

        // Look up user from token
        const shareRow = await db.prepare(
          'SELECT user_id FROM share_tokens WHERE token = ?'
        ).bind(token).first();
        if (!shareRow) return err('Collection not found or sharing disabled', 404, cors);

        // Fetch owner info
        const owner = await db.prepare(
          'SELECT email, display_name FROM users WHERE id = ?'
        ).bind(shareRow.user_id).first();

        // Fetch collection
        const cards = await db.prepare(
          'SELECT card_data FROM cards WHERE user_id = ? ORDER BY created_at DESC'
        ).bind(shareRow.user_id).all();

        // Strip sensitive fields before returning -- exclude Private collection
        const publicCollection = cards.results.map(r => {
          const c = JSON.parse(r.card_data);
          if (c.collection === 'Private') return null;
          return {
            id: c.id,
            player: c.player,
            year: c.year,
            brand: c.brand,
            cardNumber: c.cardNumber,
            team: c.team,
            parallel: c.parallel,
            collection: c.collection,
            tags: c.tags,
            grade: c.grade,
            aiGraded: c.aiGraded,
            certGrader: c.certGrader,
            officialGrade: c.officialGrade,
            imageUrl: c.imageUrl || null,
            imageUrlBack: c.imageUrlBack || null,
            serialNumber: c.serialNumber || null,
            listedOnEbay: c.listedOnEbay,
            addedAt: c.addedAt,
            // Price — only include if owner opted in per card
            sharePrice: c.sharePrice || false,
            sharePriceType: c.sharePriceType || null,
            estimatedValue: c.sharePrice ? c.estimatedValue : null,
            ownerPrice: c.sharePrice && c.sharePriceType === 'owner' ? c.ownerPrice : null,
            // Explicitly exclude: imageData, imageDataBack, certNumber, ebayListingId, ebayListingId
          };
        });

        // Display name — first part of email
        const displayName = owner ? (owner.display_name || owner.email.split('@')[0]) : 'Unknown';
        return json({ displayName, cardCount: publicCollection.length, collection: publicCollection }, 200, cors);
      } catch (e) {
        return err(e.message, 500, cors);
      }
    }

    // ─── AUTH: SET DISPLAY NAME ─────────────────────────────────────────
    if (path === '/auth/display-name' && request.method === 'POST') {
      const rl = await checkRateLimit(kv, '/auth/display-name', ip);
      if (rl.limited) return rateLimited(rl.message, rl.retryAfter, cors);
      const user = await getUser(request, db);
      if (!user) return err('Unauthorized', 401, cors);
      try {
        const body = await request.json();
        const displayName = (body.displayName || '').trim();
        if (!displayName) return err('Display name required', 400, cors);
        if (displayName.length > 32) return err('Display name must be 32 characters or less', 400, cors);
        if (!/^[a-zA-Z0-9 _\-\.]+$/.test(displayName)) return err('Display name can only contain letters, numbers, spaces, and _ - .', 400, cors);
        const userEmailPrefix = user.email ? user.email.split('@')[0].toLowerCase() : '';
        if (userEmailPrefix && (displayName.toLowerCase() === userEmailPrefix || displayName.toLowerCase().includes(userEmailPrefix))) {
          return err('Display name cannot match or contain your email username — choose something different', 400, cors);
        }
        const dnTaken = await db.prepare(
          'SELECT id FROM users WHERE display_name = ? AND id != ?'
        ).bind(displayName, user.id).first();
        if (dnTaken) return err('Display name already taken — choose a different one', 400, cors);

        await db.prepare('UPDATE users SET display_name = ? WHERE id = ?')
          .bind(displayName, user.id).run();
        await writeLog(db, { ip, path: '/auth/display-name', status: 200, event: 'DISPLAY_NAME_SET', detail: user.email });
        return json({ ok: true, displayName }, 200, cors);
      } catch (e) {
        return err(e.message, 500, cors);
      }
    }

    // ─── AUTH: VERIFY EMAIL ──────────────────────────────────────────────
    if (path === '/auth/verify-email' && request.method === 'POST') {
      try {
        const body = await request.json();
        const { token } = body;
        const tokenErr = validateToken(token);
        if (tokenErr) return err(tokenErr, 400, cors);

        const verification = await db.prepare(
          'SELECT user_id, expires_at FROM email_verifications WHERE token = ?'
        ).bind(token).first();

        if (!verification) return err('Invalid or expired verification link', 401, cors);
        if (new Date(verification.expires_at) < new Date()) {
          await db.prepare('DELETE FROM email_verifications WHERE token = ?').bind(token).run();
          return err('Verification link has expired — please sign up again', 401, cors);
        }

        // Mark user as verified
        await db.prepare('UPDATE users SET verified = 1 WHERE id = ?').bind(verification.user_id).run();
        await db.prepare('DELETE FROM email_verifications WHERE token = ?').bind(token).run();

        // Create session so user is logged in immediately after verification
        const user = await db.prepare(
          'SELECT id, email, display_name FROM users WHERE id = ?'
        ).bind(verification.user_id).first();

        const sessionToken = generateToken();
        const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
        await db.prepare(
          'INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)'
        ).bind(sessionToken, user.id, expires).run();

        await writeLog(db, { ip, path: '/auth/verify-email', status: 200, event: 'EMAIL_VERIFIED', detail: user.email });
        return json({ token: sessionToken, email: user.email, userId: user.id, displayName: user.display_name || null }, 200, cors);
      } catch (e) {
        return err(e.message, 500, cors);
      }
    }

    // ─── AUTH: RESEND VERIFICATION EMAIL ─────────────────────────────────
    if (path === '/auth/resend-verification' && request.method === 'POST') {
      const rl = await checkRateLimit(kv, '/auth/forgot', ip); // reuse forgot rate limit
      if (rl.limited) return rateLimited(rl.message, rl.retryAfter, cors);
      try {
        const body = await request.json();
        const email = (body.email || '').trim().toLowerCase();
        const emailErr = validateEmail(email);
        if (emailErr) return err(emailErr, 400, cors);

        const user = await db.prepare(
          'SELECT id, email, verified FROM users WHERE email = ?'
        ).bind(email).first();

        if (!user || user.verified) return json({ ok: true }, 200, cors); // silent — don't leak info

        // Delete old verification tokens for this user
        await db.prepare('DELETE FROM email_verifications WHERE user_id = ?').bind(user.id).run();

        const verifyToken = generateToken(16);
        const verifyExpires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
        await db.prepare('INSERT INTO email_verifications (token, user_id, expires_at) VALUES (?, ?, ?)')
          .bind(verifyToken, user.id, verifyExpires).run();

        const verifyUrl = `${APP_URL}?verify=${verifyToken}`;
        await sendEmail(
          env, user.email, 'Verify your Ice Vault email',
          `<div style="font-family:sans-serif;max-width:500px;margin:0 auto;">
            <h2 style="color:#4A9CC9;">🏒 Verify Your Email</h2>
            <p>Click the button below to verify your email address.</p>
            <a href="${verifyUrl}" style="display:inline-block;background:#4A9CC9;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;margin-top:10px;">Verify Email Address</a>
            <p style="color:#888;font-size:12px;margin-top:20px;">This link expires in <strong>24 hours</strong>.</p>
            <p style="color:#C0392B;font-size:12px;margin-top:8px;">⚠ <strong>Check your spam/junk folder</strong> if you don't see this email in your inbox.</p>
          </div>`
        );
        return json({ ok: true }, 200, cors);
      } catch (e) {
        return err(e.message, 500, cors);
      }
    }

    return err('Not found', 404, cors);
  }
};