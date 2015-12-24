import os
from netCDF4 import Dataset
import json
import numpy as np

#conversion variables
bohr_angstroem = 0.529177249
hartree_cm1 = 219474.63
eV = 27.211396132

#functions
def red_car(red,lat): return np.array(map( lambda coord: coord[0]*lat[0]+coord[1]*lat[1]+coord[2]*lat[2], red))
def car_red(car,lat): return array(map( lambda coord: solve(lat.T,coord), car))
def swapxz(x,y,z):    return [z,y,-x] #swap the x for the z component on a 3d vector
def noswap(x,y,z):    return [x,y,z] #dont change anything on the 3d vector
def map2(f,a):        return [[f(y) for y in x] for x in a] #apply a function to a list of lists
def round_ll(a):      return map2(lambda x: round(x,4), a) #round the values of a list of lists
def swap_l(a,swap):   return [swap(*x) for x in a] #swap all 3d vectors in list a

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


class material():
    def __init__(self,filename,name,reps=(1,1,1),swap=noswap,reorder=True,scale=1.0):
        self.reps = reps
        self.name = name
        self.swap = swap
        self.scale = scale
        self.filename = filename

        #if the file already exists then we read it
        if os.path.isfile(filename):
            self.read_abinit()
    
        #reorder eigenvales
        if reorder:
            self.reorder_eigenvalues()

    def read_abinit(self):
        pcfile = Dataset(self.filename, 'r', format='NETCDF4')
        self.eival = pcfile.variables['phfreqs'][:]
        vectors = pcfile.variables['phdispl_cart'][:]
        self.kpoints =  pcfile.variables['qpoints'][:]    #reduced kpoints
        self.pos = pcfile.variables['reduced_atom_positions'][:]
        self.lat = pcfile.variables['primitive_vectors'][:]*bohr_angstroem
        self.atom_types = pcfile.variables['atom_species'][:]
        self.natoms = len(pcfile.dimensions['number_of_atoms'])
        self.nkpoints = len(pcfile.dimensions['number_of_qpoints'])
        self.nmodes = len(pcfile.dimensions['number_of_phonon_modes'])
        self.chemical_symbol = pcfile.variables['chemical_symbols'][:]
        pcfile.close()

        #transform the vectors
        vectors = vectors.reshape((self.nkpoints, self.nmodes, self.natoms, 3, 2))
        #normalize the eigenvectors
        self.eivec = vectors/np.linalg.norm(vectors[0,0])*self.scale

        self.chemical_symbol = ["".join(a).strip() for a in self.chemical_symbol]
        self.atom_types = [self.chemical_symbol[a-1] for a in self.atom_types]
    
    def __str__(self):
        """ Write some information about the system
        """
        s = "number of atoms:\n"
        s += str(self.natoms)
        s += "\nlattice vectors\n"
        s += str(self.lat)
        s += "\nrotated lattice vectors:\n"
        s += str(np.array(swap_l(round_ll( self.lat ), self.swap)))
        s += "\npositions of the atoms:\n"
        s += str(self.pos)
        s += "\natom types:\n"
        s += str(self.atom_types)
        return s


    def reorder_eigenvalues(self):
        #vector transformations
        vectors = self.eivec.view(complex).reshape((self.nkpoints, self.nmodes, self.nmodes))
        
        eig = np.zeros([self.nkpoints,self.nmodes])
        eiv = np.zeros([self.nkpoints,self.nmodes,self.nmodes],dtype=complex)
        #set order at gamma
        order = range(self.nmodes)
        eig[0] = self.eival[0]
        eiv[0] = vectors[0]
        for k in xrange(1,self.nkpoints):
            order = estimate_band_connection(vectors[k-1].T,vectors[k].T,order)
            for n,i in enumerate(order):
                eig[k,n] = self.eival[k,i]
                eiv[k,n] = vectors[k,i]
        
        #update teh eigenvales with the ordered version
        self.eival = eig
        self.eivec = eiv.view(float).reshape((self.nkpoints,self.nmodes,self.natoms,3,2))

    def write_json(self,filename):
        """ Write a json file to be read by javascript
        """
        f = open(filename,"w")

        #create the datastructure to be put on the json file
        data = {"name":         self.name,
                "natoms":       self.natoms,
                "lattice":      swap_l(round_ll( self.lat ), self.swap),
                "atom_types":   self.atom_types,
                "formula":      "".join(self.atom_types),
                "kpoints":      swap_l(self.kpoints.tolist(),self.swap),
                "repetitions":  self.reps, 
                "atom_pos_car": swap_l( red_car(self.pos,self.lat).tolist(), self.swap ),
                "atom_pos_red": swap_l( round_ll( self.pos ), self.swap ),
                "highcharts":   [],
                "highsym_qpts": [{ "value": 20, "color": 'black', "width": 1 }, {"value": 30,  "color": 'black', "width": 1 }],
                "vectors":      self.eivec.tolist() }

        #highcharts stuff
        for n in xrange(self.nmodes):
            data["highcharts"].append({"name":  "%d"%n,
                                       "color": "#0066FF",
                                       "marker": {"radius": 2,"symbol": "circle"},
                                       "data": [ e*hartree_cm1/eV for e in self.eival[:,n] ]
                                      })
        f.write(json.dumps(data))
        f.close()
