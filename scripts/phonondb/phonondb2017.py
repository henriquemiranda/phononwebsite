# Copyright (c) 2017, Henrique Miranda
# All rights reserved.
#
# This file is part of the phononwebsite project
#
"""
Extract the files from phonondb2017
http://phonondb.mtl.kyoto-u.ac.jp/ph20170621/index.html
and calculate the path using seekpath 
"""

import os
import multiprocessing
from phononweb.phonopyphonon import PhonopyPhonon

def calculate_bs(material_id):
    """
    go inside the folder and calculate the band-structure
    """
    folder = material_id
    phonon_yaml_filename = os.path.join(folder,'phonon.yaml') 
    force_sets_filename = os.path.join(folder,'FORCE_SETS')
    nac_filename = os.path.join(folder,'BORN')

    #check if BORN exists
    if not os.path.isfile(nac_filename): nac_filename = None

    #create phonopy object
    mpp = PhonopyPhonon.from_files(phonon_yaml_filename,force_sets_filename,nac_filename=nac_filename)
    mpp.set_bandstructure_seekpath()
    mpp.get_bandstructure()

    #write yaml file
    yaml_filename = os.path.join(folder,'%s.yaml'%material_id)
    mpp.write_band_yaml(filename=yaml_filename) 

def run_job(filename):
    print(filename)

    #extract file
    os.system('tar fx %s'%filename)

    #calculate band-structure
    material_id = filename.split('.')[0]
    calculate_bs(material_id)

if __name__ == "__main__":
    nthreads = 2

    #list all the materials
    jobs = [ filename for filename in os.listdir('.') if 'lzma' in filename ]
    
    #paralel
    #p = multiprocessing.Pool(nthreads)
    #p.map(run_job, jobs)

    #serial
    list(map(run_job,jobs))
