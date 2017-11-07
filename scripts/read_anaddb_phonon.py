#!/usr/bin/env python
# Copyright (c) 2017, Henrique Miranda
# All rights reserved.
#
# This file is part of the phononwebsite project
#
# Read phonon dispersion from anaddb
#
from phononweb.anaddbphonon import *
import argparse
import sys

if __name__ == "__main__":
   
    parser = argparse.ArgumentParser(description='Read anaddb netCDF file and write a .json file to use in the phononwebsite')
    parser.add_argument('filename',         help='netCDF filename')
    parser.add_argument('name',             help='name of the material')
    parser.add_argument('-r','--reps',      help='number of default repetitions')
    parser.add_argument('-l','--labels',    help='string with the labels of the k-points. Eg. \"GMKG\" ')
    parser.add_argument('-w','--writeonly', help='only write json file (do not open the web browser)', action="store_true")

    #check if enough arguments are present
    if len(sys.argv)<2:
        parser.print_help()
        sys.exit(1)

    args = parser.parse_args()
    
    q = AnaddbPhonon(args.filename,args.name)
    if args.labels: q.set_labels(args.labels)
    if args.reps:   q.set_repetitions(args.reps)

    #diplsay information
    print(q)

    if args.writeonly:
        q.write_json()
    else:
        q.write_json()
        q.open_json()
