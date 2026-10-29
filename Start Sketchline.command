#!/bin/zsh
unsetopt BG_NICE
cd -- "$(dirname -- "$0")"
# Use an existing local Node runtime if Finder's PATH does not include it.
if ! command -v node >/dev/null 2>&1; then
  for sketch_node_dir in '/opt/homebrew/bin' '/usr/local/bin' "$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin"; do
    if [[ -x "$sketch_node_dir/node" ]]; then
      export PATH="$sketch_node_dir:$PATH"
      break
    fi
  done
fi
if ! command -v node >/dev/null 2>&1; then
  echo 'Sketchline needs Node.js 20.19 or newer. Install the LTS version from nodejs.org.'
  read -r '?Press Enter to close.'
  exit 1
fi
sketch_port="$(node --input-type=module -e 'import fs from "node:fs";let p=4317;try{const m=fs.readFileSync(".env","utf8").match(/^PORT[ \t]*=[ \t]*(\d+)/m);if(m && Number(m[1])>0 && Number(m[1])<65536)p=Number(m[1]);}catch{}console.log(p);')"
sketch_url="http://127.0.0.1:$sketch_port"
sketch_status="$(curl --fail --silent --max-time 1 "$sketch_url/api/status" 2>/dev/null)"
if [[ "$sketch_status" == *'"storage":"local-files"'* ]]; then
  open "$sketch_url"
  exit 0
fi
if [[ ! -d node_modules ]]; then
  echo 'Installing Sketchline dependencies...'
  npm ci --no-audit --no-fund --cache "${TMPDIR:-/tmp}/sketchline-npm-cache" || exit 1
fi
if [[ ! -f dist/index.html ]]; then
  npm run build || exit 1
fi
(
  for sketch_attempt in {1..30}; do
    if curl --fail --silent --max-time 1 "$sketch_url/api/status" >/dev/null 2>&1; then
      open "$sketch_url"
      exit 0
    fi
    sleep 0.3
  done
) &
npm start
