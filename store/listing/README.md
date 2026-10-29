# Store listing

One file per language (en, da, de, sv, nb). Character limits noted per field:
App Store name 30, subtitle 30, keywords 100, promo text 170, description 4000.
Google Play title 30, short description 80, full description 4000.
Primary markets: Norway, Sweden and Germany, US as a bonus (Sonar 22 Oct 2026: "fodmap" NO 34/9, SE 31/11, "reizdarm tagebuch" DE 41/23, "matdagbok" SE 39/22); the Danish terms sit at Apple's floor.

Screenshots: `npm run screenshots` + `node scripts/store-frames.mjs` → `store/screenshots/<lang>/`.
Check limits: `node scripts/play-listing-check.mjs .`
