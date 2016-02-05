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

if __name__ == "__main__":

    parser = argparse.ArgumentParser(description='Read <prefix>.modes and <prefix>.scf files from quantum espresso and write a .json file to use in the phononwebsite.')
    parser.add_argument('prefix', help='the prefix used in the pw.x and ph.x calculation')
    parser.add_argument('name', default='name', help='name of the material')
    args = parser.parse_args()

    q = QePhonon(args.prefix,args.name)
    print q
    q.write_json()
