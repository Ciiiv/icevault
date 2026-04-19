# Ice Vault — Setup Guide

## Part 1: Publish to GitHub Pages (free hosting)

### Step 1 — Create the repo

1. Go to [github.com/new](https://github.com/new)
2. Name it `icevault` (or anything you like)
3. Set it to **Public**
4. Click **Create repository**

### Step 2 — Upload the files

**Option A: GitHub web UI (easiest)**
1. In your new repo, click **Add file → Upload files**
2. Upload the entire `icevault/` folder contents
3. Commit to `main`

**Option B: Git CLI**
```bash
git clone https://github.com/YOUR-USERNAME/icevault.git
cd icevault
# copy all files from the icevault/ folder here
git add .
git commit -m "Initial Ice Vault release"
git push origin main
```

### Step 3 — Enable GitHub Pages

1. Go to your repo → **Settings → Pages**
2. Under **Source**, select **GitHub Actions**
3. The workflow at `.github/workflows/deploy.yml` will auto-run on every push
4. After ~60 seconds, your site is live at:
   ```
   https://YOUR-USERNAME.github.io/icevault
   ```

### Step 4 — Share it

Anyone can visit your URL and use the app with their own API keys.
Keys stay in their browser — you never see them.

---

## Part 2: Build the iOS App

### Prerequisites
- Mac with macOS 13+
- Xcode 15+ (free from App Store)
- Apple Developer account — free for device testing, $99/yr for App Store
- Node.js 18+ (`brew install node`)

### Steps

```bash
# 1. Go into the capacitor-app folder
cd icevault/capacitor-app

# 2. Install dependencies
npm install

# 3. Initialize Capacitor (first time only)
npx cap add ios

# 4. Build the web app into www/
node build.js

# 5. Sync to native project
npx cap sync ios

# 6. Open in Xcode
npx cap open ios
```

### In Xcode:

1. Select the **App** target in the left panel
2. Go to **Signing & Capabilities** → set your Team (Apple ID)
3. Change **Bundle Identifier** to something unique, e.g. `com.yourname.icevault`
4. Open `App/App/Info.plist` and add the contents of `ios-info-plist-additions.xml`
5. Select your device or a simulator
6. Press **▶ Run**

### For App Store release:
- Set version/build number in Xcode
- Product → Archive → Distribute App → App Store Connect
- Submit via App Store Connect at [appstoreconnect.apple.com](https://appstoreconnect.apple.com)

---

## Part 3: Build the Android App

### Prerequisites
- Any OS (Windows, Mac, Linux)
- Android Studio (free from [developer.android.com/studio](https://developer.android.com/studio))
- Java 17+ (bundled with Android Studio)
- Node.js 18+

### Steps

```bash
# 1. Go into the capacitor-app folder
cd icevault/capacitor-app

# 2. Install dependencies
npm install

# 3. Initialize Capacitor (first time only)
npx cap add android

# 4. Build the web app
node build.js

# 5. Sync to native project
npx cap sync android

# 6. Open in Android Studio
npx cap open android
```

### In Android Studio:

1. Open `android/app/src/main/AndroidManifest.xml`
2. Add the permissions from `android-manifest-additions.xml`
3. Select a device/emulator from the dropdown
4. Press **▶ Run**

### For Play Store release:
- Build → Generate Signed Bundle/APK → Android App Bundle
- Upload to [play.google.com/console](https://play.google.com/console)

---

## Part 4: Keeping Everything in Sync

When you update `docs/index.html` (new features, bug fixes):

```bash
# Web: just push to main — GitHub Actions auto-deploys
git add docs/index.html
git commit -m "Update app"
git push

# Mobile: rebuild and sync
cd capacitor-app
node build.js
npx cap sync
# then re-run from Xcode / Android Studio
```

---

## API Key Reference

| Key | Where to get it | Required for |
|-----|----------------|-------------|
| Anthropic `sk-ant-...` | [console.anthropic.com](https://console.anthropic.com) | Card scanning + grading + eBay descriptions |
| eBay App ID | [developer.ebay.com](https://developer.ebay.com) → My Keys | eBay listing |
| eBay OAuth Token | eBay OAuth flow with `sell.item` scope | eBay listing |

### eBay OAuth Token (quick path)
1. Log in to [developer.ebay.com](https://developer.ebay.com)
2. Go to **Hi [name] → Application Keys**
3. Create a production app → get App ID
4. Use the **Get a Token from eBay via Your Application** tool
5. Authorize with your eBay seller account
6. Copy the `User Token` — paste it in Ice Vault's API Keys modal
