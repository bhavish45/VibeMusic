#!/bin/sh
set -eu

WARP_DIR=/tmp/warp
mkdir -p "$WARP_DIR"
cd "$WARP_DIR"

if [ ! -f wgcf-account.toml ]; then
  wgcf register --accept-tos
  wgcf generate
fi

# Force an IPv4 WARP endpoint. Render IPv6 is unreliable.
sed -i 's/engage.cloudflareclient.com:2408/162.159.192.1:2408/' wgcf-profile.conf

cat > "$WARP_DIR/wireproxy.conf" << 'EOF'
WGConfig = /tmp/warp/wgcf-profile.conf

[Socks5]
BindAddress = 127.0.0.1:1080
EOF

wireproxy -c "$WARP_DIR/wireproxy.conf" &

i=0
while [ "$i" -lt 20 ]; do
  if curl -sf --max-time 2 -x socks5h://127.0.0.1:1080 https://www.cloudflare.com/cdn-cgi/trace >/dev/null; then
    echo "[warp] SOCKS5 ready"
    break
  fi
  i=$((i + 1))
  sleep 1
done

cd /app
exec uvicorn main:app --host 0.0.0.0 --port "${PORT:-10000}"
