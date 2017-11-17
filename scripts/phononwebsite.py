#!/usr/bin/env python 
# Copyright (c) 2017, Henrique Miranda
# All rights reserved.
#
# This file is part of the phononwebsite project
#
"""
Read a local file with the phononwebsite
"""
import argparse
from phononweb.phononweb import open_file_phononwebsite

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='open a file in the phononwebsite')
    parser.add_argument('filename', help='name of the file to open')
    args = parser.parse_args()

    open_file_phononwebsite(args.filename)
