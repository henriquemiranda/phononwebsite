# Copyright (C) 2017 Henrique Pereira Coutada Miranda
# All rights reserved.
#
# This file is part of phononwebsite
#
"""
Obtain phonondb structures from
http://phonondb.mtl.kyoto-u.ac.jp
and plot the phonon dispersion on the path obtained from:
 . the materials project API (Curtarolo)
 . seekpath (Pizzi)
"""

import os
import json
import re

from phonopy import Phonopy
from phonopy.interface.phonopy_yaml import *
import phonopy.file_IO as file_IO

class PhononDB2015():
    """
    Load a list of materials from the phonondb 2015 database
    http://phonondb.mtl.kyoto-u.ac.jp/database-mp.html
    """
    _url = "http://phonondb.mtl.kyoto-u.ac.jp/ph20151124/index.html"
    def __init__(self,savefile="phonondb.json"):
        try:
            from urllib.request import urlopen 
        except ImportError:
            from urllib2 import urlopen

        if os.path.isfile(savefile):
            print("reading materials from %s"%savefile)
            self.load_materials()
        else:
            print("reading materials from the phonondb website...")
            self.page = urlopen(self._url).read()
            self.get_materials()
            self.save_materials()

    def load_materials(self,savefile="phonondb.json"):
        """load materials"""
        with open(savefile,'r') as f:
            self.materials = json.load(f)

    def save_materials(self,savefile="phonondb.json"):
        """save materials in a json file"""
        with open(savefile,'w') as f:
            json.dump(self.materials,f)
        
    def get_materials(self):
        """get list of materials """
        try:
            from html.parser import HTMLParser
        except ImportError:
            from HTMLParser import HTMLParser

        class ParseHTML(HTMLParser):
            """ read a list of materials from the PhononDB database
            """
            materials = []

            def handle_data(self, data):
                if "Materials id" in data and '-' not in data:
                    self.materials.append(re.findall('([0-9]+)\s+\/\s+(.+?)\s+\/\s+(.+)',data)[0])

        parser = ParseHTML()
        parser.feed(str(self.page))
        self.materials = parser.materials

    def __str__(self):
        text = "        id       name   data\n"
        for material in self.materials:
            text += "%10s %10s %6s\n"%tuple(material)
        return text
