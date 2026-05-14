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
| AI | Anthropic Claude (`claude-opus-4-5`), OpenAI GPT-4o, Google Gemini 2.5 Flash, Ximilar Card Grader v2 | card OCR, grading, eBay descriptions |
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
│   ├── index.html          # HTML + CSS + theme init only (~2200 lines)
│   ├── js/
│   │   └── app.js              # All application JS (~2490 lines)
│   ├── manifest.json
│   ├── sw.js               # v3 -- caches index.html + js/app.js
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
- **Mark as sold** — button in card detail modal, requires sale price (required) and captures sale date automatically, moves card to Sold collection bucket, hidden from default collection view, shows in grid with sold price badge. Undo Sale option restores card to Personal Collection and clears sale data. Sold cards preserved in D1 for historical tracking and future value tracking feature
- **Manual field editing** — inline click-to-edit on all card fields in detail modal (Player, Year, Brand, Team, Card #, Parallel, Serial #, Est. Value). Click field to edit, Enter or click away to save, Escape to cancel. Save hint shown while editing. Updates modal header instantly. Syncs to D1 via per-card upsert
- **AI grade matrix** — replaces single grade box in card detail modal with 4-source matrix (Claude, GPT-4o, Gemini, Ximilar). Summary row shows all grades at a glance. Tabs switch detail view per source. Re-grade with Claude fetches existing R2 images (front + back), runs grade-only prompt, confirms before overwrite. Set as card grade copies selected source grade to main card grade. GPT-4o, Gemini, Ximilar tabs show coming soon. Grades stored per-source in card.grades object. Existing c.grade migrated to Claude slot automatically
- **R2 CORS policy** — configured on icevault-images bucket to allow all app origins (GitHub Pages + Live Server). Required for browser fetch of R2 images during re-grade
- **Private Collection** — new collection type. Cards visible in own grid but excluded from shared collection URL. Filter(Boolean) applied in worker /share endpoint. "Private Collection" option added to scan tab, cert save, card modal, and filter toolbar
- **Multi-AI scan model picker** — Claude, GPT-4o, or Gemini selectable on scan tab. Ximilar is grading-only, not available for full OCR scan. Model-aware key check and error messages. Cost notes update dynamically per selected model
- **Slab scan model picker** — Claude, GPT-4o, or Gemini selectable on Option A (AI Slab Scan). Cost note updates per model
- **Re-scan model picker** — Claude, GPT-4o, or Gemini selectable in card modal re-scan controls. Removed "Include updated grade" checkbox -- re-scan is OCR-only, grading handled via grade matrix tabs
- **Ximilar notes** — Added to scan tab model picker, grade disclaimer, and grade checkbox. Notes explain Claude/GPT-4o/Gemini are for card scan/identification, Ximilar is purpose-built for grading
- **eBay toast fix** — "Select a card first" → "Please select a card" for consistency
- **saveApiKeys() sanitize** — strips non-ASCII chars (bullet mask chars) before saving to localStorage -- prevents corrupted key headers
- **AI grade matrix (all 4 sources live)** — Claude, GPT-4o, Gemini, Ximilar all wired up. No more coming-soon tabs. Per-source key check shows "Add [X] key to enable" if key missing. Ximilar maps grades.{final,centering,corners,edges,surface,condition} to standard grade object. Ximilar purpose-built for card grading -- most accurate for condition. Claude/GPT-4o/Gemini better for card identification/OCR
- **Re-scan card** — OCR-only re-scan from existing R2 images. Model picker: Claude/GPT-4o/Gemini. Shows diff review panel before saving — changed fields highlighted teal with old→new, unchanged shown muted. Cancel hides panel, Save applies all changes and syncs to D1. Only available on cards with R2 imageUrl. Re-scan updates card fields only — grading handled separately via grade matrix tabs per source
- **Value history tracking** — every card has a valueHistory array. First entry created at scan time. Appends on manual Est. Value edit (source: manual), re-scan (source: rescan). Existing cards migrated on init and after cloud sync. Cert cards also get valueHistory at save
- **Stats tab** — new Stats sidebar nav item. Dashboard with 4 metric cards (collection value, total sold, avg vs estimate, best flip), collection value over time line chart, sold vs estimate bar chart, grade distribution bar chart, collection by bucket bars, recent sales table. All calculated client-side from collection array. Charts use Chart.js stored in _statsCharts and destroyed before re-render
- **Topbar quick stats** — Cards, Est. Value, Sold, Vs Est. always visible on all tabs. Centered via absolute positioning. Keys and account button right-aligned independently
- **Stats PDF export** — jsPDF. Page 1: teal header, 4 metric boxes, 4 charts captured from canvas, bucket bars, recent sales table (always shown with empty state). Page 2+: 3x3 card grid with R2 thumbnail, player/year/brand, stats (truncated to prevent overflow), value history mini bar chart, sold badge
- **Stats CSV export** — one row per value history entry per card. Columns: Player, Year, Brand, Parallel, Serial #, Collection, Grade, AI Graded, Est. Value, Value Date, Value Source, Sold, Sold Price, Sold Date. Separate from collection backup CSV
- 6-theme system — Hybrid default
- Session cleanup — per-user on login + 5% probabilistic global purge
- Favicon + PWA meta tags fixed
- PWA + Android APK

### Security Completed
- ✅ PBKDF2-HMAC-SHA256 — 100k iterations, no library
- ✅ Rate limiting — KV sliding window on 12 endpoints:
  - `/auth/login` 10/15min, `/auth/signup` 5/hr, `/auth/forgot` 5/hr
  - `/auth/reset` 10/hr, `/auth/change-password` 5/hr, `/auth/display-name` 10/hr
  - `/share/generate` 5/hr, `/share/view` 60/hr
  - `/collection/:id PUT` 200/hr, `/collection` bulk PUT 10/hr, `/proxy` 100/hr
  - `/upload` 50/hr
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
| 10 | Sentry error monitoring | ⚪ If public — wrangler tail + F12 dev tools sufficient for personal use |
| 11 | eBay REST API migration | ⚪ If needed — legacy XML SOAP still functional, migrate only if it breaks |
| 12 | D1 schema + Google OAuth | ⚪ If public |

### Feature Backlog

| # | Feature | Status |
|---|---------|--------|
| 1 | Public collection sharing | ✅ Done |
| 2 | Optional AI grade + serial number | ✅ Done |
| 3 | Mark as sold | ✅ Done |
| 3b | Re-grade from existing card images — grade matrix with AI source tabs | ✅ Done |
| 3c | Manual field editing in card detail modal — inline click-to-edit per field | ✅ Done |
| 3d | Re-scan full card — field diff review panel, OCR-only (no grade). Model picker: Claude/GPT-4o/Gemini. Grade updates handled via grade matrix tabs per source | ✅ Done |
| 4 | Value tracking + charts — stats tab, topbar quick stats, value history tracking, PDF + CSV export | ✅ Done |
| 5 | Multi-AI (GPT-4o, Gemini) -- scan model picker, all 4 grade matrix sources live (Claude/GPT-4o/Gemini/Ximilar), CORS headers updated, per-source key check | ✅ Done |
| 6 | Private Collection bucket -- "Private" collection type added to all dropdowns and filter toolbar. Cards in Private visible in own grid, excluded from shared collection URL server-side via filter(Boolean) in /share endpoint | ✅ Done |
| 7 | eBay Partner Network affiliate links | ⏯ Low |
| 7 | Ximilar card grading API -- grading-only, not OCR. Free tier: 1k tokens (front+back = 100 tokens = ~10 grades). Booster: $11/10k tokens (~$0.11/grade front+back) | ✅ Done |
| 8 | Bulk eBay listing | ⬜ Low |
| 9 | Photography tips popup | ⬜ Low |
| 10 | JS split -- extracted all JS from index.html into docs/js/app.js. index.html is now HTML+CSS+theme init only. sw.js bumped to v3 to cache app.js | ✅ Done |
| 11 | Account deletion + Legal + OAuth | ⚪ If public |

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

**fix.py known gotchas:**
- `\n` in JS strings: Python may write a literal newline instead of escaped `\n` inside JS string literals. Use `String.fromCharCode(10)` in JS instead, or build patches with Python string concatenation rather than raw multiline strings
- Non-ASCII chars: em-dashes, box-drawing chars, unicode minus may corrupt. Use only ASCII in JS patches -- replace with `--`, `-` etc.
- Aggressive regex: never use `re.sub` with broad patterns on the full file -- it can collapse everything. Use `str.replace()` with exact strings only
- Always verify line count after saving: `(Get-Content "path").Count` -- if it drops dramatically, run `git checkout docs/index.html` immediately
- Syntax errors after patching: check F12 console for line number, then `Get-Content "path" | Select-Object -Index (N-3..N+3)` to inspect
- `textContent` vs `innerHTML`: setting button text via `textContent` won't render HTML entities -- use `innerHTML` instead

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
| Sold cards never deleted | Marked sold cards stay in D1 with sold:true flag — filtered out of default view via JSON string match in D1 query. Preserved for historical data and future value tracking |
| R2 CORS policy | Browser fetch of R2 images (for re-grade) requires CORS headers on the bucket. Configured directly in R2 dashboard — worker ALLOWED_ORIGINS does not cover R2 direct fetches. Policy allows GET from all app origins |
| Grade matrix data structure | Grades stored per-source in card.grades.{claude,gpt4o,gemini,ximilar}. Main card.grade = the "set" grade shown in grid and eBay title. Existing aiGraded cards auto-migrated to claude slot in modal render |
| Re-grade fetches R2 directly | Browser fetches R2 image URLs as base64 for re-grade API call. No worker proxy needed — R2 CORS policy handles cross-origin access cleanly without extra latency or worker CPU |
| Chart.js for stats charts | CDN loaded, stored in _statsCharts object, destroyed before re-render to prevent canvas reuse errors. 4 chart types: line, bar, doughnut, bar |
| jsPDF for PDF export | CDN loaded via window.jspdf. Charts captured as PNG via canvas.toDataURL() and embedded. R2 images loaded via loadImageAsBase64() helper using crossOrigin=anonymous (requires R2 CORS). Text truncated in card grid to prevent overflow — clip preferred over wrap in small fixed-height cells |
| Value history as card array | valueHistory: [{value, date, source}] stored in card JSON in D1. Sources: scan, manual, rescan. Migration runs on init and after cloud sync — idempotent. No schema changes needed |
| Stats exports separate from collection backup | PDF/CSV exports on Stats tab are stats/value data only. Collection JSON/CSV exports on Collection tab are full card data backups for D1 disaster recovery |
| Ximilar token cost | Free tier: 1,000 tokens. Front+back grade = 100 tokens = ~10 grades free. Booster pack: $11/10k tokens (~$0.11 per front+back grade). Grading only -- cannot OCR card data |
| Anthropic API pricing | No free tier. Paid balance required. Claude costs ~$0.01-0.03 per card scan. Real pricing at console.anthropic.com -- Ice Vault cost estimates are approximations only. Recommend setting a monthly spend limit and turning off auto-reload |
| OpenAI API pricing | No free tier. Paid balance required. GPT-4o costs ~$0.01-0.03 per card scan. Real pricing at platform.openai.com -- Ice Vault cost estimates are approximations only. Recommend turning off auto-recharge and setting a spend limit |
| Gemini API pricing | Free tier: ~20 requests/day (as of Dec 2025, was 250+). Front+back scan = 1 request. Good for light use. Paid tier very cheap: $0.30/million input tokens -- a card scan costs fractions of a cent. Real pricing at aistudio.google.com -- Ice Vault cost estimates are approximations only |
| Multi-AI CORS | Added x-openai-key, x-gemini-key, x-ximilar-key to worker CORS Access-Control-Allow-Headers. Required for preflight to pass on custom API key headers |
| Re-scan is OCR-only | Re-scan (card modal) uses Claude/GPT-4o/Gemini for OCR field update only -- no grade included. Grade updates handled separately via grade matrix tabs per source. Removed includeGrade checkbox from re-scan controls |
| API key sanitization | saveApiKeys() strips non-ASCII chars with /[^\x20-\x7E]/g before saving. Prevents bullet mask chars (U+2022) from being saved as key values -- causes non-ISO-8859-1 fetch header errors |
| JS split | All JS extracted from index.html to docs/js/app.js. index.html now HTML+CSS+theme init only. sw.js bumped to v3 to cache js/app.js. fix.py default target updated to app.js |
| D1 batch for bulk sync | PUT /collection uses db.batch() — atomic all-or-nothing, no partial writes on import or guest migration |
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
- **R2 CORS:** Re-grade fetches R2 images directly from browser. If CORS policy is removed or origins change, re-grade will fail with "Failed to fetch". Fix: update CORS policy in Cloudflare R2 dashboard → icevault-images → Settings → CORS Policy
- **Re-grade requires R2 images:** Cards with only local base64 imageData (guest mode, old imports) cannot be re-graded — no imageUrl to fetch. Re-grade button is suppressed for these cards

---

## 📞 Context for New Claude Sessions

> "I'm continuing development of Ice Vault — a hockey card manager web app.
>
> **Stack:** GitHub Pages (Ciiiv.github.io/icevault), Cloudflare Worker at C:\Users\civ2g\icevault-worker,
> D1 (icevault, ID: 3cacae20-fde1-4183-94af-eaa256eebb84),
> KV (RATE_LIMIT_KV, ID: 94009b2958714bd88fc369c3a808997e),
> R2 bucket icevault-images (public URL: https://pub-8fa31d4e964e401e8d40e2c4244f2868.r2.dev),
> Maileroo email (noreply@af4c1dd0a43e50da.maileroo.org).
>
> **Workflow:** Two PowerShell terminals — left in C:\Users\civ2g\icevault (repo), right in C:\Users\civ2g\icevault-worker (worker).
> Run fix.py from left: `python C:\Users\civ2g\icevault-worker\fix.py`
> Deploy worker from right: `wrangler deploy` then sync icevault_worker.js reference copy manually in VSCode.
> If wrangler deploy fails: `$env:CLOUDFLARE_API_TOKEN='token'` then deploy.
> fix.py lives in C:\Users\civ2g\icevault-worker\ — never committed to repo.
> Git commands run from VSCode. Test frontend with Live Server (http://127.0.0.1:5500).
>
> **index.html is ~4500 lines.** Always use fix.py for patches — never rewrite the whole file.
> Views inside .main-content inside .sidebar-shell always.
> Classic theme: sidebar-shell display:block, sidebar-nav/topbar hidden, main-content display:block.
>
> **fix.py gotchas:** Use String.fromCharCode(10) instead of '\n' in JS strings.
> Use only ASCII in patches. Use str.replace() not re.sub() on full file.
> Always verify line count after save. Use innerHTML not textContent for HTML entities.
>
> **Completed features:** PBKDF2-100k hashing, KV rate limiting (12 endpoints), rate limit alert emails,
> Maileroo email, 6-theme system, JSON/CSV/JSON import+export (collection backup),
> sign out clears localStorage, R2 image storage (front + back, guest migration),
> R2 CORS policy configured, input validation, change password,
> display names (unique, required signup, saved at INSERT, modal locked, cannot match email),
> email verification (required signup, 24hr link, resend option),
> public collection sharing (64-char token, per-card price controls, owner display name),
> optional AI grade + serial number, no auto-scan, per-card sync + smart login pull,
> session cleanup, server-side pagination (100/page, D1 search/filter/sort, page number nav),
> mark as sold (required price, auto date, Sold bucket, hidden by default, undo option),
> sold filter in D1 query + local render, bulk PUT wrapped in D1 batch transaction,
> manual field editing (inline click-to-edit in card modal),
> AI grade matrix (4-source tabs: Claude/GPT-4o/Gemini/Ximilar, re-grade from R2 images, set as card grade),
> re-scan card (diff review panel, include grade option, fetches R2 images),
> value history tracking (valueHistory array, appends on scan/manual/rescan, migration on init),
> stats tab (collection value, sold, vs estimate, best flip, 4 charts, recent sales table),
> topbar quick stats (Cards, Est. Value, Sold, Vs Est. on all tabs, centered),
> stats PDF export (jsPDF, page 1 summary + charts, page 2+ card grid with thumbnails + value history bars),
> stats CSV export (one row per value history entry, separate from collection backup).
>
> **D1 schema:** users(id,email,password_hash,display_name,verified,created_at) + unique index on display_name,
> sessions, password_resets, email_verifications, cards(+updated_at), share_tokens, request_logs.
>
> **Next priorities:** Gemini free tier UI notes (cost hints), OpenAI/Claude no free tier UI notes, eBay affiliate links (low).
> Ximilar grading API. eBay affiliate links, bulk listing, photography tips (all low).
> Account deletion + Legal + OAuth only if going public.
> Sentry, eBay REST migration only if needed/public.
>
> D1 ops: --remote flag, $env:CLOUDFLARE_API_TOKEN if auth fails.
> See PROJECT_NOTES.md for full context."