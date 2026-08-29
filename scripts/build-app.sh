#!/bin/bash
# Builds Latch.app from the SwiftPM executable.
#
# There is no .xcodeproj here on purpose: only the Command Line Tools are
# installed on this machine, so the bundle is assembled by hand. That also keeps
# the build reproducible from a plain `bash scripts/build-app.sh`.
set -euo pipefail

cd "$(dirname "$0")/.."
APP="build/Latch.app"

swift build -c release

rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"
cp ".build/release/Latch" "$APP/Contents/MacOS/Latch"
cp "assets/Latch.icns" "$APP/Contents/Resources/Latch.icns"

cat > "$APP/Contents/Info.plist" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleName</key><string>Latch</string>
    <key>CFBundleDisplayName</key><string>Latch</string>
    <key>CFBundleExecutable</key><string>Latch</string>
    <key>CFBundleIconFile</key><string>Latch</string>
    <key>CFBundleIdentifier</key><string>dev.saksham.latch</string>
    <key>CFBundlePackageType</key><string>APPL</string>
    <key>CFBundleShortVersionString</key><string>0.1.0</string>
    <key>CFBundleVersion</key><string>1</string>
    <key>LSMinimumSystemVersion</key><string>14.0</string>
    <key>NSHighResolutionCapable</key><true/>
    <!-- Not sandboxed: quitting other apps and writing /etc/hosts are both
         impossible inside the sandbox. -->
    <key>NSAppleEventsUsageDescription</key>
    <string>Latch needs to quit distracting apps while a focus session is running.</string>
</dict>
</plist>
PLIST

# Ad-hoc signature. Enough for the app to run locally and to keep the same
# identity across rebuilds so macOS does not re-prompt for permissions every
# time. Distributing to anyone else needs a real Developer ID.
codesign --force --deep --sign - "$APP" 2>/dev/null || \
  echo "warning: ad-hoc codesign failed; the app will still run locally"

echo "Built $APP"
echo "Run it:  open $APP"
