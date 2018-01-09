# Copyright (c) 2017, Henrique Miranda
# All rights reserved.
#
# This file is part of the phononwebsite project
#
""" Generic class to hold and manipulate phonon dispersion data """
import os
import json
import numpy as np
from collections import Counter
from .units import *

def open_file_phononwebsite(filename,port=8000,
                            website="http://henriquemiranda.github.io",
                            host="localhost"):
    """
    take a file, detect the type and open it on the phonon website
    """
    import webbrowser
    import signal
    import sys

    #python 2 and 3 http server
    from http.server import SimpleHTTPRequestHandler
    from http.server import HTTPServer

    #create threads python
    from threading import Thread

    if ".json" in filename:
        filetype = "json"
    elif ".yaml" in filename:
        filetype = "yaml"
    else: 
        filetype = "rest"

    # Add CORS header to the website
    class CORSRequestHandler (SimpleHTTPRequestHandler):
        def end_headers (self):
            self.send_header('Access-Control-Allow-Origin', website)
            SimpleHTTPRequestHandler.end_headers(self)
        def log_message(self, format, *args):
            return

    # Quit application when SIGINT is received
    def signal_handler(signal, frame):
        sys.exit(0)

    #initialize http server thread
    print('Starting HTTP server...')
    try:
        server = HTTPServer(('', port), CORSRequestHandler)
    except OSError:
        server = HTTPServer(('', port+1), CORSRequestHandler)
        
    server.url = 'http://{}:{}'.format(host,server.server_port)
    t = Thread(target=server.serve_forever)
    t.daemon = True
    t.start()

    #open website with the file
    url_filename = 'http://{}:{}/{}'.format(host,server.server_port,filename)
    url = '%s/phonon.html?%s=%s'%(website,filetype,url_filename)
    webbrowser.open_new(url)

    print('Press Ctrl+C to terminate HTTP server')
    signal.signal(signal.SIGINT, signal_handler)
    signal.pause()

def estimate_band_connection(prev_eigvecs, eigvecs, prev_band_order):
    """ 
    A function to order the phonon eigenvectors taken from phonopy
    """
    metric = np.abs(np.dot(prev_eigvecs.conjugate().T, eigvecs))
    connection_order = []
    indices = list(range(len(metric)))
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
    """ 
    Class to hold and manipulate generic phonon dispersions data 
    output .json files to be read by the phononwebsite
    """
    def reorder_eigenvalues(self):
        """
        compare the eigenvectors that correspond to the different eigenvalues
        to re-order the eigenvalues and solve the band-crossings
        """
        #vector transformations
        dim = (self.nqpoints, self.nphons, self.nphons)
        vectors = self.eigenvectors.view(complex).reshape(dim)
        
        eig = np.zeros([self.nqpoints,self.nphons])
        eiv = np.zeros([self.nqpoints,self.nphons,self.nphons],dtype=complex)
        #set order at gamma
        order = list(range(self.nphons))
        eig[0] = self.eigenvalues[0]
        eiv[0] = vectors[0]
        for k in range(1,self.nqpoints):
            order = estimate_band_connection(vectors[k-1].T,vectors[k].T,order)
            for n,i in enumerate(order):
                eig[k,n] = self.eigenvalues[k,i]
                eiv[k,n] = vectors[k,i]
        
        #update teh eigenvales with the ordered version
        self.eigenvalues  = eig
        dim = (self.nqpoints,self.nphons,self.natoms,3,2)
        self.eigenvectors = eiv.view(float).reshape(dim)

    def get_chemical_formula(self):
        """
        from ase https://wiki.fysik.dtu.dk/ase/
        """
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
        """ 
        Save phonon data in a netCDF file
        """
        from netCDF4 import Dataset

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

        nccv = ncfile.createVariable
        nc_primvecs    = nccv('primitive_vectors','f8',('number_of_cartesian_dimensions',
                                                        'number_of_cartesian_dimensions'))
        nc_atoms_pos   = nccv('reduced_atom_positions','f8',('number_of_atoms',
                                                             'number_of_cartesian_dimensions'))
        nc_chem_sym    = nccv('chemical_symbols','S1',('number_of_atom_species','symbol_length'))
        nc_qpoints     = nccv('qpoints','f8',('number_of_qpoints','number_of_reduced_dimensions'))
        nc_eig         = nccv('phfreqs','f8',('number_of_qpoints','number_of_phonon_modes'))
        nc_atypes      = nccv('atom_species','i4',('number_of_atoms'))
        nc_atomic_nums = nccv('atomic_numbers','f8',('number_of_atom_species'))
        nc_eiv         = nccv('phdispl_cart','f8',('number_of_qpoints','number_of_phonon_modes',
                                                   'number_of_phonon_modes','complex'))

        str10 = np.dtype(('S10', 2))
        nc_chem_sym[:]    = np.array(["%2s"%a for a in self.chemical_symbols],dtype=str10)
        nc_atypes[:]      = np.array([np.where(self.chemical_symbols == a) for a in self.atom_types])
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
        """ 
        Iterate over all the qpoints and obtain the high symmetry points 
        as well as the distances between them
        """
       
        def collinear(a,b,c):
            """
            checkkk if three points are collinear
            """
            d = [[a[0],a[1],1],
                 [b[0],b[1],1],
                 [c[0],c[1],1]]
            return np.isclose(np.linalg.det(d),0,atol=1e-5)

        #iterate over qpoints
        qpoints = self.qpoints;
        self.highsym_qpts = [[0,'']]
        for k in range(1,self.nqpoints-1):
            #detect high symmetry qpoints
            if not collinear(qpoints[k-1],qpoints[k],qpoints[k+1]):
                self.highsym_qpts.append((k,''))
        #add final k-point
        self.highsym_qpts.append((self.nqpoints-1,''))
    
        #if the labels are defined, assign them to the detected kpoints
        if self.labels_qpts:
            nhiqpts = len(self.highsym_qpts)
            nlabels = len(self.labels_qpts)
            if nlabels == nhiqpts:
                #fill in the symbols
                self.highsym_qpts = [(q,s) for (q,l),s in zip(self.highsym_qpts,self.labels_qpts)] 
            else:
                raise ValueError("Wrong number of q-points specified. "
                                 "Found %d high symmetry qpoints but %d labels"%(nhiqpts,nlabels))
        else:
            print("The labels of the high symmetry k-points are not known. "
                  "They can be changed in the .json file manualy.") 
        return self.highsym_qpts

    def set_repetitions(self,reps):
        """
        Get the number of repetitions based from a string
        """
        if   ',' in reps: reps = reps.split(',')
        elif ' ' in reps: reps = reps.split(' ')
        self.reps = [int(r) for r in reps]       
        print(self.reps)

    def set_labels(self,labels):
        """
        Use a string to set the names of the k-points.
        There are two modes:
            1 the string is a list of caracters and each caracter corresponds to one k-point
            2 the string is a set of words comma or space separated.
        """
        if   ',' in labels: self.labels_qpts = labels.split(',')
        elif ' ' in labels: self.labels_qpts = labels.split(' ')
        else:               self.labels_qpts = labels

    def write_json(self,prefix=None,folder='.'):
        """
        Write a json file to be read by javascript
        """
        if prefix: name = prefix
        else:      name = self.name

        f = open("%s/%s.json"%(folder,name),"w")

        if self.highsym_qpts == None:
            self.get_highsym_qpts()

        red_pos = red_car(self.pos,self.cell)
        #create the datastructure to be put on the json file
        data = {"name":         self.name,             # name of the material on the website
                "natoms":       self.natoms,           # number of atoms
                "lattice":      self.cell,             # lattice vectors (bohr)
                "atom_types":   self.atom_types,       # atom type for each atom (string)
                "atom_numbers": self.atom_numbers,     # atom number for each atom (integer)
                "formula":      self.chemical_formula, # chemical formula
                "qpoints":      self.qpoints,          # list of point in the reciprocal space
                "repetitions":  self.reps,             # default value for the repetititions 
                "atom_pos_car": red_pos,               # atomic positions in cartesian coordinates
                "atom_pos_red": self.pos,              # atomic positions in reduced coordinates
                "eigenvalues":  self.eigenvalues,      # eigenvalues (in units of cm-1)
                "distances":    self.distances,        # list distances between the qpoints 
                "highsym_qpts": self.highsym_qpts,     # list of high symmetry qpoints
                "vectors":      self.eigenvectors}     # eigenvectors

        f.write(json.dumps(data,cls=JsonEncoder,indent=1))
        f.close()

    def open_json(self,prefix=None,folder='.',host='localhost',port=8000):
        """
        Create a json file and open it on the webbrowser
        
        1. Create a thread with HTTP server on localhost to provide the file to the page
        2. Open the webpage indicating it to open the file from the localhost
        3. Wait for user to kill HTTP server 
        (TODO: once the file is served the server can shutdown automatically)
        """

        if prefix: name = prefix
        else:      name = self.name
        filename = "%s/%s.json"%(folder,name)

        open_file_phononwebsite(filename,localhost=localhost,port=port)

    def __str__(self):
        text = ""
        text += "name: %s\n"%self.name
        text += "cell:\n"
        for i in range(3):
            text += ("%12.8lf "*3)%tuple(self.cell[i])+"\n"
        text += "atoms:\n"
        for a in range(self.natoms):
            atom_pos_string = "%3s %3d"%(self.atom_types[a],self.atom_numbers[a])
            atom_typ_string = ("%12.8lf "*3)%tuple(self.pos[a]) 
            text += atom_pos_string+atom_typ_string+"\n"
        text += "atypes:\n"
        for cs,an in zip(self.chemical_symbols,self.atomic_numbers):
            text += "%3s %d\n"%(cs,an)
        text += "chemical formula:\n"
        text += self.chemical_formula+"\n"
        text += "nqpoints:\n"
        text += str(self.nqpoints)
        text += "\n"
        return text


