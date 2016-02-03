#!/usr/bin/env python
# Copyright (c) 2015, Henrique Miranda
# All rights reserved.
#
# This file is part of the phononwebsite project
#
# Read phonon dispersion from quantum espresso
#
from qepy import *
from phononweb import *
import numpy as np

class QePhonon(Phonon):
    """ Class to read phonons from Quantum Espresso

        Input:
            prefix = prefix of the <prefix>.scf file where the structure is stored
                               the <prefix>.modes file that is the output of the matdyn.x or dynmat.x programs
    """
    def __init__(self,prefix,name,reps=(3,3,3)):
        self.prefix = prefix
        self.name = name
        self.reps = reps
        self.read_atoms()
        self.read_modes()
        self.highsym_qpts = None

    def read_modes(self):
        """
        Function to read the eigenvalues and eigenvectors from Quantum Expresso
        """
        filename = "%s.modes"%self.prefix
        f = open(filename,'r')
        file_list = f.readlines()
        file_str  = "".join(file_list)
        f.close()

        #determine the numer of atoms
        nphons = max([int(x) for x in re.findall( 'freq \((.+)\)', file_str )])
        atoms = nphons/3

        #check if the number fo atoms is the same
        if atoms != self.natoms:
            print "The number of atoms in the <>.scf file is not the same as in the <>.modes file"
            exit(1)

        #determine the number of qpoints
        self.nqpoints = len( re.findall('q = ', file_str ) )
        nqpoints = self.nqpoints

        eig = np.zeros([nqpoints,nphons])
        vec = np.zeros([nqpoints,nphons,atoms,3],dtype=complex)
        qpt = np.zeros([nqpoints,3])
        for k in xrange(nqpoints):
            #iterate over qpoints
            k_idx = 2 + k*((atoms+1)*nphons + 5)
            #read qpoint
            qpt[k] = map(float, file_list[k_idx].split()[2:])
            for n in xrange(nphons):
                #read eigenvalues
                eig_idx = k_idx+2+n*(atoms+1)
                eig[k][n] = float(re.findall('=\s+([+-]?\d+(?:\.\d+)?(?:[eE][-+]?\d+)?)',file_list[eig_idx])[1])
                for i in xrange(atoms):
                    #read eigenvectors
                    z = map(float,re.findall('([+-]?\d+(?:\.\d+)?(?:[eE][-+]?\d+)?)',file_list[eig_idx+1+i]))
                    vec[k][n][i] = np.array( [complex(z[0],z[1]),complex(z[2],z[3]),complex(z[4],z[5])], dtype=complex )

        self.nqpoints     = len(qpt)
        self.nphons       = nphons
        self.eigenvalues  = eig*eV/hartree_cm1
        self.eigenvectors = vec.view(dtype=float).reshape([self.nqpoints,nphons,nphons,2])
        self.qpoints      = qpt
        return self.eigenvalues, self.eigenvectors, self.qpoints

    def read_atoms(self):
        """ read the data from a quantum espresso input file
        """
        pwin = PwIn(filename="%s.scf"%self.prefix)
        self.cell, self.pos, self.atom_types = pwin.get_atoms()
        self.cell = np.array(self.cell)
        self.pos = np.array(self.pos)
        self.atom_numbers = [atomic_numbers[x] for x in self.atom_types]
        self.atomic_numbers = np.unique(self.atom_numbers)
        self.chemical_symbols = np.unique(self.atom_types).tolist()
        self.natoms = len(self.pos)
        self.chemical_formula = self.get_chemical_formula()

        #convert to reduced coordinates
        if pwin.atomic_pos_type.lower() == "cartesian":
            self.pos = car_red(self.pos,self.cell)
