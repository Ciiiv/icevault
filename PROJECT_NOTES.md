# Ice Vault — Project Notes
# For use at the start of new Claude conversations to provide full context

---

## 🌐 Live URLs

- **Web app:** https://Ciiiv.github.io/icevault
- **Cloudflare Worker:** https://lingering-breeze-fb87.workers.dev (check Cloudflare dashboard for full URL)
- **GitHub repo:** https://github.com/Ciiiv/icevault

---

## 🏗 Full Stack

| Component | Service | Details |
|-----------|---------|---------|
| Web hosting | GitHub Pages | Auto-deploys from `docs/` on push to `main` via `.github/workflows/deploy.yml` |
| API proxy + Auth | Cloudflare Worker | `lingering-breeze-fb87` — deployed via Wrangler CLI |
| Database | Cloudflare D1 | Database name: `icevault`, ID: `3cacae20-fde1-4183-94af-eaa256eebb84` |
| Email | Brevo | Transactional email — welcome + password reset. Requires verified domain to send to all users |
| AI | Anthropic Claude | `claude-opus-4-5` model — card OCR, grading, eBay descriptions |
| Android app | PWABuilder | TWA wrapper — sideloaded APK, loads from GitHub Pages URL |
| Worker deployment | Wrangler CLI | Local project at `C:\Users\civ2g\icevault-worker` |

---

## 🔑 Key IDs & Config (non-sensitive)

- **D1 Database ID:** `3cacae20-fde1-4183-94af-eaa256eebb84`
- **Worker name:** `lingering-breeze-fb87`
- **GitHub username:** `Ciiiv`
- **Wrangler project path:** `C:\Users\civ2g\icevault-worker`
- **wrangler.toml main:** `src/index.js`
- **Node.js version:** v24.15.0
- **Wrangler version:** 4.84.0

---

## 🔐 Secrets (stored in Cloudflare Worker Secrets — never in code)

- `DB` — D1 database binding
- `BREVO_API_KEY` — Brevo transactional email API key

---

## 📁 Repository Structure

```
icevault/
├── docs/
│   ├── index.html          # Entire app — HTML, CSS, JS in one file (~3100 lines)
│   ├── manifest.json       # PWA manifest
│   ├── sw.js               # Service worker (network-first for HTML, cache-first for assets)
│   └── icons/
│       ├── icon-192.png
│       └── icon-512.png
├── icevault-worker.js      # Cloudflare Worker source (reference copy for forkers)
├── .github/workflows/
│   └── deploy.yml          # GitHub Actions auto-deploy
├── README.md               # Public-facing documentation
└── PROJECT_NOTES.md        # Internal project context for Claude sessions
```

---

## ✅ What's Built & Working

### App Features
- Card scanning — front + back photo support, AI reads both images in one call
- Parallel and serial number detection from back of card
- AI condition estimate — PSA-style 1–10, weighted 70% front / 30% back (labeled "AI Est." not PSA grade)
- Optional eBay description checkbox at scan time — generates in same API call as scan
- Graded cert lookup — Option A (AI slab scan front+back) + Option B (free QR/cert # → registry link)
- 8 grading companies: PSA, BGS, SGC, CGC, Authority, TAG, KSA, HGA
- Collection management — grid view, search, filter, sort, tags, lightbox image viewer
- Tag filtering bar in collection view
- eBay listing with AI description generation (separate call or pre-generated at scan time)
- eBay Sold Listings + 130point market research buttons
- User accounts with email/password auth
- Cloud sync to Cloudflare D1
- Guest mode with red warning on save buttons
- Password reset via email (Brevo — own verified email only without custom domain)
- Password visibility toggle on all password fields
- bcrypt password hashing (cost factor 12)
- Timing attack prevention on login
- Origin check on Cloudflare Worker
- PWA manifest + service worker (network-first caching)
- Android APK via PWABuilder (sideloaded, working — auto-updates with index.html)
- Auto-syncs collection on login/signup
- Cost warnings on all API call buttons
- AI grade disclaimers on scan, collection, eBay, cert lookup tabs + card detail modal
- Liability disclaimer on all AI grade displays

### Security Completed
- ✅ Priority #1 — bcrypt replacing SHA-256 (deployed via Wrangler)

---

## 🔄 Pending / In Progress

### Security Priority List (from architecture review)
- ⬜ Priority #2 — Rate limiting on auth + proxy endpoints (Cloudflare Workers KV)
- ⬜ Priority #3 — Move card images to Cloudflare R2 (currently stored as base64 in D1)
- ⬜ Priority #4 — Per-card collection sync (currently full delete+reinsert on every save)
- ⬜ Priority #5 — Email verification on signup
- ⬜ Priority #6 — Session cleanup job (expired sessions accumulate in D1)
- ⬜ Priority #7 — Input validation on all worker endpoints
- ⬜ Priority #8 — Pagination on collection fetch
- ⬜ Priority #9 — Migrate to component-based frontend
- ⬜ Priority #10 — Error monitoring (Sentry)
- ⬜ Priority #11 — Migrate eBay to REST API (Trading API is legacy)

### Features Backlog
- ⬜ Collection sharing — public URL per account (e.g. `?collection=TOKEN`)
- ⬜ Google OAuth login
- ⬜ Export collection to CSV
- ⬜ Card value tracking over time
- ✅ **Front + back card scanning** — implemented, both raw and graded slab
- ✅ **Combined single API call** — OCR + grade + optional eBay description in one call
- ✅ **Optional eBay description at scan time** — checkbox before scanning, default off
- ⬜ **Maileroo email** — investigate as free alternative to Brevo that allows sending to any email without custom domain (3,000/month free, uses shared maileroo.org domain). Some Outlook/Hotmail deliverability issues noted
- ⬜ Photography tips popup — guidance for better scan results especially foil/refractor cards (diffused lighting, slight angle, polarizing filter)
- ⬜ Allow ChatGPT / other AI models as alternative to Claude
- ⬜ Ximilar API integration — purpose-built card grading API, better than Claude for condition assessment, supports hockey cards, has free tier credits. Use alongside Claude OCR (Claude reads text, Ximilar grades condition)
- ⬜ Privacy Policy + Terms of Service
- ⬜ Account deletion feature (GDPR right to erasure)
- ⬜ Age gate (13+ COPPA requirement)

---

## ⚠️ Known Issues & Limitations

### Email
- Brevo free tier requires a verified custom domain to send to arbitrary email addresses
- Without a domain, emails only work to your own Brevo-verified sender address
- **Impact:** Password reset doesn't work for other users until domain is added
- **Fix:** Buy a domain (~$10/yr at Cloudflare Registrar), verify in Brevo

### Architecture (from senior review)
- Images stored as base64 in D1 — won't scale, hits 1MB row limit
- Full collection resync on every save — O(n) writes
- Single HTML file — maintainable for now, needs refactor for commercial scale
- No rate limiting — auth endpoints vulnerable to brute force
- localStorage for API keys — vulnerable to XSS (acceptable for current scope)

---

## 🛠 How to Deploy Worker Updates

```powershell
cd C:\Users\civ2g\icevault-worker
# Edit src/index.js in VS Code
wrangler deploy
# To update secrets:
wrangler secret put BREVO_API_KEY
# To view logs in real time:
wrangler tail
# To list secrets:
wrangler secret list
```

---

## 🗄 D1 Database Schema

```sql
users (id, email, password_hash, created_at)
sessions (token, user_id, expires_at)
password_resets (token, user_id, expires_at)
cards (id, user_id, card_data, created_at)
```

Passwords: bcrypt `$2b$12$...` format. Login normalizes `$2b$` → `$2a$` for compatibility.

---

## 📱 Android App Notes

- Built with PWABuilder — TWA wrapper around GitHub Pages URL
- Sideloaded APK — no Play Store
- Auto-updates when `index.html` changes — no APK rebuild needed
- Camera works via browser `getUserMedia` (not native camera)
- Tested and working: login, collection sync, card scanning

---

## 🔧 Key Technical Decisions & Why

| Decision | Reason |
|----------|--------|
| Single HTML file | Easy to deploy anywhere, no build pipeline needed for hobby scale |
| Cloudflare Workers + D1 | Free tier generous, all in one ecosystem, Wrangler CLI deployment |
| bcrypt over SHA-256 | SHA-256 is a fast hash — bcrypt is intentionally slow, brute force resistant |
| Brevo over Resend | Started with Resend but switched — both require a verified custom domain to send to arbitrary email addresses on free tier. Brevo has 300 emails/day free vs Resend's limitations. Neither works for all users without a domain (~$10/yr). |
| PWABuilder over Capacitor | No Android Studio needed, 5 minute APK generation, auto-updates with web app |
| Guest mode | Better UX than forcing accounts, localStorage collection still useful |
| API keys local only | Privacy — keys never touch our servers, users own their API costs |
| Origin check on worker | Prevents casual abuse of Anthropic proxy by random domains |

---

## 🎨 UI Themes — 5 Official Choices

Five approved themes for Ice Vault. All use the same layout (desktop sidebar + main content). To implement, use CSS variables on `:root[data-theme="name"]`. Saved to localStorage, applied on load.

---

### Theme 1 — Light (current app)
Clean, minimal. Green accents throughout.

| Element | Value |
|---------|-------|
| Page background | `#f5f5f2` |
| Sidebar background | `#fafaf8` |
| Sidebar border | `#e8e8e0` |
| Logo accent ("Vault") | `#1a8c50` |
| Nav item inactive | `#666` |
| Nav item active bg | `#e8f7ef` |
| Nav item active text | `#0f6e56` |
| Nav badge | bg `#efefeb` text `#888` |
| User avatar | bg `#e8f7ef` text `#0f6e56` |
| Main background | `white` |
| Topbar border | `#efefeb` |
| Page title | `#1a1a1a` |
| Secondary button | bg `white` border `#ddd` text `#444` |
| Primary button | bg `#1a8c50` text `white` |
| Stat card bg | `#f5f5f2` |
| Stat value | `#1a1a1a` |
| Stat label | `#888` |
| Stat delta | `#1a8c50` |
| Filter pill active | bg `#e8f7ef` border `#9fe1cb` text `#0f6e56` |
| Table header | `#888` border `#efefeb` |
| Table row border | `#f0f0ec` |
| Table text | `#1a1a1a` |
| Table hover | `#fafaf8` |
| Value/price color | `#1a8c50` |
| AI grade badge | bg `#e8f7ef` text `#0f6e56` |
| PSA grade badge | bg `#e6f1fb` text `#185fa5` |
| Parallel tag | bg `#faeeda` text `#633806` |
| Action button | bg `white` border `#ddd` text `#666` |
| Action button primary | bg `#1a8c50` text `white` |
| Card thumbnails | Bright colorful gradients |

---

### Theme 2 — Dark
Charcoal dark with bright green accents.

| Element | Value |
|---------|-------|
| Browser bar | `#111` |
| Page / main background | `#141414` |
| Sidebar background | `#1a1a1a` |
| Sidebar border | `#252525` |
| Logo accent | `#4ade80` |
| Nav item inactive | `#666` |
| Nav item active bg | `#0d2e1a` |
| Nav item active text | `#4ade80` |
| Nav badge | bg `#252525` text `#555` |
| User avatar | bg `#0d2e1a` text `#4ade80` |
| Topbar background | `#141414` |
| Topbar border | `#222` |
| Page title | `#f0f0f0` |
| Secondary button | bg `#1e1e1e` border `#2a2a2a` text `#888` |
| Primary button | bg `#1a8c50` text `white` |
| Stat card | bg `#1e1e1e` border `#2a2a2a` |
| Stat value | `#f0f0f0` |
| Stat label | `#555` |
| Stat delta | `#4ade80` |
| Filter pill active | bg `#0d2e1a` border `#1a5c30` text `#4ade80` |
| Table header | `#555` border `#222` |
| Table row border | `#1e1e1e` |
| Table text | `#ccc` |
| Table hover | `#1a1a1a` |
| Value/price color | `#4ade80` |
| AI grade badge | bg `#0d2e1a` text `#4ade80` |
| PSA grade badge | bg `#042c53` text `#85b7eb` |
| Parallel tag | bg `#412402` text `#fac775` |
| Action button | bg `#1a1a1a` border `#2a2a2a` text `#666` |
| Action button primary | bg `#1a8c50` text `white` |
| Card thumbnails | Dark muted gradients matching their colors |

---

### Theme 3 — Vibrant Blue
Navy/blue sidebar, white content area, blue tones.

| Element | Value |
|---------|-------|
| Browser bar | `#e8f0ff` |
| Page background | `#f0f4ff` |
| Sidebar background | `linear-gradient(180deg, #0a2a6e, #0d3580)` |
| Sidebar border | `#1a4a9e` |
| Logo accent | `#7dd3fc` |
| Nav item inactive | `rgba(255,255,255,.5)` |
| Nav item active bg | `rgba(255,255,255,.15)` |
| Nav item active text | `white` |
| Nav badge | bg `rgba(255,255,255,.15)` text `rgba(255,255,255,.8)` |
| User avatar | bg `rgba(255,255,255,.2)` text `white` |
| Main background | `white` |
| Topbar border | `#e0e8ff` |
| Page title | `#0a1a5e` |
| Secondary button | bg `white` border `#c8d8ff` text `#3a5aa0` |
| Primary button | bg `#0a2a6e` text `white` |
| Stat card | bg `#f0f4ff` border `#dce8ff` |
| Stat value | `#0a1a5e` |
| Stat label | `#6b7fb5` |
| Stat delta | `#1a8c50` |
| Filter pill active | bg `#0a2a6e` border `#0a2a6e` text `white` |
| Table header | `#8899cc` border `#e0e8ff` |
| Table row border | `#eef2ff` |
| Table text | `#0a1a5e` |
| Table hover | `#f8f9ff` |
| Value/price color | `#0a6a3a` |
| AI grade badge | bg `#e8f7ef` text `#0f6e56` |
| PSA grade badge | bg `#dbeafe` text `#1e40af` |
| Parallel tag | bg `#fef3c7` text `#92400e` |
| Action button primary | bg `#0a2a6e` text `white` |
| Card thumbnails | Bright colorful gradients |

---

### Theme 4 — Ice (full dark)
Deep navy everything with teal/cyan accents. Most "hockey" feeling.

| Element | Value |
|---------|-------|
| Browser bar | `#071524` |
| URL bar | bg `#0d2a3e` border `#1a4a6a` text `#5dd8f0` |
| Page / main background | `#0d1a26` |
| Sidebar background | `linear-gradient(180deg, #071524, #0a1f2e)` |
| Sidebar border | `#1a3a4a` |
| Logo accent | `#5dd8f0` |
| Nav item inactive | `rgba(255,255,255,.35)` |
| Nav item active bg | `rgba(93,216,240,.12)` border `rgba(93,216,240,.2)` |
| Nav item active text | `#5dd8f0` |
| Nav badge | bg `rgba(93,216,240,.15)` text `#5dd8f0` |
| User avatar | bg `rgba(93,216,240,.2)` border `rgba(93,216,240,.25)` text `#5dd8f0` |
| Topbar background | `#0a1f2e` |
| Topbar border | `#1a3a4a` |
| Page title | `#c0e8f8` |
| Secondary button | bg `rgba(93,216,240,.06)` border `#1a3a4a` text `#5a9eac` |
| Primary button | `linear-gradient(135deg, #0a8a9a, #0d6e8e)` text `white` |
| Stat card | bg `#0a1f2e` border `#1a3a4a` |
| Stat value | `#c0e8f8` |
| Stat label | `#3a6a7a` |
| Stat delta | `#5dd8f0` |
| Filter pill active | bg `rgba(93,216,240,.12)` border `rgba(93,216,240,.3)` text `#5dd8f0` |
| Table header | `#3a6a7a` border `#1a3a4a` |
| Table row border | `#12253a` |
| Table text | `#a0cce0` |
| Table hover | `rgba(93,216,240,.04)` |
| Value/price color | `#5dd8f0` |
| AI grade badge | bg `rgba(93,216,240,.12)` text `#5dd8f0` |
| PSA grade badge | bg `#042c53` text `#85b7eb` |
| Parallel tag | bg `rgba(239,159,39,.1)` text `#ef9f27` |
| Action button | bg `rgba(93,216,240,.04)` border `#1a3a4a` text `#3a7a8a` |
| Action button primary | `linear-gradient(135deg, #0a8a9a, #0d6e8e)` text `white` |
| Card thumbnails | Dark deep-tone gradients (navy, dark teal, dark wine, dark purple) |

---

### Theme 5 — Hybrid (ice dark sidebar + vibrant blue content)
Identical ice sidebar to Theme 4. White content area with blue tones from Theme 3. Teal accent buttons.

| Element | Value |
|---------|-------|
| Sidebar | Identical to Theme 4 — all same values |
| Page / main background | `white` |
| Topbar | bg `white` border `#e0e8ff` |
| Page title | `#0a1a5e` |
| Secondary button | bg `white` border `#c8d8ff` text `#3a5aa0` |
| Primary button | `linear-gradient(135deg, #0a8a9a, #0d6e8e)` text `white` |
| Stat card | bg `#f0f4ff` border `#dce8ff` |
| Stat value | `#0a1a5e` |
| Stat label | `#6b7fb5` |
| Stat delta | `#0a8a9a` |
| Filter pill active | bg `#0a1f2e` border `#0a1f2e` text `#5dd8f0` |
| Table header | `#8899cc` border `#e0e8ff` |
| Table row border | `#eef2ff` |
| Table text | `#0a1a5e` |
| Table hover | `#f8f9ff` |
| Value/price color | `#0a8a9a` |
| AI grade badge | bg `#d0f8f0` text `#0a5a6a` |
| PSA grade badge | bg `#dbeafe` text `#1e40af` |
| Parallel tag | bg `#fef3c7` text `#854f0b` |
| Action button | bg `white` border `#c8d8ff` text `#3a5aa0` |
| Action button primary | `linear-gradient(135deg, #0a8a9a, #0d6e8e)` text `white` |
| Card thumbnails | Bright colorful gradients (same as Theme 1) |

---

### CSS Implementation Pattern

```css
:root[data-theme="light"] {
  --bg-page: #f5f5f2; --bg-main: white; --bg-sidebar: #fafaf8;
  --accent: #1a8c50; --accent-light: #e8f7ef; --accent-text: #0f6e56;
  --text-primary: #1a1a1a; --text-secondary: #888;
  --border: #efefeb; --border-sidebar: #e8e8e0;
  --btn-primary-bg: #1a8c50; --btn-primary-text: white;
  --stat-bg: #f5f5f2; --logo-accent: #1a8c50;
  --val-color: #1a8c50; --grade-ai-bg: #e8f7ef; --grade-ai-text: #0f6e56;
}
:root[data-theme="dark"] {
  --bg-page: #141414; --bg-main: #141414; --bg-sidebar: #1a1a1a;
  --accent: #4ade80; --accent-light: #0d2e1a; --accent-text: #4ade80;
  --text-primary: #f0f0f0; --text-secondary: #555;
  --border: #222; --border-sidebar: #252525;
  --btn-primary-bg: #1a8c50; --btn-primary-text: white;
  --stat-bg: #1e1e1e; --logo-accent: #4ade80;
  --val-color: #4ade80; --grade-ai-bg: #0d2e1a; --grade-ai-text: #4ade80;
}
:root[data-theme="blue"] {
  --bg-page: #f0f4ff; --bg-main: white;
  --sidebar-bg: linear-gradient(180deg,#0a2a6e,#0d3580); --sidebar-border: #1a4a9e;
  --accent: #0a2a6e; --logo-accent: #7dd3fc;
  --text-primary: #0a1a5e; --text-secondary: #6b7fb5;
  --border: #e0e8ff; --btn-primary-bg: #0a2a6e;
  --stat-bg: #f0f4ff; --val-color: #0a6a3a;
}
:root[data-theme="ice"] {
  --bg-page: #0d1a26; --bg-main: #0d1a26;
  --sidebar-bg: linear-gradient(180deg,#071524,#0a1f2e); --sidebar-border: #1a3a4a;
  --accent: #5dd8f0; --logo-accent: #5dd8f0;
  --text-primary: #c0e8f8; --text-secondary: #3a6a7a;
  --border: #1a3a4a; --btn-primary-bg: linear-gradient(135deg,#0a8a9a,#0d6e8e);
  --stat-bg: #0a1f2e; --val-color: #5dd8f0;
}
:root[data-theme="hybrid"] {
  /* sidebar: same as ice */ /* main: vibrant blue */
  --bg-main: white; --bg-page: #f0f4ff;
  --sidebar-bg: linear-gradient(180deg,#071524,#0a1f2e); --sidebar-border: #1a3a4a;
  --accent: #0a8a9a; --logo-accent: #5dd8f0;
  --text-primary: #0a1a5e; --text-secondary: #6b7fb5;
  --border: #e0e8ff; --btn-primary-bg: linear-gradient(135deg,#0a8a9a,#0d6e8e);
  --stat-bg: #f0f4ff; --val-color: #0a8a9a;
}
```

Theme is applied via: `document.documentElement.setAttribute('data-theme', 'ice')`
Saved to: `localStorage.setItem('icevault-theme', 'ice')`
Loaded on init: `document.documentElement.setAttribute('data-theme', localStorage.getItem('icevault-theme') || 'light')`

---

### Full index.html Implementation

#### Step 1 — CSS variables block (add inside `<style>` tag)

```css
/* ── THEME VARIABLES ── */
:root[data-theme="light"] {
  --bg-page:         #f5f5f2;
  --bg-main:         #ffffff;
  --bg-sidebar:      #fafaf8;
  --bg-stat:         #f5f5f2;
  --bg-topbar:       #ffffff;
  --bg-input:        #ffffff;
  --bg-hover:        #fafaf8;
  --sidebar-grad:    none;
  --border-sidebar:  #e8e8e0;
  --border-main:     #efefeb;
  --border-row:      #f0f0ec;
  --border-input:    #dddddd;
  --text-primary:    #1a1a1a;
  --text-secondary:  #888888;
  --text-muted:      #aaaaaa;
  --text-sidebar:    #666666;
  --text-heading:    #1a1a1a;
  --logo-accent:     #1a8c50;
  --nav-active-bg:   #e8f7ef;
  --nav-active-text: #0f6e56;
  --nav-active-border: transparent;
  --nav-badge-bg:    #efefeb;
  --nav-badge-text:  #888888;
  --avatar-bg:       #e8f7ef;
  --avatar-text:     #0f6e56;
  --avatar-border:   transparent;
  --accent:          #1a8c50;
  --accent-light:    #e8f7ef;
  --accent-text:     #0f6e56;
  --btn-primary-bg:  #1a8c50;
  --btn-primary-text:#ffffff;
  --btn-secondary-bg:#ffffff;
  --btn-secondary-border:#dddddd;
  --btn-secondary-text:#444444;
  --filter-active-bg:#e8f7ef;
  --filter-active-border:#9fe1cb;
  --filter-active-text:#0f6e56;
  --stat-val:        #1a1a1a;
  --stat-lbl:        #888888;
  --stat-delta:      #1a8c50;
  --table-th:        #888888;
  --table-border:    #efefeb;
  --table-row-border:#f0f0ec;
  --table-text:      #1a1a1a;
  --val-color:       #1a8c50;
  --grade-ai-bg:     #e8f7ef;
  --grade-ai-text:   #0f6e56;
  --grade-psa-bg:    #e6f1fb;
  --grade-psa-text:  #185fa5;
  --parallel-bg:     #faeeda;
  --parallel-text:   #633806;
  --action-bg:       #ffffff;
  --action-border:   #dddddd;
  --action-text:     #666666;
  --url-bg:          #ffffff;
  --url-border:      #e0e0d8;
  --url-text:        #999999;
  --browser-bar-bg:  #f8f8f6;
  --browser-border:  #e0e0d8;
}

:root[data-theme="dark"] {
  --bg-page:         #141414;
  --bg-main:         #141414;
  --bg-sidebar:      #1a1a1a;
  --bg-stat:         #1e1e1e;
  --bg-topbar:       #141414;
  --bg-input:        #1e1e1e;
  --bg-hover:        #1a1a1a;
  --sidebar-grad:    none;
  --border-sidebar:  #252525;
  --border-main:     #222222;
  --border-row:      #1e1e1e;
  --border-input:    #2a2a2a;
  --text-primary:    #f0f0f0;
  --text-secondary:  #555555;
  --text-muted:      #444444;
  --text-sidebar:    #666666;
  --text-heading:    #f0f0f0;
  --logo-accent:     #4ade80;
  --nav-active-bg:   #0d2e1a;
  --nav-active-text: #4ade80;
  --nav-active-border: transparent;
  --nav-badge-bg:    #252525;
  --nav-badge-text:  #555555;
  --avatar-bg:       #0d2e1a;
  --avatar-text:     #4ade80;
  --avatar-border:   transparent;
  --accent:          #4ade80;
  --accent-light:    #0d2e1a;
  --accent-text:     #4ade80;
  --btn-primary-bg:  #1a8c50;
  --btn-primary-text:#ffffff;
  --btn-secondary-bg:#1e1e1e;
  --btn-secondary-border:#2a2a2a;
  --btn-secondary-text:#888888;
  --filter-active-bg:#0d2e1a;
  --filter-active-border:#1a5c30;
  --filter-active-text:#4ade80;
  --stat-val:        #f0f0f0;
  --stat-lbl:        #555555;
  --stat-delta:      #4ade80;
  --table-th:        #555555;
  --table-border:    #222222;
  --table-row-border:#1e1e1e;
  --table-text:      #cccccc;
  --val-color:       #4ade80;
  --grade-ai-bg:     #0d2e1a;
  --grade-ai-text:   #4ade80;
  --grade-psa-bg:    #042c53;
  --grade-psa-text:  #85b7eb;
  --parallel-bg:     #412402;
  --parallel-text:   #fac775;
  --action-bg:       #1a1a1a;
  --action-border:   #2a2a2a;
  --action-text:     #666666;
  --url-bg:          #1a1a1a;
  --url-border:      #2a2a2a;
  --url-text:        #555555;
  --browser-bar-bg:  #111111;
  --browser-border:  #222222;
}

:root[data-theme="blue"] {
  --bg-page:         #f0f4ff;
  --bg-main:         #ffffff;
  --bg-sidebar:      #0a2a6e;
  --bg-stat:         #f0f4ff;
  --bg-topbar:       #ffffff;
  --bg-input:        #f0f4ff;
  --bg-hover:        #f8f9ff;
  --sidebar-grad:    linear-gradient(180deg, #0a2a6e, #0d3580);
  --border-sidebar:  #1a4a9e;
  --border-main:     #e0e8ff;
  --border-row:      #eef2ff;
  --border-input:    #c8d8ff;
  --text-primary:    #0a1a5e;
  --text-secondary:  #6b7fb5;
  --text-muted:      #8899cc;
  --text-sidebar:    rgba(255,255,255,0.5);
  --text-heading:    #0a1a5e;
  --logo-accent:     #7dd3fc;
  --nav-active-bg:   rgba(255,255,255,0.15);
  --nav-active-text: #ffffff;
  --nav-active-border: transparent;
  --nav-badge-bg:    rgba(255,255,255,0.15);
  --nav-badge-text:  rgba(255,255,255,0.8);
  --avatar-bg:       rgba(255,255,255,0.2);
  --avatar-text:     #ffffff;
  --avatar-border:   transparent;
  --accent:          #0a2a6e;
  --accent-light:    #e6f1fb;
  --accent-text:     #0a2a6e;
  --btn-primary-bg:  #0a2a6e;
  --btn-primary-text:#ffffff;
  --btn-secondary-bg:#ffffff;
  --btn-secondary-border:#c8d8ff;
  --btn-secondary-text:#3a5aa0;
  --filter-active-bg:#0a2a6e;
  --filter-active-border:#0a2a6e;
  --filter-active-text:#ffffff;
  --stat-val:        #0a1a5e;
  --stat-lbl:        #6b7fb5;
  --stat-delta:      #1a8c50;
  --table-th:        #8899cc;
  --table-border:    #e0e8ff;
  --table-row-border:#eef2ff;
  --table-text:      #0a1a5e;
  --val-color:       #0a6a3a;
  --grade-ai-bg:     #e8f7ef;
  --grade-ai-text:   #0f6e56;
  --grade-psa-bg:    #dbeafe;
  --grade-psa-text:  #1e40af;
  --parallel-bg:     #fef3c7;
  --parallel-text:   #92400e;
  --action-bg:       #ffffff;
  --action-border:   #c8d8ff;
  --action-text:     #3a5aa0;
  --url-bg:          #ffffff;
  --url-border:      #c8d8ff;
  --url-text:        #6b7fb5;
  --browser-bar-bg:  #e8f0ff;
  --browser-border:  #b0c8f0;
}

:root[data-theme="ice"] {
  --bg-page:         #0d1a26;
  --bg-main:         #0d1a26;
  --bg-sidebar:      #071524;
  --bg-stat:         #0a1f2e;
  --bg-topbar:       #0a1f2e;
  --bg-input:        rgba(93,216,240,0.06);
  --bg-hover:        rgba(93,216,240,0.04);
  --sidebar-grad:    linear-gradient(180deg, #071524, #0a1f2e);
  --border-sidebar:  #1a3a4a;
  --border-main:     #1a3a4a;
  --border-row:      #12253a;
  --border-input:    #1a3a4a;
  --text-primary:    #c0e8f8;
  --text-secondary:  #3a6a7a;
  --text-muted:      #2a5a6a;
  --text-sidebar:    rgba(255,255,255,0.35);
  --text-heading:    #c0e8f8;
  --logo-accent:     #5dd8f0;
  --nav-active-bg:   rgba(93,216,240,0.12);
  --nav-active-text: #5dd8f0;
  --nav-active-border: rgba(93,216,240,0.2);
  --nav-badge-bg:    rgba(93,216,240,0.15);
  --nav-badge-text:  #5dd8f0;
  --avatar-bg:       rgba(93,216,240,0.2);
  --avatar-text:     #5dd8f0;
  --avatar-border:   rgba(93,216,240,0.25);
  --accent:          #5dd8f0;
  --accent-light:    rgba(93,216,240,0.12);
  --accent-text:     #5dd8f0;
  --btn-primary-bg:  linear-gradient(135deg, #0a8a9a, #0d6e8e);
  --btn-primary-text:#ffffff;
  --btn-secondary-bg:rgba(93,216,240,0.06);
  --btn-secondary-border:#1a3a4a;
  --btn-secondary-text:#5a9eac;
  --filter-active-bg:rgba(93,216,240,0.12);
  --filter-active-border:rgba(93,216,240,0.3);
  --filter-active-text:#5dd8f0;
  --stat-val:        #c0e8f8;
  --stat-lbl:        #3a6a7a;
  --stat-delta:      #5dd8f0;
  --table-th:        #3a6a7a;
  --table-border:    #1a3a4a;
  --table-row-border:#12253a;
  --table-text:      #a0cce0;
  --val-color:       #5dd8f0;
  --grade-ai-bg:     rgba(93,216,240,0.12);
  --grade-ai-text:   #5dd8f0;
  --grade-psa-bg:    #042c53;
  --grade-psa-text:  #85b7eb;
  --parallel-bg:     rgba(239,159,39,0.1);
  --parallel-text:   #ef9f27;
  --action-bg:       rgba(93,216,240,0.04);
  --action-border:   #1a3a4a;
  --action-text:     #3a7a8a;
  --url-bg:          #0d2a3e;
  --url-border:      #1a4a6a;
  --url-text:        #5dd8f0;
  --browser-bar-bg:  #071524;
  --browser-border:  #1a3a4a;
}

:root[data-theme="hybrid"] {
  /* Sidebar: identical to ice theme */
  --bg-sidebar:      #071524;
  --sidebar-grad:    linear-gradient(180deg, #071524, #0a1f2e);
  --border-sidebar:  #1a3a4a;
  --logo-accent:     #5dd8f0;
  --text-sidebar:    rgba(255,255,255,0.35);
  --nav-active-bg:   rgba(93,216,240,0.12);
  --nav-active-text: #5dd8f0;
  --nav-active-border: rgba(93,216,240,0.2);
  --nav-badge-bg:    rgba(93,216,240,0.15);
  --nav-badge-text:  #5dd8f0;
  --avatar-bg:       rgba(93,216,240,0.2);
  --avatar-text:     #5dd8f0;
  --avatar-border:   rgba(93,216,240,0.25);
  /* Main content: vibrant blue */
  --bg-page:         #f0f4ff;
  --bg-main:         #ffffff;
  --bg-stat:         #f0f4ff;
  --bg-topbar:       #ffffff;
  --bg-input:        #f0f4ff;
  --bg-hover:        #f8f9ff;
  --border-main:     #e0e8ff;
  --border-row:      #eef2ff;
  --border-input:    #c8d8ff;
  --text-primary:    #0a1a5e;
  --text-secondary:  #6b7fb5;
  --text-muted:      #8899cc;
  --text-heading:    #0a1a5e;
  --accent:          #0a8a9a;
  --accent-light:    #d0f8f0;
  --accent-text:     #0a5a6a;
  --btn-primary-bg:  linear-gradient(135deg, #0a8a9a, #0d6e8e);
  --btn-primary-text:#ffffff;
  --btn-secondary-bg:#ffffff;
  --btn-secondary-border:#c8d8ff;
  --btn-secondary-text:#3a5aa0;
  --filter-active-bg:#0a1f2e;
  --filter-active-border:#0a1f2e;
  --filter-active-text:#5dd8f0;
  --stat-val:        #0a1a5e;
  --stat-lbl:        #6b7fb5;
  --stat-delta:      #0a8a9a;
  --table-th:        #8899cc;
  --table-border:    #e0e8ff;
  --table-row-border:#eef2ff;
  --table-text:      #0a1a5e;
  --val-color:       #0a8a9a;
  --grade-ai-bg:     #d0f8f0;
  --grade-ai-text:   #0a5a6a;
  --grade-psa-bg:    #dbeafe;
  --grade-psa-text:  #1e40af;
  --parallel-bg:     #fef3c7;
  --parallel-text:   #854f0b;
  --action-bg:       #ffffff;
  --action-border:   #c8d8ff;
  --action-text:     #3a5aa0;
  --url-bg:          #0d2a3e;
  --url-border:      #1a4a6a;
  --url-text:        #5dd8f0;
  --browser-bar-bg:  #071524;
  --browser-border:  #1a3a4a;
}
```

#### Step 2 — Apply variables to existing CSS (replace hardcoded colors)

Replace all hardcoded color values in the existing CSS with variables. Key mappings:

```css
/* Replace these patterns throughout existing CSS: */
background: #f5f5f2          → background: var(--bg-page)
background: white            → background: var(--bg-main)
background: #fafaf8          → background: var(--bg-sidebar)
color: #1a1a1a               → color: var(--text-primary)
color: #888                  → color: var(--text-secondary)
border-color: #efefeb        → border-color: var(--border-main)
background: #1a8c50          → background: var(--btn-primary-bg)
color: #1a8c50  (values)     → color: var(--val-color)
background: #e8f7ef          → background: var(--grade-ai-bg)
color: #0f6e56               → color: var(--grade-ai-text)
background: #faeeda          → background: var(--parallel-bg)
color: #633806               → color: var(--parallel-text)
```

#### Step 3 — Sidebar gradient handling

```css
.sidebar {
  background: var(--sidebar-grad, var(--bg-sidebar));
}
/* When --sidebar-grad is 'none', falls back to --bg-sidebar solid color */
```

#### Step 4 — Theme init JS (add at very top of existing `<script>` block)

```javascript
// ── THEME INIT ── runs before anything else to prevent flash
(function() {
  const saved = localStorage.getItem('icevault-theme') || 'light';
  document.documentElement.setAttribute('data-theme', saved);
})();
```

#### Step 5 — Theme switcher function (add to JS)

```javascript
const THEMES = [
  { id: 'light',  label: 'Light',        icon: '☀' },
  { id: 'dark',   label: 'Dark',         icon: '🌑' },
  { id: 'blue',   label: 'Vibrant Blue', icon: '🔷' },
  { id: 'ice',    label: 'Ice',          icon: '❄' },
  { id: 'hybrid', label: 'Hybrid',       icon: '🌊' },
];

function setTheme(themeId) {
  document.documentElement.setAttribute('data-theme', themeId);
  localStorage.setItem('icevault-theme', themeId);
}

function getCurrentTheme() {
  return localStorage.getItem('icevault-theme') || 'light';
}
```

#### Step 6 — Theme picker HTML (add inside Settings panel)

```html
<div class="settings-section">
  <div class="settings-label">Theme</div>
  <div class="theme-picker">
    <button onclick="setTheme('light')"  class="theme-btn" data-theme-btn="light">☀ Light</button>
    <button onclick="setTheme('dark')"   class="theme-btn" data-theme-btn="dark">🌑 Dark</button>
    <button onclick="setTheme('blue')"   class="theme-btn" data-theme-btn="blue">🔷 Vibrant Blue</button>
    <button onclick="setTheme('ice')"    class="theme-btn" data-theme-btn="ice">❄ Ice</button>
    <button onclick="setTheme('hybrid')" class="theme-btn" data-theme-btn="hybrid">🌊 Hybrid</button>
  </div>
</div>
```

#### Step 7 — Active state on theme buttons (add to setTheme function)

```javascript
function setTheme(themeId) {
  document.documentElement.setAttribute('data-theme', themeId);
  localStorage.setItem('icevault-theme', themeId);
  // Update active button state
  document.querySelectorAll('[data-theme-btn]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.themeBtn === themeId);
  });
}

// Call on page load to set initial active state
document.addEventListener('DOMContentLoaded', () => {
  const current = getCurrentTheme();
  document.querySelectorAll('[data-theme-btn]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.themeBtn === current);
  });
});
```

#### Step 8 — Theme picker CSS

```css
.theme-picker {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.theme-btn {
  padding: 6px 14px;
  border-radius: 20px;
  border: 1px solid var(--border-main);
  background: var(--bg-main);
  color: var(--text-secondary);
  font-size: 12px;
  cursor: pointer;
}
.theme-btn.active {
  background: var(--accent-light);
  border-color: var(--accent);
  color: var(--accent-text);
  font-weight: 500;
}
```

---

## 📱 Mobile Navigation — Slide-out Drawer

On desktop the sidebar is always visible on the left. On mobile (PWA/TWA wrapper and browser) the sidebar is replaced by a **slide-out drawer** triggered by a hamburger ☰ button in the top left. No bottom tabs. No top tabs. One consistent nav pattern across all platforms.

### How it works
- Hamburger ☰ in topbar top-left → drawer slides in from left
- Dark overlay covers content behind drawer
- Close by: tapping overlay, tapping ✕, or swiping left
- Swipe right anywhere on screen to open
- Same nav items as desktop sidebar — all 8 fit without cramming
- Same active states, user footer, theme colors

### Breakpoint
```css
/* Desktop — show sidebar, hide drawer trigger */
@media (min-width: 768px) {
  .sidebar { display: flex; }
  .hamburger-btn { display: none; }
  .drawer { display: none; }
  .drawer-overlay { display: none; }
}

/* Mobile — hide sidebar, show drawer trigger */
@media (max-width: 767px) {
  .sidebar { display: none; }
  .hamburger-btn { display: flex; }
  .app { flex-direction: column; }
}
```

### Drawer HTML structure
```html
<!-- Hamburger button — inside topbar, mobile only -->
<button class="hamburger-btn" id="hamburgerBtn" onclick="openDrawer()">
  <span class="hline"></span>
  <span class="hline"></span>
  <span class="hline"></span>
</button>

<!-- Drawer overlay -->
<div class="drawer-overlay" id="drawerOverlay" onclick="closeDrawer()"></div>

<!-- Slide-out drawer -->
<div class="drawer" id="drawer">
  <div class="drawer-header">
    <div class="drawer-logo">Ice<span>Vault</span></div>
    <button class="drawer-close" onclick="closeDrawer()">✕</button>
  </div>
  <nav class="drawer-nav">
    <div class="drawer-item active" onclick="showTab('collection'); closeDrawer()">⊞ Collection</div>
    <div class="drawer-item" onclick="showTab('scan'); closeDrawer()">⊕ Scan card</div>
    <div class="drawer-item" onclick="showTab('graded'); closeDrawer()">★ Graded certs</div>
    <div class="drawer-item" onclick="showTab('ebay'); closeDrawer()">↗ List on eBay</div>
    <div class="drawer-item" onclick="showTab('share'); closeDrawer()">⊙ Public share</div>
    <div class="drawer-divider"></div>
    <div class="drawer-item" onclick="showTab('settings'); closeDrawer()">⚙ Settings</div>
    <div class="drawer-item" onclick="showTab('apikeys'); closeDrawer()">? API keys</div>
  </nav>
  <div class="drawer-footer">
    <div class="drawer-user">
      <div class="drawer-avatar" id="drawerAvatar">?</div>
      <div>
        <div class="drawer-username" id="drawerUsername">Guest</div>
        <div class="drawer-plan">Pay per scan</div>
      </div>
    </div>
  </div>
</div>
```

### Drawer JS
```javascript
function openDrawer() {
  document.getElementById('drawer').classList.add('open');
  document.getElementById('drawerOverlay').classList.add('open');
  document.body.style.overflow = 'hidden'; // prevent background scroll
}

function closeDrawer() {
  document.getElementById('drawer').classList.remove('open');
  document.getElementById('drawerOverlay').classList.remove('open');
  document.body.style.overflow = '';
}

// Swipe right to open, swipe left to close
let touchStartX = 0;
document.addEventListener('touchstart', e => { touchStartX = e.touches[0].clientX; });
document.addEventListener('touchend', e => {
  const dx = e.changedTouches[0].clientX - touchStartX;
  if (dx > 60 && touchStartX < 40) openDrawer();  // swipe right from left edge
  if (dx < -60) closeDrawer();                      // swipe left anywhere
});
```

### Drawer CSS
```css
.hamburger-btn {
  width: 34px; height: 34px;
  border-radius: 8px;
  background: var(--bg-input);
  border: 1px solid var(--border-sidebar);
  display: flex; flex-direction: column;
  align-items: center; justify-content: center; gap: 4px;
  cursor: pointer; flex-shrink: 0;
}
.hline {
  width: 14px; height: 1.5px;
  background: var(--logo-accent);
  border-radius: 2px;
}

.drawer-overlay {
  display: none;
  position: fixed; inset: 0;
  background: rgba(0,0,0,.6);
  z-index: 100;
}
.drawer-overlay.open { display: block; }

.drawer {
  position: fixed;
  top: 0; left: 0; bottom: 0;
  width: 75%; max-width: 280px;
  background: var(--sidebar-grad, var(--bg-sidebar));
  border-right: 1px solid var(--border-sidebar);
  z-index: 101;
  display: flex; flex-direction: column;
  transform: translateX(-100%);
  transition: transform .25s ease;
}
.drawer.open { transform: translateX(0); }

.drawer-header {
  padding: 16px;
  display: flex; align-items: center; justify-content: space-between;
  border-bottom: 1px solid rgba(255,255,255,.08);
}
.drawer-logo { font-size: 15px; font-weight: 500; color: white; }
.drawer-logo span { color: var(--logo-accent); }
.drawer-close {
  width: 28px; height: 28px; border-radius: 7px;
  background: rgba(255,255,255,.06);
  border: 1px solid var(--border-sidebar);
  color: rgba(255,255,255,.4); font-size: 14px;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer;
}

.drawer-nav { padding: 8px; flex: 1; }
.drawer-item {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 12px; border-radius: 8px;
  font-size: 13px; color: var(--text-sidebar);
  margin-bottom: 2px; cursor: pointer;
}
.drawer-item.active {
  background: var(--nav-active-bg);
  color: var(--nav-active-text);
  border: 1px solid var(--nav-active-border);
  font-weight: 500;
}
.drawer-divider {
  height: 1px;
  background: rgba(255,255,255,.06);
  margin: 6px 8px;
}

.drawer-footer { padding: 12px; border-top: 1px solid rgba(255,255,255,.06); }
.drawer-user {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 10px; border-radius: 8px;
  background: rgba(255,255,255,.04);
}
.drawer-avatar {
  width: 30px; height: 30px; border-radius: 50%;
  background: var(--avatar-bg);
  border: 1px solid var(--avatar-border);
  color: var(--avatar-text);
  display: flex; align-items: center; justify-content: center;
  font-size: 11px; font-weight: 500; flex-shrink: 0;
}
.drawer-username { font-size: 11px; font-weight: 500; color: rgba(255,255,255,.85); }
.drawer-plan { font-size: 9px; color: var(--logo-accent); opacity: .6; }
```

### Theme behavior on mobile
All 5 themes apply identically on mobile — the drawer uses the same CSS variables as the desktop sidebar so colors switch automatically. The hamburger icon uses `--logo-accent` for its lines so it matches the active theme. Dark and Ice themes are particularly good on mobile as they save battery on OLED screens.

### PWA/TWA notes
- Themes persist via `localStorage` — carry over between sessions in WebView
- Drawer swipe gestures work in TWA WebView
- `body overflow: hidden` when drawer is open prevents background scroll in WebView
- On Android the back button should close the drawer if open — add: `document.addEventListener('backbutton', closeDrawer)`

---

## 🖥 Desktop vs Mobile Layout Summary

| Element | Desktop (≥768px) | Mobile (<768px) |
|---------|-----------------|-----------------|
| Navigation | Always-visible left sidebar | Slide-out drawer via ☰ |
| Nav trigger | None — always visible | Hamburger button in topbar |
| Collection view | Table with columns | Card list (stacked rows) |
| Scan view | Two-panel split (photos left, results right) | Single column stacked |
| Cert lookup | Two-panel split | Single column stacked |
| Theme switching | Settings page | Settings via drawer → Settings |
| Breakpoint | `min-width: 768px` | `max-width: 767px` |

---

## 📞 Context for New Claude Sessions

Paste this at the start of a new conversation:

> "I'm continuing development of Ice Vault — a hockey card manager web app + Android app.
> Stack: GitHub Pages (Ciiiv.github.io/icevault), Cloudflare Worker deployed via Wrangler CLI
> at C:\Users\civ2g\icevault-worker, D1 database (icevault), Brevo for emails (needs verified
> domain to send to all users). Completed: bcrypt auth (Priority #1), front+back scanning,
> combined API call, optional eBay description at scan time.
> UI: 5 approved themes (light/dark/blue/ice/hybrid) with full CSS variable specs in PROJECT_NOTES.
> Mobile nav: slide-out drawer replacing sidebar on screens <768px — full spec in PROJECT_NOTES.
> Next priority: [whatever you're working on].
> See PROJECT_NOTES.md in the GitHub repo (Ciiiv/icevault) for full context."
