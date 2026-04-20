# 🏒 Ice Vault — Hockey Card Manager

A free, open-source hockey card collection manager with AI-powered scanning, condition grading, graded cert lookup, eBay listing, and cloud account sync — all from your browser or as a native iOS/Android app.

---

## ✨ Features

### 📷 Card Scanning
- **Drop or photograph** any hockey card
- **AI reads the card** automatically — player name, year, brand/set, card number, team, parallel/variation
- **AI condition estimate** — PSA-style 1–10 grade with centering, corners, edges, and surface breakdown
- Clearly labeled as **AI estimate only** — not an official grading company grade
- **✕ Clear** button to rescan a bad photo instantly

### ⬜ Graded Cert Lookup
- **Option A — AI Slab Scan** (~$0.01–0.03): photograph your graded slab — AI reads the label through the plastic and fills in all details including cert number, official grade, player, year, and set
- **Option B — Free cert # / QR lookup**: enter a cert number or scan the QR/barcode on the slab — opens the official registry in a new tab for manual entry (zero API cost)
- Supports **8 grading companies**: PSA, BGS, SGC, CGC, Authority, TAG, KSA, HGA
- QR scanning auto-detects the grading company from the barcode URL

### 🗂 Collection Management
- Browse all cards in a **grid view** with thumbnails
- **Search** by player, year, brand, team, or tag
- **Filter** by collection bucket, eBay status
- **Sort** by newest, oldest, player name, value, or grade
- **Tag system** — add custom tags (Rookie, HOF, Auto, etc.) and filter by tag
- **Click any card** to view full details, edit tags, change collection bucket, or enlarge the image
- **Lightbox image viewer** — click the card photo to expand it full screen

### 🛒 List on eBay
- Select any card from your collection to create a listing
- Auto-generates a listing title (up to 80 characters)
- **Optional AI description** (~$0.01–0.02): generates a collector-focused eBay listing description based on card details, grade, and parallel
- **🔍 eBay Sold Listings** button — opens eBay pre-filtered to completed sold listings for real market pricing
- **📈 130point** button — copies the search term to clipboard and opens 130point.com for historical price data
- Direct **eBay Trading API** submission (requires eBay developer credentials)

### 👤 User Accounts & Cloud Sync
- **Free accounts** — sign up with email and password
- Collection **syncs to the cloud** via Cloudflare D1 — accessible from any device
- **Guest mode** — full app works without an account, collection stored locally in browser
- Visible warning on save buttons when not signed in
- **Forgot password** — reset link sent to your email via Resend
- API keys are **never saved to your account** — stored locally on your device only

### 🔒 Privacy & Cost Transparency
- All API keys stored in **browser localStorage only** — never sent to any server or database
- Cost warnings on every AI-powered action so you always know when an API call is made:
  - Card scan: ~$0.01–0.03
  - Slab scan: ~$0.01–0.03
  - eBay description (optional): ~$0.01–0.02
- Cert # lookup and QR decoding: **free, no API call**
- eBay Sold and 130point links: **free, no API call**

---

## 🌐 Use as a Web App

**Live site:** `https://Ciiiv.github.io/icevault`

Visit the URL and click **⚙ API Keys** to enter your keys. Click **👤 Sign In** to create a free account and sync your collection across devices.

### API Keys needed:
| Key | Where to get it | Used for |
|-----|----------------|---------|
| Anthropic `sk-ant-...` | [console.anthropic.com](https://console.anthropic.com) | Card scanning, slab reading, eBay descriptions |
| eBay App ID | [developer.ebay.com](https://developer.ebay.com) | eBay listing (optional) |
| eBay OAuth Token | eBay OAuth flow | eBay listing (optional) |

> **Privacy note:** API keys are stored only in your browser's local storage on your device. They are never sent to, saved in, or accessible by this app, any server, or any database — even if you have an account. You will need to re-enter your keys if you clear your browser cache, use a different browser, or switch devices.

---

## 📱 Build as iOS / Android App

The mobile app uses [Capacitor](https://capacitorjs.com) to wrap the web app in a native shell with real camera access.

### iOS
```bash
cd capacitor-app
npm install
npx cap add ios
node build.js
npx cap sync ios
npx cap open ios   # opens Xcode → hit Run
```

### Android
```bash
npx cap add android
node build.js
npx cap sync android
npx cap open android   # opens Android Studio → hit Run
```

See `SETUP.md` for full mobile build instructions.

---

## 🏗 Project Structure

```
icevault/
├── docs/
│   └── index.html          # The entire web app (single file)
├── capacitor-app/           # Native iOS/Android wrapper
│   ├── package.json
│   ├── capacitor.config.json
│   └── build.js
└── .github/workflows/
    └── deploy.yml           # Auto-deploys to GitHub Pages on push
```

---

## 🚀 Deploy Your Own

1. Fork this repo
2. Go to **Settings → Pages → Source: GitHub Actions**
3. Push to `main` — auto-deploys in ~30 seconds

For full cloud sync (user accounts), you'll need:
- A [Cloudflare](https://cloudflare.com) account (free)
- A Cloudflare Worker (proxy + auth backend)
- A Cloudflare D1 database (collection storage)
- A [Resend](https://resend.com) account for password reset emails (free tier)

See `SETUP.md` for complete instructions.

---

## ⚖️ License

MIT — free to use, fork, and modify.
