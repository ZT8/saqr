#!/usr/bin/env bash
# One-time setup: generates the Android and iOS project folders around lib/ (existing files are kept),
# allows the app to reach a local development server, and fetches packages.
set -euo pipefail
cd "$(dirname "$0")"

flutter create --platforms=android,ios --org ae.saqr --project-name saqr .

# Android: internet permission for release builds + plain-http to a dev server.
MANIFEST=android/app/src/main/AndroidManifest.xml
grep -q 'android.permission.INTERNET' "$MANIFEST" || \
  sed -i.bak 's#<application#<uses-permission android:name="android.permission.INTERNET"/>\n    <application android:usesCleartextTraffic="true"#' "$MANIFEST"

# iOS: allow http on the local network for development (use https in production).
PLIST=ios/Runner/Info.plist
if ! grep -q NSAppTransportSecurity "$PLIST"; then
  /usr/libexec/PlistBuddy -c "Add :NSAppTransportSecurity dict" "$PLIST" 2>/dev/null || true
  /usr/libexec/PlistBuddy -c "Add :NSAppTransportSecurity:NSAllowsLocalNetworking bool true" "$PLIST" 2>/dev/null || true
  /usr/libexec/PlistBuddy -c "Add :NSAppTransportSecurity:NSAllowsArbitraryLoads bool true" "$PLIST" 2>/dev/null || true
fi
# iOS: Arabic first.
/usr/libexec/PlistBuddy -c "Add :CFBundleLocalizations array" "$PLIST" 2>/dev/null || true
/usr/libexec/PlistBuddy -c "Add :CFBundleLocalizations:0 string ar" "$PLIST" 2>/dev/null || true
/usr/libexec/PlistBuddy -c "Add :CFBundleLocalizations:1 string en" "$PLIST" 2>/dev/null || true
/usr/libexec/PlistBuddy -c "Set :CFBundleDisplayName صقر" "$PLIST" 2>/dev/null || true

flutter pub get
echo "Done. Run: flutter run"
