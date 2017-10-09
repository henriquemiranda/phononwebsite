#
# 1 February 2016
#
# Obtain phonondb structures  from
# http://phonondb.mtl.kyoto-u.ac.jp
# and plot the pohnon dispersion on the path obtained from the materials project API
#

from phonopy import Phonopy
from phonopy.interface.vasp import read_vasp
from phonopy.interface.phonopy_yaml import *
from pymatgen.matproj.rest import MPRester
from phonopy.structure.atoms import Atoms
import phonopy.file_IO as file_IO
import urllib2
import os
import json
import re
import multiprocessing
from HTMLParser import HTMLParser

band_points = 15

class ParseHTML(HTMLParser):
    materials = []

    def handle_data(self, data):
        if "Materials id" in data and '-' not in data:
            print data
            self.materials.append(re.findall('([0-9]+)\s+\/\s+(.+?)\s+\/\s+(.+)',data)[0])

class Phonondb():
    _url = "http://phonondb.mtl.kyoto-u.ac.jp/database-mp.html"
    _savefile = "phonondb.json"
    def __init__(self):
        if os.path.isfile(self._savefile):
            print("reading from %s"%self._savefile)
            f = open(self._savefile,'r')
            self.materials = json.load(f)
            f.close()
        else:
            print("making http request...")
            self.page = urllib2.urlopen(self._url).read()
            self.get_materials()
            #save materials in a json file
            f = open(self._savefile,'w')
            json.dump(self.materials,f)
            f.close()

    def get_materials(self):
        parser = ParseHTML()
        parser.feed(self.page)
        self.materials = parser.materials

    def __str__(self):
        text = "        id       name   data\n"
        for material in self.materials:
            text += "%10s %10s %6s\n"%tuple(material)
        return text
   

class MaterialsProjectPhonon():
    """ Obtain the bandstrcture from seekpath and calculate it using phonopy
    """
    def __init__(self,material_id):
        self.material_id = material_id
        
        ph_yaml = PhonopyYaml()
        ph_yaml.read('%s/phonon.yaml'%material_id)
        atoms = ph_yaml._unitcell
        supercell_matrix = ph_yaml._data['supercell_matrix']
        phonon = Phonopy(atoms,supercell_matrix)

        self.atoms = atoms
        self.supercell_matrix = supercell_matrix
        self.phonon = phonon

    def get_cell(self):
        return ( self.atoms.get_cell(),
                 self.atoms.get_scaled_positions(),
                 self.atoms.get_atomic_numbers() )
    
    def get_bandstructure(self,reference_distance=0.05):
        import seekpath
        path = seekpath.get_explicit_k_path(self.get_cell(),reference_distance=reference_distance)
        kpath = path['explicit_kpoints_rel']
        bands = []
        for segment in path['segments']:
            start_k, end_k = segment
            bands.append(kpath[start_k:end_k])
        self.bands = bands

    def get_phonons(self):
        """
        Calculate the phonon bandstructures along a path
        """
        phonon = self.phonon
        force_sets = file_IO.parse_FORCE_SETS(filename='%s/FORCE_SETS'%self.material_id)
        phonon.set_displacement_dataset(force_sets)
        phonon.produce_force_constants()
        phonon.symmetrize_force_constants_by_space_group()
        phonon.set_band_structure(self.bands, is_eigenvectors=True, is_band_connection=True)
        phonon.get_band_structure()

    def write_disp_yaml(self,filename='disp.yaml'):
        phonon = self.phonon
        
        displacements = phonon.get_displacements()
        directions = phonon.get_displacement_directions()
        supercell = phonon.get_supercell()
        file_IO.write_disp_yaml(displacements, supercell, directions=directions, filename="%s/%s"%(self.material_id,filename))

    def write_band_yaml(self,filename='band.yaml'):
        # export a json file with the data
        self.phonon.write_yaml_band_structure(filename="%s/%s"%(self.material_id,filename))

if __name__ == "__main__":
    nthreads = 2

    def calculate_bs(material_id):
        """
        go inside the folder and calculate the band-structure
        """
        mpp = MaterialsProjectPhonon(material_id)
        mpp.get_bandstructure()
        mpp.get_phonons()
        mpp.write_disp_yaml()
        mpp.write_band_yaml() 

    def run_job(filename):
        print filename

        #extract file
        os.system('tar fx %s'%filename)

        #calculate band-structure
        material_id = filename.split('.')[0]
        calculate_bs(material_id)


    #list all the materials
    jobs = [ filename for filename in os.listdir('.') if 'lzma' in filename ]
    
    p = multiprocessing.Pool(nthreads)
    p.map(run_job, jobs)



