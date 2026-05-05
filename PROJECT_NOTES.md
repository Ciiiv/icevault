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
| Database | Cloudflare D1 | Database name: `icevault`, ID: `3cacae20-fde1-4183-94af-eaa256eebb84` — metadata only, no images |
| Image storage | Cloudflare R2 | Bucket: `icevault-images` — card photos, 10GB free, zero egress. Key format: `cards/{userId}/{cardId}.jpg` |
| Rate limiting | Cloudflare KV | Namespace: `RATE_LIMIT_KV`, ID: `94009b2958714bd88fc369c3a808997e` |
| Email | Maileroo | Transactional email — 3,000/mo free. Sending domain: `af4c1dd0a43e50da.maileroo.org`, from: `noreply@af4c1dd0a43e50da.maileroo.org` |
| AI | Anthropic Claude | `claude-opus-4-5` model — card OCR, grading, eBay descriptions |
| Android app | PWABuilder | TWA wrapper — sideloaded APK, loads from GitHub Pages URL |
| Worker deployment | Wrangler CLI | Local project at `C:\Users\civ2g\icevault-worker` |

---

## 🔑 Key IDs & Config (non-sensitive)

- **D1 Database ID:** `3cacae20-fde1-4183-94af-eaa256eebb84`
- **KV Namespace ID:** `94009b2958714bd88fc369c3a808997e`
- **R2 Bucket:** `icevault-images`
- **R2 Public URL:** `https://pub-8fa31d4e964e401e8d40e2c4244f2868.r2.dev`
- **Worker name:** `lingering-breeze-fb87`
- **GitHub username:** `Ciiiv`
- **Wrangler project path:** `C:\Users\civ2g\icevault-worker`
- **Maileroo sending domain:** `af4c1dd0a43e50da.maileroo.org`

---

## 🔐 Secrets (Cloudflare Worker Secrets — never in code or wrangler.toml)

- `MAILEROO_API_KEY` — Maileroo sending key
- `EMAIL_FROM` — `noreply@af4c1dd0a43e50da.maileroo.org`
- `ALERT_EMAIL` — optional, defaults to `mtouch01@gmail.com`

---

## 📁 Repository Structure

```
icevault/                           ← Git repo (GitHub Pages)
├── docs/
│   ├── index.html                  # Entire app — HTML, CSS, JS (~2400 lines)
│   ├── manifest.json
│   ├── sw.js
│   └── icons/
├── icevault_worker.js              # Worker reference copy (manually synced)
├── .github/workflows/deploy.yml
├── README.md
└── PROJECT_NOTES.md

icevault-worker\                    ← Separate folder, NOT a git repo
└── src\index.js                    # Actual deployed worker — edit here, wrangler deploy
```

---

## ✅ What's Built & Working

### App Features
- Card scanning — front + back photo, AI reads both in one API call
- Parallel and serial number detection from back of card
- AI condition estimate — PSA-style 1–10, labeled "AI Est."
- Optional eBay description at scan time
- Graded cert lookup — Option A (AI slab) + Option B (free QR/cert #)
- 8 grading companies: PSA, BGS, SGC, CGC, Authority, TAG, KSA, HGA
- Collection management — grid, search, filter, sort, tags, lightbox
- **Export JSON** — full lossless backup, reimportable
- **Export CSV** — 22-column flat file for Excel/Sheets
- **Import JSON** — merge backup, skip duplicates by ID, sync to cloud
- eBay listing with AI description, sold listings + 130point research
- eBay Trading API XML integration (legacy)
- User accounts with email/password auth
- Cloud sync — metadata to D1, images to R2
- **R2 image storage** — card photos served from CDN, cached 1 year, zero egress cost
- Guest mode with local-only storage
- **Sign out clears localStorage** — prevents account bleed-over on shared devices
- **Guest → account migration** — base64 images auto-uploaded to R2 at sign-in before D1 sync
- Password reset via Maileroo
- **Change password** from signed-in account modal — requires current password, enforces 8+ chars with letter + number + symbol, rate limited, same-password check server-side
- 6-theme system — Hybrid default
- PWA + Android APK

### Security Completed
- ✅ PBKDF2-HMAC-SHA256 password hashing — 100k iterations
- ✅ Rate limiting — KV sliding window on all 5 endpoints:
  - `/auth/login` — 10/15min, `/auth/signup` — 5/hr, `/auth/forgot` — 5/hr, `/auth/reset` — 10/hr, `/proxy` — 100/hr
- ✅ Rate limit alert emails — alertRateLimit(), KV deduped, fire-and-forget
- ✅ Login fail delay — 100ms
- ✅ Timing attack prevention
- ✅ D1 request logging — 7-day retention, auto-purged
- ✅ IPv4 preference in logs
- ✅ Origin check on worker
- ✅ Sign out clears localStorage
- ✅ Input validation on all worker endpoints — email 254 chars, password 1024, token hex format, collection max 2000 cards, card data max 10KB, image max 8MB, MIME type whitelist

### Image Storage Architecture
- Signed-in users: images upload to R2 at save time via `uploadImageToR2()` → `imageUrl` stored in card, `imageData` null
- Guests: images stay as base64 in localStorage (`imageData`) — never touch D1
- Guest → account: `migrateLocalImagesToR2()` runs at sign-in, uploads all base64 images to R2 before `syncCollectionToCloud()`
- Display: all image renders check `c.imageUrl || c.imageData` — backwards compatible with any legacy base64 cards
- Back images stored separately: `imageUrlBack` / `imageDataBack` — shown in card modal, both clickable to lightbox
- R2 key format: `cards/{userId}/{cardId}.jpg` (front), `cards/{userId}/{cardId}_back.jpg` (back)
- R2 public URL: `https://pub-8fa31d4e964e401e8d40e2c4244f2868.r2.dev/{key}`

---

## 🔄 Pending / Backlog

### Security & Architecture

| # | Item | Status | Notes |
|---|------|--------|-------|
| 1 | Password hashing | ✅ Done | PBKDF2-HMAC-SHA256 100k iterations |
| 2 | Rate limiting | ✅ Done | KV sliding window on all 5 endpoints |
| 3 | Rate limit alerting | ✅ Done | Alert emails, KV deduped |
| 4 | R2 image storage | ✅ Done | Images in R2, metadata in D1, guest migration on sign-in |
| 5 | Input validation on worker endpoints | ✅ Done | Email/password/token limits, collection size cap, image size + MIME check, strong password rules on change-pw |
| 6 | Per-card collection sync | ⬜ Med | Full delete+reinsert on every save |
| 7 | Session cleanup job | ⬜ Med | Expired sessions accumulate in D1 |
| 8 | Pagination on collection fetch | ⬜ Med | Full collection loads every time |
| 9 | D1 schema redesign for OAuth | ⬜ Low | Prerequisite for Google/Discord OAuth |
| 10 | Google + Discord OAuth | ⬜ Low | Depends on #9 |
| 11 | Email verification on signup | ⬜ Low | |
| 12 | Error monitoring (Sentry) | ⬜ Low | Add before public launch |
| 13 | Migrate eBay to REST Sell API | ⬜ Low | Trading API deprecated but functional |

### Feature Backlog

- ⬜ **Public collection sharing** — read-only URL, KEY FLYWHEEL FEATURE
- ⬜ Card value tracking over time + charts
- ⬜ Mark as sold — archive with date and price
- ⬜ Multi-AI — GPT-4o, Gemini, Ollama (BYOK)
- ⬜ Ximilar API — purpose-built card grading
- ⬜ Migrate eBay to REST Sell API
- ⬜ eBay Partner Network affiliate links
- ⬜ Privacy Policy, ToS, account deletion (GDPR), age gate (COPPA) — **required before public launch**
- ⬜ Freemium — free 500 cards, Pro $3.99/mo

---

## 🎨 Theme System (COMPLETE)

| ID | Name | Layout |
|----|------|--------|
| `classic` | Dark navy + gold | Header + tab nav |
| `light` | White + green | Sidebar |
| `dark` | Charcoal + green | Sidebar |
| `blue` | Navy sidebar + white content | Sidebar |
| `ice` | Full dark navy + teal | Sidebar |
| `hybrid` | **Ice sidebar + blue-white content (default)** | Sidebar |

### Key rules
- Views always live inside `.main-content` inside `.sidebar-shell`
- Classic hides sidebar chrome but keeps `.main-content` visible full width via `display: block !important`
- **Never add `display:none` to `.sidebar-shell` in Classic** — that hides all views
- Adding new views: `.view` div + `nav-btn` in classic nav + `sidebar-item` in sidebar + `VIEW_TITLES` entry

### Layout CSS pattern
```css
:root[data-theme="classic"] .sidebar-shell { display: block !important; width: 100%; }
:root[data-theme="classic"] .sidebar-nav { display: none !important; }
:root[data-theme="classic"] .sidebar-topbar { display: none !important; }
:root[data-theme="classic"] .main-content { display: block !important; width: 100%; }
:root:not([data-theme="classic"]) .sidebar-shell { display: flex !important; }
:root:not([data-theme="classic"]) header { display: none !important; }
:root:not([data-theme="classic"]) nav { display: none !important; }
```

---

## 🛠 Wrangler Quick Reference

```powershell
cd C:\Users\civ2g\icevault-worker

wrangler deploy
wrangler tail
wrangler tail --format pretty | Select-String "RATE LIMITED|ERROR|LOGIN_FAILED|MAILEROO|R2"

wrangler secret put MAILEROO_API_KEY
wrangler secret put EMAIL_FROM
wrangler secret list
wrangler secret delete SECRET_NAME

wrangler kv key list --namespace-id=94009b2958714bd88fc369c3a808997e

wrangler whoami
wrangler --version
npm install -g wrangler
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

### PowerShell D1 query tip
Single quotes inside double quotes work. For complex queries use ascii-encoded file:
```powershell
"YOUR SQL" | Out-File -FilePath query.sql -Encoding ascii
wrangler d1 execute icevault --remote --file query.sql
# Note: --file doesn't show SELECT results — use --command for queries
```

---

## 🗄 D1 Database Schema

```sql
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY, user_id TEXT NOT NULL, expires_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS password_resets (
  token TEXT PRIMARY KEY, user_id TEXT NOT NULL, expires_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS cards (
  id TEXT NOT NULL, user_id TEXT NOT NULL,
  card_data TEXT NOT NULL,  -- JSON: metadata + imageUrl (R2) or imageData (base64 legacy/guest)
  created_at TEXT NOT NULL, PRIMARY KEY (id, user_id)
);
CREATE TABLE IF NOT EXISTS request_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT, timestamp TEXT NOT NULL,
  ip TEXT NOT NULL, path TEXT NOT NULL, status INTEGER NOT NULL,
  event TEXT NOT NULL, detail TEXT, created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_logs_created_at ON request_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_logs_event ON request_logs(event);
CREATE INDEX IF NOT EXISTS idx_logs_ip ON request_logs(ip);
```

Password hash format: `pbkdf2$100000$salt$hash`.

---

## 🔍 D1 Operations Reference

### User & Account Queries

```powershell
# All users
wrangler d1 execute icevault --remote --command "SELECT email, id, created_at FROM users ORDER BY created_at ASC"

# Users with card counts and storage
wrangler d1 execute icevault --remote --command "SELECT u.email, u.id, COUNT(c.id) as cards, SUM(LENGTH(c.card_data)) as bytes FROM users u LEFT JOIN cards c ON c.user_id = u.id GROUP BY u.id"

# Card IDs and emails
wrangler d1 execute icevault --remote --command "SELECT u.email, c.id, c.user_id, LENGTH(c.card_data) as bytes FROM cards c JOIN users u ON u.id = c.user_id"

# Signup IPs (requires logs from after logging was added)
wrangler d1 execute icevault --remote --command "SELECT ip, event, detail, created_at FROM request_logs WHERE event = 'SIGNUP' ORDER BY created_at ASC"
```

### Account Management (Delete)

```powershell
# Full account delete — run in this order
wrangler d1 execute icevault --remote --command "DELETE FROM cards WHERE user_id = 'USER_ID'"
wrangler d1 execute icevault --remote --command "DELETE FROM sessions WHERE user_id = 'USER_ID'"
wrangler d1 execute icevault --remote --command "DELETE FROM password_resets WHERE user_id = 'USER_ID'"
wrangler d1 execute icevault --remote --command "DELETE FROM users WHERE id = 'USER_ID'"

# Verify
wrangler d1 execute icevault --remote --command "SELECT email, id FROM users"
```

### Log Queries

```powershell
# Rate limit hits by IP
wrangler d1 execute icevault --remote --command "SELECT ip, COUNT(*) as hits FROM request_logs WHERE event = 'RATE_LIMITED' GROUP BY ip ORDER BY hits DESC"

# Failed logins
wrangler d1 execute icevault --remote --command "SELECT ip, detail, COUNT(*) as attempts FROM request_logs WHERE event = 'LOGIN_FAILED' GROUP BY ip ORDER BY attempts DESC"

# Recent activity
wrangler d1 execute icevault --remote --command "SELECT ip, path, event, detail, created_at FROM request_logs ORDER BY created_at DESC LIMIT 20"

# Storage check
wrangler d1 execute icevault --remote --command "SELECT user_id, COUNT(*) as cards, SUM(LENGTH(card_data)) as bytes FROM cards GROUP BY user_id"
```

### R2 Operations

```powershell
# List objects in R2 bucket (via Cloudflare dashboard or wrangler)
wrangler r2 object list icevault-images

# Delete a specific image from R2
wrangler r2 object delete icevault-images cards/USER_ID/CARD_ID.jpg

# Check bucket usage — via Cloudflare dashboard → R2 → icevault-images → Metrics
```

### Image Migration Script
`migrate-images.js` — migrates base64 cards from D1 to R2. Usage:
```powershell
# Get auth token from DevTools → Application → Local Storage → iceVault_authToken
$env:IV_AUTH_TOKEN="your_token_here"
node C:\Users\civ2g\icevault-worker\migrate-images.js
```

---

## 📱 Android App Notes

- PWABuilder TWA wrapper — sideloaded, no Play Store
- Auto-updates when `index.html` changes
- Themes persist via localStorage in WebView

---

## 🔧 Key Technical Decisions

| Decision | Reason |
|----------|--------|
| R2 for images, D1 for metadata | D1 1MB row limit hit at ~3 cards with base64. R2 = zero egress, 10GB free, CDN cached |
| Guest mode keeps base64 locally | No auth token to upload to R2. Base64 never touches D1 in guest mode |
| migrateLocalImagesToR2 at sign-in | Prevents base64 ever landing in D1, handles guest-to-account flow |
| imageUrl \|\| imageData fallback | Backwards compatible — displays both R2 URLs and legacy base64 |
| R2 public bucket | `<img>` tags can't send auth headers. Card images aren't sensitive — URL not guessable |
| Sign out clears localStorage | Prevents card bleed-over between accounts on shared devices |
| Import is merge not replace | Existing cards preserved, duplicates skipped by ID |
| PBKDF2 password hashing | Built-in Web Crypto API — no library dependency. 100k iterations = CF Workers hard limit |
| Maileroo over Brevo | 3,000/mo free, sends to any email without custom domain |
| alertRateLimit fire-and-forget | No await — never delays the 429 response |
| Single HTML file | No build pipeline, maintainable at current scale |

---

## ⚠️ Known Issues & Limitations


- **Full collection resync:** Every save deletes and reinserts all cards. Fix: per-card sync (backlog #6)
- **eBay Trading API:** Legacy XML SOAP — deprecated but functional. Fix: REST migration (backlog #13)
- **Maileroo shared domain:** Emails land in junk on Gmail and Yahoo. Fix: custom domain (~$10/yr)
- **D1 transient errors:** Occasional startup errors — Cloudflare-side, self-resolves in seconds
- **Guest collections shared on shared devices:** localStorage has no user concept — by design, covered by UI warning
- **R2 public bucket:** Anyone with a URL can view an image. URLs are not guessable (userId + cardId) but not private
- **PowerShell D1 queries:** Use double quotes wrapping SQL with single quotes inside. `--file` doesn't show SELECT output

---

## 📞 Context for New Claude Sessions

> "I'm continuing development of Ice Vault — a hockey card manager web app + Android app.
> Stack: GitHub Pages (Ciiiv.github.io/icevault), Cloudflare Worker at C:\Users\civ2g\icevault-worker,
> D1 (icevault, ID: 3cacae20-fde1-4183-94af-eaa256eebb84),
> KV (RATE_LIMIT_KV, ID: 94009b2958714bd88fc369c3a808997e),
> R2 bucket icevault-images (public URL: https://pub-8fa31d4e964e401e8d40e2c4244f2868.r2.dev),
> Maileroo email (noreply@af4c1dd0a43e50da.maileroo.org).
>
> Worker: C:\Users\civ2g\icevault-worker\src\index.js — edit in VS Code, wrangler deploy.
> GitHub reference: icevault_worker.js (manually synced).
>
> Completed: PBKDF2-100k hashing, KV rate limiting (6 endpoints incl. change-password), rate limit alert emails,
> Maileroo email, 6-theme system (Hybrid default, sidebar layout), JSON/CSV export + JSON import,
> sign out clears localStorage, R2 image storage (front + back uploaded at save, guest migration
> at sign-in, imageUrl||imageData fallback), input validation on all worker endpoints.
>
> index.html ~2400 lines. Views inside .main-content inside .sidebar-shell always.
> Classic theme: sidebar-shell display:block, sidebar-nav/topbar hidden, main-content display:block full width.
> Never display:none the sidebar-shell in Classic — hides all views.
>
> Next priorities: public collection sharing (key flywheel feature), account deletion, mark as sold.
> Legal before public launch: Privacy Policy, ToS, account deletion, age gate.
>
> D1 ops: --remote flag, double quotes wrapping SQL, single quotes inside.
> See PROJECT_NOTES.md for full context."