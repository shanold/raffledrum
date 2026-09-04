#!/bin/sh
set -eu
export WRANGLER_SEND_METRICS=false

case "${ORGANIZER_PASSWORD_HASH:-}" in
  ''|*[!0-9a-fA-F]*)
    echo "ORGANIZER_PASSWORD_HASH must be a SHA-256 hexadecimal digest." >&2
    exit 64
    ;;
esac

case "${SESSION_SECRET:-}" in
  ''|*[!0-9a-fA-F]*)
    echo "SESSION_SECRET must be a long hexadecimal value." >&2
    exit 64
    ;;
esac

umask 077
printf 'ORGANIZER_PASSWORD_HASH=%s\nSESSION_SECRET=%s\n' \
  "$ORGANIZER_PASSWORD_HASH" "$SESSION_SECRET" > .dev.vars

wrangler d1 migrations apply raffle-drum --local --persist-to=/data --config=wrangler.docker.jsonc
exec wrangler dev --ip 0.0.0.0 --port 80 --local --persist-to=/data --config=wrangler.docker.jsonc
