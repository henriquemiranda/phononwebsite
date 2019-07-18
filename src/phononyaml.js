import * as atomic_data from './atomic_data.js';
import * as utils from './utils.js';
import * as mat from './mat.js';

var thz2ev = 33.35641;

export class PhononYaml {

    getFromURL(url,callback) {
        /*
        load a file from url
        */

        function onLoadEndHandler(text) {
            this.getFromString(text,callback);
        };

        $.get(url,onLoadEndHandler.bind(this));

    }

    static getYaml(tags,object,noerror=false) {
        /*
        check if the tags are present and if so return their value 
        */

        let ntags = tags.length;
        for (let i = 0; i < ntags; i++) {
            let tag = tags[i];
            if (tag in object) {
                return object[tag];
            }
        }
        if (noerror) {return}
        alert(tags + " not found in the file."+
              "Please generate the file again with the lastest version of phonopy.");
        throw new Error(tags + " not found in the file.");
    }

    getFromFile(file,callback) {
        /*
        file is a javascript file object with the "band.yaml" file
        */

        let yaml_reader = new FileReader();

        function onLoadEndHandler() {
            this.getFromString(yaml_reader.result,callback);
        }
 
        //read the files
        yaml_reader.onloadend = onLoadEndHandler.bind(this);
        yaml_reader.readAsText(file);

    }

    getFromString(string,callback) {
        /*
        yaml is the content of "band.yaml" file as a string
        */

        let phononyaml = jsyaml.load(string);
        this.getFromYaml(phononyaml);
        callback();
    }

    static getUnits(interface_mode) {

        let kb_J = 1.3806504e-23  // [J/K]
        let PlanckConstant = 4.13566733e-15 // [eV s]
        let Hbar = PlanckConstant/(2*mat.pi) // [eV s]
        let Avogadro = 6.02214179e23
        let SpeedOfLight = 299792458  // [m/s]
        let AMU = 1.6605402e-27  // [kg]
        let Newton = 1.0         // [kg m / s^2]
        let Joule = 1.0          // [kg m^2 / s^2]
        let EV = 1.60217733e-19  // [J]
        let Angstrom = 1.0e-10   // [m]
        let THz = 1.0e12         // [/s]
        let Mu0 = 4.0e-7 * mat.pi    // [Hartree/m]
        let Epsilon0 = 1.0 / Mu0 / SpeedOfLight**2  // [C^2 / N m^2]
        let Me = 9.10938215e-31

        let Bohr = 4e10 * mat.pi * Epsilon0 * Hbar**2 / Me   // Bohr radius [A] 0.5291772
        let Hartree = Me * EV / 16 / mat.pi**2 / Epsilon0**2 / Hbar**2  // Hartree [eV] 27.211398
        let Rydberg = Hartree / 2  // Rydberg [eV] 13.6056991

        let units = {}
        if (interface_mode == 'abinit') {
            units['nac_factor'] = Hartree / Bohr
            units['distance_to_A'] = Bohr
            units['force_constants_unit'] = 'eV/Angstrom.au'
            units['length_unit'] = 'au'
        }
        else if (interface_mode == 'qe' || interface_mode == 'pwscf') {
            units['nac_factor'] = 2.0
            units['distance_to_A'] = Bohr
            units['force_constants_unit'] = 'Ry/au^2'
            units['length_unit'] = 'au'
        }
        else if (interface_mode == 'wien2k') {
            units['nac_factor'] = 2000.0
            units['distance_to_A'] = Bohr
            units['force_constants_unit'] = 'mRy/au^2'
            units['length_unit'] = 'au'
        }
        else if (interface_mode == 'elk') {
            units['nac_factor'] = 1.0
            units['distance_to_A'] = Bohr
            units['force_constants_unit'] = 'hartree/au^2'
            units['length_unit'] = 'au'
        }
        else if (interface_mode == 'siesta') {
            units['nac_factor'] = Hartree / Bohr
            units['distance_to_A'] = Bohr
            units['force_constants_unit'] = 'eV/Angstrom.au'
            units['length_unit'] = 'au'
        }
        else if (interface_mode == 'cp2k') {
            units['nac_factor'] = Hartree / Bohr  // in a.u.
            units['distance_to_A'] = Bohr
            units['force_constants_unit'] = 'hartree/au^2'
            units['length_unit'] = 'Angstrom'
        }
        else if (interface_mode == 'crystal') {
            units['nac_factor'] = Hartree * Bohr
            units['distance_to_A'] = 1.0
            units['force_constants_unit'] = 'eV/Angstrom^2'
            units['length_unit'] = 'Angstrom'
        }
        else if (interface_mode == 'dftbp') {
            units['nac_factor'] = Hartree * Bohr
            units['distance_to_A'] = Bohr
            units['force_constants_unit'] = 'hartree/au^2'
            units['length_unit'] = 'au'
        }
        else { // interface_mode == 'vasp' or others
            units['nac_factor'] = Hartree * Bohr
            units['distance_to_A'] = 1.0
            units['force_constants_unit'] = 'eV/Angstrom^2'
            units['length_unit'] = 'Angstrom'
        }
        return units
    }

    getFromYaml(phononyaml) {

        //read the yaml files
        let lat      = PhononYaml.getYaml(['lattice'],phononyaml);
        let nqpoint  = PhononYaml.getYaml(['nqpoint'],phononyaml);
        let npath    = PhononYaml.getYaml(['npath'],phononyaml);
        let tmat     = PhononYaml.getYaml(['supercell_matrix'],phononyaml);
        let pc_atoms = PhononYaml.getYaml(['points','atoms'],phononyaml);
        let phonon   = PhononYaml.getYaml(['phonon'],phononyaml);

        // get the units
        let calculator = PhononYaml.getYaml(['calculator'],phononyaml,true);
        let units = PhononYaml.getUnits(calculator);

        //convert the lattice to Angstroem
        lat = mat.matrix_scale(lat,units['distance_to_A'])

        //verify if the eigenvectors tag is prsent
        let has_eigenvectors = phonon[0]['band'][0].hasOwnProperty('eigenvector');
        if (!has_eigenvectors) {
            alert("Eigenvectors not found in band.yaml file."+
                  "Please regenerate with the EIGENVECTORS=.true. tag.");
        }

        let segment_nqpoint;
        if ('segment_nqpoint' in phononyaml) {
            segment_nqpoint = phononyaml['segment_nqpoint'];
        }
        else {
            segment_nqpoint = [];
            for (i=0; i<npath; i++) {
                segment_nqpoint.push(nqpoint/npath);
            }
        }

        //get the number of repetitions
        let pmat = mat.matrix_multiply(lat,tmat);

        //get the atoms inside the unit cell
        this.atom_types = [];
        this.atom_numbers = [];
        this.atom_pos_car = [];
        this.atom_pos_red = [];
        this.natoms = pc_atoms.length;

        for (let i=0; i<this.natoms; i++) {
            let atom = pc_atoms[i];
            let symbol   = PhononYaml.getYaml(['symbol'],atom);
            let position = PhononYaml.getYaml(['position','coordinates'],atom);
            this.atom_numbers.push(atomic_data.atomic_number[symbol]);
            this.atom_types.push(symbol);
            this.atom_pos_red.push(position);
            this.atom_pos_car.push(utils.red_car(position,lat));
        }

        this.formula = utils.get_formula(this.atom_types);
        this.name = this.formula;

        let check_high_sym_qpoint = function(phonon_qpoint,highsym_qpts) {
            let label = phonon_qpoint['label'];
            let dist  = phonon_qpoint['distance'];
            //check if a label is present
            if (label) {  highsym_qpts[dist] = label; }
            else       {  highsym_qpts[dist] = '';    }
        }

        //iterate over the different segments of the path
        this.kpoints     = [];
        this.eigenvalues = [];
        this.vec         = [];
        this.distances   = [];
        this.line_breaks = [0];
        this.highsym_qpts = {};
        this.qindex = {};
        let nmodes = this.natoms*3;
        let qpoint = 0;

        //iterate over number of paths
        for (let p=0; p<npath; p++) {
            //get size of segment
            let size_segment = segment_nqpoint[p];

            //iterate over_qpoints
            for (let i=0; i<size_segment; i++) {
                let phonon_qpoint = phonon[qpoint+i];

                let dist = phonon_qpoint['distance'];
                this.qindex[dist] = this.kpoints.length;
                this.kpoints.push(phonon_qpoint['q-position']);

                //get distances
                this.distances.push( phonon_qpoint['distance'] );

                //create bands
                let eig = [];
                let eiv = [];
                let phonon_qpoint_band = phonon_qpoint['band'];
                for (let n=0; n<nmodes; n++) {
                    let phonon_qpoint_band_mode = phonon_qpoint_band[n];
                    //get eigenvalues
                    eig.push( phonon_qpoint_band_mode['frequency']*thz2ev );
                    //get eigenvectors
                    eiv.push( phonon_qpoint_band_mode['eigenvector'] );
                }
                this.vec.push(eiv);
                this.eigenvalues.push(eig);
            }

            //add line breaks
            this.line_breaks.push([qpoint,qpoint+size_segment]);

            //check if start point and end point are high-symmetry points
            check_high_sym_qpoint(phonon[qpoint],this.highsym_qpts);
            qpoint += size_segment;
            check_high_sym_qpoint(phonon[qpoint-1],this.highsym_qpts);
        }
        
        //get average mass (for normalization purposes)
        let average_mass = 0;
        let sqrt_atom_masses = [];
        for (let i=0;i<this.natoms;i++) {
            let mass = atomic_data.atomic_mass[this.atom_numbers[i]]
            average_mass += mass;
            sqrt_atom_masses.push(Math.sqrt(mass));
        }
        average_mass /= this.natoms;
        let sqrt_average_mass = Math.sqrt(average_mass);

        //normalize the phonon modes with the masses
        let nqpoints = this.vec.length;
        for (let q=0; q<nqpoints; q++) {
            let eivecq = this.vec[q];
            for (let n=0; n<nmodes; n++) {
                let eivecqn = eivecq[n];
                for (let i=0;i<this.natoms;i++) {
                    let norm = sqrt_average_mass/sqrt_atom_masses[i];
                    //real part
                    eivecqn[i][0][0] *= norm;
                    eivecqn[i][1][0] *= norm;
                    eivecqn[i][2][0] *= norm;
                    //imaginary part
                    eivecqn[i][0][1] *= norm;
                    eivecqn[i][1][1] *= norm;
                    eivecqn[i][2][1] *= norm;
                }
            }
        }

        this.addatomphase = true;
        this.lat = lat;
        this.repetitions = utils.getReasonableRepetitions(this.natoms,lat);
    }
}
