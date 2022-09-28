#!/usr/bin/env python 
# Copyright (c) 2022, Henrique Miranda
# All rights reserved.
#
# This file is part of the phononwebsite project
#
"""
Read phonon dispersion from vasp
http://www.vasp.at/
"""
from phononweb.vaspphonon import VaspPhonon
import argparse
import sys

if __name__ == "__main__":

    parser = argparse.ArgumentParser(description='Read the phonon modes from vaspout.h5 vasp output file.')
    parser.add_argument('filename',         help='the name of the vaspout.h5 file')
    parser.add_argument('name',             help='name of the material', nargs='?', default=None)
    parser.add_argument('-w','--writeonly', help='only write json file (do not open the web browser)', action="store_true")

    #check if enough arguments are present
    if len(sys.argv)<2:
        parser.print_help()
        sys.exit(1)

    args = parser.parse_args()

    filename = args.filename
    if args.name:  name = args.name
    else:          name = prefix

    vp = VaspPhonon(name,filename=filename)

    #display information
    print(vp)

    if args.writeonly:
        vp.write_json()
    else:
        vp.write_json()
        vp.open_json()
