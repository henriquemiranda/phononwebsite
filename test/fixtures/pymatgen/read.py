import json
import numpy as np

with open('mp-149_pmg_bs.json') as f:
    pmg = json.load(f)
    
    print('all keys:')
    print(pmg.keys())

    #get structure
    structure = pmg['structure']
    lattice = structure['lattice']
    sites   = structure['sites']

    print("\nlattice:")
    alpha = lattice['alpha']
    beta  = lattice['beta']
    gamma = lattice['gamma']

    lat = lattice['matrix']
    for vec in lat:
        print(vec)
    
    print("\natoms:")
    for site in sites:
        label = site['label'] 
        cartesian = site['xyz']
        reduced = site['abc']
        print(label, reduced)

    print("\nbands:")
    qpoints = np.array(pmg['qpoints'])
    print("qpoints:",qpoints.shape)
    eig = pmg['bands']
    eiv = pmg['eigendisplacements']
    print('eig:',np.array(eig).shape)
    eiv_real = np.array(eiv['real'])
    eiv_imag = np.array(eiv['imag'])
    eiv = eiv_real + eiv_imag*1j
    print('eiv:',eiv.shape)
    labels_dict = pmg['labels_dict']
    print("\nlabels:")
    for label,qpoint in labels_dict.items():
        print(label,qpoint)
