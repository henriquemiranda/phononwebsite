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
from phononweb.utils import open_file_phononwebsite

def main():
    parser = argparse.ArgumentParser(description='open a file in the phononwebsite')
    parser.add_argument('filename', help='name of the file to open')
    parser.add_argument('-w','--website', default="http://henriquemiranda.github.io/phononwebsite",
                                   help='the website to use')
    args = parser.parse_args()

    open_file_phononwebsite(args.filename,website=args.website)

if __name__ == "__main__":
    main()
