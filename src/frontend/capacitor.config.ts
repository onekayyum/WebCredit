import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.ledger.app",
  appName: "Ledger",
  webDir: "dist",
  server: {
    // Use https scheme for Android WebView (avoids mixed-content issues)
    androidScheme: "https",
    // For local dev with live-reload, uncomment and set your machine's IP:
    // url: "http://192.168.1.100:5173",
    // cleartext: true,
  },
  plugins: {
    Camera: {
      // Camera permissions are declared in AndroidManifest.xml / Info.plist
    },
  },
  android: {
    allowMixedContent: true,
  },
  ios: {
    contentInset: "automatic",
  },
};

export default config;
