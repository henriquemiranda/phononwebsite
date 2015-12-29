from netCDF4 import Dataset, stringtoarr
import numpy as np
from unilux_matlib import *
from ase import io
from ase.units import *

Ha = 4.55633e-6
hartree_cm1 = 219474.63
eV = 27.211396132
NUMCHARS = 80
prefix = 'mote2'

print "reading atoms..."
atoms = io.read(prefix+'.scf',format='esp_in')


print "cell:"
print atoms.get_cell()
print "positions:"
print atoms.get_scaled_positions()

atoms.translate((0.0,0.0,3))

print "cell:"
print atoms.get_cell()
print "positions:"
print atoms.get_scaled_positions()

print "reading eigenvectors..."
eig, vec, qpt = read_modes_txt(prefix+'.modes')

nqpoints = len(qpt)
chem_sym = atoms.get_chemical_symbols()
atom_numbers = np.unique(atoms.get_atomic_numbers())
unique_chem_sym = np.unique(chem_sym)
unique_atom_species = dict(zip(unique_chem_sym,range(1,len(unique_chem_sym)+1)))
atom_species = [ unique_atom_species[i] for i in chem_sym]
natypes = len(unique_chem_sym)
natoms = len(atoms)
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
nc_qpoints[:]      = np.array(qpt)
nc_primvecs[:]     = atoms.get_cell()/Bohr
nc_atoms_pos[:]    = atoms.get_scaled_positions()
nc_eig[:] = eig*eV/hartree_cm1
nc_eiv[:] = vec.view(dtype=float).reshape([nqpoints,nphons,nphons,2])

ncfile.close()
