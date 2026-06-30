#!/usr/bin/env python3
"""
generate_zumba_manifest.py
--------------------------
Run this script from the phononwebsite root directory any time you add or
remove .json files from zumbadb/.

File naming convention:
    ZMO_pol_<pol>_ei_<ei>_es_<es>.json
    where pol, ei, es ∈ {x, y, z}

Usage:
    python3 generate_zumba_manifest.py

Output:
    zumbadb/manifest.json   — a sorted JSON array of filenames, e.g.
    ["ZMO_pol_x_ei_x_es_x.json", "ZMO_pol_x_ei_x_es_y.json", ...]

All 27 possible Porto combinations:
    for pol in x y z:
      for ei in x y z:
        for es in x y z:
          ZMO_pol_{pol}_ei_{ei}_es_{es}.json
"""

import json
import os
import sys

ZUMBADB_DIR = os.path.join(os.path.dirname(__file__), "zumbadb")
MANIFEST    = os.path.join(ZUMBADB_DIR, "manifest.json")


def main():
    if not os.path.isdir(ZUMBADB_DIR):
        print(f"ERROR: directory not found: {ZUMBADB_DIR}", file=sys.stderr)
        print("Create zumbadb/ and populate it with JSON files first.", file=sys.stderr)
        sys.exit(1)

    files = sorted(
        f for f in os.listdir(ZUMBADB_DIR)
        if f.endswith(".json") and f != "manifest.json"
    )

    with open(MANIFEST, "w") as fp:
        json.dump(files, fp, indent=2)
        fp.write("\n")

    axes = ['x', 'y', 'z']
    expected = set(
        f"ZMO_pol_{pol}_ei_{ei}_es_{es}.json"
        for pol in axes for ei in axes for es in axes
    )
    found = set(files)
    missing = sorted(expected - found)
    if missing:
        print(f"\n⚠  {len(missing)} of 27 Porto combinations not yet in zumbadb/:")
        for f in missing:
            print(f"  {f}")


if __name__ == "__main__":
    main()