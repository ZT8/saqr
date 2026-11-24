# Around (Flutter)

تطبيق العميل لمنصة Around: الدخول برقم الهاتف، المتاجر، المنيو والسلة، الدفع، وتتبع الطلب بالموقع حتى الاستلام.
يتصل بنفس الخادم الموجود في `wagfa-app/server` (نفس الـ API).

## التشغيل (على Mac)
```bash
cd around_flutter
flutter create --org ae.around --project-name around .   # يولّد مجلدي ios و android حول الكود الحالي
flutter pub get
flutter analyze
flutter run --dart-define=API_URL=http://<عنوان-جهازك>:4000
```
> على المحاكي: iOS يقبل `http://localhost:4000`، وأندرويد يحتاج `http://10.0.2.2:4000`.

## الأذونات (بعد flutter create)
**iOS** — أضف في `ios/Runner/Info.plist`:
```xml
<key>NSLocationWhenInUseUsageDescription</key>
<string>نحتاج موقعك عشان الفرع يجهّز طلبك ويعرف متى توصل.</string>
```
**Android** — أضف في `android/app/src/main/AndroidManifest.xml` داخل `<manifest>`:
```xml
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION"/>
<uses-permission android:name="android.permission.INTERNET"/>
```
وللاتصال بـ http (التطوير فقط) على أندرويد أضف `android:usesCleartextTraffic="true"` في وسم `<application>`.

## بناء IPA
افتح `ios/Runner.xcworkspace` في Xcode، اختر الفريق وBundle ID، ثم Product → Archive.
أو: `flutter build ipa --dart-define=API_URL=https://api.yourdomain.com`

## الموجود وغير الموجود
- موجود: دخول OTP، الرئيسية والبحث والتصنيفات، المتجر والمنيو والفروع، السلة، السيارات، الدفع (تجريبي)، تتبع الطلب بالموقع، تقييم الطلب، طلباتي، حسابي.
- لاحقاً: الولاء، الهدايا، السوشال والستوريات، الإشعارات الفورية (Push)، الدفع الحقيقي (بوابة دفع عبر SDK).

## بناء IPA بدون Mac (GitHub Actions)
1. ارفع مجلد `around_flutter` إلى مستودع GitHub خاص.
2. من Settings → Secrets and variables → Actions أضف هذي الأسرار:
   - `BUNDLE_ID` (مثل `ae.around.app`) · `APPLE_TEAM_ID` · `PROFILE_NAME` (اسم الـ Provisioning Profile بالضبط)
   - `EXPORT_METHOD`: `app-store` أو `ad-hoc` أو `enterprise` أو `development` حسب نوع شهادتك
   - `API_URL` (رابط الخادم https) · `CERT_PASSWORD`
   - `CERT_P12_BASE64` و`PROFILE_BASE64`: ملف الشهادة `.p12` وملف `.mobileprovision` محوّلين base64 (`base64 -i file | pbcopy` على Mac، أو `base64 -w0 file` على لينكس)
3. من تبويب Actions شغّل «Build iOS IPA»، وحمّل `Around-ipa` من نتيجة التشغيل.
