# Copyright (c) 2017, Henrique Miranda
# All rights reserved.
#
# This file is part of the phononwebsite project
#
""" Read phonon dispersion from anaddb """
import os
from math import sqrt
import numpy as np
from .phononweb import Phonon
from .units import *

class AnaddbPhonon(Phonon):
    """
    Read the phonons produced with anaddb
    """
    def __init__(self,filename,name,reps=(3,3,3),reorder=True,highsym_qpts=None,folder='.'):
        self.reps = reps
        self.name = name
        self.folder = folder
        self.filename = "%s/%s"%(folder,filename)
        self.highsym_qpts = highsym_qpts

        #if the file already exists then we read it
        if os.path.isfile(self.filename):
            self.read_anaddb()
        else:
            raise ValueError('File {} does not exist.'.format(self.filename))

        #reorder eigenvales
        if reorder:
            self.reorder_eigenvalues()
        self.get_distances_qpts()
        self.labels_qpts = None

    def read_anaddb(self):
        """ read the netcdf file that results form anaddb
        """
        from netCDF4 import Dataset

        pcfile = Dataset(self.filename, 'r', format='NETCDF4')

        self.eigenvalues      = pcfile.variables['phfreqs'][:]*hartree_cm1/eV
        vectors               = pcfile.variables['phdispl_cart'][:]
        self.qpoints          = pcfile.variables['qpoints'][:]    #reduced coordinates
        self.pos              = pcfile.variables['reduced_atom_positions'][:]
        self.cell             = pcfile.variables['primitive_vectors'][:]*bohr_angstroem
        self.atypes           = pcfile.variables['atom_species'][:]
        self.natoms           = len(pcfile.dimensions['number_of_atoms'])
        self.nqpoints         = len(pcfile.dimensions['number_of_qpoints'])
        self.nphons           = len(pcfile.dimensions['number_of_phonon_modes'])
        self.chemical_symbols = pcfile.variables['chemical_symbols'][:].astype(str)
        self.atomic_numbers   = pcfile.variables['atomic_numbers'][:].astype(int)
        pcfile.close()

        #transform the vectors
        vectors = vectors.reshape((self.nqpoints, self.nphons, self.natoms, 3, 2))

        #the abinit eigenvectors are scaled with the atomic masses but the phonopy ones are not
        #so we always scale the eigenvectors with the atomic masses in the javascript of the website
        #here we scale then with sqrt(m) so that we recover the correct scalling on the website
        #for na in xrange(self.natoms):
        #    atomic_specie = self.atypes[na]-1
        #    atomic_number = self.atomic_numbers[atomic_specie]
        #    vectors[:,:,na,:,:] *= sqrt(atomic_mass[atomic_number])       
 
        #normalize the eigenvectors
        self.eigenvectors = vectors/np.linalg.norm(vectors[0,0])

        self.chemical_symbols = ["".join(a).strip() for a in self.chemical_symbols]
        self.atom_types       = [self.chemical_symbols[a-1] for a in self.atypes]
        self.atom_numbers     = [self.atomic_numbers[a-1] for a in self.atypes]
        self.chemical_formula = self.get_chemical_formula()
