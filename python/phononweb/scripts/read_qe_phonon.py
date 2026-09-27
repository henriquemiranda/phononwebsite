#!/usr/bin/env python
# Copyright (c) 2017, Henrique Miranda
# All rights reserved.
#
# This file is part of the phononwebsite project
#
"""
Read phonon dispersion from quantum espresso
http://www.quantum-espresso.org/
"""
from phononweb.qephonon import *
import argparse
import sys
import json
import numpy as np

# Exact SI constants for the Raman Stokes intensity conversion.
h = 6.62607015e-34  # Planck constant (J s)
c = 299792458.0  # Speed of light in vacuum (m/s)
k = 1.380649e-23  # Boltzmann constant (J/K)

def stokes_intensity_factor(f, t):
    """
    Computes the full conversion factor from Raman activity to intensity:
    (1 / freq) * (n_v + 1)
    """
    f = np.asarray(f, dtype=float) * 100.0  
    exponent = (h * c * f) / (k * t)
    n_v = np.zeros_like(f)
    mask = f > 0
    
    n_v[mask] = 1.0 / np.expm1(exponent[mask])
    factor = np.zeros_like(f)
    factor[mask] = (1.0 / f[mask]) * (n_v[mask] + 1.0)
    
    return factor

def read_raman_intensities(filename):
    """Parses the Raman column from a QE dynmat.out file."""
    raman_intensities = []
    found_table = False
    try:
        with open(filename, 'r') as f:
            for line in f:
                if 'mode' in line and 'Raman' in line:
                    found_table = True
                    continue
                
                if found_table:
                    parts = line.split()
                    if not parts or not parts[0].isdigit():
                        if raman_intensities: break 
                        continue
  
                    try:
                        raman_intensities.append(float(parts[4]))
                    except (ValueError, IndexError):
                        continue
        return raman_intensities
    except Exception as e:
        print(f"Error reading dynmat file: {e}")
        return None

def main():
    parser = argparse.ArgumentParser(description='Read QE phonon data and optionally inject Raman intensities.')
    parser.add_argument('prefix',            help='the prefix used in calculation')
    parser.add_argument('name',              help='name of the material', nargs='?', default=None)
    parser.add_argument('-s','--scf',        help='scf input file')
    parser.add_argument('-m','--modes',      help='modes file from matdyn.x')
    parser.add_argument('-d','--dynmat',     help='(Optional) dynmat.out file for Raman intensities')
    parser.add_argument('-r','--reps',       help='cell repetitions')
    parser.add_argument('-l','--labels',     help='k-point labels (e.g. "GMKG")')
    parser.add_argument('-w','--writeonly',  help='do not open browser', action="store_true")

    if len(sys.argv) < 2:
        parser.print_help()
        sys.exit(1)

    args = parser.parse_args()
    prefix = args.prefix
    name = args.name if args.name else prefix
    json_filename = f"{name}.json"

    q = QePhonon(prefix, name, scf=args.scf, modes=args.modes)
    if args.labels: q.set_labels(args.labels)
    if args.reps:   q.set_repetitions(args.reps)

    print(q)
    q.write_json()
    
    if args.dynmat:
        raman_data = read_raman_intensities(args.dynmat)
        
        if raman_data:
            with open(json_filename, 'r') as f:
                data = json.load(f)

            gamma_index = None
            for i, qpt in enumerate(data.get('qpoints', [])):
                if all(abs(x) < 1e-5 for x in qpt):
                    gamma_index = i
                    break
            
            if gamma_index is not None:
                frequencies = np.array(data['eigenvalues'][gamma_index])
                raw_activities = np.array(raman_data)

                if len(raw_activities) != len(frequencies):
                    raise ValueError(
                        f"Raman mode count ({len(raw_activities)}) does not match "
                        f"the Gamma-point mode count ({len(frequencies)})."
                    )

                mode_order = np.asarray(q.mode_order[gamma_index], dtype=int)
                if not np.array_equal(np.sort(mode_order), np.arange(len(frequencies))):
                    raise ValueError(f"Invalid mode-order mapping at Gamma point {gamma_index}.")

                ordered_activities = raw_activities[mode_order]
                conversion_factors = stokes_intensity_factor(frequencies, 300.0)
                corrected_intensities = ordered_activities * conversion_factors
                max_val = np.max(corrected_intensities)
                if max_val > 0:
                    corrected_intensities = corrected_intensities / max_val
                data['raman_intensities'] = corrected_intensities.tolist()
                data['gamma_index'] = gamma_index
                
                with open(json_filename, 'w') as f:
                    json.dump(data, f, indent=1)
                print("Success")
            else:
                print("Warning: Gamma point not found.")

    if not args.writeonly:
        q.open_json()

if __name__ == "__main__":
    main()
