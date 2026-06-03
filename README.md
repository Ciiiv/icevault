# 🏒 Ice Vault — Hockey Card Manager

A free, open-source hockey card collection manager. Scan front and back with AI — get condition grades, parallel detection, serial numbers, and eBay descriptions in one tap. Graded cert lookup for 8 companies. Direct eBay listing. Cloud sync. Bring your own API key — no subscriptions, no markup, your data stays yours.

---

## 🤔 Why Ice Vault?

**Every other app shows you a catalog image of your card. Ice Vault shows you YOUR card.**

When you import a collection from a CSV, eBay My Collection, or any other data source, you get a list of card names next to stock photos pulled from a database. The same generic image for every copy of a 2015-16 McDavid Young Guns — whether it's a PSA 10 or a beat-up $30 raw.

That's a spreadsheet. Not a collection.

Ice Vault scans your actual card — front and back — and stores your photo, your centering, your corners. Because two copies of the same card can be worth $200 or $600 depending on condition, and condition is only visible in your specific scan.

| | Other apps | Ice Vault |
|--|-----------|----------|
| What you see | Generic catalog photo — same for every copy | Your actual card — your specific centering, corners, surfaces |
| Condition grading | None (CollX, Ludex) or separate paid service | AI grades your card from your scan — included in scan cost |
| Parallel detection | Limited | Reads parallel name from the back of YOUR card |
| Serial number | Hit or miss | Reads serial number from the back of YOUR card |
| Graded cert lookup | PSA only (PSA app) | 8 grading companies — PSA, BGS, SGC, CGC, Authority, TAG, KSA, HGA |
| Data ownership | Their servers, their database | Your Cloudflare D1 — your data |
| Cost | $10/month subscription (CollX Pro) or per-credit | ~$0.02–0.04 per scan — pay AI provider directly, no markup. Gemini free tier available |

**The scan cost isn't a barrier — it's the price of doing it right.**

A $50 card costs $0.04 to properly document with front + back scanning, AI condition grade, parallel detection, and serial number reading. A $200 card costs the same $0.04. For any card worth owning, the cost of scanning it correctly is negligible.

---

## ✨ Features

### 📷 Card Scanning
- Upload or photograph **front and back** of any hockey card
- **AI reads both images in one call** — player name, year, brand/set, card number, team, parallel/variation, serial number
- **Back of card improves accuracy** — parallel names (e.g. Speckled Rainbow Foil), serial numbers, and card numbers are often clearer on the back
- **AI condition estimate** — PSA-style 1–10 grade with centering, corners, edges, and surface — weighted 70% front / 30% back. Optional — uncheck to skip and save tokens
- Clearly labeled as **AI estimate only** — not an official grading company grade
- **Serial number detection** — AI reads serial number from back of card (e.g. 47/99), saved to card, shown in modal and included in eBay title and search
- **Optional eBay description** — checkbox before scanning to generate listing copy in the same API call (~+$0.01)
- No auto-scan — images load without triggering AI. You control when the API call happens
- **Multi-AI scan model picker** -- choose Claude, GPT-4o, or Gemini for card scan (OCR + grade). Cost notes update dynamically per model. Ximilar is grading-only -- not for card scan
- **Slab scan model picker** -- Claude, GPT-4o, or Gemini selectable for AI Slab Scan (Option A on Graded Cert tab)
- **Re-scan model picker** -- choose Claude, GPT-4o, or Gemini when re-scanning a card from the collection. Re-scan is OCR field update only -- use the grade matrix for grading
- **eBay listing** -- submit cards directly from Ice Vault. Move cards to eBay Queue collection, select from the eBay tab, set price/condition/shipping, generate AI description (factual, no hype), submit. Fixed Price or Auction, Best Offer, 4 condition options (Near Mint or Better / Excellent / Very Good / Poor), shipping options with hints and editable cost. Requires eBay Auth'n'Auth token
- **eBay Queue** -- move cards to the eBay Queue collection to batch list them. Queue panel in the eBay tab shows all queued cards with editable titles, prices, AI-generated descriptions (Claude/GPT-4o/Gemini), and per-card Submit. Submit All lists everything in sequence. Cards auto-move to For Sale after listing
- **Bulk operations** -- Select mode in collection toolbar. Check multiple cards, then Move to collection, Delete, or Export selected as CSV. Select All / Clear included
- **Card notes** -- free text notes per card (condition, purchase info, storage). Click to edit in card detail, searchable, included in CSV export
- **PDF export** -- exports collection stats and per-card grid as PDF. Collections over 250 cards split into separate files automatically, each with page numbers and card range labels. Combine externally if needed
- **IceVault ID** -- every card gets a unique sequential ID (ICV-000001) assigned on first scan. Shown in card modal and included in CSV export. Foundation for future duplicate detection
- **Advanced filters** -- filter collection by grade range, value range, and date added. Combines with existing search, collection, and status filters
- **Photography tips** -- tap "Photo tips" near the upload zone for lighting, background, focus, and framing guidance. Separate "Slab tips" variant for graded card scans
- **Private Collection** -- cards in Private Collection are visible in your own grid but excluded from shared collection URLs
- **AI grade matrix** -- 4-source grading: Claude, GPT-4o, Gemini, and Ximilar. Ximilar is purpose-built for card condition grading and most accurate. Claude/GPT-4o/Gemini better for card identification. Each source gets its own tab with full breakdown. Set any source as the card active grade. Ximilar tab includes "View full breakdown" button showing per-corner, per-edge, surface, and centering ratio detail for front and back images separately, with weak spot highlighting and autograph/damage detection
- **Re-scan from collection** -- re-scan any card using its existing stored images. Shows a diff review panel highlighting what changed before saving. OCR field update only -- use the grade matrix for grading
- **Re-grade from collection** — re-run condition grading only on any card using stored images, without touching other card data
- **Manual field editing** — click any field in the card detail view to edit inline. Enter or click away to save, Escape to cancel
- ✕ Clear button to rescan instantly
- Front only: ~$0.01–0.02 | Front + back: ~$0.02–0.04 per scan

### ⬜ Graded Cert Lookup
- **Option A — AI Slab Scan** (~$0.02–0.04): photograph **front and back** of your graded slab — AI reads both label sides through the plastic, filling in cert number, official grade, player, year, set, and variation
- **Option B — Free cert # / QR lookup**: enter a cert number or scan the QR/barcode on the slab — opens the official registry in a new tab for manual entry (zero API cost). Optionally attach front and back slab photos for the card modal image
- Supports **8 grading companies**: PSA, BGS, SGC, CGC, Authority, TAG, KSA, HGA
- QR scanning auto-detects the grading company from the barcode URL

### 🗂 Collection Management
- Grid view with card thumbnails, grades, tags, and values
- Search by player, year, brand, team, or tag — server-side search across full collection
- Filter by collection bucket and eBay listing status
- Sort by newest, oldest, player name, value, or grade
- **Paginated display** — 100 cards per page with numbered page navigation
- Custom tag system — add, remove, and filter by tags
- Click any card for full details, edit tags, change collection, enlarge image
- Lightbox image viewer — click card photo to expand full screen
- **Export JSON** — full lossless backup including images, reimportable
- **Export CSV** — flat spreadsheet (22 columns), opens in Excel/Google Sheets
- **Import JSON** — restore from backup, merges with existing collection, skips duplicates
- **Mark as sold** — record sale price and date on any card, moves to Sold bucket, hidden from default view. Undo option available. Sold cards kept for historical data
- **Value history tracking** — estimated value changes tracked over time on every card. Updated on scan, manual edit, and re-scan
- **Stats & Value Tracking tab** — collection value, total sold, avg vs AI estimate, best flip. Charts: collection value over time, sold vs estimate, grade distribution, collection by bucket. Recent sales table
- **Stats PDF export** — full report: summary metrics, all charts, per-card pages with thumbnail and value history mini chart
- **Stats CSV export** — value history and sales data per card, one row per value entry

### 🛒 List on eBay
- Select any card to create a listing
- Auto-generates listing title (80 character eBay limit)
- **Optional AI description at scan time** — check before scanning — description is ready when you list
- **eBay title** — player name first, includes serial number and official grade (PSA/BGS etc.) if graded. AI estimates never included in title
- Or generate description separately on the eBay tab (~$0.01–0.02)
- **🔍 eBay Sold Listings** — opens eBay pre-filtered to completed sold listings
- **📈 130point** — copies search term to clipboard and opens 130point.com for price history
- Direct eBay Trading API submission (requires eBay developer credentials)

### 👤 User Accounts & Cloud Sync
- Free accounts — sign up with email and password
- Collection syncs to the cloud — accessible from any device
- **Card images stored in Cloudflare R2** — not in the database, served from CDN, cached by browser
- Guest mode — full app usable without an account, collection stored locally in browser only
- **Sign out clears local collection** — prevents card data from bleeding between accounts on shared devices
- **Guest → account migration** — when a guest signs up, all local card images are automatically uploaded to R2 before syncing to D1
- Password reset via email (Maileroo — sends to any email address, no custom domain needed)
- **Change password** from account modal — requires current password, enforces 8+ chars with letter, number, and symbol
- **Display name** — chosen at signup, saved immediately — no re-prompt after email verification. Shown on shared collections instead of your email. Must be unique across all accounts. Editable from account modal
- **Share your collection** — generate a public read-only link anyone can view without an account. Share the whole collection at once with per-card price controls — show AI estimated value or your own asking price, labeled with your display name. Revoke anytime
- API keys are **never saved to your account** — stored locally on your device only
- Session lasts 30 days before requiring re-login

### 🔒 Privacy & Security
- All API keys stored in browser localStorage only — never sent to any server or database
- Passwords hashed with **PBKDF2-HMAC-SHA256 at 100,000 iterations** — OWASP compliant, no third-party library, never stored as plain text
- Timing attack prevention on login — always runs full hash verify even when user not found
- 100ms artificial delay on failed login attempts
- Rate limiting on all auth endpoints via Cloudflare KV
- Cloudflare Worker locked to only accept requests from the Ice Vault domain (origin check)
- Cost warnings on every AI-powered action
- Even with a user account, API keys are never saved to the database — by design

### 🎨 Themes
- 6 built-in themes — Classic (dark navy), Light, Dark, Vibrant Blue, Ice, Hybrid
- **Hybrid is the default** — ice dark sidebar + vibrant blue content
- Theme picker in Settings (⚙ API Keys → scroll to bottom)
- Theme persists across sessions

---

## 💰 API Cost Summary

All AI features use your own API keys — you pay only for what you use, directly to each AI provider. No markup, no subscription. Claude and GPT-4o require a paid balance. Gemini offers ~20 free requests/day.

### Per-scan cost estimates (actual prices may vary -- check each provider)

| Scan Type | Images Sent | Approx Cost |
|-----------|-------------|-------------|
| Card scan — front only | 1 | ~$0.01–0.02 |
| Card scan — front + back | 2 | ~$0.02–0.04 |
| Card scan — front + back + eBay description | 2 + longer output | ~$0.03–0.06 |
| Graded slab scan — front only | 1 | ~$0.01–0.02 |
| Graded slab scan — front + back | 2 | ~$0.02–0.04 |
| Cert # / QR lookup | 0 | Free |
| eBay sold listings link | 0 | Free |
| 130point link | 0 | Free |
| Account sync | 0 | Free (Cloudflare D1 + R2) |
| Ximilar card grade (front + back) | 2 images | 100 tokens (~10 free, then ~$0.11 per grade) |
| Password reset email | 0 | Free (Maileroo) |
| Share collection link | 0 | Free (Cloudflare D1) |

### Monthly cost vs CollX Pro ($10/month flat)

| Scans/month | Front only (~$0.02) | Front + Back (~$0.04) | Front + Back + eBay (~$0.05) |
|-------------|--------------------|-----------------------|------------------------------|
| 10 cards | $0.20 | $0.40 | $0.50 |
| 50 cards | $1.00 | $2.00 | $2.50 |
| 100 cards | $2.00 | $4.00 | $5.00 |
| 200 cards | $4.00 | $8.00 | $10.00 |
| 250 cards | $5.00 | $10.00 | $12.50 |

> **Free tier options:** Gemini 2.5 Flash offers ~20 free API requests/day via Google AI Studio (front+back scan = 1 request). Good for light use. Ximilar includes 1,000 free tokens (~10 front+back grades). Claude and GPT-4o have no free tier -- both require a paid balance. Cost estimates shown in Ice Vault are approximations only -- check real pricing at console.anthropic.com, platform.openai.com, and aistudio.google.com.

> **Break-even vs CollX Pro:** Ice Vault is cheaper for collectors scanning under ~200 cards/month with front+back. Most casual collectors scan 20–50 new cards/month, making Ice Vault cost **$0.40–$2.00/month** vs CollX Pro's flat $10/month.

---

## 🌐 Web App

**Live site (repo owner's instance):** `https://Ciiiv.github.io/icevault`
> If you've forked this repo, your site will be at `https://YOUR-USERNAME.github.io/icevault`

Visit and click **⚙ API Keys** to enter your keys. Click **👤 Sign In** to create a free account and sync your collection across devices.

### API Keys needed

| Key | Where to get it | Used for |
|-----|----------------|---------|
| Anthropic `sk-ant-...` | [console.anthropic.com](https://console.anthropic.com) | Card scanning, slab reading, eBay descriptions |
| OpenAI `sk-...` | [platform.openai.com](https://platform.openai.com) | Card scanning + grading with GPT-4o (optional) |
| Google AI `AIza...` | [aistudio.google.com](https://aistudio.google.com) | Card scanning + grading with Gemini -- ~20 free requests/day (optional) |
| Ximilar token | [app.ximilar.com](https://app.ximilar.com) | Card grading only -- 1k free tokens (~10 front+back grades), then $11/10k tokens (optional) |
| eBay App ID | [developer.ebay.com](https://developer.ebay.com) | eBay listing (optional) |
| eBay OAuth Token | eBay OAuth flow with `sell.item` scope | eBay listing (optional) |

> **Privacy:** API keys are stored only in your browser's local storage. They are never sent to, saved in, or accessible by this app, any server, or database — even if you have an account.

> **Security tip:** In your Anthropic console, set a monthly spend limit and disable auto-reload. With prepaid credits and auto-reload off, your maximum possible exposure is your prepaid balance — no automatic card charges can occur.

---

## 📱 Android App

> **Quick install:** Download the APK directly from [GitHub Releases](https://github.com/Ciiiv/icevault/releases/download/v1.0.0/Ice.Vault.apk) (944 KB). The download link is also available in the app under ⚙ API Keys. Enable "Install unknown apps" in Android Settings → Security to install.

The Android app is built using **PWABuilder** — a free Microsoft tool that wraps the web app into a native Android package. Since the app loads from your GitHub Pages URL, any update to `index.html` automatically updates the Android app too — no rebuild needed.

### Install via sideload (no Play Store needed)
1. Go to [pwabuilder.com](https://pwabuilder.com)
2. Enter your GitHub Pages URL (e.g. `https://YOUR-USERNAME.github.io/icevault`)
3. Click **Package For Stores → Other Android → Download Package**
4. Unzip the download, transfer the APK to your Android phone
5. Enable "Install from unknown sources" in Android Settings → Security
6. Open the APK and tap Install
7. Ice Vault appears on your home screen as a native app

---

## 🏗 Full Stack & Dependencies

| Component | Service | Purpose | Cost |
|-----------|---------|---------|------|
| Web hosting | GitHub Pages | Serves the app | Free |
| API proxy + Auth | Cloudflare Workers | Forwards Anthropic requests, handles user auth | Free tier |
| Database | Cloudflare D1 | Stores user accounts and card metadata | Free tier |
| Image storage | Cloudflare R2 | Stores card photos — 10GB free, zero egress fees | Free tier |
| Email | Maileroo | Welcome emails and password reset — 3,000/mo free, any recipient | Free tier |
| AI | Anthropic Claude, OpenAI GPT-4o, Google Gemini, Ximilar | Card OCR, condition grading, eBay descriptions | Pay per use (Gemini has free tier) |
| Android app | PWABuilder | Wraps web app as Android APK | Free |
| Worker deployment | Wrangler CLI | Local development and deployment of Cloudflare Worker | Free |

### Cloudflare Worker — API endpoints
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/` | Anthropic API proxy |
| POST | `/auth/signup` | Create account |
| POST | `/auth/login` | Sign in |
| POST | `/auth/logout` | Sign out |
| GET | `/auth/verify` | Verify session token |
| POST | `/auth/forgot` | Request password reset email |
| POST | `/auth/reset` | Reset password with token |
| POST | `/auth/change-password` | Change password while signed in |
| POST | `/auth/display-name` | Set or update display name |
| POST | `/share/generate` | Generate share token (rate limited 5/hr) |
| DELETE | `/share/revoke` | Revoke share token — disables sharing immediately |
| GET | `/share/status` | Check if sharing is enabled for current user |
| GET | `/share/:token` | Public — fetch shared collection (rate limited 60/hr) |
| POST | `/upload` | Upload card image to R2 |
| GET | `/collection` | Fetch user's collection from D1 |
| PUT | `/collection` | Save/sync full collection to D1 |
| DELETE | `/collection/:id` | Delete single card from D1 |

### Cloudflare Worker — environment bindings required
| Variable | Type | Purpose |
|----------|------|---------|
| `DB` | D1 Database | `icevault` database |
| `RATE_LIMIT_KV` | KV Namespace | Rate limiting sliding windows |
| `IMAGES` | R2 Bucket | `icevault-images` card photo storage |
| `MAILEROO_API_KEY` | Secret | Maileroo transactional email |
| `EMAIL_FROM` | Secret | Sender address (e.g. `noreply@yourdomain.maileroo.org`) |
| `ALERT_EMAIL` | Secret | Optional — rate limit alert recipient |

---

## 📁 Project Structure

```
icevault/
├── docs/                          # GitHub Pages web app (auto-deployed)
│   ├── index.html                 # HTML + CSS + theme init only (~2355 lines)
│   ├── js/
│   │   └── app.js                 # All application JS (~3283 lines)
│   ├── manifest.json              # PWA manifest — name, icons, theme colors
│   ├── sw.js                      # Service worker — v3, caches index.html + js/app.js
│   └── icons/
│       ├── icon-192.png           # App icon 192x192
│       └── icon-512.png           # App icon 512x512
├── icevault_worker.js             # Cloudflare Worker source — reference copy (manually synced)
├── .github/
│   └── workflows/
│       └── deploy.yml             # Auto-deploys docs/ to GitHub Pages on push to main
├── README.md
└── PROJECT_NOTES.md               # Internal project context — architecture, decisions, pending work
```

---

## 🚀 Deploy Your Own Copy

### Prerequisites
- A [GitHub](https://github.com) account
- A [Cloudflare](https://cloudflare.com) account (free)
- A [Maileroo](https://maileroo.com) account (free) — no custom domain needed
- [Node.js](https://nodejs.org) LTS installed
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/): `npm install -g wrangler`

---

### Step 1 — Fork and host on GitHub Pages

1. Fork this repo → name it `icevault` → set to Public
2. Go to **Settings → Pages → Source → GitHub Actions**
3. Push any change to `main` — site auto-deploys in ~30 seconds
4. Your site: `https://YOUR-USERNAME.github.io/icevault`

---

### Step 2 — Create the D1 database

1. Cloudflare dashboard → **Storage & Databases → D1 → Create database** → name it `icevault`
2. Go into the database → **Console** tab → run each query:

```sql
CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, display_name TEXT, created_at TEXT NOT NULL)
```
```sql
CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, user_id TEXT NOT NULL, expires_at TEXT NOT NULL)
```
```sql
CREATE TABLE IF NOT EXISTS password_resets (token TEXT PRIMARY KEY, user_id TEXT NOT NULL, expires_at TEXT NOT NULL)
```
```sql
CREATE TABLE IF NOT EXISTS cards (id TEXT NOT NULL, user_id TEXT NOT NULL, card_data TEXT NOT NULL, created_at TEXT NOT NULL, PRIMARY KEY (id, user_id))
```
```sql
CREATE TABLE IF NOT EXISTS request_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, timestamp TEXT NOT NULL, ip TEXT NOT NULL, path TEXT NOT NULL, status INTEGER NOT NULL, event TEXT NOT NULL, detail TEXT, created_at TEXT NOT NULL)
```
```sql
CREATE INDEX IF NOT EXISTS idx_logs_created_at ON request_logs(created_at)
```
```sql
CREATE INDEX IF NOT EXISTS idx_cards_user ON cards(user_id)
```
```sql
CREATE TABLE IF NOT EXISTS share_tokens (token TEXT PRIMARY KEY, user_id TEXT NOT NULL, created_at TEXT NOT NULL)
```

3. Note your **database ID** from the Overview tab

---

### Step 3 — Create R2 bucket

1. Cloudflare dashboard → **R2 Object Storage → Create bucket** → name it `icevault-images`
2. After creation → **Settings → Public Access → Enable** (type `allow` to confirm)
3. Note the public URL: `https://pub-xxxxxxxx.r2.dev`
4. Go to **Settings** tab of the bucket -> **CORS Policy** -> Add this policy:
```json
[
  {
    "AllowedOrigins": [
      "https://YOUR-USERNAME.github.io",
      "http://127.0.0.1:5500",
      "http://localhost:5500"
    ],
    "AllowedMethods": ["GET"],
    "AllowedHeaders": ["*"],
    "MaxAgeSeconds": 3600
  }
]
```
> Required for browser re-grade and PDF export to fetch card images directly from R2. Without it those features fail with a CORS error.

---

### Step 4 — Create a Maileroo account

1. Sign up free at [maileroo.com](https://maileroo.com)
2. Add a domain (use their free shared domain if you don't have one)
3. Go to your domain → **SMTP Accounts → New Account** → create `noreply@yourdomain.maileroo.org`
4. Go to **Sending Keys → Create New Key** → copy it

---

### Step 5 — Set up the Cloudflare Worker

```powershell
mkdir icevault-worker
cd icevault-worker
npm init -y
```

Create `wrangler.toml`:
```toml
name = "your-worker-name"
main = "src/index.js"
compatibility_date = "2024-01-01"

[[d1_databases]]
binding = "DB"
database_name = "icevault"
database_id = "YOUR-D1-DATABASE-ID"

[[kv_namespaces]]
binding = "RATE_LIMIT_KV"
id = "YOUR-KV-NAMESPACE-ID"

[[r2_buckets]]
binding = "IMAGES"
bucket_name = "icevault-images"
```

Create a KV namespace:
```powershell
wrangler kv namespace create RATE_LIMIT_KV
# Copy the ID into wrangler.toml
```

Create `src/index.js` and paste the contents of `icevault_worker.js` from this repo.

Update these constants with your own values:
- `ALLOWED_ORIGINS` — your GitHub Pages URL
- `APP_URL` — your GitHub Pages URL
- `R2_PUBLIC_URL` — your R2 public URL from Step 3

Then deploy:
```powershell
wrangler login
wrangler secret put MAILEROO_API_KEY
wrangler secret put EMAIL_FROM        # e.g. noreply@yourdomain.maileroo.org
wrangler deploy
```

---

### Step 6 — Update the app to point to your worker

1. In your forked repo, edit `docs/js/app.js`
2. Find: `const WORKER_URL = 'https://...'`
3. Replace with your Cloudflare Worker URL (shown after `wrangler deploy`)
4. Commit — GitHub Pages auto-deploys in ~30 seconds

---

### Step 7 — Get your Anthropic API key

1. Sign up at [console.anthropic.com](https://console.anthropic.com)
2. **API Keys → Create Key** → copy it
3. In the app click **⚙ API Keys** → paste your key → Save
4. This key stays in your browser only — never stored in the app or database

---

### Step 8 — Test it

1. Visit `https://YOUR-USERNAME.github.io/icevault`
2. Click **⚙ API Keys** → paste your Anthropic key → Save
3. Click **👤 Sign In** → Create Account
4. Go to **Scan Card** → drop a card photo → watch the AI read it
5. Save to collection — image uploads to R2, metadata syncs to D1

---

### Optional — Build Android app

1. Go to [pwabuilder.com](https://pwabuilder.com)
2. Enter your GitHub Pages URL
3. Click **Package For Stores → Other Android → Download Package**
4. Transfer APK to Android phone and install

---

## 🗒 Project Notes

See [`PROJECT_NOTES.md`](./PROJECT_NOTES.md) for full internal project context including architecture decisions, known issues, pending priority list, and deployment commands.

---

## ⚖️ License

MIT — free to use, fork, and modify.