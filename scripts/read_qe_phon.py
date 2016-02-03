# Copyright (c) 2015, Henrique Miranda
# All rights reserved.
#
# Redistribution and use in source and binary forms, with or without
# modification, are permitted provided that the following conditions are met:
#     * Redistributions of source code must retain the above copyright
#       notice, this list of conditions and the following disclaimer.
#     * Redistributions in binary form must reproduce the above copyright
#       notice, this list of conditions and the following disclaimer in the
#       documentation and/or other materials provided with the distribution.
#     * Neither the name of the phononwebsite project nor the
#       names of its contributors may be used to endorse or promote products
#       derived from this software without specific prior written permission.
# 
# THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
# ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
# WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
# DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER BE LIABLE FOR ANY
# DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
# (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
# LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
# ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
# (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
# SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
#
# Read phonon dispersion from quantum espresso
#
from netCDF4 import Dataset
from qepy import * 
import numpy as np
import argparse

hartree_cm1 = 219474.63
eV          = 27.211396132
Bohr        = 1.88973

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

def car_red(car,lat):
    """
    Convert cartesian coordinates to reduced
    """
    return np.array(map( lambda coord: np.linalg.solve(np.array(lat).T,coord), car))

class QePhonon():
    """ Class to read phonons from Quantum Espresso
       
        Input:
            prefix = prefix of the <prefix>.scf file where the structure is stored
                               the <prefix>.modes file that is the output of the matdyn.x or dynmat.x programs
    """
    def __init__(self,prefix):
        self.prefix = prefix
        self.read_atoms()
        self.read_modes()
    
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

        #determine the number of qpoints
        kpoints = len( re.findall('q = ', file_str ) )

        eig = np.zeros([kpoints,nphons])
        vec = np.zeros([kpoints,nphons,atoms,3],dtype=complex)
        qpt = np.zeros([kpoints,3])
        for k in xrange(kpoints):
            #iterate over kpoints
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

        self.eigenvalues, self.eigenvectors, self.qpoints = eig, vec, qpt
        return eig, vec, qpt

    def read_atoms(self):
        """ read the data from a quantum espresso input file
        """
        pwin = PwIn(filename="%s.scf"%self.prefix)
        self.cell, self.pos, self.sym = pwin.get_atoms()
        self.cell = np.array(self.cell)
        self.pos = np.array(self.pos)
        self.sym = np.array(self.sym)
        if pwin.atomic_pos_type.lower() == "crystal":
            self.pos = car_red(self.pos,self.cell)
    def __str__(self):
        text = ""
        text += "cell:\n"
        text += str(self.cell)+"\n"
        text += "positions:\n"
        text += str(self.pos)+"\n"
        return text

    def save_netcdf(self):
        """ Save phonon data in a netCDF file
        """
        nqpoints = len(self.qpoints)
        chem_sym = self.sym
        atom_numbers = np.unique([atomic_numbers[x] for x in self.sym])
        unique_chem_sym = np.unique(chem_sym)
        unique_atom_species = dict(zip(unique_chem_sym,range(1,len(unique_chem_sym)+1)))
        atom_species = [ unique_atom_species[i] for i in chem_sym]
        natypes = len(unique_chem_sym)
        natoms = len(self.pos)
        nphons = natoms*3

        #save all this stuff on a netcdf file
        ncfile = Dataset('anaddb.out_PHBST.nc', 'w')
        ncfile.createDimension('complex', 2)
        ncfile.createDimension('number_of_cartesian_dimensions', 3)
        ncfile.createDimension('number_of_reduced_dimensions', 3) 
        ncfile.createDimension('number_of_atom_species', natypes)
        ncfile.createDimension('number_of_qpoints', nqpoints)
        ncfile.createDimension('number_of_atoms', natoms)
        ncfile.createDimension('number_of_phonon_modes', nphons)
        ncfile.createDimension('symbol_length',2)

        nc_primvecs     = ncfile.createVariable('primitive_vectors','f8',('number_of_cartesian_dimensions','number_of_cartesian_dimensions'))
        nc_atoms_pos    = ncfile.createVariable('reduced_atom_positions','f8',('number_of_atoms','number_of_cartesian_dimensions'))
        nc_chem_sym     = ncfile.createVariable('chemical_symbols','S1',('number_of_atom_species','symbol_length'))
        nc_qpoints      = ncfile.createVariable('qpoints','f8',('number_of_qpoints','number_of_reduced_dimensions'))
        nc_eig          = ncfile.createVariable('phfreqs','f8',('number_of_qpoints','number_of_phonon_modes'))
        nc_atypes       = ncfile.createVariable('atom_species','i4',('number_of_atoms'))
        nc_atom_numbers = ncfile.createVariable('atomic_numbers','f8',('number_of_atom_species'))
        nc_eiv          = ncfile.createVariable('phdispl_cart','f8',('number_of_qpoints','number_of_phonon_modes',
                                                                     'number_of_phonon_modes','complex'))


        nc_chem_sym[:]     = np.array([ "%2s"%a for a in unique_chem_sym ],dtype=np.dtype(('S10', 2)))
        nc_atypes[:]       = atom_species 
        nc_atom_numbers[:] = atom_numbers 
        nc_qpoints[:]      = np.array(self.qpoints)
        nc_primvecs[:]     = self.cell/Bohr
        nc_atoms_pos[:]    = self.pos
        nc_eig[:] = self.eigenvalues*eV/hartree_cm1
        nc_eiv[:] = self.eigenvectors.view(dtype=float).reshape([nqpoints,nphons,nphons,2])

        ncfile.close()

if __name__ == "__main__":

    parser = argparse.ArgumentParser(description='Read pw.x bands.')
    parser.add_argument('prefix', help='the prefix used in the pw.x calculation')
    args = parser.parse_args()

    q = QePhonon(args.prefix)
    q.save_netcdf()
