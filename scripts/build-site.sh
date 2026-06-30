#!/bin/sh
set -eu
ROOT="$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

rm -rf build
mkdir -p build/test

python3 python/phononweb/scripts/render_homepage.py --output build/index.html

if command -v emcc >/dev/null 2>&1; then
  sh ./scripts/build-eigen-wasm.sh
fi

./node_modules/.bin/rollup -c

terser build/main.js    -c -m --source-map "content=build/main.js.map,url=main.min.js.map"       -o build/main.min.js
terser build/exciton.js -c -m --source-map "content=build/exciton.js.map,url=exciton.min.js.map" -o build/exciton.min.js
terser build/structure.js -c -m --source-map "content=build/structure.js.map,url=structure.min.js.map" -o build/structure.min.js
terser build/alloy.js   -c -m --source-map "content=build/alloy.js.map,url=alloy.min.js.map"     -o build/alloy.min.js
terser build/zumba.js     -c -m --source-map "content=build/zumba.js.map,url=zumba.min.js.map"         -o build/zumba.min.js
python3 generate_alloy_manifest.py
python3 generate_zumba_manifest.py
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
