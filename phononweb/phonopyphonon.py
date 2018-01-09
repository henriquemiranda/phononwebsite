# Copyright (c) 2017, Henrique Miranda
# All rights reserved.
#
# This file is part of the phononwebsite project
#
""" Helpper function to create band-structures with phonopy """

import os
import json
import re
import copy

from phonopy import Phonopy
from phonopy.units import Hartree, Bohr
from phonopy.interface.phonopy_yaml import *
import phonopy.file_IO as file_IO

class PhonopyPhonon():
    """
    Calculate the phonon dispersion from phononpy
    """
    def __init__(self,phonon):
        self.phonon = phonon

    @classmethod
    def from_files(self,phonon_yaml_filename,force_sets_filename,nac_filename=None):
        """initialize the PhonopyPhonon"""
        #get phonon_yaml
        ph_yaml = PhonopyYaml()
        ph_yaml.read(phonon_yaml_filename)
        atoms = ph_yaml.get_unitcell()
        supercell_matrix = ph_yaml._data['supercell_matrix']

        #get force_sets
        force_sets = file_IO.parse_FORCE_SETS(filename=force_sets_filename)

        phonon = Phonopy(atoms,supercell_matrix)
        phonon.set_displacement_dataset(force_sets)
        phonon.produce_force_constants()
        phonon.symmetrize_force_constants_by_space_group()

        #get NAC
        if nac_filename:
            nac_params = file_IO.parse_BORN(phonon.get_primitive(), filename=nac_filename)
            nac_factor = Hartree * Bohr
            if nac_params['factor'] == None:
                nac_params['factor'] = nac_factor
            phonon.set_nac_params(nac_params)

        return PhonopyPhonon(phonon)

    def set_bandstructure_mp(self,mp_id,mp_api_key=None,band_points=5,verbose=False):
        """
        get bandstructure from the materials project
        """
        from pymatgen.ext.matproj import MPRester
        
        #start mprester
        self.mprester = MPRester(mp_api_key)

        #get bandstruccture
        bs = self.mprester.get_bandstructure_by_material_id(mp_id)

        #get high symmetry k-points
        if verbose: print("nkpoints:", len(bs.kpoints))
        branches = bs.as_dict()['branches']

        self.bands = []
        self.labels = [bs.kpoints[0].label]
        for path in branches:
            start = path['start_index'] 
            end   = path['end_index']

            start_kpoint = bs.kpoints[start].frac_coords
            end_kpoint   = bs.kpoints[end].frac_coords
            step_kpoint  = end_kpoint-start_kpoint

            self.labels.append(bs.kpoints[end].label)

            branch = []
            for i in range(band_points+1):
                branch.append(start_kpoint + float(i)/band_points*step_kpoint )
            self.bands.append(np.array(branch))

    def set_bandstructure_seekpath(self,reference_distance=0.1):
        """Get the bandstructure using seekpath"""
        import seekpath

        unitcell = self.phonon.get_unitcell()
        cell = unitcell.get_cell()
        atoms = unitcell.get_atomic_numbers()
        pos = unitcell.get_scaled_positions()
        
        path = seekpath.get_explicit_k_path((cell,pos,atoms),reference_distance=reference_distance)
        kpath  = path['explicit_kpoints_rel']
        explicit_labels = path['explicit_kpoints_labels']
        self.bands = []
        self.labels = []
        for segment in path['segments']:
            start_k, end_k = segment
            self.labels.append(explicit_labels[start_k])
            self.bands.append(kpath[start_k:end_k])
        self.labels.append(explicit_labels[-1])

    def get_frequencies_with_eigenvectors(self,qpoint=(0,0,0)):
        """calculate the eigenvalues and eigenvectors at a specific qpoint"""
        frequencies, eigenvectors = self.phonon.get_frequencies_with_eigenvectors(qpoint)
        return frequencies, eigenvectors

    def get_bandstructure(self, is_eigenvectors=True, is_band_connection=True):
        """calculate the bandstructure"""
        self.phonon.set_band_structure(self.bands, is_eigenvectors=is_eigenvectors, is_band_connection=is_band_connection)
        return self.phonon.get_band_structure()
 
    def write_disp_yaml(self,filename='disp.yaml'):
        """write disp yaml file"""
        displacements = self.phonon.get_displacements()
        directions = self.phonon.get_displacement_directions()
        supercell = self.phonon.get_supercell()
        file_IO.write_disp_yaml(displacements, supercell, directions=directions, filename=filename)

    def write_band_yaml(self,eigenvectors=True,filename='band.yaml'):
        """export a yaml file with the band-structure data"""
        if eigenvectors:
            phonon = self.phonon
        else:
            phonon = copy.deepcopy(self.phonon)
            phonon._band_structure._eigenvectors = None
        phonon.write_yaml_band_structure(filename=filename)
