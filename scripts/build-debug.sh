#!/bin/sh
set -eu

ROOT="$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

export PATH="$ROOT/node_modules/.bin:$PATH"

rm -rf build
mkdir -p build/test

python3 python/phononweb/scripts/render_homepage.py --output build/index.html

if command -v emcc >/dev/null 2>&1; then
  sh ./scripts/build-eigen-wasm.sh
fi

rollup -c

python3 generate_alloy_manifest.py
python3 generate_zumba_manifest.py

cp build/main.js      build/main.min.js
cp build/exciton.js   build/exciton.min.js
cp build/structure.js build/structure.min.js
cp build/alloy.js     build/alloy.min.js
cp build/zumba.js     build/zumba.min.js

cp -r figures css libs data README.md favicon.svg favicon.ico build/
cp phonon.html exciton.html structure.html alloy.html zumba.html build/
cp -r alloydb build/alloydb
cp -r zumbadb build/zumbadb

rm -f build/data/phonondb2017/.gitignore
cp -r test/fixtures build/test/

test -f build/main.min.js
test -f build/exciton.min.js
test -f build/structure.min.js
test -f build/alloy.min.js
test -f build/zumba.min.js
test -f build/alloydb/manifest.json
test -f build/zumbadb/manifest.json

echo "Build complete."