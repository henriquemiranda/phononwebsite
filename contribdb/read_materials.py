# Copyright (c) 2018, Henrique Miranda
# All rights reserved.
#
# This file is part of the phononwebsite project
#
from __future__ import print_function
from phononweb import *
import json

root = "contribdb"
hexagonal = [(0,'\Gamma'),(20,'M'),(30,'K'),(50,'\Gamma')]
material_list = {
"tise2_bulk":		  [ QePhonon,     'tise2', hexagonal, [ 5, 5, 1], "Bulk TiSe2"],
"hbn_bulk":           [ QePhonon,     'hbn',   hexagonal, [ 5, 5, 1], "Bulk hBN"]}
        
#create the models file
models = []
separator = "#"*50+"\n"

#create the data.json files
for folder in list(material_list.keys()):
    reader, filename, highsym_qpts, reps, name = material_list[folder]
    print(separator+"%s\n"%name+separator)
    m = reader(filename,name,reps=reps,folder=folder,highsym_qpts=highsym_qpts)
    m.write_json(prefix='data', folder=folder)
    print(m, "\n")
        
    models.append({"folder":os.path.join(root,folder),"name":name})

with open("models.json","w") as f:
    json.dump(models,f,indent=4)
