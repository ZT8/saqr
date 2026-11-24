# Around

منصة طلب من السيارة (virtual drive-thru) للإمارات. هذا الفرع (`around-app`) منفصل عن مشروع صقر.

- `server/` الخادم (Node + Express + SQLite)
- `web/` الموقع ولوحات التاجر والفرع والإدارة (React + Vite)
- `mobile/` تطبيق العميل (Flutter) — بناء IPA عبر `.github/workflows/ios.yml`
