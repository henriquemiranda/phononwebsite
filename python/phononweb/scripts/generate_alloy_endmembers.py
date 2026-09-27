#!/usr/bin/env python3
"""
Build the two small "runtime dynamical matrix" json payloads that the alloy
page mixes client-side, from the pure BaZrS3 and BaZrSe3 QE dynamical-matrix
files (bazrs3.dyn / bazrse3.dyn).

This replaces the old approach of pre-computing a full x/m grid of static
json files: the site now stores just these two endpoints and interpolates
force constants (by x) / overrides the chalcogen mass (by m) in the browser
at slider-drag time, reusing the site's existing runtime dynamical-matrix
solver (see src/dynamicalmatrix.js).

Usage:
    python3 generate_alloy_endmembers.py bazrs3.dyn bazrse3.json --name BaZrS3 --output alloydb/bazrs3.json
    python3 generate_alloy_endmembers.py bazrse3.dyn --name BaZrSe3 --output alloydb/bazrse3.json
"""

from __future__ import annotations

import argparse
import json

from phononweb.scripts.parse_qe_dynmat import parse_qe_dynmat

# 1 amu, expressed in the mass units QE's dynamical-matrix files use natively.
# Derived empirically from the .dyn files themselves (Ba: 125165.90357338246 / 137.327,
# Zr: 83145.589633344076 / 91.224, S: 29220.902434063530 / 32.06 all agree exactly).
AMU_TO_NATIVE = 911.4442431086565

# sqrt(eigenvalue) -> cm^-1, for these Rydberg-atomic-unit dynamical matrices.
# eigenvalue is an energy^2 in Ry^2; 1 Ry = 109737.31568160 cm^-1 exactly.
RY_TO_CM1 = 109737.31568160
THZ_TO_CM1 = 33.35641
FREQUENCY_CONVERSION_FACTOR = RY_TO_CM1 / THZ_TO_CM1


def build_payload(dyn_path: str, name: str, formula: str) -> dict:
    parsed = parse_qe_dynmat(dyn_path)
    natoms = parsed["natoms"]

    # dynamicalmatrix.js expects real 3x3 blocks (fcBlock[axisRow][axisCol]), not
    # complex pairs -- these matrices are real at Gamma (verified: max|imag|==0),
    # so drop the imaginary component here.
    fc_real = [
        [
            [[c.real for c in row] for row in parsed["dynamical_matrix"][i, j]]
            for j in range(natoms)
        ]
        for i in range(natoms)
    ]

    masses_native = [parsed["type_masses"][t - 1] for t in parsed["atom_types"]]

    dynamical_matrix = {
        "format": "phonopy-dynamical-matrix-v1",
        "acoustic_sum_rule": "translational",
        "primitive_natoms": natoms,
        "supercell_natoms": natoms,
        "primitive_lattice": parsed["lattice"].tolist(),
        "frequency_conversion_factor": FREQUENCY_CONVERSION_FACTOR,
        "masses": masses_native,
        "force_constants_compact": fc_real,
        "shortest_vectors": [[0.0, 0.0, 0.0]],
        "multiplicity": [[[1, 0] for _ in range(natoms)] for _ in range(natoms)],
        "s2pp_map": list(range(natoms)),
    }

    atom_types = [parsed["type_symbols"][t - 1] for t in parsed["atom_types"]]
    atomic_number_by_symbol = {"Ba": 56, "Zr": 40, "S": 16, "Se": 34}
    atom_numbers = [atomic_number_by_symbol[s] for s in atom_types]

    return {
        "name": name,
        "formula": formula,
        "natoms": natoms,
        "lattice": parsed["lattice"].tolist(),
        "atom_types": atom_types,
        "atom_numbers": atom_numbers,
        "atom_pos_car": parsed["atom_pos_car"].tolist(),
        "masses": masses_native,
        "qpoints": [[0.0, 0.0, 0.0]],
        "distances": [0.0],
        "highsym_qpts": [[0, "GAMMA"]],
        "line_breaks": [[0, 1]],
        "repetitions": [2, 2, 2],
        "dynamical_matrix": dynamical_matrix,
        "amu_to_native_mass_unit": AMU_TO_NATIVE,
        "raman_tensor": (
            parsed["raman_tensor"].tolist() if parsed["raman_tensor"] is not None else None
        ),
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("dyn_file", help="path to the QE .dyn file (bazrs3.dyn or bazrse3.dyn)")
    parser.add_argument("--name", required=True, help="display name, e.g. BaZrS3")
    parser.add_argument("--formula", required=True, help="chemical formula, e.g. Ba4S12Zr4")
    parser.add_argument("--output", required=True, help="output json path")
    args = parser.parse_args()

    payload = build_payload(args.dyn_file, args.name, args.formula)
    with open(args.output, "w") as f:
        json.dump(payload, f, indent=1)
    print(f"wrote {args.output} ({args.dyn_file} -> {args.name})")


if __name__ == "__main__":
    main()
