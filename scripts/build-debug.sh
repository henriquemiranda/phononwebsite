#!/bin/sh
set -eu

ROOT="$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

rm -rf build
mkdir -p build

python3 python/phononweb/scripts/render_homepage.py --output build/index.html

if command -v emcc >/dev/null 2>&1; then
  sh ./scripts/build-eigen-wasm.sh
fi

rollup -c

cp -r figures css libs data README.md phonon.html exciton.html structure.html alloy.html favicon.svg favicon.ico build/
cp -r alloydb build/alloydb
rm -f build/data/phonondb2017/.gitignore
cp build/main.js build/main.min.js
cp build/exciton.js build/exciton.min.js
cp build/structure.js build/structure.min.js
cp build/alloy.js build/alloy.min.js
