class PhononYaml {

    static getYaml(tags,object) {
        /*
        check if the tags are present and if so return their value 
        */

        let ntags = tags.length;
        for (var i = 0; i < ntags; i++) {
            let tag = tags[i];
            if (tag in object) {
                return object[tag];
            }
        }
        alert(tags + " not found in the file. Please generate the file again with the lastest version of phonopy.");
        throw new Error(tags + " not found in the file.");
    }

    getFromFile(file) {
        /*
        file is a javascript file object with the "band.yaml" file
        */
 
        let yaml_reader = new FileReader();

        function onLoadEndHandler() {
            this.getFromPhononpyString(yaml_reader.result);
            update();
        }
 
        //read the files
        yaml_reader.onloadend = onLoadEndHandler.bind(this);
        yaml_reader.readAsText(file);

    }

    getFromString(string) {
        /*
        yaml is the content of "band.yaml" file as a string
        */

        this.k = 0;
        this.n = 0;
        var supercell_lat, rec, lat, nqpoint, npath, phonon, sc_atoms, segment_nqpoint;

        //read the yaml files
        var phononyaml = jsyaml.load(string);
        lat      = this.getYaml(['lattice'],phononyaml);
        nqpoint  = this.getYaml(['nqpoint'],phononyaml);
        npath    = this.getYaml(['npath'],phononyaml);
        tmat     = this.getYaml(['supercell_matrix'],phononyaml);
        pc_atoms = this.getYaml(['points','atoms'],phononyaml);
        phonon   = this.getYaml(['phonon'],phononyaml);
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
        pmat = matrix_multiply(lat,tmat);

        //get the atoms inside the unit cell
        let pos,x,y,z,atom_types = [], atom_numbers = [] ;
        let atomic_numbers = {}, pc_atoms_car = [], pc_atoms_red = [];

        for (i=0; i<pc_atoms.length; i++) {
            let symbol   = this.getYaml(['symbol'],pc_atoms[i]);
            let position = this.getYaml(['position','coordinates'],pc_atoms[i]);
            atom_numbers.push(atomic_number[symbol]);
            atom_types.push(symbol);
            pc_atoms_red.push(position);
            pc_atoms_car.push(red_car(position,lat));
        }
        this.natoms = pc_atoms.length;

        //get the phonon dispersion
        let kpoints = [], eivals, eivecs = [];
        let nmodes = this.natoms*3;
        let n, p, phononi, phononiband;

        let highcharts = [];
        this.highsym_qpts = {};
        this.qindex = {};
        var qpoint = 0;

        var check_high_sym_qpoint = function(phononi,highsym_qpts) {
            //check if a label is present
            if (phononi['label']) {
                highsym_qpts[phononi['distance']] = phononi['label'];
            }
            else {
                highsym_qpts[phononi['distance']] = '';
            }
        }

        //iterate over the different segments of the path
        this.eigenvalues = [];
        this.distances   = [];
        for (p=0; p<npath; p++) {

            //clean eivals array
            eivals = [];
            for (i=0; i<nmodes; i++) {
                eivals.push([]);
            }

            check_high_sym_qpoint(phonon[qpoint],this.highsym_qpts);

            for (i=0; i<segment_nqpoint[p]; i++) {
                phononi = phonon[qpoint+i];

                var dist = phononi['distance'];
                if (!(dist in this.qindex)) {
                    this.qindex[dist] = kpoints.length;
                }
                kpoints.push(phononi['q-position']);

                phononiband = phononi['band'];
                //get distances
                this.distances.push( phononi['distance'] );

                //create bands
                eig   = [];
                eivec = [];
                for (n=0; n<nmodes; n++) {
                    //get eigenvalues
                    eig.push( phononiband[n]['frequency']*thz2ev );
                    eivals[n].push([phononi['distance'],phononiband[n]['frequency']*thz2ev]);

                    //get eigenvectors
                    vec = this.getYaml(['eigenvector'],phononiband[n])
                    eivec.push(vec);
                }
                eivecs.push(eivec);
                this.eigenvalues.push(eig);
            }
            check_high_sym_qpoint(phononi,this.highsym_qpts);

            qpoint += segment_nqpoint[p];

            //plot of the phonon dispersion
            for (i=0; i<nmodes; i++) {
                highcharts.push({ name:  i.toString(),
                                  color: "#0066FF",
                                  marker: { radius: 2,
                                            symbol: "circle"},
                                  data: eivals[i]
                                });
            }
        }

        //get average mass (for normalization purposes)
        average_mass = 0;
        sqrt_atom_masses = [];
        for (i=0;i<this.natoms;i++) {
            mass = atomic_mass[atom_numbers[i]]
            average_mass += mass;
            sqrt_atom_masses.push(Math.sqrt(mass));
        }
        average_mass /= this.natoms;
        sqrt_average_mass = Math.sqrt(average_mass);

        //normalize the phonon modes with the masses
        nqpoints = eivecs.length;
        for (q=0; q<nqpoints; q++) {
            eivecq = eivecs[q];
            for (n=0; n<nmodes; n++) {
                eivecqn = eivecq[n];
                for (i=0;i<this.natoms;i++) {
                    norm = sqrt_average_mass/sqrt_atom_masses[i];
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
        this.atomic_numbers = unique(atom_numbers).map(parseInt(x));
        this.atom_pos_car = pc_atoms_car;
        this.atom_pos_red = pc_atoms_red;
        this.lat = lat;
        this.vec = eivecs;
        this.kpoints = kpoints;
        this.formula = atom_types.join('');
        this.highcharts = highcharts;
        this.repetitions = [3,3,3];

    }
}
