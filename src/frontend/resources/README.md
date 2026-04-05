# App Icon & Splash Screen Resources

Place your icon and splash screen source images here:

- `icon.png` — App icon (1024x1024 px, PNG, no transparency for iOS)
- `splash.png` — Splash screen (2732x2732 px, PNG, centered logo on solid bg)

## Generate platform assets

After placing your source images, use the Capacitor asset generator:

```bash
npm install -g @capacitor/assets
npx capacitor-assets generate --iconBackgroundColor "#ffffff" --splashBackgroundColor "#ffffff"
```

This will auto-generate all required sizes for Android (mipmap-*) and iOS (Assets.xcassets).
