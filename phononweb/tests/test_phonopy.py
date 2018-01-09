# Copyright (C) 2017 Henrique Pereira Coutada Miranda
# All rights reserved.
#
# This file is part of phononwebsite
#
from __future__ import print_function
import unittest
import os
import shutil as sh
from phononweb.phononpy import PhonopyPhonon

test_path = os.path.join('..','..','tests','phonondb','2015','mp-149','gruneisen-00')

class TestPhononpyPhonon(unittest.TestCase):
    def setUp(self):
        """initialize the phononpy class"""
        phonon_yaml_filename = os.path.join(test_path,'phonon.yaml')
        force_sets_filename = os.path.join(test_path,'FORCE_SETS')
        self.phonon = PhonopyPhonon.from_files(phonon_yaml_filename,force_sets_filename)

    def test_mp_bandstructure(self):
        """ Calculate bandstructure using the materials project database """
        self.phonon.set_bandstructure_mp('mp-149') 
        self.phonon.get_bandstructure()
        self.phonon.write_band_yaml('mp-149-mp.yaml')

    def test_seekpath_bandstructure(self):
        """ Calculate bandstructure using seekpath """
        self.phonon.set_bandstructure_seekpath() 
        self.phonon.get_bandstructure()
        self.phonon.write_band_yaml('mp-149-seekpath.yaml')

    def tearDown(self):
        """ remove the files """
        filename = 'mp-149-mp.yaml'
        if os.path.isfile(filename): os.remove(filename)
        filename ='mp-149-seekpath.yaml'
        if os.path.isfile(filename): os.remove(filename)

if __name__ == '__main__':
    unittest.main()
