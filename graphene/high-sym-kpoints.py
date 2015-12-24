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

# Hexagonal
G =  [    0,    0, 0 ]
M =  [  0.5,    0, 0 ]
K =  [ 1./3, 1./3, 0 ]

kw = [G,M,K,G]
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
