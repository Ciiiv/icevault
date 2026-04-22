# 🏒 Ice Vault — Hockey Card Manager

A free, open-source hockey card collection manager with AI-powered scanning, condition grading, graded cert lookup, eBay listing, and cloud account sync — available as a web app and Android app.

---

## ✨ Features

### 📷 Card Scanning
- Drop or photograph any hockey card
- **AI reads the card automatically** — player name, year, brand/set, card number, team, parallel/variation
- **AI condition estimate** — PSA-style 1–10 grade with centering, corners, edges, and surface breakdown
- Clearly labeled as **AI estimate only** — not an official grading company grade
- ✕ Clear button to rescan a bad photo instantly
- ~$0.01–0.03 per scan using your own Anthropic API key

### ⬜ Graded Cert Lookup
- **Option A — AI Slab Scan** (~$0.01–0.03): photograph your graded slab — AI reads the label through the plastic and fills in all details including cert number, official grade, player, year, and set
- **Option B — Free cert # / QR lookup**: enter a cert number or scan the QR/barcode on the slab — opens the official registry in a new tab for manual entry (zero API cost)
- Supports **8 grading companies**: PSA, BGS, SGC, CGC, Authority, TAG, KSA, HGA
- QR scanning auto-detects the grading company from the barcode URL
- Both options can be used together — scan the slab with AI then verify cert # at the registry

### 🗂 Collection Management
- Grid view with card thumbnails, grades, tags, and values
- Search by player, year, brand, team, or tag
- Filter by collection bucket and eBay listing status
- Sort by newest, oldest, player name, value, or grade
- Custom tag system — add, remove, and filter by tags
- Click any card for full details, edit tags, change collection, enlarge image
- Lightbox image viewer — click card photo to expand full screen
- Tags visible on cards in grid view

### 🛒 List on eBay
- Select any card to create a listing
- Auto-generates listing title (80 character eBay limit)
- Optional AI description (~$0.01–0.02) — collector-focused, editable before listing
- **🔍 eBay Sold Listings** — opens eBay pre-filtered to completed sold listings for real market pricing
- **📈 130point** — copies search term to clipboard and opens 130point.com for price history
- Direct eBay Trading API submission (requires eBay developer credentials)

### 👤 User Accounts & Cloud Sync
- Free accounts — sign up with email and password
- Collection syncs to the cloud via Cloudflare D1 — accessible from any device
- Guest mode — full app usable without an account, collection stored locally in browser only
- Visible red warning on save buttons when not signed in
- Forgot password — reset link sent to email via Brevo transactional email
- Password visibility toggle on all password fields
- API keys are **never saved to your account** — stored locally on your device only
- Session lasts 30 days before requiring re-login

### 🔒 Privacy & Security
- All API keys stored in browser localStorage only — never sent to any server or database
- Passwords hashed with **bcrypt (cost factor 12)** before storing — never stored as plain text
- Timing attack prevention on login endpoint
- Cloudflare Worker locked to only accept requests from the Ice Vault domain (origin check)
- Cost warnings on every AI-powered action so you always know when an API call is made
- Even with a user account, API keys are never saved to the database — by design

> **Email limitation:** Transactional emails (welcome, password reset) require a verified sender domain. Without a custom domain, emails only work if you verify your own email address as a sender in Brevo. To send to all users, a custom domain (~$10/yr) is required.

---

## 💰 API Cost Summary

| Action | Cost | API Used |
|--------|------|----------|
| Card scan (OCR + grade) | ~$0.01–0.03 | Anthropic Claude |
| AI slab scan (graded cert) | ~$0.01–0.03 | Anthropic Claude |
| eBay description (optional) | ~$0.01–0.02 | Anthropic Claude |
| Cert # / QR lookup | Free | None |
| eBay sold listings link | Free | None |
| 130point link | Free | None |
| Account sync | Free | Cloudflare D1 |
| Password reset email | Free (with verified domain) | Brevo |

---

## 🌐 Web App

**Live site (repo owner's instance):** `https://Ciiiv.github.io/icevault`
> If you've forked this repo, your site will be at `https://YOUR-USERNAME.github.io/icevault`

Visit and click **⚙ API Keys** to enter your keys. Click **👤 Sign In** to create a free account and sync your collection across devices.

### API Keys needed

| Key | Where to get it | Used for |
|-----|----------------|---------|
| Anthropic `sk-ant-...` | [console.anthropic.com](https://console.anthropic.com) | Card scanning, slab reading, eBay descriptions |
| eBay App ID | [developer.ebay.com](https://developer.ebay.com) | eBay listing (optional) |
| eBay OAuth Token | eBay OAuth flow with `sell.item` scope | eBay listing (optional) |

> **Privacy:** API keys are stored only in your browser's local storage. They are never sent to, saved in, or accessible by this app, any server, or database — even if you have an account. You will need to re-enter your keys if you clear your browser cache, use a different browser, or switch devices.

---

## 📱 Android App

The Android app is built using **PWABuilder** — a free Microsoft tool that wraps the web app into a native Android package (TWA — Trusted Web Activity). Since the app loads from your GitHub Pages URL, any update to `index.html` automatically updates the Android app too — no rebuild needed.

### Install via sideload (no Play Store needed)
1. Go to [pwabuilder.com](https://pwabuilder.com)
2. Enter your GitHub Pages URL (e.g. `https://YOUR-USERNAME.github.io/icevault`)
3. Click **Package For Stores → Other Android → Download Package**
4. Unzip the download, transfer the APK to your Android phone
5. Enable "Install from unknown sources" in Android Settings → Security
6. Open the APK and tap Install
7. Ice Vault appears on your home screen as a native app

### Google Play Store submission
1. Use the **Google Play** tab in PWABuilder instead of Other Android
2. You will need a Google Play developer account ($25 one-time fee)
3. Follow PWABuilder's [packaging instructions](https://docs.pwabuilder.com/#/builder/android)

---

## 🏗 Full Stack & Dependencies

| Component | Service | Purpose | Cost |
|-----------|---------|---------|------|
| Web hosting | GitHub Pages | Serves the app | Free |
| API proxy + Auth | Cloudflare Workers | Forwards Anthropic requests, handles user auth | Free tier |
| Database | Cloudflare D1 | Stores user accounts and card collections | Free tier (5GB) |
| Email | Brevo | Welcome emails and password reset (requires verified domain) | Free tier (300/day) |
| AI | Anthropic Claude | Card OCR, condition grading, eBay descriptions | Pay per use |
| Android app | PWABuilder | Wraps web app as Android APK / Play Store bundle | Free |
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
| GET | `/collection` | Fetch user's collection from D1 |
| PUT | `/collection` | Save/sync full collection to D1 |
| DELETE | `/collection/:id` | Delete single card from D1 |

### Cloudflare Worker — environment bindings required
| Variable | Type | Purpose |
|----------|------|---------|
| `DB` | D1 Database binding | `icevault` database |
| `BREVO_API_KEY` | Secret | Brevo transactional email API key |

---

## 📁 Project Structure

```
icevault/
├── docs/                          # GitHub Pages web app (auto-deployed)
│   ├── index.html                 # Entire app — HTML, CSS, and JS in one file
│   ├── manifest.json              # PWA manifest — name, icons, theme colors
│   ├── sw.js                      # Service worker — network-first caching
│   └── icons/
│       ├── icon-192.png           # App icon 192x192 (home screen, PWA)
│       └── icon-512.png           # App icon 512x512 (splash screen, Play Store)
├── icevault-worker.js             # Cloudflare Worker source — auth, API proxy, collection sync
├── .github/
│   └── workflows/
│       └── deploy.yml             # Auto-deploys docs/ to GitHub Pages on every push to main
└── README.md                      # This file
```

---

## 🚀 Deploy Your Own Copy

Follow these steps exactly to get your own fully working instance.

### Prerequisites
- A [GitHub](https://github.com) account
- A [Cloudflare](https://cloudflare.com) account (free)
- A [Brevo](https://brevo.com) account (free) + a verified domain for sending emails to all users
- [Node.js](https://nodejs.org) LTS installed on your computer
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/) installed: `npm install -g wrangler`

---

### Step 1 — Fork and host on GitHub Pages

1. Click **Fork** on this repo → name it `icevault` → set to Public
2. Go to your forked repo → **Settings → Pages → Source → GitHub Actions**
3. Push any change to `main` — site auto-deploys in ~30 seconds
4. Your site will be live at `https://YOUR-USERNAME.github.io/icevault`

---

### Step 2 — Create the D1 database

1. Cloudflare dashboard → **Storage & Databases → D1**
2. Click **Create database** → name it `icevault` → leave location as default → **Create**
3. Go into the database → click **Console** tab
4. Run each of these queries one at a time (paste and hit Execute after each):

```sql
CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, created_at TEXT NOT NULL)
```
```sql
CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, user_id TEXT NOT NULL, expires_at TEXT NOT NULL, FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE)
```
```sql
CREATE TABLE IF NOT EXISTS password_resets (token TEXT PRIMARY KEY, user_id TEXT NOT NULL, expires_at TEXT NOT NULL, FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE)
```
```sql
CREATE TABLE IF NOT EXISTS cards (id TEXT NOT NULL, user_id TEXT NOT NULL, card_data TEXT NOT NULL, created_at TEXT NOT NULL, PRIMARY KEY (id, user_id), FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE)
```
```sql
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id)
```
```sql
CREATE INDEX IF NOT EXISTS idx_resets_user ON password_resets(user_id)
```
```sql
CREATE INDEX IF NOT EXISTS idx_cards_user ON cards(user_id)
```
5. Verify by typing `/tables` — you should see `users`, `sessions`, `password_resets`, `cards`
6. Note your **database ID** from the Overview tab

---

### Step 3 — Create a Brevo account and get an API key

1. Sign up free at [brevo.com](https://brevo.com)
2. Go to **Settings → SMTP & API → API Keys & MCP** → generate a new API key named `icevault`
3. Copy the API key (you only see it once)
4. **Important:** To send emails to all users you must verify a custom domain in Brevo → **Settings → Senders, domains, IPs → Add a domain**. Without this, emails only work to your own verified address.

---

### Step 4 — Set up the Cloudflare Worker with Wrangler

```powershell
# Create project folder
mkdir icevault-worker
cd icevault-worker
npm init -y
npm install bcryptjs

# Create config file
New-Item wrangler.toml
```

Paste this into `wrangler.toml` (update with your own database ID):
```toml
name = "your-worker-name"
main = "src/index.js"
compatibility_date = "2024-01-01"

[[d1_databases]]
binding = "DB"
database_name = "icevault"
database_id = "YOUR-D1-DATABASE-ID"
```

Create `src/index.js` and paste the contents of `icevault-worker.js` from this repo.

Update these two lines with your own GitHub username:
- Line 6: `'https://YOUR-USERNAME.github.io'`
- Line 10: `const APP_URL = 'https://YOUR-USERNAME.github.io/icevault'`

Then deploy:
```powershell
wrangler login
wrangler secret put BREVO_API_KEY   # paste your Brevo API key when prompted
wrangler deploy
```

---

### Step 5 — Update the app to point to your worker

1. In your forked repo, edit `docs/index.html`
2. Find: `const WORKER_URL = 'https://...'`
3. Replace with your own Cloudflare Worker URL (shown after `wrangler deploy`)
4. Commit — GitHub Pages auto-deploys in ~30 seconds

---

### Step 6 — Get your Anthropic API key

1. Sign up at [console.anthropic.com](https://console.anthropic.com)
2. Go to **API Keys → Create Key** → copy it
3. In the app click **⚙ API Keys** → paste your key → Save
4. This key stays in your browser only — never stored in the app or database

---

### Step 7 — Test it

1. Visit `https://YOUR-USERNAME.github.io/icevault`
2. Click **⚙ API Keys** → paste your Anthropic key → Save
3. Click **👤 Sign In** → Create Account
4. Go to **Scan Card** → drop a card photo → watch the AI read it
5. Save to collection — confirm it syncs to your D1 database

---

### Optional — Build Android app

1. Go to [pwabuilder.com](https://pwabuilder.com)
2. Enter your GitHub Pages URL
3. Click **Package For Stores → Other Android → Download Package**
4. Transfer the APK to your Android phone and install

---

## ⚖️ License

MIT — free to use, fork, and modify.
