import json
import numpy as np

f = open('absorptionspectra_old.json')
data = json.load(f)
f.close()

nx = data['nx']
ny = data['ny']
nz = data['nz']

lattice = data['lattice']
tol = 1e-5
#change range
eel = []
for line in data['eps']:
    if 0.8 < line[0] < 2.5:
        eel.append(line)
data['eps'] = eel

for n,atom in enumerate(data['atoms']):
    data['atoms'][n][3] = atom[3]+lattice[2][2]/2

for exciton in data['excitons']:
    datagrid = np.array(exciton['datagrid']).reshape([nz,ny,nx])
    new_datagrid = datagrid.copy()
    new_datagrid[:nz/2,:,:] = datagrid[nz/2:,:,:]
    new_datagrid[nz/2:,:,:] = datagrid[:nz/2,:,:]
    new_datagrid[abs(new_datagrid.real) < tol] = 0.0
    exciton["datagrid"] = new_datagrid.flatten().tolist()

f = open('absorptionspectra.json','w')
json.dump(data,f)
f.close()
