# Copyright (C) 2017 Henrique Pereira Coutada Miranda
# All rights reserved.
#
# This file is part of phononwebsite
#
from __future__ import print_function
import unittest
import os
from phononweb.phonondb import PhononDB2015

class TestPhononDB2015(unittest.TestCase):
    def test_phonondb_2015(self):
        pdb = PhononDB2015()
        pdb = PhononDB2015()
        print(pdb)

    def tearDown(self):
        os.remove('phonondb.json')

if __name__ == '__main__':
    unittest.main()
