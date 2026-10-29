#!/usr/bin/env bash
# Runs in CI right after `npx cap add ios`: Info.plist keys, deployment target 15.5
# (required by the WidgetBridge pod / WidgetKit), iPhone-only device family.
set -euo pipefail
PLIST=ios/App/App/Info.plist
PB=/usr/libexec/PlistBuddy
set_key() { $PB -c "Set :$1 '$2'" "$PLIST" 2>/dev/null || $PB -c "Add :$1 string '$2'" "$PLIST"; }
# Camera / photo library (meal photos, stored only on the device)
set_key NSCameraUsageDescription "Fodmara can attach a photo of your meal to a meal entry. Photos stay on this device."
set_key NSPhotoLibraryUsageDescription "Fodmara can attach a photo from your library to a meal entry. Photos stay on this device."
# HealthKit (write-only gut symptom samples; optional, toggled in Settings)
set_key NSHealthUpdateUsageDescription "Fodmara can write your logged gut symptoms to Apple Health, if you turn it on in Settings."
set_key NSHealthShareUsageDescription "Fodmara does not read any Health data. This is only needed to show the Apple Health permission screen."
$PB -c "Add :ITSAppUsesNonExemptEncryption bool false" "$PLIST" 2>/dev/null || $PB -c "Set :ITSAppUsesNonExemptEncryption false" "$PLIST"
# Deployment target -> 15.5 (Xcode project + Podfile)
sed -i '' -E 's/IPHONEOS_DEPLOYMENT_TARGET = [0-9.]+;/IPHONEOS_DEPLOYMENT_TARGET = 15.5;/g' ios/App/App.xcodeproj/project.pbxproj
sed -i '' -E "s/platform :ios, '[0-9.]+'/platform :ios, '15.5'/" ios/App/Podfile
grep -n "platform :ios" ios/App/Podfile
# Every pod target gets at least 15.5 (inserted into Capacitor's existing post_install hook)
sed -i '' 's/  assertDeploymentTarget(installer)/  assertDeploymentTarget(installer)\
  installer.pods_project.targets.each { |t| t.build_configurations.each { |c| c.build_settings["IPHONEOS_DEPLOYMENT_TARGET"] = "15.5" if c.build_settings["IPHONEOS_DEPLOYMENT_TARGET"].to_f < 15.5 } }/' ios/App/Podfile
echo "Info.plist and deployment target updated"
# iPhone only (the UI is designed for phones). Widget extension inherits via ios-widget.rb.
sed -i '' -E 's/TARGETED_DEVICE_FAMILY = "1,2";/TARGETED_DEVICE_FAMILY = "1";/g' ios/App/App.xcodeproj/project.pbxproj
grep -c 'TARGETED_DEVICE_FAMILY = "1";' ios/App/App.xcodeproj/project.pbxproj || true
