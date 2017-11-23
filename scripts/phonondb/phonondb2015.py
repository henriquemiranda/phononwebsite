"""
Obtain phonondb structures  from
http://phonondb.mtl.kyoto-u.ac.jp
and plot the pohnon dispersion on the path obtained from the materials project API
"""

import urllib2
import os
import json
import re
from HTMLParser import HTMLParser

from phonopy import Phonopy
from phonopy.interface.phonopy_yaml import *
from pymatgen.matproj.rest import MPRester
import phonopy.file_IO as file_IO

band_points = 5

class ParseHTML(HTMLParser):
    """ read a list of materials from the PhononDB database
    """
    materials = []

    def handle_data(self, data):
        if "Materials id" in data and '-' not in data:
            self.materials.append(re.findall('([0-9]+)\s+\/\s+(.+?)\s+\/\s+(.+)',data)[0])

class PhononDB2015():
    """
    Load a list of materials from the phonondb 2015 database
    http://phonondb.mtl.kyoto-u.ac.jp/database-mp.html
    """
    _url = "http://phonondb.mtl.kyoto-u.ac.jp/database-mp.html"
    _savefile = "phonondb.json"
    def __init__(self):
        if os.path.isfile(self._savefile):
            print("reading from %s"%self._savefile)
            self.load_files():
        else:
            print("making http request...")
            self.page = urllib2.urlopen(self._url).read()
            self.get_materials()
            self.save_materials()

    def load_materials(self):
        """load materials"""
        with open(self._savefile,'r') as f:
            self.materials = json.load(f)

    def save_materials(self):
        """save materials in a json file"""
        with open(self._savefile,'w') as f:
            json.dump(self.materials,f)
        
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
    """ 
    Obtain the bandstrcture from the materials project
    """
    def __init__(self,material_id):
        mpid = self.get_mp_id()
        self.mprester = MPRester(mpid)
        self.material_id = material_id

    def get_mp_id(self):
        """
        Get the materials project id
        """
        home = os.path.expanduser("~")
        path = "%s/.materialsproject/key"%home
        with open(path,'r') as f:
            return f.read().strip()
        return

    def get_bandstructure(self):
        a = self.mprester

        #get bandstruccture
        bs=a.get_bandstructure_by_material_id(material_id)

        #get high symmetry k-points
        kpoints = bs.kpoints
        print("nkpoints:", len(kpoints))
        branches = bs.as_dict()['branches']

        self.bands = []
        high_sym_kpoints = [kpoints[0]]
        for path in branches:
            start = path['start_index'] 
            end   = path['end_index']
            start_kpoint = kpoints[start].frac_coords
            end_kpoint   = kpoints[end].frac_coords
            step_kpoint  = end_kpoint-start_kpoint
            labels = path['name'].split('-')
            high_sym_kpoints.append(kpoints[end].frac_coords)

            print("%4d %4d %4d"%(start,end,end-start), labels)
          
            branch = []
            for i in range(band_points+1):
                branch.append[ start_kpoint + float(i)/band_points*step_kpoint ]
            self.bands.append(branch)

    def get_phonons(self,folder):
        """calculate the phonon dispersion along the path"""
        ph_yaml = PhonopyYaml('%s/phonon.yaml'%folder)
        atoms = ph_yaml.get_atoms()
        supercell_matrix = ph_yaml._data['supercell_matrix']

        self.phonon = Phonopy(atoms,supercell_matrix)
        phonon = self.phonon
        force_sets = file_IO.parse_FORCE_SETS(filename='%s/FORCE_SETS'%folder)
        phonon.set_displacement_dataset(force_sets)
        phonon.produce_force_constants()
        phonon.symmetrize_force_constants_by_space_group()
        phonon.set_band_structure(self.bands, is_eigenvectors=True, is_band_connection=True)
        phonon.get_band_structure()

    def write_disp_yaml(self,filename='disp.yaml'):
        """write disp yaml file"""
        phonon = self.phonon
        
        displacements = phonon.get_displacements()
        directions = phonon.get_displacement_directions()
        supercell = phonon.get_supercell()
        file_IO.write_disp_yaml(displacements, supercell, directions=directions, filename=filename)

    def write_band_yaml(self):
        """export a yaml file with the band-structure data"""
        self.phonon.write_yaml_band_structure()

if __name__ == "__main__":
    # from here we can get all the ids of the materials in the phonondb page
    #p = Phonondb()
    #print p

    #here is an example of how to plo the data for one of the materials
    material_id = "mp-10096"
    mpp = MaterialsProjectPhonon(material_id)
    mpp.get_bandstructure()
    mpp.get_phonons()
    mpp.write_disp_yaml()
    mpp.write_band_yaml()
