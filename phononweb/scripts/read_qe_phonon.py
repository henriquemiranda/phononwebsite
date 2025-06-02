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

def main():
    parser = argparse.ArgumentParser(description='Read <prefix>.modes and <prefix>.scf files from quantum espresso '
                                                 'and write a .json file to use in the phononwebsite.')
    parser.add_argument('prefix',           help='the prefix used in the pw.x and ph.x calculation')
    parser.add_argument('name',             help='name of the material', nargs='?', default=None)
    parser.add_argument('-s','--scf',       help='name of the scf input file for pw.x')
    parser.add_argument('-m','--modes',     help='name of the modes file produced with matdyn.x')
    parser.add_argument('-r','--reps',      help='number of default repetitions of the unit cell')
    parser.add_argument('-l','--labels',    help='string with the labels of the k-points. Eg. \"GMKG\" ')
    parser.add_argument('-w','--writeonly', help='only write json file (do not open the web browser)', action="store_true")

    #check if enough arguments are present
    if len(sys.argv)<2:
        parser.print_help()
        sys.exit(1)

    args = parser.parse_args()

    prefix = args.prefix
    if args.name:  name = args.name
    else:          name = prefix

    q = QePhonon(prefix,name,scf=args.scf,modes=args.modes)
    if args.labels: q.set_labels(args.labels)
    if args.reps:   q.set_repetitions(args.reps)

    #display information
    print(q)

    if args.writeonly:
        q.write_json()
    else:
        q.write_json()
        q.open_json()

if __name__ == "__main__":
    main()
    