#!/usr/bin/env python3
"""
Parse a Quantum Espresso ph.x dynamical-matrix file (single q-point) into
the plain arrays needed to rebuild D(q) elsewhere (e.g. the phononwebsite
runtime dynamical-matrix payload used by the alloy mixing feature).

Only ibrav=8 (orthorhombic, primitive) is supported, since that's what the
BaZrS3/BaZrSe3 calculations use. The trailing NAC block (Dielectric Tensor /
Effective Charges) is intentionally ignored: for these materials dynmat.x is
run with q=(0,0,0) and no explicit q-direction, so QE itself reports
"TO-LO splitting will be absent" and never applies it.
"""

from __future__ import annotations

import re

import numpy as np

_SPECIES_LINE_RE = re.compile(r"^\s*\d+\s+'([^']*)'\s+([\d.eEdD+-]+)")

BOHR_TO_ANGSTROM = 0.52917721067


def _lattice_from_ibrav8(celldm):
    a, b_over_a, c_over_a = celldm[0], celldm[1], celldm[2]
    return np.array([
        [a, 0.0, 0.0],
        [0.0, b_over_a * a, 0.0],
        [0.0, 0.0, c_over_a * a],
    ])


def parse_qe_dynmat(filename):
    """Parse a QE .dyn file into a plain dict.

    Returns a dict with:
      natoms, ntyp
      type_symbols: list[str], type_masses: list[float] (file's native mass units)
      atom_types: list[int] (1-indexed type per atom, matches file)
      atom_pos_car: (natoms,3) ndarray, Angstrom
      lattice: (3,3) ndarray, Angstrom
      dynamical_matrix: (natoms,natoms,3,3) complex128 ndarray
    """
    with open(filename) as f:
        lines = f.readlines()

    dims = lines[2].split()
    ntyp, natoms, ibrav = int(dims[0]), int(dims[1]), int(dims[2])
    celldm = [float(x) for x in dims[3:9]]
    if ibrav != 8:
        raise NotImplementedError(f"only ibrav=8 is supported, got ibrav={ibrav}")

    lattice_bohr = _lattice_from_ibrav8(celldm)
    lattice = lattice_bohr * BOHR_TO_ANGSTROM

    type_symbols = []
    type_masses = []
    row = 3
    for _ in range(ntyp):
        m = _SPECIES_LINE_RE.match(lines[row])
        type_symbols.append(m.group(1).strip())
        type_masses.append(float(m.group(2)))
        row += 1

    atom_types = []
    atom_pos_car_alat = []
    for _ in range(natoms):
        parts = lines[row].split()
        atom_types.append(int(parts[1]))
        atom_pos_car_alat.append([float(parts[2]), float(parts[3]), float(parts[4])])
        row += 1
    atom_pos_car = np.array(atom_pos_car_alat) * celldm[0] * BOHR_TO_ANGSTROM

    # Skip blank line(s) and the "Dynamical Matrix in cartesian axes" / q= header
    # down to the first "  i  j" pair line.
    while not lines[row].strip().startswith("q ="):
        row += 1
    row += 1
    while not lines[row].strip():
        row += 1

    dynmat = np.zeros((natoms, natoms, 3, 3), dtype=np.complex128)
    for _ in range(natoms * natoms):
        i, j = (int(x) - 1 for x in lines[row].split())
        row += 1
        for axis_row in range(3):
            vals = [float(x.replace("D", "E").replace("d", "e")) for x in lines[row].split()]
            row += 1
            for axis_col in range(3):
                dynmat[i, j, axis_row, axis_col] = complex(
                    vals[2 * axis_col], vals[2 * axis_col + 1]
                )

    return {
        "natoms": natoms,
        "ntyp": ntyp,
        "type_symbols": type_symbols,
        "type_masses": type_masses,
        "atom_types": atom_types,
        "atom_pos_car": atom_pos_car,
        "lattice": lattice,
        "dynamical_matrix": dynmat,
    }
