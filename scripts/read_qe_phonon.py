#!/usr/bin/env python 
# Copyright (c) 2015, Henrique Miranda
# All rights reserved.
#
# This file is part of the phononwebsite project
#
# Read phonon dispersion from quantum espresso
#
from phononweb.qephonon import *
import argparse
import sys

if __name__ == "__main__":

    parser = argparse.ArgumentParser(description='Read <prefix>.modes and <prefix>.scf files from quantum espresso and write a .json file to use in the phononwebsite.')
    parser.add_argument('prefix',        help='the prefix used in the pw.x and ph.x calculation')
    parser.add_argument('name',          help='name of the material', nargs='?', default=None)
    parser.add_argument('-s','--scf',    help='name of the scf input file')
    parser.add_argument('-m','--modes',  help='name of the modes file produced with matdyn.x')
    parser.add_argument('-r','--reps',   help='number of default repetitions')
    parser.add_argument('-l','--labels', help='A string with the labels of the kpoints.')

    if len(sys.argv)<2:
        parser.print_help()
        sys.exit(1)

    args = parser.parse_args()

    prefix = args.prefix
    name   = args.name
    if not name: name = prefix

    q = QePhonon(prefix,name,scf=args.scf,modes=args.modes)
    if args.labels: q.set_labels(args.labels)
    if args.reps:   q.set_repetitions(args.reps)
    print q
    q.write_json()
