#!/usr/bin/env python3
"""
generate_alloy_manifest.py
--------------------------
Run this script from the phononwebsite root directory any time you add or
remove .json files from alloydb/.

Usage:
    python3 generate_alloy_manifest.py

Output:
    alloydb/manifest.json   — a sorted JSON array of filenames, e.g.
    ["BaZrS_x_0.0_m_32.06.json", "BaZrS_x_1.0_m_78.97.json"]
"""

import json
import os
import sys

ALLOYDB_DIR = os.path.join(os.path.dirname(__file__), "alloydb")
MANIFEST    = os.path.join(ALLOYDB_DIR, "manifest.json")

def main():
    if not os.path.isdir(ALLOYDB_DIR):
        print(f"ERROR: directory not found: {ALLOYDB_DIR}", file=sys.stderr)
        sys.exit(1)

    files = sorted(
        f for f in os.listdir(ALLOYDB_DIR)
        if f.endswith(".json") and f != "manifest.json"
    )

    with open(MANIFEST, "w") as fp:
        json.dump(files, fp, indent=2)
        fp.write("\n")

    print(f"Written {len(files)} entries to {MANIFEST}")
    for f in files:
        print(f"  {f}")

if __name__ == "__main__":
    main()
