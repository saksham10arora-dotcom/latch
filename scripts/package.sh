#!/bin/bash
# Builds the Chrome Web Store upload.
#
# The extension folder holds tests, node_modules and design notes that must not
# ship: the store rejects unused files, reviewers read whatever you send them,
# and node_modules alone would be tens of thousands of files. This copies only
# what the manifest actually references.
set -euo pipefail

cd "$(dirname "$0")/.."
OUT="build/latch.zip"
STAGE="build/store"

VERSION=$(python3 -c "import json;print(json.load(open('manifest.json'))['version'])")

rm -rf "$STAGE" "$OUT"
mkdir -p "$STAGE"

# Everything the manifest points at, and nothing else.
cp manifest.json "$STAGE/"
cp -R src "$STAGE/src"
cp -R icons "$STAGE/icons"

# Belt and braces: strip anything that crept in via the directory copies.
find "$STAGE" -name "*.test.js" -delete
find "$STAGE" -name ".DS_Store" -delete
rm -f "$STAGE/icons/latch.svg"   # the source art, not needed at runtime

( cd "$STAGE" && zip -qr "../../$OUT" . )

echo "Built $OUT  (version $VERSION)"
echo
echo "Contents:"
# `head -n -2` is a GNU extension and BSD head rejects it, so the trailing
# summary lines are dropped with awk instead.
unzip -l "$OUT" | awk 'NR>3 && $4 != "" && $1 ~ /^[0-9]+$/ { printf "  %8s  %s\n", $1, $4 }'
