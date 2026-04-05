# Ledger — Mobile Build Instructions

## Prerequisites

- **Node.js** >= 18
- **Android Studio** (for Android builds) — [Download](https://developer.android.com/studio)
- **Xcode** (for iOS builds, macOS only) — [Download](https://developer.apple.com/xcode/)
- **Java JDK 17** (required by Android Gradle)

---

## 1. Environment Setup

Copy the example env file and set your API URL:

```bash
cd src/frontend
cp .env.example .env
```

Edit `.env` and set the API URL to your backend:

```env
# Local development
VITE_API_URL=http://localhost:3001

# Production server
VITE_API_URL=https://memelith.fun
# or
VITE_API_URL=http://128.85.36.93:4000
```

> **Important:** For mobile builds, `VITE_API_URL` **must** be an absolute URL
> (not empty) because the app runs inside a WebView with no same-origin server.

---

## 2. Install Dependencies

```bash
cd src/frontend
npm install
```

---

## 3. Build the Web App

```bash
npm run build
```

This creates the `dist/` folder that Capacitor uses as its web directory.

---

## 4. Sync Capacitor

After every web build, sync the native projects:

```bash
npm run cap:sync
```

Or for a specific platform:

```bash
npm run cap:build:android   # build + sync android
npm run cap:build:ios       # build + sync ios
```

---

## 5. Android

### Open in Android Studio

```bash
npm run cap:open:android
```

### Build Debug APK

From Android Studio:
1. **Build** → **Build Bundle(s) / APK(s)** → **Build APK(s)**
2. APK is at: `android/app/build/outputs/apk/debug/app-debug.apk`

Or via command line:

```bash
cd android
./gradlew assembleDebug
```

### Build Release APK

```bash
cd android
./gradlew assembleRelease
```

APK location: `android/app/build/outputs/apk/release/app-release-unsigned.apk`

> You must sign the APK before distribution. See [Android signing docs](https://developer.android.com/studio/publish/app-signing).

### Build AAB (for Play Store)

```bash
cd android
./gradlew bundleRelease
```

AAB location: `android/app/build/outputs/bundle/release/app-release.aab`

### Run on Connected Device / Emulator

```bash
npm run cap:run:android
```

---

## 6. iOS (macOS only)

### Open in Xcode

```bash
npm run cap:open:ios
```

### Build & Run

1. Select your target device or simulator in Xcode
2. Click **Run** (Cmd+R)

Or via CLI:

```bash
npm run cap:run:ios
```

---

## 7. Live Reload (Development)

For testing on a physical device connected to the same network:

1. Find your computer's local IP (e.g. `192.168.1.100`)
2. Edit `capacitor.config.ts`:

```ts
server: {
  url: "http://192.168.1.100:5173",
  cleartext: true,
},
```

3. Start the dev server:

```bash
npm run dev
```

4. Sync and run:

```bash
npm run cap:run:android
# or
npm run cap:run:ios
```

> **Remember** to remove the `server.url` before building for production!

---

## 8. App Icons & Splash Screens

Place your source images in `resources/`:
- `icon.png` — 1024x1024 px
- `splash.png` — 2732x2732 px

Then generate all platform sizes:

```bash
npm install -g @capacitor/assets
npx capacitor-assets generate --iconBackgroundColor "#ffffff" --splashBackgroundColor "#ffffff"
```

---

## Quick Reference

| Task                    | Command                               |
|-------------------------|---------------------------------------|
| Dev server              | `npm run dev`                         |
| Build web               | `npm run build`                       |
| Sync all platforms      | `npm run cap:sync`                    |
| Build + sync Android    | `npm run cap:build:android`           |
| Build + sync iOS        | `npm run cap:build:ios`               |
| Open Android Studio     | `npm run cap:open:android`            |
| Open Xcode              | `npm run cap:open:ios`                |
| Run on Android device   | `npm run cap:run:android`             |
| Run on iOS device       | `npm run cap:run:ios`                 |
| Debug APK               | `cd android && ./gradlew assembleDebug` |
| Release APK             | `cd android && ./gradlew assembleRelease` |
| Play Store AAB          | `cd android && ./gradlew bundleRelease` |
