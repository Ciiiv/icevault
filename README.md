# 🏒 Ice Vault — Hockey Card Manager

A free, open-source hockey card collection manager with AI-powered OCR scanning, condition grading, and eBay listing — all from your browser or as a native iOS/Android app.

## ✨ Features

- 📷 **Scan cards** via camera or photo upload
- 🤖 **AI reads the card** — player, year, brand, card number, team, parallel
- 📊 **AI condition grading** — PSA-style 1–10 with centering, corners, edges, surface breakdown
- 🗂 **Collection management** — tags, buckets, search, filter
- 🛒 **eBay listing** — AI-generated descriptions, Trading API submission
- 💾 **All data stays local** — stored in your browser, nothing sent to any server except your own API calls

---

## 🌐 Use as a Web App

**Live site:** `https://YOUR-USERNAME.github.io/icevault`

Just visit the URL and click **⚙ API Keys** to enter:
- Your **Anthropic API key** (`sk-ant-...`) from [console.anthropic.com](https://console.anthropic.com)
- Your **eBay App ID + OAuth token** from [developer.ebay.com](https://developer.ebay.com) *(only needed for listing)*

Keys are saved to your browser's localStorage — never sent anywhere except directly to those APIs.

---

## 📱 Build as iOS / Android App

The mobile app uses [Capacitor](https://capacitorjs.com) to wrap the web app in a native shell, giving you real camera access and App Store distribution.

### Prerequisites

- [Node.js](https://nodejs.org) 18+
- [Xcode](https://developer.apple.com/xcode/) (for iOS, Mac only)
- [Android Studio](https://developer.android.com/studio) (for Android)
- Apple Developer account ($99/yr) for App Store, or free for device testing
- Google Play account ($25 one-time) for Play Store

### Setup

```bash
cd capacitor-app
npm install
```

### Build & Run iOS

```bash
npm run build          # copies app into www/
npx cap sync ios       # syncs web assets to native project
npx cap open ios       # opens Xcode
```
In Xcode: select your device/simulator → ▶ Run

### Build & Run Android

```bash
npm run build
npx cap sync android
npx cap open android   # opens Android Studio
```
In Android Studio: select your device → ▶ Run

### Updating the app

When you change `docs/index.html`:
```bash
npm run build
npx cap sync
```

---

## 🚀 Deploy Your Own GitHub Pages Site

1. Fork this repo
2. Go to **Settings → Pages**
3. Set Source to **GitHub Actions**
4. Push to `main` — site deploys automatically

---

## 🔑 API Key Notes

### Anthropic
- Get key: [console.anthropic.com](https://console.anthropic.com)
- Model used: `claude-opus-4-5` (vision + text)
- Cost: ~$0.01–0.03 per card scan (image input + text output)

### eBay
- Register app: [developer.ebay.com](https://developer.ebay.com)
- Required scope: `https://api.ebay.com/oauth/api_scope/sell.item`
- Use **Trading API** → **AddItem** call
- Sandbox available for testing

---

## 🏗 Project Structure

```
icevault/
├── docs/                    # GitHub Pages web app
│   └── index.html           # The entire app (single file)
├── capacitor-app/           # Native mobile wrapper
│   ├── package.json
│   ├── capacitor.config.json
│   └── www/                 # Built web assets (auto-generated)
└── .github/workflows/
    └── deploy.yml           # Auto-deploy to GitHub Pages
```

---

## ⚖️ License

MIT — free to use, fork, and modify.
