#!/bin/bash
# Emergency unblock. Removes Latch's block from /etc/hosts without needing the
# app to run, be installed, or even still exist.
#
# This exists because the app is allowed to fail. If Latch crashes, gets deleted
# mid-session, or hits a bug while writing, the block outlives it and half the
# internet stops resolving with no visible cause. One shell script with no
# dependencies is the floor under that.
#
#   sudo ./scripts/latch-unlock.sh
set -euo pipefail

HOSTS=/etc/hosts
BEGIN='# >>> latch >>>'
END='# <<< latch <<<'

if [ "$(id -u)" -ne 0 ]; then
  echo "Needs root, since /etc/hosts is root-owned. Re-run:" >&2
  echo "  sudo $0" >&2
  exit 1
fi

if ! grep -qF "$BEGIN" "$HOSTS"; then
  echo "No Latch block in $HOSTS. Nothing to undo."
  exit 0
fi

STAMP=$(date +%Y%m%d-%H%M%S)
cp "$HOSTS" "/tmp/hosts.before-latch-unlock.$STAMP"
echo "Backed up current hosts to /tmp/hosts.before-latch-unlock.$STAMP"

# Write to a temp file and copy over the top. Never redirect into /etc/hosts:
# the shell truncates it on open, so an interrupted write leaves it empty.
# The awk pass drops the trailing blank lines the deletion leaves behind, so
# the file comes back byte-identical to how it started. Without it, every
# crash-and-recover cycle would leave one more blank line in /etc/hosts.
TMP=$(mktemp)
sed "/^${BEGIN}\$/,/^${END}\$/d" "$HOSTS" \
  | awk '{ lines[NR] = $0; if (NF) last = NR } END { for (i = 1; i <= last; i++) print lines[i] }' \
  > "$TMP"
cp "$TMP" "$HOSTS"
rm -f "$TMP"

dscacheutil -flushcache 2>/dev/null || true
killall -HUP mDNSResponder 2>/dev/null || true

echo "Latch block removed. Websites are reachable again."
