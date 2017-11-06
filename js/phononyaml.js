const thz2ev = 33.35641;

function unique(a) {
    var i, b = {};
    for (i=0; i<a.length; i++) {
        b[a[i]] = 0;
    }
    return Object.keys(b);
}

class PhononYaml {

    static getYaml(tags,object) {
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
        alert(tags + " not found in the file. Please generate the file again with the lastest version of phonopy.");
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

    getFromYaml(phononyaml) {

        //read the yaml files
        let lat      = PhononYaml.getYaml(['lattice'],phononyaml);
        let nqpoint  = PhononYaml.getYaml(['nqpoint'],phononyaml);
        let npath    = PhononYaml.getYaml(['npath'],phononyaml);
        let tmat     = PhononYaml.getYaml(['supercell_matrix'],phononyaml);
        let pc_atoms = PhononYaml.getYaml(['points','atoms'],phononyaml);
        let phonon   = PhononYaml.getYaml(['phonon'],phononyaml);

        let segment_nqpoint;
        if ('segment_nqpoint' in phononyaml) {
            segment_nqpoint = phononyaml['segment_nqpoint'];
        }
        else {
            segment_nqpoint = []
            for (i=0; i<npath; i++) {
                segment_nqpoint.push(nqpoint/npath);
            }
        }

        //get the number of repetitions
        let pmat = matrix_multiply(lat,tmat);

        //get the atoms inside the unit cell
        let pos,x,y,z,atom_types = [], atom_numbers = [];
        let atomic_numbers = {}, pc_atoms_car = [], pc_atoms_red = [];

        for (let i=0; i<pc_atoms.length; i++) {
            let symbol   = PhononYaml.getYaml(['symbol'],pc_atoms[i]);
            let position = PhononYaml.getYaml(['position','coordinates'],pc_atoms[i]);
            atom_numbers.push(atomic_number[symbol]);
            atom_types.push(symbol);
            pc_atoms_red.push(position);
            pc_atoms_car.push(red_car(position,lat));
        }
        this.natoms = pc_atoms.length;

        //get the phonon dispersion
        let kpoints = [], eivecs = [];
        let nmodes = this.natoms*3;
        let phononi, phononiband;
        let qpoint = 0;

        this.highsym_qpts = {};
        this.qindex = {};

        let check_high_sym_qpoint = function(phonon_qpoint,highsym_qpts) {
            //check if a label is present
            if (phonon_qpoint['label']) {
                highsym_qpts[phonon_qpoint['distance']] = phonon_qpoint['label'];
            }
            else {
                highsym_qpts[phonon_qpoint['distance']] = '';
            }
        }

        //iterate over the different segments of the path
        this.eigenvalues = [];
        this.distances   = [];
        for (let p=0; p<npath; p++) {

            //clean eivals array
            let eivals = [];
            for (let i=0; i<nmodes; i++) {
                eivals.push([]);
            }

            let phonon_qpoint;
            check_high_sym_qpoint(phonon[qpoint],this.highsym_qpts);

            //iterate over_qpoints
            for (let i=0; i<segment_nqpoint[p]; i++) {
                phonon_qpoint = phonon[qpoint+i];

                let dist = phonon_qpoint['distance'];
                if (!(dist in this.qindex)) {
                    this.qindex[dist] = kpoints.length;
                }
                kpoints.push(phonon_qpoint['q-position']);
                phononiband = phonon_qpoint['band'];

                //get distances
                this.distances.push( phonon_qpoint['distance'] );

                //create bands
                let eig   = [];
                let eivec = [];
                for (let n=0; n<nmodes; n++) {
                    //get eigenvalues
                    eig.push( phononiband[n]['frequency']*thz2ev );
                    eivals[n].push([phonon_qpoint['distance'],phononiband[n]['frequency']*thz2ev]);

                    //get eigenvectors
                    let vec = PhononYaml.getYaml(['eigenvector'],phononiband[n])
                    eivec.push(vec);
                }
                eivecs.push(eivec);
                this.eigenvalues.push(eig);
            }

            check_high_sym_qpoint(phonon_qpoint,this.highsym_qpts);

            qpoint += segment_nqpoint[p];
        }

        //get average mass (for normalization purposes)
        let average_mass = 0;
        let sqrt_atom_masses = [];
        for (let i=0;i<this.natoms;i++) {
            let mass = atomic_mass[atom_numbers[i]]
            average_mass += mass;
            sqrt_atom_masses.push(Math.sqrt(mass));
        }
        average_mass /= this.natoms;
        let sqrt_average_mass = Math.sqrt(average_mass);

        //normalize the phonon modes with the masses
        let nqpoints = eivecs.length;
        for (let q=0; q<nqpoints; q++) {
            let eivecq = eivecs[q];
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
        this.atom_types = atom_types;
        this.atom_numbers = atom_numbers;
        this.atomic_numbers = unique(atom_numbers).map(parseInt);
        this.atom_pos_car = pc_atoms_car;
        this.atom_pos_red = pc_atoms_red;
        this.lat = lat;
        this.vec = eivecs;
        this.kpoints = kpoints;
        this.formula = atom_types.join('');
        this.repetitions = [3,3,3];

    }
}
