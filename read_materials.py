# Copyright (c) 2016, Henrique Miranda
# All rights reserved.
#
# Redistribution and use in source and binary forms, with or without
# modification, are permitted provided that the following conditions are met:
#     * Redistributions of source code must retain the above copyright
#       notice, this list of conditions and the following disclaimer.
#     * Redistributions in binary form must reproduce the above copyright
#       notice, this list of conditions and the following disclaimer in the
#       documentation and/or other materials provided with the distribution.
#     * Neither the name of the phononwebsite project nor the
#       names of its contributors may be used to endorse or promote products
#       derived from this software without specific prior written permission.
#
# THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
# ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
# WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
# DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER BE LIABLE FOR ANY
# DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
# (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
# LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
# ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
# (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
# SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
from phononweb import *

ana = 'anaddb.out_PHBST.nc'
material_list = { 
"graphene":           [ AnaddbPhonon,     ana, [ 5, 5, 1], "Graphene"],
"mos2_bulk":		  [ AnaddbPhonon,     ana, [ 5, 5, 1], "Bulk MoS<sub>2</sub>"],
"mos2_singlelayer":	  [ AnaddbPhonon,     ana, [ 5, 5, 1], "Layer MoS<sub>2</sub>"],
"mote2_singlelayer":  [ QePhonon,     'mote2', [ 5, 5, 1], "Layer MoTe<sub>2</sub>"],
"mote2_bulk":         [ QePhonon,     'mote2', [ 5, 5, 1], "Bulk MoTe<sub>2</sub>"]}
        
#create the models file
models = {"nmodels": len(material_list),
          "models": []}

#create the data.json files
for folder in material_list.keys():
    reader, filename, reps, name = material_list[folder]
    print "#"*50+"\n",name+"\n","#"*50
    m = reader(filename,name,reps=reps,folder=folder)
    m.write_json(prefix='data', folder=folder)
    print m, "\n"
        
    models["models"].append({"folder":folder,"name":name})

f = open("models.json","w")
f.write(json.dumps(models))
f.close()
