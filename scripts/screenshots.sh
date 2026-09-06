#!/bin/bash
# Renders the Chrome Web Store screenshots at exactly 1280x800.
#
# Driven off src/lock.css and the markup inside src/lock.js rather than a copy,
# because the previous approach was a standalone HTML file holding its own
# duplicate of the stylesheet. It drifted: the wall was redesigned around a
# gauge, and the screenshot kept showing the progress rail that used to be
# there. A screenshot of a design you no longer ship is worse than none.
set -euo pipefail
cd "$(dirname "$0")/.."

CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
[ -x "$CHROME" ] || { echo "Chrome not found at $CHROME"; exit 1; }

OUT="build/shots"
rm -rf "$OUT"; mkdir -p "$OUT"

python3 scripts/build_shots.py "$OUT"

for f in "$OUT"/*.html; do
  n="${f%.html}"
  "$CHROME" --headless --disable-gpu --force-device-scale-factor=1 \
    --hide-scrollbars --window-size=1280,800 \
    --screenshot="$n.png" "$f" >/dev/null 2>&1
done

cp "$OUT/1-lecture.png"  store/screenshot-1-lecture.png
cp "$OUT/2-reading.png"  store/screenshot-2-reading.png

echo "Store screenshots rebuilt:"
for f in store/screenshot-*.png; do
  echo "  $f  $(sips -g pixelWidth -g pixelHeight "$f" | awk '/pixel/{printf "%s ", $2}')"
done
