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

cp -r figures css libs README.md phonon.html exciton.html structure.html alloy.html zumba.html mixing.html cuvac.html favicon.svg favicon.ico build/
cp -r alloydb build/alloydb
cp -r zumbadb build/zumbadb
cp -r defectdb build/defectdb
# Reuse the local datasets instead of copying gigabytes into every debug build.
ln -s ../data build/data || cp -r data build/
cp build/main.js build/main.min.js
cp build/exciton.js build/exciton.min.js
cp build/structure.js build/structure.min.js
cp build/alloy.js build/alloy.min.js
cp build/zumba.js build/zumba.min.js
cp build/mixing.js build/mixing.min.js
cp build/cuvac.js build/cuvac.min.js
