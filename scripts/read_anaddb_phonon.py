#!/usr/bin/env python
# Copyright (c) 2015, Henrique Miranda
# All rights reserved.
#
# This file is part of the phononwebsite project
#
# Read phonon dispersion from anaddb
#
from phononweb.anaddbphonon import *
import argparse

if __name__ == "__main__":
   
    parser = argparse.ArgumentParser(description='Read anaddb netCDF file and write a .json file to use in the phononwebsite')
    parser.add_argument('filename', help='netCDF filename')
    parser.add_argument('name', default='name', help='name of the material')
    parser.add_argument('-l','--labels', help='A string with the labels of the kpoints.')
    args = parser.parse_args()
    
    q = AnaddbPhonon(args.filename,args.name)
    if args.labels: q.set_labels(args.labels)
    print q
    q.write_json()
