# -*- coding: utf-8 -*-
from material import *
from itertools import product
from math import sin, cos, sqrt, radians, pi
from cmath import exp
from numpy import array
from numpy.linalg import solve
import numpy as np

material_list = { 
"graphene":           [noswap, [ 5, 5, 1],  0.01, "Graphene"],
"mos2_bulk":		  [noswap, [ 5, 5, 1],  0.01, "Bulk MoS<sub>2</sub>"],
"mos2_singlelayer":	  [noswap, [ 5, 5, 1],  0.01, "Layer MoS<sub>2</sub>"],
"mote2_singlelayer":  [noswap, [ 5, 5, 1],  0.01, "Layer MoTe<sub>2</sub>"],
"mote2_bulk":         [noswap, [ 5, 5, 1],  0.01, "Bulk MoTe<sub>2</sub>"]}
#"mote2_doublelayer":  [noswap, [ 5, 5, 1],  2, "Double Layer MoTe<sub>2</sub>"],
#"carbon_linearchain": [noswap, [ 1, 1, 10], 2, "C Linear Chain"], 
        
#create the models file
models = {"nmodels": len(material_list),
          "models": []}

#create the data.json files
for folder in material_list.keys():
    swap, reps, scale, name = material_list[folder]
    print "#"*50+"\n",name+"\n","#"*50
    m = material(folder+'/anaddb.out_PHBST.nc',name,reps=reps,swap=swap,scale=scale)
    m.write_json(folder+'/data.json')
    print m, "\n"
        
    models["models"].append({"folder":folder,"name":name})

f = open("models.json","w")
f.write(json.dumps(models))
f.close()
