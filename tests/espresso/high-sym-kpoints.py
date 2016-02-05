"""
Date: 2013/2014
Authors: Henrique Miranda
Description:
This script is used to generate a path in reciprocal space by specifiying the High-symmetry K-points by character.
Version: 3.4.0
Example of use:
python high-sym-kpoints.py GMKG > klist.dat

TODO:

"""
from __future__ import division
from numpy import array
from sys import argv

points = dict()

npoints =40

# Hexagonal
points["G"] =  [    0,     0, 0  ]
points["M"] =  [  0.5,     0, 0  ]
points["K"] =  [ 2./3, -1./3, 0  ]
points["A"] =  [     0,      0, 0.5 ]
points["L"] =  [   0.5,   -0.5, 0.5 ]
points["H"] =  [ 2./3., -1./3., 0.5 ]
"""

# Monoclinic
points["A"] = [ 0.5, 0.0, 0.0]
points["M"] = [ 0.5,-0.0,-0.5]
points["Z"] = [ 0.0, 0.0,-0.5]
points["G"] = [ 0.0, 0.0, 0.0]
points["V"] = [ 0.0, 0.5, 0.0]


# Diamond
points["W"] =  [ 1/4, 3/4, 1/2 ]
points["G"] =  [   0,   0,   0 ]
points["X"] =  [   0, 1/2, 1/2 ]
points["W"] =  [ 1/4, 1/2, 3/4 ]
points["L"] =  [   0,   0, 1/2 ]
points["G"] =  [   0,   0,   0 ]

#sc
points["M"] = [ 1/2, 1/2, 0   ]
points["R"] = [ 1/2, 1/2, 1/2 ]
points["X"] = [   0, 1/2, 0   ]
bcc
points["P"] = [ 1/4,  1/4, 1/4 ]
points["H"] = [ 1/2, -1/2, 1/2 ]
points["N"] = [   0,    0, 1/2 ]
#fcc
points["U"] = [ 5/8, 1/4, 5/8 ]
points["K"] = [ 3/8, 3/8, 3/4 ]
points["W"] = [ 1/2, 1/4, 3/4 ]
points["L"] = [ 1/2, 1/2, 1/2 ]
points["X"] = [ 1/2,   0, 1/2 ]
"""

kw = []
for point in 'GMKG':
    try:
        p = points[point]
        kw.append(p)
    except KeyError:
        print "Ignoring ", p
        continue

kw = array(kw)
gri = [20,10,20]

#generate reduced coordinates
k_red = []
for i in xrange(len(gri)):
    for j in xrange(gri[i]):
        k_red.append(kw[i] + float(j)/gri[i]*(kw[i+1]-kw[i]))
k_red.append(kw[-1])

#print output
for vec in k_red:
    print "%12.6lf %12.6lf %12.6lf 1.0" % tuple(vec)
