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
from HTMLParser import HTMLParser

band_points = 5

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
        print "nkpoints:", len(kpoints)
        branches = bs.as_dict()['branches']

        self.bands = []
        high_sym_kpoints = [kpoints[0]]
        for path in branches:
            start = path['start_index'] 
            end   = path['end_index']
            start_kpoint = kpoints[start].frac_coords
            end_kpoint   = kpoints[end].frac_coords
            step_kpoint   = end_kpoint-start_kpoint
            labels = path['name'].split('-')
            print "%4d %4d %4d"%(start,end,end-start), labels
            high_sym_kpoints.append(kpoints[end].frac_coords)
             
            self.bands.append([start_kpoint+float(i)/band_points*step_kpoint for i in range(band_points+1)])

    def get_phonons(self):
        # calculate the phonon dispersion
        folder = material_id
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
        phonon = self.phonon
        
        displacements = phonon.get_displacements()
        directions = phonon.get_displacement_directions()
        supercell = phonon.get_supercell()
        file_IO.write_disp_yaml(displacements, supercell, directions=directions, filename=filename)

    def write_band_yaml(self):
        # export a json file with the data
        self.phonon.write_yaml_band_structure()# get structures from the phonondb page

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
