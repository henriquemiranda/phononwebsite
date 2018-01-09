const thz2ev = 33.35641;

function getReasonableRepetitions(natoms,lat) {
    /*
    choose a reasonable number of repetitions
    Some logic can be implemented here to improve 
    in which directions the repetitions are made
    */

    if (natoms < 4)        { return [3,3,3] };
    if (4 < natoms < 15)   { return [2,2,2] };
    if (15 < natoms < 50)  { return [2,2,1] };
    if (50 < natoms)       { return [1,1,1] };

}

class PhononYaml {

    getFromURL(url,callback) {
        /*
        load a file from url
        */

        function onLoadEndHandler(text) {
            this.getFromString(text,callback);
        };

        $.get(url,onLoadEndHandler.bind(this));

    }

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
            segment_nqpoint = [];
            for (i=0; i<npath; i++) {
                segment_nqpoint.push(nqpoint/npath);
            }
        }

        //get the number of repetitions
        let pmat = matrix_multiply(lat,tmat);

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
            this.atom_numbers.push(atomic_number[symbol]);
            this.atom_types.push(symbol);
            this.atom_pos_red.push(position);
            this.atom_pos_car.push(red_car(position,lat));
        }

        this.formula = get_formula(this.atom_types);
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
            let mass = atomic_mass[this.atom_numbers[i]]
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
        this.repetitions = getReasonableRepetitions(this.natoms,lat);
    }
}
