#!/bin/bash
# ダブルクリックまたは `bash start.command` で起動(Mac用)。インストール不要。
cd "$(dirname "$0")"
PORT=8765
echo "http://localhost:$PORT を開きます。終了は Ctrl+C。"
(sleep 1; open -a "Google Chrome" "http://localhost:$PORT" 2>/dev/null || open "http://localhost:$PORT") &
python3 -m http.server $PORT --bind 127.0.0.1
