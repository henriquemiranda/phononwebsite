import yaml
import json

#read yaml file
with open("phonondb.yaml", 'r') as stream:
    data = yaml.load(stream)

print("number of materials:",len(data))

#load phonondb2018.json produced from phonondb class (reading the names from the website)
with open("phonondb2018.json") as stream:
    phonondb_names = json.load(stream)

mpid_name = {}
for item in phonondb_names:
    mpid, name, spgroup = item
    mpid_name[int(mpid)] = name

#load number of atoms dictionary
with open("natoms.json") as stream:
    mpid_natoms = json.load(stream)

#complete links
json_data = []
for mpid in data:
    if str(mpid) not in mpid_natoms: continue
    natoms = mpid_natoms[str(mpid)]
    if natoms > 50: 
        print("skipping mpid: %d natoms: %d"%(mpid,natoms))
        continue
    mat_data = {'id': mpid,
                'name': mpid_name[mpid],
                'url': "http://phonondb.mtl.kyoto-u.ac.jp/ph20180417/v/band-%d.yaml"%mpid }
    json_data.append(mat_data)

print("total materials: %d"%len(json_data))
#write json file
with open("phonondb.json", 'w') as stream:
    json.dump(json_data,stream,indent=4)

