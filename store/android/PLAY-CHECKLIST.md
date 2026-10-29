# Android / Google Play – checklist (Fodmara)

Status 26 Oct: steps 1, 3, 4 done; step 2 done except content rating (IARC terms = Steffen); step 5: AAB uploaded (draft 1.0.0, internal, testers = Ilumie testers) – Steffen rolls out + creates Monetize products; step 6: RevenueCat Play app + goog_ key done, service-account JSON in RevenueCat = Steffen.

Same order as Migrano (see App-Playbook §7):
1. Play Console app `com.ilumie.fodmara` (Fodmara – Tinnitus Tracker, en-US default, app, free). Store listing en/da/de/sv/no from `store/listing/*.md`; graphics: `store/android/icon-512.png`, `feature-graphic-<lang>.png`, `store/screenshots/<lang>/store-android-N.png` (upload via ilumie.com/play-assets/fodmara/). Category Medical, support@fodmara.app, https://fodmara.app, privacy https://fodmara.app/privacy (mirror on ilumie.com/fodmara/privacy/ if Google's SSL check fails).
2. Declarations: no ads, app access = Play Billing instructions, content rating (PEGI 3, digital purchases), 18+, data safety = purchase history + device id (RevenueCat; air pressure town coordinates are sent to Open-Meteo only when the user turns it on – not linked, not stored), health = condition management, no ad id, AI = none.
3. Keystore: `keytool -genkeypair -v -keystore fodmara-upload.jks -alias fodmara -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=Therkildsen Group, O=Therkildsen Group, L=Viborg, C=DK"` → Codemagic Android keystores, reference `fodmara_upload`.
4. New JSON key on `codemagic-play@ilumie-play.iam.gserviceaccount.com` → group `google_play` on the fodmara Codemagic app.
5. `android-release` (internal, draft) → roll out internal test → Monetize: `fodmara_pro_yearly`/`p1y` base 119,20 DKK (= 149 incl. VAT) + offer `trial7`; `fodmara_pro_lifetime`/`lifetime` base 279,20 (= 349).
6. RevenueCat Play app + `goog_` key in app.config.json; service-account JSON in RevenueCat.
