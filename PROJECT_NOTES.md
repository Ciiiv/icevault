# Ice Vault — Project Notes
# Hockey card collection manager — AI scanning, condition grading, cert lookup, eBay listing, BYOK, open source
# For use at the start of new Claude conversations to provide full context

---

## 🌐 Live URLs

- **Web app:** https://Ciiiv.github.io/icevault
- **Cloudflare Worker:** https://lingering-breeze-fb87.mtouch01.workers.dev
- **GitHub repo:** https://github.com/Ciiiv/icevault

---

## 🏗 Full Stack

| Component | Service | Details |
|-----------|---------|---------|
| Web hosting | GitHub Pages | Auto-deploys from `docs/` on push to `main` |
| API proxy + Auth | Cloudflare Worker | `lingering-breeze-fb87` — deployed via Wrangler CLI |
| Database | Cloudflare D1 | Database name: `icevault`, ID: `3cacae20-fde1-4183-94af-eaa256eebb84` |
| Rate limiting | Cloudflare KV | Namespace: `RATE_LIMIT_KV`, ID: `94009b2958714bd88fc369c3a808997e` |
| Email | Maileroo | Transactional email — welcome + password reset. Free 3,000/mo. Sends to any email without custom domain. Sending domain: `af4c1dd0a43e50da.maileroo.org`, from: `noreply@af4c1dd0a43e50da.maileroo.org` |
| AI | Anthropic Claude | `claude-opus-4-5` model — card OCR, grading, eBay descriptions |
| Android app | PWABuilder | TWA wrapper — sideloaded APK, loads from GitHub Pages URL |
| Worker deployment | Wrangler CLI | Local project at `C:\Users\civ2g\icevault-worker` — requires Node.js (any recent LTS) |

---

## 🔑 Key IDs & Config (non-sensitive)

- **D1 Database ID:** `3cacae20-fde1-4183-94af-eaa256eebb84`
- **KV Namespace ID:** `94009b2958714bd88fc369c3a808997e`
- **Worker name:** `lingering-breeze-fb87`
- **GitHub username:** `Ciiiv`
- **Wrangler project path:** `C:\Users\civ2g\icevault-worker`
- **Maileroo sending domain:** `af4c1dd0a43e50da.maileroo.org`

---

## 🔐 Secrets (Cloudflare Worker Secrets — never in code or wrangler.toml)

- `MAILEROO_API_KEY` — Maileroo sending key (create at maileroo.com → Domains → Sending Keys)
- `EMAIL_FROM` — from address: `noreply@af4c1dd0a43e50da.maileroo.org`
- `ALERT_EMAIL` — optional, defaults to `mtouch01@gmail.com` if not set

---

## 📁 Repository Structure

```
icevault/                           ← Git repo (GitHub Pages)
├── docs/
│   ├── index.html                  # Entire app — HTML, CSS, JS (~2400 lines)
│   ├── manifest.json               # PWA manifest
│   ├── sw.js                       # Service worker
│   └── icons/
│       ├── icon-192.png
│       └── icon-512.png
├── icevault_worker.js              # Worker reference copy (manually synced)
├── .github/workflows/deploy.yml    # GitHub Actions auto-deploy
├── README.md
└── PROJECT_NOTES.md

icevault-worker\                    ← Separate folder, NOT a git repo
└── src\index.js                    # Actual deployed worker source — edit here, wrangler deploy
```

---

## ✅ What's Built & Working

### App Features
- Card scanning — front + back photo support, AI reads both images in one API call
- Parallel and serial number detection from back of card
- AI condition estimate — PSA-style 1–10, weighted 70% front / 30% back (labeled "AI Est." not PSA grade)
- Optional eBay description checkbox at scan time — generates in same API call as scan
- Graded cert lookup — Option A (AI slab scan front+back) + Option B (free QR/cert # → registry link)
- 8 grading companies: PSA, BGS, SGC, CGC, Authority, TAG, KSA, HGA
- Collection management — grid view, search, filter, sort, tags, lightbox image viewer
- **Export JSON** — full lossless backup including images, all fields, reimportable
- **Export CSV** — 22-column flat file, no images, opens in Excel/Google Sheets
- **Import JSON** — merges backup into current collection, skips duplicates by ID, syncs to cloud
- eBay listing with AI description generation
- eBay Sold Listings + 130point market research buttons
- eBay Trading API XML integration (legacy — functional, deprecation risk)
- User accounts with email/password auth
- Cloud sync to Cloudflare D1
- Guest mode with red warning on save buttons
- **Sign out clears local collection** — prevents card bleed-over between accounts on shared devices
- Password reset via email (Maileroo — works for all email providers, no custom domain needed)
- Welcome email on signup (Maileroo)
- 6-theme system — see Theme System section below
- PWA manifest + service worker
- Android APK via PWABuilder (sideloaded, auto-updates with index.html)
- AI grade disclaimers and liability warnings on all grade displays
- Cost warnings on all API call buttons

### Security Completed
- ✅ PBKDF2-HMAC-SHA256 password hashing — 100k iterations (CF Workers Web Crypto hard limit). OWASP compliant, ~3ms CPU, no library dependency
- ✅ Legacy bcrypt support — detects `$2a$/$2b$` hashes, falls back to bcryptjs, migrates naturally on password reset
- ✅ Rate limiting — KV sliding window on ALL auth endpoints + proxy:
  - `/auth/login` — 10 attempts / 15 min
  - `/auth/signup` — 5 attempts / hr
  - `/auth/forgot` — 5 attempts / hr
  - `/auth/reset` — 10 attempts / hr
  - `/proxy` (AI scan) — 100 requests / hr
- ✅ Rate limit alert emails — `alertRateLimit()` fires on every rate limit hit, deduped via KV (1 email per IP per endpoint per hour). Email includes IP, endpoint, timestamp, and ready-to-paste D1 query
- ✅ Login fail delay — 100ms artificial delay on failed login
- ✅ Timing attack prevention — always runs full PBKDF2 verify even when user not found
- ✅ D1 request logging — events: RATE_LIMITED, LOGIN_FAILED, LOGIN_OK, SIGNUP, ERROR, PASSWORD_RESET_SENT, PASSWORD_RESET_OK
- ✅ 7-day log retention — auto-purged on ~2% of requests via `maybePurgeLogs()`
- ✅ IPv4 preference — uses `CF-Connecting-IPv4` header, falls back to `CF-Connecting-IP`
- ✅ Origin check on worker
- ✅ Sign out clears localStorage — prevents account data bleed-over on shared devices

---

## 🔄 Pending / Backlog

### Security & Architecture

| # | Item | Status | Notes |
|---|------|--------|-------|
| 1 | Password hashing | ✅ Done | PBKDF2-HMAC-SHA256 100k iterations |
| 2 | Rate limiting | ✅ Done | KV sliding window on all 5 endpoints |
| 3 | Rate limit alerting | ✅ Done | Alert emails via Maileroo, KV deduped |
| 4 | Move card images to Cloudflare R2 | ⬜ Next | Base64 in D1 hits 1MB row limit — ~500–800 cards max |
| 5 | Input validation on all worker endpoints | ⬜ High | No sanitization currently — SQL injection + oversized payload risk |
| 6 | Per-card collection sync | ⬜ Med | Full delete+reinsert on every save — O(n) writes |
| 7 | Session cleanup job | ⬜ Med | Expired sessions accumulate in D1 indefinitely |
| 8 | Pagination on collection fetch | ⬜ Med | Full collection loads every time |
| 9 | D1 schema redesign for OAuth | ⬜ Low | Add `auth_providers` table — prerequisite for Google/Discord OAuth |
| 10 | Google + Discord OAuth | ⬜ Low | Depends on #9 schema first |
| 11 | Email verification on signup | ⬜ Low | Lower priority if OAuth adoption is high |
| 12 | Error monitoring (Sentry) | ⬜ Low | Add before public launch |
| 13 | Migrate eBay to REST Sell API | ⬜ Low | Trading API is legacy XML — functional but deprecated by eBay |

### Feature Backlog

#### Collection & Sharing
- ⬜ **Public collection sharing** — read-only URL per account (`?collection=TOKEN`). KEY FLYWHEEL FEATURE — no account needed to view
- ⬜ Card value tracking over time + historical price charts
- ⬜ Mark as sold — archive with date and price

#### AI & Scanning
- ⬜ Multi-AI support — GPT-4o, Gemini, local Ollama (BYOK for all, user picks in Settings)
- ⬜ Ximilar API — purpose-built card grading, better for foil/refractor. Claude OCR + Ximilar condition grade hybrid
- ⬜ Photography tips popup for better scan results

#### Selling
- ⬜ Migrate eBay to REST Sell API (Inventory API + Listing API — JSON, OAuth 2.0, not deprecated)
- ⬜ Bulk eBay listing — list multiple cards at once
- ⬜ eBay Partner Network affiliate links — passive income, zero effort

#### Legal (required before public launch)
- ⬜ Privacy Policy
- ⬜ Terms of Service
- ⬜ Account deletion — GDPR right to erasure
- ⬜ Age gate 13+ — COPPA

#### Monetisation
- ⬜ Freemium — free 500 cards, Pro $3.99/mo

---

## 🎨 Theme System (COMPLETE)

Six themes in `docs/index.html`. Hybrid is the default for new users.

| ID | Name | Sidebar | Content | Layout |
|----|------|---------|---------|--------|
| `classic` | Classic | — | Dark navy `#0A1628` + gold | Header + tab nav |
| `light` | Light | Off-white `#fafaf8` | White + green accent | Sidebar |
| `dark` | Dark | Charcoal `#1a1a1a` | Dark `#141414` + green | Sidebar |
| `blue` | Vibrant Blue | Navy gradient | White + blue tones | Sidebar |
| `ice` | Ice | Dark navy gradient | Dark navy + teal | Sidebar |
| `hybrid` | **Hybrid (default)** | Ice dark sidebar | White + blue tones | Sidebar |

### How it works
- Theme saved to `localStorage('icevault-theme')`, default `'hybrid'`
- IIFE at top of `<head>` sets `data-theme` on `<html>` before render — prevents flash
- `setTheme(id)` — updates `data-theme`, saves, syncs both classic nav + sidebar nav
- Theme picker rendered via `renderThemePicker()` — injected into Settings modal on open
- `--sb-*` vars for sidebar, `--mc-*` vars for main content area

### Layout switching
```css
/* Classic: header + tab nav visible, sidebar chrome hidden, main-content full width */
:root[data-theme="classic"] header { display: flex !important; }
:root[data-theme="classic"] nav { display: flex !important; }
:root[data-theme="classic"] .sidebar-shell { display: block !important; width: 100%; }
:root[data-theme="classic"] .sidebar-nav { display: none !important; }
:root[data-theme="classic"] .sidebar-topbar { display: none !important; }
:root[data-theme="classic"] .main-content { display: block !important; background: transparent; width: 100%; }

/* Themes 1-5: sidebar shell is flex, header + classic nav hidden */
:root:not([data-theme="classic"]) .sidebar-shell { display: flex !important; }
:root:not([data-theme="classic"]) header { display: none !important; }
:root:not([data-theme="classic"]) nav { display: none !important; }
```

**Important:** Views always live inside `.main-content` which is always in the DOM. Classic hides the sidebar chrome but keeps `.main-content` visible full width. Never add `display:none` to `.sidebar-shell` in Classic — that hides all views.

### Adding a new view
1. `<div class="view" id="view-{name}">` inside `.main-content`
2. `<button class="nav-btn" onclick="switchView('{name}')" id="nav-{name}">` in Classic `<nav>`
3. `<button class="sidebar-item" id="sb-{name}" onclick="switchView('{name}')">` in sidebar
4. `'{name}': 'Display Title'` in `VIEW_TITLES` map in JS

### Mobile drawer
On <768px: sidebar-nav hides, hamburger ☰ in topbar adds `drawer-open` class to `#sidebarShell`. Overlay click and Escape close it.

---

## 🛠 Wrangler Quick Reference

```powershell
cd C:\Users\civ2g\icevault-worker

wrangler deploy                    # deploy worker
wrangler tail                      # live logs (~3hr session)
wrangler tail --format pretty | Select-String "RATE LIMITED|ERROR|LOGIN_FAILED|MAILEROO"

wrangler secret put MAILEROO_API_KEY   # add/update Maileroo key
wrangler secret put EMAIL_FROM         # add/update from address
wrangler secret list                   # list secret names (not values)
wrangler secret delete SECRET_NAME     # remove a secret

wrangler kv key list --namespace-id=94009b2958714bd88fc369c3a808997e

wrangler whoami
wrangler --version
npm install -g wrangler             # update wrangler
```

### D1 queries — PowerShell note
Single quotes inside double quotes work fine. For complex queries with single-quoted strings use ascii-encoded .sql files:
```powershell
"YOUR SQL HERE" | Out-File -FilePath query.sql -Encoding ascii
wrangler d1 execute icevault --remote --file query.sql
# Note: --file runs in import mode — use --command for SELECT output
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
```

---

## 🗄 D1 Database Schema

```sql
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS password_resets (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS cards (
  id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  card_data TEXT NOT NULL,  -- JSON blob, includes base64 imageData (pre-R2) or imageUrl (post-R2)
  created_at TEXT NOT NULL,
  PRIMARY KEY (id, user_id)
);
CREATE TABLE IF NOT EXISTS request_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TEXT NOT NULL,
  ip TEXT NOT NULL,
  path TEXT NOT NULL,
  status INTEGER NOT NULL,
  event TEXT NOT NULL,
  detail TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_logs_created_at ON request_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_logs_event ON request_logs(event);
CREATE INDEX IF NOT EXISTS idx_logs_ip ON request_logs(ip);
```

Password hash format: `pbkdf2$100000$salt$hash`. Legacy bcrypt `$2a$/$2b$` still supported via fallback.

---

## 🔍 D1 Operations Reference

All commands use `--remote` to hit live D1. Use double quotes around the command, single quotes inside SQL strings.

### User & Account Queries

```powershell
# List all users
wrangler d1 execute icevault --remote --command "SELECT email, id, created_at FROM users ORDER BY created_at ASC"

# Users with card counts and total storage
wrangler d1 execute icevault --remote --command "SELECT u.email, u.id, COUNT(c.id) as cards, SUM(LENGTH(c.card_data)) as bytes FROM users u LEFT JOIN cards c ON c.user_id = u.id GROUP BY u.id"

# Cards per user with storage size
wrangler d1 execute icevault --remote --command "SELECT user_id, COUNT(*) as cards, SUM(LENGTH(card_data)) as total_bytes FROM cards GROUP BY user_id"

# Show card IDs and emails together
wrangler d1 execute icevault --remote --command "SELECT u.email, c.id, c.user_id, LENGTH(c.card_data) as bytes FROM cards c JOIN users u ON u.id = c.user_id"

# Find signup IP for an account (requires logs from after logging was added)
wrangler d1 execute icevault --remote --command "SELECT ip, event, detail, created_at FROM request_logs WHERE event = 'SIGNUP' ORDER BY created_at ASC"
```

### Account Management (Delete)

```powershell
# Delete a user's cards
wrangler d1 execute icevault --remote --command "DELETE FROM cards WHERE user_id = 'USER_ID_HERE'"

# Delete a user's sessions
wrangler d1 execute icevault --remote --command "DELETE FROM sessions WHERE user_id = 'USER_ID_HERE'"

# Delete a user's password reset tokens
wrangler d1 execute icevault --remote --command "DELETE FROM password_resets WHERE user_id = 'USER_ID_HERE'"

# Delete the user account
wrangler d1 execute icevault --remote --command "DELETE FROM users WHERE id = 'USER_ID_HERE'"

# Or delete by email
wrangler d1 execute icevault --remote --command "DELETE FROM users WHERE email = 'user@example.com'"

# Verify deletion
wrangler d1 execute icevault --remote --command "SELECT email, id FROM users"
```

### Log Queries

```powershell
# Rate limit hits by IP
wrangler d1 execute icevault --remote --command "SELECT ip, COUNT(*) as hits FROM request_logs WHERE event = 'RATE_LIMITED' GROUP BY ip ORDER BY hits DESC"

# Failed logins by IP
wrangler d1 execute icevault --remote --command "SELECT ip, detail, COUNT(*) as attempts FROM request_logs WHERE event = 'LOGIN_FAILED' GROUP BY ip ORDER BY attempts DESC"

# Recent activity
wrangler d1 execute icevault --remote --command "SELECT ip, path, event, detail, created_at FROM request_logs ORDER BY created_at DESC LIMIT 20"

# Signups over time
wrangler d1 execute icevault --remote --command "SELECT DATE(created_at) as date, COUNT(*) as signups FROM request_logs WHERE event = 'SIGNUP' GROUP BY DATE(created_at) ORDER BY date DESC"

# Manual log purge (runs automatically on ~2% of requests)
wrangler d1 execute icevault --remote --command "DELETE FROM request_logs WHERE created_at < datetime('now', '-7 days')"

# Database size overview
wrangler d1 execute icevault --remote --command "SELECT COUNT(*) as users FROM users"
wrangler d1 execute icevault --remote --command "SELECT COUNT(*) as cards, SUM(LENGTH(card_data)) as total_bytes FROM cards"
```

---

## 📱 Android App Notes

- Built with PWABuilder — TWA wrapper around GitHub Pages URL
- Sideloaded APK — no Play Store
- Auto-updates when `index.html` changes — no APK rebuild needed
- Camera works via browser `getUserMedia`
- Themes persist via localStorage in WebView

---

## 🔧 Key Technical Decisions

| Decision | Reason |
|----------|--------|
| Single HTML file | No build pipeline, easy to deploy, maintainable at current scale |
| Cloudflare Workers + D1 | Generous free tier, all in one ecosystem, Wrangler CLI |
| PBKDF2 over bcrypt | Uses built-in Web Crypto API — no library dependency. bcryptjs only loaded lazily for legacy migration |
| 100k iterations (not 200k) | CF Workers Web Crypto hard limit — 200k throws an error |
| Maileroo for email | 3,000/mo free, sends to any email without custom domain — unlike Brevo which requires verified domain |
| Trading API for eBay | REST migration is low priority — Trading API still functional |
| Guest mode | Better UX than forcing accounts upfront |
| API keys local only | Privacy — keys never touch our servers |
| PWABuilder over Capacitor | No Android Studio needed, 5 min APK, auto-updates with web app |
| alertRateLimit fire-and-forget | No await — never delays the 429 response back to the attacker |
| Sign out clears localStorage | Prevents card bleed-over between accounts on shared devices |
| JSON export includes images | Lossless backup — base64 imageData preserved for full restore |
| CSV export excludes images | Base64 would make file huge and Excel can't display them anyway |
| Import is merge not replace | Existing cards preserved, duplicates skipped by ID |

---

## ⚠️ Known Issues & Limitations

- **Images in D1:** Base64 blobs — 1MB row limit at scale (~500–800 cards). Fix: R2 migration (backlog #4) — NEXT UP
- **No input validation:** Worker endpoints have no sanitization. Fix: backlog #5
- **Full collection resync:** Every save deletes and reinserts entire collection. Fix: per-card sync (backlog #6)
- **eBay Trading API:** Legacy XML SOAP — deprecated by eBay but still functional. Fix: REST migration (backlog #13)
- **Maileroo shared domain:** Emails come from `noreply@af4c1dd0a43e50da.maileroo.org` — lands in junk on Gmail and Yahoo. Fix: add custom domain to Maileroo (~$10/yr for domain)
- **D1 transient errors:** Occasional `D1_ERROR: Internal error while starting up` — Cloudflare-side, self-resolves in seconds, rare
- **Guest collections shared on shared devices:** localStorage has no user concept — two guests on the same device share the same collection. By design/limitation, covered by guest warning in UI
- **PowerShell D1 queries:** Nested quotes cause issues. Use double quotes wrapping SQL with single quotes inside. `--file` mode doesn't display SELECT output — use `--command` for queries

---

## 📞 Context for New Claude Sessions

Paste this at the start of a new conversation:

> "I'm continuing development of Ice Vault — a hockey card manager web app + Android app.
> Stack: GitHub Pages (Ciiiv.github.io/icevault), Cloudflare Worker at C:\Users\civ2g\icevault-worker,
> D1 database (icevault, ID: 3cacae20-fde1-4183-94af-eaa256eebb84),
> KV namespace (RATE_LIMIT_KV, ID: 94009b2958714bd88fc369c3a808997e),
> Maileroo for email (free tier, any recipient, from noreply@af4c1dd0a43e50da.maileroo.org).
>
> Worker file: C:\Users\civ2g\icevault-worker\src\index.js — edit in VS Code, wrangler deploy.
> GitHub reference copy: icevault_worker.js in repo (manually synced, not a git repo).
>
> Completed: PBKDF2-100k password hashing, KV rate limiting on all 5 endpoints (login/signup/forgot/reset/proxy),
> rate limit alert emails via alertRateLimit() (KV deduped, fire-and-forget), Maileroo email (Brevo removed),
> 6-theme system (Hybrid default — ice dark sidebar + vibrant blue content, Classic preserved,
> sidebar + mobile drawer layout for themes 1-5, theme picker in Settings modal),
> JSON/CSV export + JSON import in collection view, sign out clears localStorage.
>
> index.html is ~2400 lines. Theme switching: data-theme on html element, IIFE in head prevents flash,
> setTheme() syncs both classic nav and sidebar nav. Views always live inside .main-content inside
> .sidebar-shell — Classic hides sidebar chrome but keeps .main-content visible full width.
> Adding new views: .view div + nav-btn in classic nav + sidebar-item in sidebar + VIEW_TITLES map entry.
>
> Next up: R2 image migration (backlog #4) — base64 images in D1 rows hit 1MB limit at ~500 cards.
> Also high priority: input validation on worker endpoints.
> Legal required before public launch: Privacy Policy, ToS, account deletion, age gate.
>
> D1 ops: use --remote flag, double quotes around command, single quotes inside SQL.
> See PROJECT_NOTES.md in GitHub repo (Ciiiv/icevault) for full D1 ops reference and all context."