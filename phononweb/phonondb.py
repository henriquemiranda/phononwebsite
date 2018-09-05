# Copyright (C) 2018 Henrique Pereira Coutada Miranda
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

class PhononDB():
    """
    Load a list of materials from the phonondb database
    http://phonondb.mtl.kyoto-u.ac.jp/database-mp.html
    """
    _urls = {"2018":"http://phonondb.mtl.kyoto-u.ac.jp/ph20180417/index.html",
             "2015":"http://phonondb.mtl.kyoto-u.ac.jp/ph20151124/index.html"}

    def __init__(self,url="http://phonondb.mtl.kyoto-u.ac.jp/ph20151124/index.html"):

        #try to read the url from dictionary
        if url in self._urls:
            self.url = self._urls[url]
        else:
            self.url = url

    def run(self):
        """read the materials and save them in file"""
        if os.path.isfile(savefile):
            print("reading materials from %s"%savefile)
            self.load_materials()
        else:
            print("reading materials from the phonondb website...")
            self.get_materials()
            self.save_materials()

    def load_materials(self,savefile="phonondb.json"):
        """load materials from file"""
        with open(savefile,'r') as f:
            self.materials = json.load(f)

    def save_materials(self,savefile="phonondb.json"):
        """save materials in a json file"""
        with open(savefile,'w') as f:
            json.dump(self.materials,f)
        
    def get_materials(self):
        """get list of materials from the website"""
        try:
            from html.parser import HTMLParser
            from urllib.request import urlopen 
        except ImportError:
            from HTMLParser import HTMLParser
            from urllib2 import urlopen

        class ParseHTML(HTMLParser):
            """ read a list of materials from the PhononDB database
            """
            materials = []

            def handle_data(self, data):
                if "Materials id" in data:
                    tfind = re.findall('([0-9]+)\s+\/\s+(.+?)\s+\/\s+(.+)',data)
                    if len(tfind):
                        self.materials.append(tfind[0])

        self.page = urlopen(self.url).read()
        parser = ParseHTML()
        parser.feed(str(self.page))
        self.materials = parser.materials

    def __str__(self):
        lines=[]; app = lines.append
        app("        id       name   data")
        for material in self.materials:
            app("%10s %10s %6s"%tuple(material))
        app("total materials: %d"%len(self.materials))
        return "\n".join(lines)


if __name__ == "__main__":
    phonondb2015 = PhononDB(url="2015")
    phonondb2015.get_materials()
    phonondb2015.save_materials('phonondb2015.json')
    print(phonondb2015)

    phonondb2018 = PhononDB(url="2018")
    phonondb2018.get_materials()
    phonondb2018.save_materials('phonondb2018.json')
    print(phonondb2018)
