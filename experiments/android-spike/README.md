# Taurifer Android Lab: APK proof of concept

An isolated native Android WebView shell for https://taurifer.com/. Requires Android 10+ (API 29+), and initially an internet connection. This is not an offline-bundled client or a production migration.

## Download and install, no PC

The GitHub workflow at https://github.com/pedrochagasmaster/repforge/actions/workflows/android-wrapper-spike.yml publishes TauriferAndroidLab-debug-APK after each build. Download the artifact, extract app-debug.apk from its ZIP, and open the APK in your Android Downloads or Files app. Android may ask you to allow installing apps from the browser or file manager. Keep Play Protect enabled and turn the installation permission off again afterwards.

This is a debug-signed APK. Android does NOT need a Mac, developer account, or a second device. GitHub-hosted builds use different debug signing keys, so a future build may not upgrade over the old lab install. Before uninstalling, export your Taurifer Lab data; uninstalling removes WebView storage.

Android package com.taurifer.lab, application label Taurifer Lab. Separate from Chrome's installed PWA. Workouts in Chrome are not automatically transferred to this WebView. Use dummy data or the existing JSON backup import.

## Features and limitations

- System Android WebView with JavaScript, DOM storage, IndexedDB, first-party cookies and HTTPS-only navigation. Service-worker offline support depends on installed Android System WebView.
- External AI/provider links open outside the app. Android file chooser supports imports.
- HTTP downloads use Android DownloadManager; blob exports attempt an Android Save document picker bridge. Exercise export/import on a device and verify file contents before trusting it.
- No native haptics, StoreKit, Play Billing, notification integration, Health Connect, or synchronization. The site is loaded from live production.
- The live site may emit opted-in PostHog analytics and Cloudflare traffic. Toggle analytics off in Settings during personal testing if desired; a lab User-Agent suffix helps diagnosis.

## Test on phone

1. Start a test program, log sets and complete a workout.
2. Kill the app; relaunch; verify the workout and draft persist.
3. Test backup JSON export to Downloads/Files, open exported file, and import it.
4. Test rest timer while locked, external links, keyboard, Android back, dark mode.
5. Airplane-mode test after initial online launch; compare with the installed Chrome PWA.
6. Record deficiencies before changing Taurifer's production app.

Build: AGP 8.9.2, Gradle 8.11.1, JDK 17, SDK 35. Target SDK 34 is a test-only compatibility choice, not a Play Store release setting.

The work aligns with the product's evidence-gated native roadmap in docs/business-product-thesis.md and docs/adr/0010-product-business-thesis-and-validation-sequencing.md.
