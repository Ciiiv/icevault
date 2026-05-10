# Ice Vault — Project Notes
# Hockey card collection manager — AI scanning, condition grading, cert lookup, eBay listing, BYOK, open source
# For use at the start of new Claude conversations to provide full context

---

## 🌐 Live URLs

- **Web app:** https://Ciiiv.github.io/icevault
- **Cloudflare Worker:** https://lingering-breeze-fb87.mtouch01.workers.dev
- **R2 public URL:** https://pub-8fa31d4e964e401e8d40e2c4244f2868.r2.dev
- **GitHub repo:** https://github.com/Ciiiv/icevault

---

## 🏗 Full Stack

| Component | Service | Details |
|-----------|---------|---------|
| Web hosting | GitHub Pages | Auto-deploys from `docs/` on push to `main` |
| API proxy + Auth | Cloudflare Worker | `lingering-breeze-fb87` — deployed via Wrangler CLI |
| Database | Cloudflare D1 | Database name: `icevault`, ID: `3cacae20-fde1-4183-94af-eaa256eebb84` |
| Image storage | Cloudflare R2 | Bucket: `icevault-images`, public URL: `https://pub-8fa31d4e964e401e8d40e2c4244f2868.r2.dev` |
| Rate limiting | Cloudflare KV | Namespace: `RATE_LIMIT_KV`, ID: `94009b2958714bd88fc369c3a808997e` |
| Email | Maileroo | 3,000/mo free. From: `noreply@af4c1dd0a43e50da.maileroo.org` |
| AI | Anthropic Claude | `claude-opus-4-5` — card OCR, grading, eBay descriptions |
| Android app | PWABuilder | TWA wrapper — sideloaded APK |
| Worker deployment | Wrangler CLI | `C:\Users\civ2g\icevault-worker` |

---

## 🔑 Key IDs & Config

- **D1 Database ID:** `3cacae20-fde1-4183-94af-eaa256eebb84`
- **KV Namespace ID:** `94009b2958714bd88fc369c3a808997e`
- **R2 Bucket:** `icevault-images`
- **Worker name:** `lingering-breeze-fb87`
- **GitHub username:** `Ciiiv`
- **Wrangler project:** `C:\Users\civ2g\icevault-worker`

---

## 🔐 Secrets (set via `wrangler secret put`)

- `MAILEROO_API_KEY`
- `EMAIL_FROM` — `noreply@af4c1dd0a43e50da.maileroo.org`
- `ALERT_EMAIL` — defaults to `mtouch01@gmail.com`

---

## 📁 Repository Structure

```
icevault/
├── docs/
│   ├── index.html          # Entire app ~3250 lines
│   ├── manifest.json
│   ├── sw.js
│   ├── favicon.svg
│   └── icons/
├── icevault_worker.js      # Worker reference copy (manually synced)
├── README.md
└── PROJECT_NOTES.md

icevault-worker\            # NOT a git repo
├── src\index.js            # Deployed worker — edit here, wrangler deploy
├── fix.py                  # Diagnostic/patch script (stays here, not in git)
└── wrangler.toml
```

---

## ✅ Completed Features

### App Features
- Card scanning — front + back, AI reads both in one call
- **Optional AI grade** — checkbox to include/skip condition estimate (saves tokens). Unchecked = no grade saved. Auto-scan removed — user clicks Analyze manually
- **Serial number detection** — AI reads from card back (e.g. 47/99), saved to card, shown in modal and shared view, included in eBay title and search URL
- Parallel detection from back of card
- Optional eBay description at scan time
- Graded cert lookup — Option A (AI slab) + Option B (free QR/cert #)
- 8 grading companies: PSA, BGS, SGC, CGC, Authority, TAG, KSA, HGA
- Collection management — grid, search, filter, sort, tags, lightbox
- **Server-side pagination** — 100 cards/page, search/filter/sort hit D1, page number nav with ellipsis. Guest stays local. Debounced 300ms
- **Export JSON** — full lossless backup, reimportable
- **Export CSV** — 22-column flat file including serial number
- **Import JSON** — merge backup, skip duplicates, migrate images to R2
- eBay listing — AI description, sold listings + 130point research
- **eBay title** — player first, serial number included, official grade only (AI grades excluded)
- User accounts with email/password auth
- **Email verification** — required on signup, click link in email, 24hr expiry. Spam folder warning shown. Resend option. Existing accounts pre-verified
- **Display name** — required on signup, saved immediately at account creation (no re-prompt after email verification), cannot match email username (frontend + backend check), **must be unique across all accounts** (DB unique index + backend check at signup and update), prompted on first login for existing accounts, editable from account modal
- Cloud sync — metadata to D1, images to R2
- **Per-card sync** — single card upsert on save/edit/delete. Smart meta check on login skips full pull if up to date
- **R2 image storage** — front + back uploaded at save, guest migration at sign-in
- Guest mode — local only, full R2 migration on account creation
- Sign out clears localStorage and lastSync
- Password reset via Maileroo
- **Change password** — 8+ chars, letter+number+symbol, rate limited, same-pw check server-side
- **Public collection sharing** — 64-char token, per-card price controls (AI est or owner price), owner display name shown next to price. Rate limited
- 6-theme system — Hybrid default
- Session cleanup — per-user on login + 5% probabilistic global purge
- Favicon + PWA meta tags fixed
- PWA + Android APK

### Security Completed
- ✅ PBKDF2-HMAC-SHA256 — 100k iterations, no library
- ✅ Rate limiting — KV sliding window on 11 endpoints:
  - `/auth/login` 10/15min, `/auth/signup` 5/hr, `/auth/forgot` 5/hr
  - `/auth/reset` 10/hr, `/auth/change-password` 5/hr, `/auth/display-name` 10/hr
  - `/share/generate` 5/hr, `/share/view` 60/hr
  - `/collection/:id PUT` 200/hr, `/collection` bulk PUT 10/hr, `/proxy` 100/hr
- ✅ Rate limit alert emails — KV deduped, fire-and-forget
- ✅ Input validation on all endpoints
- ✅ Display name cannot match email username — frontend + backend
- ✅ Display name unique across all accounts — DB unique index + backend check on signup and update
- ✅ Display name saved at signup INSERT — no redundant prompt after email verification
- ✅ Display name modal cannot be dismissed — no X button, ESC blocked, backdrop click blocked
- ✅ Email verification on signup
- ✅ Login fail delay 100ms + timing attack prevention
- ✅ D1 request logging — 7-day retention
- ✅ Origin check on worker
- ✅ Sign out clears localStorage

---

## 🔄 Pending / Backlog

### Security & Architecture

| # | Item | Status |
|---|------|--------|
| 1-8 | Hashing, rate limiting, R2, validation, per-card sync, session cleanup, pagination | ✅ Done |
| — | Bulk PUT /collection wrapped in D1 batch transaction — atomic, no partial writes | ✅ Done |
| 9 | Email verification | ✅ Done |
| 10 | Sentry error monitoring | ⬜ Next — do before mark as sold |
| 11 | eBay REST API migration | ⬜ Low |
| 12 | D1 schema + Google OAuth | ⚪ If public |

### Feature Backlog

| # | Feature | Status |
|---|---------|--------|
| 1 | Public collection sharing | ✅ Done |
| 2 | Optional AI grade + serial number | ✅ Done |
| 3 | Mark as sold | ⬜ Med |
| 4 | Value tracking + charts | ⬜ Med |
| 5 | Multi-AI (GPT-4o, Gemini, Ollama) | ⬜ Med |
| 6 | eBay Partner Network affiliate links | ⬜ Low |
| 7 | Ximilar card grading API | ⬜ Low |
| 8 | Bulk eBay listing | ⬜ Low |
| 9 | Photography tips popup | ⬜ Low |
| 10 | Account deletion + Legal + OAuth | ⚪ If public |

---

## 🗄 D1 Database Schema

```sql
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  display_name TEXT,
  verified INTEGER DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY, user_id TEXT NOT NULL, expires_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS password_resets (
  token TEXT PRIMARY KEY, user_id TEXT NOT NULL, expires_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS email_verifications (
  token TEXT PRIMARY KEY, user_id TEXT NOT NULL, expires_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS cards (
  id TEXT NOT NULL, user_id TEXT NOT NULL,
  card_data TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT,
  PRIMARY KEY (id, user_id)
);
CREATE TABLE IF NOT EXISTS share_tokens (
  token TEXT PRIMARY KEY, user_id TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS request_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT, timestamp TEXT NOT NULL,
  ip TEXT NOT NULL, path TEXT NOT NULL, status INTEGER NOT NULL,
  event TEXT NOT NULL, detail TEXT, created_at TEXT NOT NULL
);
```

Notes:
- Password hash format: `pbkdf2$100000$salt$hash`
- `display_name` has a unique index: `CREATE UNIQUE INDEX idx_users_display_name ON users(display_name)`
- `display_name`, `verified`, `updated_at` added via ALTER TABLE
- `email_verifications` table added for signup flow
- Existing accounts have `verified = 1` (set via UPDATE users SET verified = 1)

---

## 💻 Developer Workflow

Two PowerShell terminals open side by side in Windows Terminal:

**Left terminal — `C:\Users\civ2g\icevault\` (repo)**
- Run fix.py patches: `python C:\Users\civ2g\icevault-worker\fix.py`
- Git commands run from VSCode (source control panel or terminal)
- Edit `docs/index.html`, `README.md`, `PROJECT_NOTES.md` in VSCode

**Right terminal — `C:\Users\civ2g\icevault-worker\` (worker)**
- Deploy worker: `wrangler deploy`
- Watch live logs: `wrangler tail`
- Run D1 queries: `wrangler d1 execute icevault --remote --command "..."`
- If OAuth fails: `$env:CLOUDFLARE_API_TOKEN='your-token'` then `wrangler deploy`

**Syncing worker reference copy:**
- Open `src/index.js` in VSCode → Ctrl+A, Ctrl+C
- Open `icevault_worker.js` in VSCode → Ctrl+A, Delete, Ctrl+V, Save

**Deploying frontend:**
- Edit `docs/index.html` locally, test with VSCode Live Server (http://127.0.0.1:5500)
- Git commit + push from VSCode → GitHub Pages auto-deploys in ~30 seconds

**fix.py pattern:**
- Each fix.py is a targeted patch script — finds exact strings and replaces them
- Always run from left terminal with full path: `python C:\Users\civ2g\icevault-worker\fix.py`
- fix.py lives in `C:\Users\civ2g\icevault-worker\` — never committed to repo
- After worker changes: run fix.py → wrangler deploy → sync reference copy → git push
- After frontend changes: run fix.py → test with Live Server → git push

## 🛠 Wrangler Quick Reference

```powershell
cd C:\Users\civ2g\icevault-worker

# Deploy — use API token if OAuth fails
$env:CLOUDFLARE_API_TOKEN="your-token-here"
wrangler deploy

wrangler login   # re-authenticate
wrangler tail
npm install -g wrangler   # update wrangler

wrangler secret put MAILEROO_API_KEY
wrangler secret put EMAIL_FROM
wrangler secret list
```

### wrangler.toml
```toml
name = "lingering-breeze-fb87"
main = "src/index.js"
compatibility_date = "2024-01-01"

[[d1_databases]]
binding = "DB"
database_name = "icevault"
database_id = "3cacae20-fde1-4183-94af-eaa256eebb84"

[[kv_namespaces]]
binding = "RATE_LIMIT_KV"
id = "94009b2958714bd88fc369c3a808997e"

[[r2_buckets]]
binding = "IMAGES"
bucket_name = "icevault-images"
```

---

## 🔍 D1 Operations Reference

```powershell
# All users
wrangler d1 execute icevault --remote --command "SELECT email, display_name, verified, id FROM users"

# Full account delete
wrangler d1 execute icevault --remote --command "DELETE FROM cards WHERE user_id = 'USER_ID'"
wrangler d1 execute icevault --remote --command "DELETE FROM sessions WHERE user_id = 'USER_ID'"
wrangler d1 execute icevault --remote --command "DELETE FROM password_resets WHERE user_id = 'USER_ID'"
wrangler d1 execute icevault --remote --command "DELETE FROM share_tokens WHERE user_id = 'USER_ID'"
wrangler d1 execute icevault --remote --command "DELETE FROM email_verifications WHERE user_id = 'USER_ID'"
wrangler d1 execute icevault --remote --command "DELETE FROM users WHERE id = 'USER_ID'"

# Storage check
wrangler d1 execute icevault --remote --command "SELECT user_id, COUNT(*) as cards, SUM(LENGTH(card_data)) as bytes FROM cards GROUP BY user_id"

# Recent logs
wrangler d1 execute icevault --remote --command "SELECT ip, path, event, detail, created_at FROM request_logs ORDER BY created_at DESC LIMIT 20"

# Manually verify an account
wrangler d1 execute icevault --remote --command "UPDATE users SET verified = 1 WHERE email = 'user@example.com'"
```

---

## 🔧 Key Technical Decisions

| Decision | Reason |
|----------|--------|
| R2 for images, D1 for metadata | D1 1MB row limit. R2 = zero egress, 10GB free, CDN cached |
| Per-card sync + smart meta check | Full resync was N writes per save. Meta check skips pull if nothing changed |
| Server-side pagination | All search/filter/sort hit D1. 100/page. Scales to 50k+ cards |
| PBKDF2 | Built-in Web Crypto API — no library. 100k = CF Workers hard limit |
| Maileroo | 3,000/mo free, sends to any email without custom domain |
| Display name separate from email | Email never exposed publicly on shared collections |
| Share token 64 hex chars | 2^256 — unguessable. One per user, revocable |
| Email verification | Confirms real email before account active. Existing accounts pre-verified |
| No OAuth for now | Current PBKDF2 auth is solid. OAuth adds complexity for no gain at personal scale |
| No auto-scan | User controls when API call happens — avoids wasted tokens |
| Single HTML file | No build pipeline, maintainable at current scale |
| Cloudflare API token for deploy | OAuth token can expire — scoped API token more reliable |

---

## 🔐 Security & Architecture Notes

### /share/ Route Conflict Risk — Do Not Change generateToken Without Reading This

**Current implementation:**
```javascript
function generateToken(length) {
  const array = new Uint8Array(length || 32);
  crypto.getRandomValues(array);
  return Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
}
```
Share tokens are generated with `generateToken(32)` — producing 64 hex characters using only `0-9` and `a-f`.

**The routing pattern in the worker:**
```javascript
// Named routes checked first (explicit match)
if (path === '/share/generate' && request.method === 'POST') { ... }
if (path === '/share/revoke' && request.method === 'DELETE') { ... }
if (path === '/share/status' && request.method === 'GET') { ... }

// Catch-all — anything not matched above is treated as a public token lookup
if (path.startsWith('/share/') && request.method === 'GET' && path !== '/share/status') {
  const token = path.split('/')[2];
  // treat as public share token lookup
}
```

**The risk:**
The catch-all pattern on Route 3 means any token that matches a named route word (e.g. `status`, `generate`, `revoke`) would be intercepted by the named handler instead of reaching the public lookup — making that collection unreachable via its token.

**Why it is currently safe:**
`generateToken(32)` produces only hex characters (`0-9`, `a-f`). Named routes like `status`, `generate`, `revoke` contain characters outside the hex alphabet (`s`, `t`, `u`, `v` is valid hex but the full words are not). It is mathematically impossible for a hex token to equal any current named route word.

**When this becomes a risk:**
- If `generateToken` is replaced with alphanumeric (e.g. nanoid, UUID, base64) — character set expands to include `s`, `t`, `u`, `g`, `r`, `v`, `e` etc., making collisions theoretically possible
- If new named routes are added under `/share/` that happen to be valid hex strings (unlikely but possible — e.g. a route named `/share/feed` — `f`, `e`, `e`, `d` are all valid hex)

**If you ever change token generation, do one of the following first:**

Option A — Keep tokens hex-only (safest, no routing changes needed):
```javascript
// Safe — stick with hex output from generateToken
generateToken(32) // 64 hex chars, 0-9 a-f only
```

Option B — Add explicit token format validation to the catch-all:
```javascript
// Before treating as a token, validate it looks like a token
if (path.startsWith('/share/') && request.method === 'GET' && path !== '/share/status') {
  const token = path.split('/')[2];
  // Reject if token doesn't match expected format — prevents named route collisions
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return err('Invalid token', 400, cors);
  // ... proceed with lookup
}
```

Option C — Switch catch-all to explicit length check:
```javascript
// Tokens are always 64 chars — named routes are never 64 chars
if (path.startsWith('/share/') && token.length === 64) { ... }
```

**Recommendation:** Do not change `generateToken` without implementing Option B or C first. Option B is preferred — it validates both format and length, and future-proofs the routing against any token format changes.

---

## ⚠️ Known Issues & Limitations

- **Maileroo shared domain:** Emails (verification, reset) may land in spam on Gmail/Yahoo. Warn users to check spam
- **eBay Trading API:** Legacy XML SOAP — deprecated but functional
- **R2 public bucket:** URLs not guessable (userId + cardId) but not private
- **Wrangler OAuth expiry:** Use `$env:CLOUDFLARE_API_TOKEN` if deploy fails

---

## 📞 Context for New Claude Sessions

> "I'm continuing development of Ice Vault — a hockey card manager web app.
> Stack: GitHub Pages (Ciiiv.github.io/icevault), Cloudflare Worker at C:\Users\civ2g\icevault-worker,
> D1 (icevault, ID: 3cacae20-fde1-4183-94af-eaa256eebb84),
> KV (RATE_LIMIT_KV, ID: 94009b2958714bd88fc369c3a808997e),
> R2 bucket icevault-images (public URL: https://pub-8fa31d4e964e401e8d40e2c4244f2868.r2.dev),
> Maileroo email (noreply@af4c1dd0a43e50da.maileroo.org).
>
> Worker: C:\Users\civ2g\icevault-worker\src\index.js — edit, then wrangler deploy.
> If wrangler deploy fails with KV permissions: $env:CLOUDFLARE_API_TOKEN='token' then deploy.
> Worker reference copy: icevault_worker.js in GitHub repo (manually synced after each deploy).
> fix.py diagnostic/patch script lives in C:\Users\civ2g\icevault-worker\ (not in git).
>
> index.html is ~3250 lines. Always use fix.py for patches — never rewrite the whole file.
> Views inside .main-content inside .sidebar-shell always.
> Classic theme: sidebar-shell display:block, sidebar-nav/topbar hidden, main-content display:block.
>
> Completed: PBKDF2-100k hashing, KV rate limiting (11 endpoints), rate limit alert emails,
> Maileroo email, 6-theme system, JSON/CSV export + JSON import, sign out clears localStorage,
> R2 image storage (front + back, guest migration), input validation, change password,
> display names (required signup, cannot match email, prompted on first login),
> email verification (required signup, 24hr link, spam warning, resend option, existing accounts pre-verified),
> public collection sharing (64-char token, per-card price controls, owner display name),
> optional AI grade checkbox, serial number field (scan/modal/eBay/shared view),
> no auto-scan (user clicks Analyze), per-card sync + smart login pull,
> session cleanup, server-side pagination (100/page, D1 search/filter/sort, page number nav),
> favicon + PWA meta tags.
>
> D1 schema: users(id,email,password_hash,display_name,verified,created_at),
> sessions, password_resets, email_verifications, cards(+updated_at), share_tokens, request_logs.
>
> Next priorities: Sentry error monitoring setup, then mark as sold feature.
> Legal/OAuth only if going public.
>
> D1 ops: --remote flag, $env:CLOUDFLARE_API_TOKEN if auth fails.
> See PROJECT_NOTES.md for full context."