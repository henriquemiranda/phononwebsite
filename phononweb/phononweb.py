# Copyright (c) 2016, Henrique Miranda
# All rights reserved.
#
# This file is part of the phononwebsite project
#
# Generic class to hold phonon dispersion data
#
import os
from netCDF4 import Dataset
import json
import numpy as np
from collections import Counter

#conversion variables
bohr_angstroem = 0.529177249
hartree_cm1 = 219474.63
eV = 27.211396132
Bohr = 1.88973

#from ase https://wiki.fysik.dtu.dk/ase/
chemical_symbols = ['X',  'H',  'He', 'Li', 'Be',
                    'B',  'C',  'N',  'O',  'F',
                    'Ne', 'Na', 'Mg', 'Al', 'Si',
                    'P',  'S',  'Cl', 'Ar', 'K',
                    'Ca', 'Sc', 'Ti', 'V',  'Cr',
                    'Mn', 'Fe', 'Co', 'Ni', 'Cu',
                    'Zn', 'Ga', 'Ge', 'As', 'Se',
                    'Br', 'Kr', 'Rb', 'Sr', 'Y',
                    'Zr', 'Nb', 'Mo', 'Tc', 'Ru',
                    'Rh', 'Pd', 'Ag', 'Cd', 'In',
                    'Sn', 'Sb', 'Te', 'I',  'Xe',
                    'Cs', 'Ba', 'La', 'Ce', 'Pr',
                    'Nd', 'Pm', 'Sm', 'Eu', 'Gd',
                    'Tb', 'Dy', 'Ho', 'Er', 'Tm',
                    'Yb', 'Lu', 'Hf', 'Ta', 'W',
                    'Re', 'Os', 'Ir', 'Pt', 'Au',
                    'Hg', 'Tl', 'Pb', 'Bi', 'Po',
                    'At', 'Rn', 'Fr', 'Ra', 'Ac',
                    'Th', 'Pa', 'U',  'Np', 'Pu',
                    'Am', 'Cm', 'Bk', 'Cf', 'Es',
                    'Fm', 'Md', 'No', 'Lr']

atomic_numbers = {}
for Z, symbol in enumerate(chemical_symbols):
    atomic_numbers[symbol] = Z
#end from ase

#functions
def red_car(red,lat): return np.array(map( lambda coord: coord[0]*lat[0]+coord[1]*lat[1]+coord[2]*lat[2], red))
def car_red(car,lat): return np.array(map( lambda coord: np.linalg.solve(lat.T,coord), car))
def map2(f,a):        return [[f(y) for y in x] for x in a] #apply a function to a list of lists

def rec_lat(lat):
    """
    Calculate the reciprocal lattice vectors
    """
    a1,a2,a3 = lat
    v = np.dot(a1,np.cross(a2,a3))
    b1 = np.cross(a2,a3)/v
    b2 = np.cross(a3,a1)/v
    b3 = np.cross(a1,a2)/v
    return np.array([b1,b2,b3])

def estimate_band_connection(prev_eigvecs, eigvecs, prev_band_order):
    """ A function to order the phonon eigenvectors taken from phonopy
    """
    metric = np.abs(np.dot(prev_eigvecs.conjugate().T, eigvecs))
    connection_order = []
    indices = range(len(metric))
    indices.reverse()
    for overlaps in metric:
        maxval = 0
        for i in indices:
            val = overlaps[i]
            if i in connection_order:
                continue
            if val > maxval:
                maxval = val
                maxindex = i
        connection_order.append(maxindex)

    band_order = [connection_order[x] for x in prev_band_order]
    return band_order


class Phonon():
    """ Class to hold and manipulate generic phonon dispersions data
    """

    def reorder_eigenvalues(self):
        #vector transformations
        vectors = self.eigenvectors.view(complex).reshape((self.nqpoints, self.nphons, self.nphons))
        
        eig = np.zeros([self.nqpoints,self.nphons])
        eiv = np.zeros([self.nqpoints,self.nphons,self.nphons],dtype=complex)
        #set order at gamma
        order = range(self.nphons)
        eig[0] = self.eigenvalues[0]
        eiv[0] = vectors[0]
        for k in xrange(1,self.nqpoints):
            order = estimate_band_connection(vectors[k-1].T,vectors[k].T,order)
            for n,i in enumerate(order):
                eig[k,n] = self.eigenvalues[k,i]
                eiv[k,n] = vectors[k,i]
        
        #update teh eigenvales with the ordered version
        self.eigenvalues  = eig
        self.eigenvectors = eiv.view(float).reshape((self.nqpoints,self.nphons,self.natoms,3,2))

    def get_chemical_formula(self):
        #from ase https://wiki.fysik.dtu.dk/ase/
        numbers = self.atom_numbers
        elements = np.unique(numbers)
        symbols = np.array([chemical_symbols[e] for e in elements])
        counts = np.array([(numbers == e).sum() for e in elements])

        ind = symbols.argsort()
        symbols = symbols[ind]
        counts = counts[ind]

        if 'H' in symbols:
            i = np.arange(len(symbols))[symbols == 'H']
            symbols = np.insert(np.delete(symbols, i), 0, symbols[i])
            counts = np.insert(np.delete(counts, i), 0, counts[i])
        if 'C' in symbols:
            i = np.arange(len(symbols))[symbols == 'C']
            symbols = np.insert(np.delete(symbols, i), 0, symbols[i])
            counts = np.insert(np.delete(counts, i), 0, counts[i])

        formula = ''
        for s, c in zip(symbols, counts):
            formula += s
            if c > 1:
                formula += str(c)

        return formula
        #end from ase

    def save_netcdf(self):
        """ Save phonon data in a netCDF file
        """
        natypes = len(self.chemical_symbols)

        #save all this stuff on a netcdf file
        ncfile = Dataset('anaddb.out_PHBST.nc', 'w')
        ncfile.createDimension('complex', 2)
        ncfile.createDimension('number_of_cartesian_dimensions', 3)
        ncfile.createDimension('number_of_reduced_dimensions', 3)
        ncfile.createDimension('number_of_atom_species', natypes)
        ncfile.createDimension('number_of_qpoints', self.nqpoints)
        ncfile.createDimension('number_of_atoms', self.natoms)
        ncfile.createDimension('number_of_phonon_modes', self.nphons)
        ncfile.createDimension('symbol_length',2)

        nc_primvecs     = ncfile.createVariable('primitive_vectors','f8',('number_of_cartesian_dimensions','number_of_cartesian_dimensions'))
        nc_atoms_pos      = ncfile.createVariable('reduced_atom_positions','f8',('number_of_atoms','number_of_cartesian_dimensions'))
        nc_chem_sym       = ncfile.createVariable('chemical_symbols','S1',('number_of_atom_species','symbol_length'))
        nc_qpoints        = ncfile.createVariable('qpoints','f8',('number_of_qpoints','number_of_reduced_dimensions'))
        nc_eig            = ncfile.createVariable('phfreqs','f8',('number_of_qpoints','number_of_phonon_modes'))
        nc_atypes         = ncfile.createVariable('atom_species','i4',('number_of_atoms'))
        nc_atomic_numbers = ncfile.createVariable('atomic_numbers','f8',('number_of_atom_species'))
        nc_eiv            = ncfile.createVariable('phdispl_cart','f8',('number_of_qpoints','number_of_phonon_modes',
                                                                       'number_of_phonon_modes','complex'))
        nc_chem_sym[:]       = np.array([ "%2s"%a for a in self.chemical_symbols ],dtype=np.dtype(('S10', 2)))
        nc_atypes[:]         = np.array([np.where(self.chemical_symbols == a) for a in self.atom_types])
        nc_atomic_numbers[:] = self.atomic_numbers
        nc_qpoints[:]        = np.array(self.qpoints)
        nc_primvecs[:]       = self.cell/bohr_angstroem
        nc_atoms_pos[:]      = self.pos
        nc_eig[:]            = self.eigenvalues
        nc_eiv[:]            = self.eigenvectors

        ncfile.close()

    def get_distances_qpts(self):

        #calculate reciprocal lattice
        rec = rec_lat(self.cell)
        #calculate qpoints in the reciprocal lattice
        car_qpoints = red_car(self.qpoints,rec)

        self.distances = []
        distance = 0
        #iterate over qpoints
        for k in range(1,self.nqpoints):
            self.distances.append(distance);

            #calculate distances
            step = np.linalg.norm(car_qpoints[k]-car_qpoints[k-1])
            distance += step

        #add the last distances
        self.distances.append(distance)

    def get_highsym_qpts(self):
        """ Iterate over all the qpoints and obtain the high symmetry points as well as the distances between them
        """
       
        def collinear(a,b,c):
            d = [[a[0],a[1],1],
                 [b[0],b[1],1],
                 [c[0],c[1],1]]
            return np.isclose(np.linalg.det(d),0,atol=1e-5)

        #iterate over qpoints
        qpoints = self.qpoints;
        self.highsym_qpts = []
        for k in range(1,self.nqpoints-1):
            #detect high symmetry qpoints
            if not collinear(qpoints[k-1],qpoints[k],qpoints[k+1]):
                self.highsym_qpts.append((k,''))

        return self.highsym_qpts

    def __str__(self):
        text = ""
        text += "cell:\n"
        for i in range(3):
            text += ("%12.8lf "*3)%tuple(self.cell[i])+"\n"
        text += "atoms:\n"
        for a in range(self.natoms):
            text += "%3s %3d"%(self.atom_types[a],self.atom_numbers[a])+("%12.8lf "*3)%tuple(self.pos[a])+"\n"
        text += "chemical symbols:\n"
        text += str(self.chemical_symbols)+"\n"
        text += str(self.atomic_numbers)+"\n"
        text += "chemical formula:\n"
        text += self.chemical_formula+"\n"
        text += "nqpoints:\n"
        text += str(self.nqpoints)
        return text

    def write_json(self,prefix=None,folder='.'):
        """ Write a json file to be read by javascript
        """
        if prefix: name = prefix
        else:      name = self.name

        f = open("%s/%s.json"%(folder,name),"w")

        if self.highsym_qpts == None:
            self.get_highsym_qpts()

        #create the datastructure to be put on the json file
        data = {"name":             self.name,                       # name of the material that will be displayed on the website
                "natoms":           self.natoms,                     # number of atoms
                "lattice":          self.cell.tolist(),              # lattice vectors (bohr)
                "atom_types":       self.atom_types,                 # atom type   for each atom in the system (string)
                "atom_numbers":     self.atom_numbers,               # atom number for each atom in the system (integer)
                "chemical_symbols": self.chemical_symbols,           # unique atom types   (string) 
                "atomic_numbers":   self.atomic_numbers.tolist(),    # unique atom numbers (integer)
                "formula":          self.chemical_formula,           # chemical formula
                "qpoints":          self.qpoints.tolist(),           # list of point in the reciprocal space
                "repetitions":      self.reps,                       # default value for the repetititions 
                "atom_pos_car":     red_car(self.pos,self.cell).tolist(), # atomic positions in cartesian coordinates
                "atom_pos_red":     self.pos.tolist(),                    # atomic positions in reduced coordinates
                "eigenvalues":      self.eigenvalues.tolist(),            # eigenvalues (in units of cm-1)
                "distances":        self.distances,                       # list distances between the qpoints 
                "highsym_qpts":     self.highsym_qpts,                    # list of high symmetry qpoints
                "vectors":          self.eigenvectors.tolist()}           # eigenvectors

        f.write(json.dumps(data))
        f.close()
