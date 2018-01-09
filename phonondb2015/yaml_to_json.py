import yaml
import json

#read yaml file
with open("phonondb.yaml", 'r') as stream:
    data = yaml.load(stream)

print("number of materials:",len(data))

#write json file
with open("phonondb.json", 'w') as stream:
    json.dump(data,stream,indent=4)

