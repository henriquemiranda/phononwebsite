# Copyright (C) 2017 Henrique Pereira Coutada Miranda, Alejandro Molina Sanchez
# All rights reserved.
#
# This file is part of yambopy
#
#
import os
import re
from math import sqrt
from .lattice import *

class PwIn():
    """
    Class to generate an manipulate Quantum Espresso input files
    Can be initialized either reading from a file or starting from a new file.

    Examples of use:

    To read a local file with name "mos2.in"

        .. code-block :: python
        
            qe = PwIn('mos2.scf')
            print qe

    To start a file from scratch

        .. code-block :: python
        
            qe = PwIn('mos2.scf')
            qe.atoms = [['N',[ 0.0, 0.0,0.0]],
                        ['B',[1./3,2./3,0.0]]]
            qe.atypes = {'B': [10.811, "B.pbe-mt_fhi.UPF"],
                         'N': [14.0067,"N.pbe-mt_fhi.UPF"]}

            qe.control['prefix'] = "'%s'"%prefix
            qe.control['verbosity'] = "'high'"
            qe.control['wf_collect'] = '.true.'
            qe.control['pseudo_dir'] = "'../pseudos/'"
            qe.system['celldm(1)'] = 4.7
            qe.system['celldm(3)'] = layer_separation/qe.system['celldm(1)']
            qe.system['ecutwfc'] = 60
            qe.system['occupations'] = "'fixed'"
            qe.system['nat'] = 2
            qe.system['ntyp'] = 2
            qe.system['ibrav'] = 4
            qe.kpoints = [6, 6, 1]
            qe.electrons['conv_thr'] = 1e-8

            print qe
     
    Special care should be taken with string variables e.g. "'high'"
 
    """    
    _pw = 'pw.x'

    def __init__(self, filename=None):
        #kpoints
        self.ktype = "automatic"
        self.kpoints = [1,1,1]
        self.shiftk = [0,0,0]
        self.klist = []
        #dictionaries
        self.control = dict()
        self.system = dict()
        self.electrons = dict()
        self.ions = dict()
        self.cell = dict()
        self.atypes = dict()
        self.atoms = []
        self.cell_parameters = []
        self.cell_units = 'angstrom'
        self.atomic_pos_type = 'crystal'

        #in case we start from a reference file
        if filename:
            f = open(filename,"r")
            self.file_name = filename #set filename
            self.file_lines = f.readlines() #set file lines
            self.store(self.control,"control")     #read &control
            self.store(self.system,"system")      #read &system
            self.store(self.electrons,"electrons")   #read &electrons
            self.store(self.ions,"ions")        #read &ions
            self.store(self.cell,"cell")        #read &ions
            #read ATOMIC_SPECIES
            self.read_atomicspecies()
            #read ATOMIC_POSITIONS
            self.read_atoms()
            #read K_POINTS
            self.read_kpoints()
            #read CELL_PARAMETERS
            self.read_cell_parameters()

    def read_atomicspecies(self):
        lines = self.file_lines
        #find ATOMIC_SPECIES keyword in file and read next line
        for n,line in enumerate(lines):
            if "ATOMIC_SPECIES" in line:
                for i in range(int(self.system["ntyp"])):
                    n+=1
                    atype, mass, psp = lines[n].split()
                    self.atypes[atype] = [mass,psp]

    def get_symmetry_spglib(self):
        """
        get the symmetry group of this system using spglib
        """
        import spglib

        lat, positions, atypes = self.get_atoms()
        lat = np.array(lat)

        at = np.unique(atypes)
        an = dict(list(zip(at,list(range(len(at))))))
        atypes = [an[a] for a in atypes]

        cell = (lat,positions,atypes)

        spacegroup = spglib.get_spacegroup(cell,symprec=1e-5)
        return spacegroup

    def get_masses(self):
        """ Get an array with the masses of all the atoms
        """
        masses = []
        for atom in self.atoms:
            atype = self.atypes[atom[0]]
            mass = float(atype[0])
            masses.append(mass) 
        return masses

    def set_path(self,path):
        self.klist = path.get_klist()

    def get_atoms(self):
        """ Get the lattice parameters, postions of the atoms and chemical symbols
        """
        self.read_cell_parameters()
        cell = self.cell_parameters
        sym = [atom[0] for atom in self.atoms]
        pos = [atom[1] for atom in self.atoms]
        if self.atomic_pos_type == 'bohr':
            pos = car_red(pos,cell)
        return cell, pos, sym

    def set_atoms_string(self,string):
        """
        set the atomic postions using string of the form
        Si 0.0 0.0 0.0
        Si 0.5 0.5 0.5
        """
        atoms_str = [line.strip().split() for line in string.strip().split('\n')]
        self.atoms = []
        for atype,x,y,z in atoms_str:
            self.atoms.append([atype,list(map(float,[x,y,z]))])

    def set_atoms(self,atoms):
        """ set the atomic postions using a Atoms datastructure from ase
        """
        # we will write down the cell parameters explicitly
        self.system['ibrav'] = 0
        if 'celldm(1)' in self.system: del self.system['celldm(1)']
        self.cell_parameters = atoms.get_cell()
        self.atoms = list(zip(atoms.get_chemical_symbols(),atoms.get_scaled_positions()))
        self.system['nat'] = len(self.atoms)

    def displace(self,mode,displacement,masses=None):
        """ A routine to displace the atoms acoording to a phonon mode
        """
        if masses is None:
            masses = [1] * len(self.atoms)
            small_mass = 1
        else:
            small_mass = min(masses) #we scale all the displacements to the bigger mass
        for i in range(len(self.atoms)):
            self.atoms[i][1] = self.atoms[i][1] + mode[i].real*displacement*sqrt(small_mass)/sqrt(masses[i])

    def read_atoms(self):
        lines = self.file_lines
        #find READ_ATOMS keyword in file and read next lines
        for n,line in enumerate(lines):
            if "ATOMIC_POSITIONS" in line:
                atomic_pos_type = line
                self.atomic_pos_type = re.findall('([A-Za-z]+)',line)[-1]
                for i in range(int(self.system["nat"])):
                    n+=1
                    atype, x,y,z = lines[n].split()
                    self.atoms.append([atype,[float(i) for i in (x,y,z)]])
        self.atomic_pos_type = atomic_pos_type.replace('{','').replace('}','').strip().split()[1]

    def read_cell_parameters(self):
        ibrav = int(self.system['ibrav'])
        if ibrav == 0:
            if 'celldm(1)' in list(self.system.keys()):
                a = float(self.system['celldm(1)'])
            else:
                a = 1
            lines = iter(self.file_lines)
            for line in lines:
                if "CELL_PARAMETERS" in line:
                    self.cell_units = line.translate(None, '{}()').split()[1]
                    self.cell_parameters = [[1,0,0],[0,1,0],[0,0,1]]
                    for i in range(3):
                        self.cell_parameters[i] = [ float(x)*a for x in lines.next().split() ]
            if self.cell_units == 'angstrom' or self.cell_units == 'bohr':
                if 'celldm(1)' in self.system: del self.system['celldm(1)']
        elif ibrav == 4:
            a = float(self.system['celldm(1)'])
            c = float(self.system['celldm(3)'])
            self.cell_parameters = [[   a,          0,  0],
                                    [-a/2,sqrt(3)/2*a,  0],
                                    [   0,          0,c*a]]
        elif ibrav == 2:
            a = float(self.system['celldm(1)'])
            self.cell_parameters = [[ -a/2,   0, a/2],
                                    [    0, a/2, a/2],
                                    [ -a/2, a/2,   0]]
        elif ibrav == 6:
            a = float(self.system['celldm(1)'])
            c = float(self.system['celldm(3)'])
            self.cell_parameters = [[  a,   0,   0],
                                    [  0,   a,   0],
                                    [  0,   0, c*a]]
        else:
            print('ibrav = %d not implemented'%ibrav)
            exit(1)
        
    def read_kpoints(self):
        lines = self.file_lines
        #find K_POINTS keyword in file and read next line
        for n,line in enumerate(lines):
            if "K_POINTS" in line:
                #chack if the type is automatic
                if "automatic" in line:
                    n+=1
                    self.ktype = "automatic"
                    vals = list(map(float, lines[n].split()))
                    self.kpoints, self.shiftk = vals[0:3], vals[3:6]
                #otherwise read a list
                else:
                    #read number of kpoints
                    nkpoints = int(lines.next().split()[0])
                    self.klist = []
                    self.ktype = ""
                    try:
                        lines_list = list(lines)
                        for n in range(nkpoints):
                            vals = lines_list[n].split()[:4]
                            self.klist.append( list(map(float,vals)) )
                    except IndexError:
                        print("wrong k-points list format")
                        exit()

    def slicefile(self, keyword):
        lines = re.findall('&%s(?:.?)+\n((?:.+\n)+?)(?:\s+)?\/'%keyword,"".join(self.file_lines),re.MULTILINE)
        return lines
    
    def store(self,group,name):
        """
        Save the variables specified in each of the groups on the structure
        """
        for file_slice in self.slicefile(name):
            for keyword, value in re.findall('([a-zA-Z_0-9_\(\)]+)(?:\s+)?=(?:\s+)?([a-zA-Z/\'"0-9_.-]+)',file_slice):
                group[keyword.strip()]=value.strip()

    def stringify_group(self, keyword, group):
        if group != {}:
            string='&%s\n' % keyword 
            for keyword in group:
                string += "%20s = %s\n" % (keyword, group[keyword])
            string += "/&end\n"
            return string
        else:
            return ''

    def remove_key(self,group,key):
        """ if a certain key exists in the group, remove it
        """
        if key in list(group.items()):
            del group[key]

    def run(self,filename,procs=1,folder='.'):
        """ this function is used to run this job locally
        """
        os.system('mkdir -p %s'%folder)
        self.write("%s/%s"%(folder,filename))
        if procs == 1:
            os.system('cd %s; OMP_NUM_THREADS=1 %s -inp %s > %s.log' % (folder,self._pw,filename,filename))
        else:
            os.system('cd %s; OMP_NUM_THREADS=1 mpirun -np %d %s -inp %s > %s.log' % (folder,procs,self._pw,filename,filename))

    def write(self,filename):
        f = open(filename,'w')
        f.write(str(self))
        f.close()

    def __str__(self):
        """
        Output the file in the form of a string
        """
        string = ''
        string += self.stringify_group("control",self.control) #print control
        string += self.stringify_group("system",self.system) #print system
        string += self.stringify_group("electrons",self.electrons) #print electrons
        string += self.stringify_group("ions",self.ions) #print ions
        string += self.stringify_group("cell",self.cell) #print ions

        #print atomic species
        string += "ATOMIC_SPECIES\n"
        for atype in self.atypes:
            string += " %3s %8s %20s\n" % (atype, self.atypes[atype][0], self.atypes[atype][1])
        #print atomic positions
        string += "ATOMIC_POSITIONS { %s }\n"%self.atomic_pos_type
        for atom in self.atoms:
            string += "%3s %14.10lf %14.10lf %14.10lf\n" % (atom[0], atom[1][0], atom[1][1], atom[1][2])
        #print kpoints
        if self.ktype == "automatic":
            string += "K_POINTS { %s }\n" % self.ktype
            string += ("%3d"*6+"\n")%tuple(self.kpoints + self.shiftk)
        elif self.ktype == "crystal":
            string += "K_POINTS { %s }\n" % self.ktype
            string += "%d\n" % len(self.klist)
            for i in self.klist:
              string += ('%12.8lf '*4+'\n') % tuple(i)
        else:
            string += "K_POINTS { }\n"
            string += "%d\n" % len(self.klist)
            for i in self.klist:
                string += (("%12.8lf "*4)+"\n")%tuple(i)
        if self.system['ibrav'] == 0 or self.system['ibrav'] == '0':
            string += "CELL_PARAMETERS %s\n"%self.cell_units
            for i in range(3):
                string += ("%14.10lf "*3+"\n")%tuple(self.cell_parameters[i])
        return string
