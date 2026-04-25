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

## 📞 Context for New Claude Sessions

Paste this at the start of a new conversation:

> "I'm continuing development of Ice Vault — a hockey card manager web app + Android app. 
> Stack: GitHub Pages (Ciiiv.github.io/icevault), Cloudflare Worker (see PROJECT_NOTES.md for URL) 
> deployed via Wrangler CLI at C:\Users\civ2g\icevault-worker, D1 database (icevault), 
> Brevo for emails (needs verified domain to send to all users). 
> Completed: bcrypt auth (Priority #1). 
> Next: [whatever you're working on].
> See PROJECT_NOTES.md in the repo for full context."
