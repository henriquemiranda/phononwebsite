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

rollup -c

terser build/main.js -c -m --source-map "content=build/main.js.map,url=main.min.js.map" -o build/main.min.js
terser build/exciton.js -c -m --source-map "content=build/exciton.js.map,url=exciton.min.js.map" -o build/exciton.min.js
terser build/structure.js -c -m --source-map "content=build/structure.js.map,url=structure.min.js.map" -o build/structure.min.js
terser build/alloy.js -c -m --source-map "content=build/alloy.js.map,url=alloy.min.js.map" -o build/alloy.min.js
terser build/zumba.js -c -m --source-map "content=build/zumba.js.map,url=zumba.min.js.map" -o build/zumba.min.js
terser build/mixing.js -c -m --source-map "content=build/mixing.js.map,url=mixing.min.js.map" -o build/mixing.min.js
terser build/cuvac.js -c -m --source-map "content=build/cuvac.js.map,url=cuvac.min.js.map" -o build/cuvac.min.js

cp -r figures css libs data README.md phonon.html exciton.html structure.html alloy.html zumba.html mixing.html cuvac.html favicon.svg favicon.ico build/
cp -r alloydb build/alloydb
cp -r zumbadb build/zumbadb
cp -r defectdb build/defectdb
rm -f build/data/phonondb2017/.gitignore
cp -r test/fixtures build/test/

test -f build/main.min.js
test -f build/exciton.min.js
test -f build/structure.min.js
test -f build/alloy.min.js
test -f build/alloydb/bazrs3.json
test -f build/alloydb/bazrse3.json
test -f build/zumba.min.js
test -f build/mixing.min.js
test -f build/data/mixing/models.json
test -f build/zumbadb/manifest.json
test -f build/cuvac.min.js
test -f build/defectdb/Cu_vac_q-1_PBE_gamma.json.gz
