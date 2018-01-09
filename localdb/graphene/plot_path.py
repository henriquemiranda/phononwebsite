import json
import numpy as np
import matplotlib.pyplot as plt

f = open('data.json')
data = json.load(f)
f.close()

qpoints = np.array(data['qpoints'])

plt.plot(qpoints[:,0],qpoints[:,1])
plt.show()
