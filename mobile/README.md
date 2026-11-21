# صقر | Saqr — mobile app (Flutter, iOS + Android)

One Flutter codebase for iPhone and Android. It talks to the same Saqr server (`/api/*`) as the web app and uses the same strings. They are bundled in `assets/i18n/strings.json` and refreshed from `/api/i18n`.

**Screens:**
- Scan, with the falcon-eye verdict
- Report
- Registry
- Practice game
- More, which holds:
  - extortion help (confidential case with encrypted evidence, tracking and withdrawal, plus a quick-exit button)
  - family protection (QR pairing and alerts)
  - elder mode (large text, the verdict read aloud, a help button)
  - safety tips
  - settings (language, server address)

The app is Arabic-first (right-to-left), with English available.

**iOS SMS filter (optional, Swift):** `ios_extensions/SaqrMessageFilter/MessageFilterExtension.swift` is an on-device port of Saqr's rules. iOS hands it SMS from unknown senders, and it moves scam-like ones to *Junk* before the user sees them. The message never leaves the phone.

## Requirements
- Flutter 3.27 or newer (`flutter --version`)
- **Android:** Android Studio and the Android SDK
- **iOS:** a Mac with Xcode 15 or newer and CocoaPods. Installing on a real iPhone or making an **IPA** also needs an Apple Developer account.

## Setup (once)
```bash
cd mobile
./setup.sh          # creates android/ and ios/ around lib/, sets network permissions, flutter pub get
```

## Run
1. Start the Saqr server first: `npm start` in the repo root.
2. Run the app:
   ```bash
   flutter run                     # emulator or connected phone
   ```
3. Set the server address under **More → Settings** if the default does not fit your device:
   - Android emulator: `http://10.0.2.2:3000` (the default)
   - iOS simulator: `http://localhost:3000`
   - real phone: `http://<your-computer-IP>:3000`, or your https deployment

## Build
```bash
flutter build apk --release        # Android → build/app/outputs/flutter-apk/app-release.apk
flutter build appbundle            # Android → Google Play (.aab)
flutter build ipa                  # iOS → build/ios/ipa/*.ipa  (Mac + Xcode + Apple signing)
```
**No Mac?** Push the repo to GitHub, open *Actions → Mobile builds → Run workflow*. GitHub's macOS runner builds `saqr-unsigned.ipa` and `app-release.apk` and attaches them to the run. Sign the IPA before installing it: use Sideloadly or AltStore with an Apple ID, or `codesign` with your own certificate. Alternatively, `codemagic.yaml` builds the APK and an iOS archive on Codemagic's cloud Macs. Add your Apple signing there for a signed IPA.

## Add the iOS SMS filter
1. Open `ios/Runner.xcworkspace` in Xcode.
2. Choose **File → New → Target → Message Filter Extension** and name it `SaqrMessageFilter`.
3. Replace the generated `MessageFilterExtension.swift` with `ios_extensions/SaqrMessageFilter/MessageFilterExtension.swift`.
4. Build to a real iPhone. Then go to **Settings → Apps → Messages → Unknown & Spam → SMS Filtering** and choose **Saqr**.

## Tests
```bash
flutter test
```

## What was and wasn't verified
The app and the Swift extension were written and syntax-checked with a parser, but they were **not compiled or run**: the environment they were written in had no Flutter or Xcode toolchain. Run `flutter analyze` and `flutter run` before the demo and fix anything they report.
