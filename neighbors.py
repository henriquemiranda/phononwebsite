from ase.calculators.neighborlist import NeighborList
import numpy as np
symprec = 1e-5

class Neighbors():
    """ Class to obtain the neighbours from ase and manipulate them """
    def __init__(self,atoms):
        self.natoms = len(atoms)
        self.nl = NeighborList([10.0]*self.natoms, self_interaction=False, bothways=True)
        self.nl.update(atoms)
        self.atoms = atoms
        self.pos_red = np.array(atoms.get_scaled_positions())
        self.pos_car = np.array(atoms.get_positions())
        self.displacements = self.nl.displacements
        self.neighbors     = self.nl.neighbors
        self.calculate_positions()

    def calculate_positions(self):
        self.positions = []
        self.distances = []
        atoms = self.atoms
        for a in xrange(self.natoms):
            self.positions.append([])
            neighbors, displacements = self.neighbors[a], self.displacements[a]
            for n, d in zip(neighbors, displacements):
                pos = atoms.positions[n] + np.dot(d, atoms.get_cell()) - atoms.positions[a]
                self.positions[-1].append(pos)
            self.distances.append( [np.linalg.norm(p) for p in self.positions[-1]] )     

    def order(self): 
        """ Order the atoms according to the distance to the origin
        """
        self.nneighbors = []
        self.nneighbors_dict = []
        for a in xrange(self.natoms):
            self.distances[a],self.positions[a],self.neighbors[a],self.displacements[a] =\
                zip(*sorted(zip(self.distances[a],self.positions[a],self.neighbors[a],self.displacements[a]),key=lambda x: x[0]))
            #attribute the corresponding neighbour index to each shell
            d_now = 0
            n = 0
            self.nneighbors.append([])
            for d in self.distances[a]:
                if not np.isclose(d,d_now,rtol=1e-5):
                    n += 1
                self.nneighbors[-1].append(n)
                d_now = d
            self.nneighbors_dict.append(dict(zip(self.nneighbors[-1],range(len(self.nneighbors[-1])))))

    def get_id_nneighbor(self,atom,n):
        """ Function to get a index and displacement of a nth nearest neighbour
        """
        index = self.nneighbors_dict[atom][n]
        return self.displacements[atom][index], self.neighbors[atom][index]

    def get_id_nneighbors(self,atom,n):
        """ Function to get a index and displacement of a nth nearest neighbour
        """
        start_index = self.nneighbors_dict[atom][n]
        end_index = self.nneighbors_dict[atom][n+1]
        return self.displacements[atom][start_index:end_index],\
               self.neighbors[atom][start_index:end_index]

    def get_nneighbors(self,atom,n):
        """ get the list of nth neighbors in reduced coordinates
            atom -> atom in the unit cell
            n    -> number of the neghbor
        """
        neighbors = []
        for neighbor in [x for x,i in enumerate(self.nneighbors[atom]) if i == n]:
            neighbors.append( self.displacements[atom][neighbor] + self.pos_red[self.neighbors[atom][neighbor]] )
        return neighbors


    def get_nneighbors_sym(self,atom,n,sym_rotations): 
        """ use a list of symmetry operations to generate the other neighbours
            atom -> atom in the unit cell
            n    -> number of the neghbor
            rotation -> list of rotation matrices

            we also return the rotation matrices that generated each neighbor
        """
        neighbors = []
        rotations = []
        #get the postions of all the neighbors
        neighbors_pos = self.get_nneighbors(atom,n) 
        do_loop = True
        while do_loop:
            ref_pos = neighbors_pos[0]
            for r in sym_rotations:
                pos = np.dot(r,ref_pos)
                #check if the transformed neighbor corresponds to another neighbor
                for i,n_pos in enumerate(neighbors_pos):
                    if np.allclose(pos,n_pos,atol=symprec):
                        del neighbors_pos[i]
                        break 
                neighbors.append( pos )
                rotations.append( r )
                #check if all the neghbors where found
                if len(neighbors_pos) < 1:
                    do_loop=False
                    break
        return np.array(neighbors), np.array(rotations)

    def __str__(self):
        s = ""
        for a in xrange(self.natoms):
            s += "natom: %d\n"%a
            for d, pos in zip(self.distances[a],self.positions[a]):
                s += "%8.4lf"%d+("%8.4lf "*3)%tuple(pos)+"\n"
        return s
