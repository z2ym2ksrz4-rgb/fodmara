# Store listing

One file per language (en, da, de, sv, nb). Character limits noted per field:
App Store name 30, subtitle 30, keywords 100, promo text 170, description 4000.
Google Play title 30, short description 80, full description 4000.
Germany is the primary market (Sonar 22 Oct 2026: "tinnitus app" DE Android 43/25, iOS 24/21); the Nordic terms sit at Apple's floor.

Screenshots: `npm run screenshots` + `node scripts/store-frames.mjs` → `store/screenshots/<lang>/`.
Check limits: `node scripts/play-listing-check.mjs .`
