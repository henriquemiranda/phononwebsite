# Copyright (c) 2022, Henrique Miranda
# All rights reserved.
#
# This file is part of the phononwebsite project
#
""" Read phonon dispersion from quantum espresso """
from math import pi
import numpy as np
from phononweb import Phonon, bohr_angstroem, atomic_numbers
from .lattice import *

class VaspPhonon(Phonon):
    """
    Class to read phonons from VASP

    Input:
        prefix: vaspout.h5 file where the phonon dispersion is stored
    """
    def __init__(self,name,filename='vaspout.h5',reps=None,reorder=True):
        import h5py
        self.name = name
        self.filename = filename

        vaspout = h5py.File('vaspout.h5','r')

        #get reps
        sc_lat = vaspout['/input/poscar/lattice_vectors'][:]
        pc_lat = vaspout['/results/phonons/primitive/lattice_vectors'][:]
        t = np.matmul(np.linalg.inv(pc_lat.T),sc_lat.T)
        self.reps = np.rint(t.diagonal())
        if (reps): self.reps = reps

        # read atoms
        self.read_atoms(vaspout)

        # read path
        self.read_path(vaspout)

        # read modes
        self.read_modes(vaspout)

        #reorder eigenvalues
        if reorder:
            self.reorder_eigenvalues()
        self.get_distances_qpts()

    def read_path(self,vaspout):
        qpt = vaspout['/results/phonons/qpoint_coords'][:]
        self.qpoints = qpt
        self.nqpoints = len(qpt)


        coordinates_kpoints = vaspout['/input/qpoints/coordinates_kpoints'][:]
        number_line_segments = vaspout['/input/qpoints/number_line_segments'][()]
        number_kpoints = vaspout['/input/qpoints/number_kpoints'][()]

        nkpoints = 0
        indexes = []
        for nl in range(int(number_line_segments/2)):
            kpos1 = nkpoints
            nkpoints = nkpoints+number_kpoints
            kpos2 = nkpoints
            indexes.append(kpos1)
            indexes.append(kpos2)

        labels_kpoints = vaspout['/input/qpoints/labels_kpoints'][:]
        labels_kpoints = [label.decode().strip() for label in labels_kpoints]
        positions_labels_kpoints = vaspout['/input/qpoints/positions_labels_kpoints'][:]

        self.highsym_qpts = []
        highsym_qpts_dict = {}
        for p,l in zip(positions_labels_kpoints,labels_kpoints):
            highsym_qpts_dict[indexes[p-1]] = l
        self.highsym_qpts = list(highsym_qpts_dict.items())

    def read_modes(self,vaspout):
        """
        Function to read the eigenvalues and eigenvectors from Quantum Expresso
        """
        self.nphons       = vaspout['/results/phonons/nions'][()]*3
        self.eigenvalues  = vaspout['/results/phonons/frequencies'][:]*33.356
        self.eigenvectors = vaspout['/results/phonons/eigenvectors'][:]

        return self.eigenvalues, self.eigenvectors, self.qpoints

    def read_atoms(self,vaspout):
        """
        read the data from a quantum espresso input file
        """
        self.cell = vaspout['/results/phonons/primitive/lattice_vectors'][:]
        self.rec = rec_lat(self.cell)
        self.pos = vaspout['/results/phonons/primitive/position_ions'][:]
        ion_types = vaspout['/results/phonons/primitive/ion_types'][:]
        number_ion_types = vaspout['/results/phonons/primitive/number_ion_types'][:]
        ion_types = [typ.decode().strip() for typ in ion_types]
        atom_types = []
        for i,ion_type in enumerate(ion_types):
            for ntyp in range(number_ion_types[i]):
                atom_types.append(ion_type)
        self.chemical_symbols = ion_type
        self.atom_types = atom_types
        self.atom_numbers = [atomic_numbers[x] for x in self.atom_types]
        #self.atomic_numbers = np.unique(self.atom_numbers)
        self.chemical_symbols  = vaspout['/results/phonons/primitive/ion_types'][:]
        self.natoms = len(self.pos)
        self.chemical_formula = self.get_chemical_formula()

if __name__ == "__main__":
    vp = VaspPhonon('graphene')
    vp.write_json()
