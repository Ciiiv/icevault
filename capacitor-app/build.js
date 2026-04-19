/**
 * build.js — Copies docs/index.html into www/ and patches it
 * for Capacitor native camera + secure storage.
 */

const fs = require('fs');
const path = require('path');

const srcFile = path.resolve(__dirname, '../docs/index.html');
const outDir = path.resolve(__dirname, 'www');
const outFile = path.join(outDir, 'index.html');

if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

let html = fs.readFileSync(srcFile, 'utf8');

// 1. Inject Capacitor core bridge (must be first script in <head>)
const capacitorScript = `
  <script src="capacitor.js"></script>
  <script>
    // Detect if running inside Capacitor native shell
    window.IS_NATIVE = !!(window.Capacitor && window.Capacitor.isNativePlatform());

    // Override camera open to use Capacitor Camera plugin when native
    window.nativeCameraOverride = async function() {
      if (!window.IS_NATIVE) return false;
      try {
        const { Camera, CameraResultType, CameraSource } = window.Capacitor.Plugins;
        const image = await Camera.getPhoto({
          quality: 90,
          allowEditing: false,
          resultType: CameraResultType.DataUrl,
          source: CameraSource.Camera,
          presentationStyle: 'fullscreen'
        });
        return image.dataUrl; // base64 data URL
      } catch (e) {
        console.warn('Native camera error:', e);
        return false;
      }
    };

    // Override storage to use Capacitor Preferences when native
    window.nativeStorage = {
      async get(key) {
        if (!window.IS_NATIVE) return localStorage.getItem(key);
        const { Preferences } = window.Capacitor.Plugins;
        const result = await Preferences.get({ key });
        return result.value;
      },
      async set(key, value) {
        if (!window.IS_NATIVE) { localStorage.setItem(key, value); return; }
        const { Preferences } = window.Capacitor.Plugins;
        await Preferences.set({ key, value: String(value) });
      }
    };
  </script>`;

// Inject right after <head>
html = html.replace('<head>', '<head>' + capacitorScript);

// 2. Patch openCamera() to prefer native camera
const nativeCameraPatch = `
    // PATCHED: try native camera first
    async function openCamera() {
      if (window.IS_NATIVE) {
        const dataUrl = await window.nativeCameraOverride();
        if (dataUrl) {
          currentImageData = dataUrl;
          setPreviewImage(dataUrl);
          return;
        }
      }
      // fallback to getUserMedia (web)
      try {
        cameraStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        document.getElementById('cameraFeed').srcObject = cameraStream;
        document.getElementById('cameraModal').classList.add('open');
      } catch {
        showToast('Camera access denied or unavailable', 'error');
      }
    }`;

// Replace original openCamera function
html = html.replace(
  /async function openCamera\(\) \{[\s\S]*?^\s{2}\}/m,
  nativeCameraPatch
);

// 3. Patch getKeys / saveApiKeys to use native storage when available
const storageInitPatch = `
    // PATCHED: async-safe key loading for native
    async function initFromStorage() {
      const keys = ['iceVault_cards','iceVault_anthropicKey','iceVault_ebayApp','iceVault_ebayToken'];
      for (const k of keys) {
        const v = await window.nativeStorage.get(k);
        if (v && !localStorage.getItem(k)) localStorage.setItem(k, v);
      }
      collection = JSON.parse(localStorage.getItem('iceVault_cards') || '[]');
      updateHeaderStats();
    }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initFromStorage);
    } else {
      initFromStorage();
    }`;

// Inject before closing </script>
html = html.replace('// INIT\nupdateHeaderStats();', '// INIT\nupdateHeaderStats();\n' + storageInitPatch);

fs.writeFileSync(outFile, html, 'utf8');
console.log(`✅ Built: ${outFile}`);
console.log(`   IS_NATIVE bridge injected`);
console.log(`   Native camera override injected`);
console.log(`   Native storage overlay injected`);
console.log('\nNext steps:');
console.log('  npx cap add ios      (first time only)');
console.log('  npx cap add android  (first time only)');
console.log('  npm run ios          (build + open Xcode)');
console.log('  npm run android      (build + open Android Studio)');
