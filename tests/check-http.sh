#!/bin/sh
# รันจากโฟลเดอร์ใดก็ได้ ต้องมี python3 และ curl
set -eu
cd "$(dirname "$0")/.."
log=$(mktemp)
python3 -m http.server 8765 >"$log" 2>&1 &
server_pid=$!
trap 'kill "$server_pid" 2>/dev/null || true; rm -f "$log"' EXIT INT TERM
sleep 1
if ! kill -0 "$server_pid" 2>/dev/null; then
  cat "$log"
  exit 1
fi
for page in index.html tools/shorten.html tools/qr.html tools/wheel.html tools/groups.html tools/baht-text.html tools/dates.html tools/timer.html tools/word-count.html tools/pdf.html tools/certificate.html tools/password.html tools/vote.html tools/raffle.html tools/picker.html tools/quiz.html tools/buzzer.html tools/gift-exchange.html tools/checkin.html tools/countdown.html; do
  code=$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:8765/$page")
  printf '%s %s\n' "$code" "$page"
  test "$code" = 200
done
cdn_code=$(curl -sI -o /dev/null -w '%{http_code}' 'https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js')
printf '%s %s\n' "$cdn_code" 'qrcode-generator@1.4.4 CDN'
test "$cdn_code" = 200
