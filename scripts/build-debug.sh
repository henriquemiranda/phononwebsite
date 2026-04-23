#!/bin/sh
set -eu

ROOT="$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# Fix for the cluster: ensure local node_modules are in the PATH
export PATH="$ROOT/node_modules/.bin:$PATH"

rm -rf build
mkdir -p build/test

python3 python/phononweb/scripts/render_homepage.py --output build/index.html

if command -v emcc >/dev/null 2>&1; then
  sh ./scripts/build-eigen-wasm.sh
fi

# Run rollup to bundle the JS
rollup -c

# Generate the Alloy manifest (New)
python3 generate_alloy_manifest.py

# In DEBUG mode, we skip the slow terser minification and just copy the files
# but we name them .min.js so the HTML files still work.
cp build/main.js      build/main.min.js
cp build/exciton.js   build/exciton.min.js
cp build/structure.js build/structure.min.js
cp build/alloy.js     build/alloy.min.js

# Copy assets and the new alloy files
cp -r figures css libs data README.md favicon.svg favicon.ico build/
cp phonon.html exciton.html structure.html alloy.html build/
cp -r alloydb build/alloydb

rm -f build/data/phonondb2017/.gitignore
cp -r test/fixtures build/test/

# Verification checks
test -f build/main.min.js
test -f build/exciton.min.js
test -f build/structure.min.js
test -f build/alloy.min.js
test -f build/alloydb/manifest.json

echo "Build complete. alloy.html + alloy.min.js ready in build/."