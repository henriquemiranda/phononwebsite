#!/usr/bin/env python
# Copyright (c) 2015, Henrique Miranda
# All rights reserved.
#
# This file is part of the phononwebsite project
#
# Read phonon dispersion from anaddb
#
from netCDF4 import Dataset
from phononweb import *
import os
import numpy as np
import argparse

class AnaddbPhonon(Phonon):
    def __init__(self,filename,name,reps=(3,3,3),reorder=True,scale=1.0):
        self.reps = reps
        self.name = name
        self.scale = scale
        self.filename = filename
        self.highsym_qpts = None

        #if the file already exists then we read it
        if os.path.isfile(filename):
            self.read_anaddb()
    
        #reorder eigenvales
        if reorder:
            self.reorder_eigenvalues()

    def read_anaddb(self):
        """ read the netcdf file that results form anaddb
        """
        pcfile = Dataset(self.filename, 'r', format='NETCDF4')

        self.eigenvalues      = pcfile.variables['phfreqs'][:]*hartree_cm1/eV
        vectors               = pcfile.variables['phdispl_cart'][:]
        self.qpoints          = pcfile.variables['qpoints'][:]    #reduced coordinates
        self.pos              = pcfile.variables['reduced_atom_positions'][:]
        self.cell             = pcfile.variables['primitive_vectors'][:]
        self.atypes           = pcfile.variables['atom_species'][:]
        self.natoms           = len(pcfile.dimensions['number_of_atoms'])
        self.nqpoints         = len(pcfile.dimensions['number_of_qpoints'])
        self.nphons           = len(pcfile.dimensions['number_of_phonon_modes'])
        self.chemical_symbols = pcfile.variables['chemical_symbols'][:]
        self.atomic_numbers   = pcfile.variables['atomic_numbers'][:].astype(int)
        pcfile.close()

        #transform the vectors
        vectors = vectors.reshape((self.nqpoints, self.nphons, self.natoms, 3, 2))
        #normalize the eigenvectors
        self.eigenvectors = vectors/np.linalg.norm(vectors[0,0])*self.scale

        self.chemical_symbols = np.array(["".join(a).strip() for a in self.chemical_symbols])
        self.atom_types       = [self.chemical_symbols[a-1] for a in self.atypes]
        self.atom_numbers     = [self.atomic_numbers[a-1] for a in self.atypes]
        self.chemical_formula = self.get_chemical_formula()

if __name__ == "__main__":
   
    parser = argparse.ArgumentParser(description='Read anaddb netCDF file and write a .json file to use in the phononwebsite')
    parser.add_argument('filename', help='netCDF filename')
    parser.add_argument('name', default='name', help='name of the material')
    args = parser.parse_args()
    
    q = AnaddbPhonon(args.filename,args.name)
    print q
    q.save_netcdf()
    q.write_json()
