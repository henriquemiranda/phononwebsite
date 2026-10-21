import yaml
import numpy as np
import matplotlib.pyplot as plt

f = open('band.yaml')
data = yaml.load(f)
f.close()

nqpoints = len(data['phonon'])
qpoints = []
for i in xrange(nqpoints):
    qpoint = data['phonon'][i]['q-position']
    print ("%12.8lf "*3)%tuple(qpoint)
    qpoints.append(qpoint)

qpoints = np.array(qpoints)
plt.plot(qpoints[:,0],qpoints[:,1])
plt.show()

exit()
qpoints = np.array(data['qpoints'])

plt.plot(qpoints[:,0],qpoints[:,1])
plt.show()
