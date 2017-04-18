//check if the tags are present and if so return their value 
getYaml = function(tags,object) {
    var ntags = tags.length;
    for (var i = 0; i < ntags; i++) {
        var tag = tags[i];
        if ((tag in object)) {
            return object[tag];
        }
    }
    alert(tags + " not found in the file. Please generate the file again with the lastest version of phonopy.");
    throw new Error(tags + " not found in the file.");
}

//yaml is a file object with the "band.yaml" file
getFromPhononpyFile = function(yaml) {
    var yaml_reader = new FileReader();
    self = this;

    //read the files
    yaml_reader.onloadend = onLoadEndHandler;
    yaml_reader.readAsText(yaml);

    function onLoadEndHandler() {
    self.getFromPhononpyString(yaml_reader.result);
    update();
    }
},

//yaml is the content of "band.yaml" file as a string
getFromPhononpyString = function(yaml) {
    this.k = 0;
    this.n = 0;
    var supercell_lat, rec, lat, nqpoint, npath, phonon, sc_atoms, segment_nqpoint;

    //read the yaml files
    var phononyaml = jsyaml.load(yaml);
    lat      = getYaml(['lattice'],phononyaml);
    nqpoint  = getYaml(['nqpoint'],phononyaml);
    npath    = getYaml(['npath'],phononyaml);
    tmat     = getYaml(['supercell_matrix'],phononyaml);
    pc_atoms = getYaml(['points','atoms'],phononyaml);
    phonon   = getYaml(['phonon'],phononyaml);
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

    //this will be changed
    nx = 3;
    ny = 3;
    nz = 3;

    //get the atoms inside the unit cell
    var pos,x,y,z,atom_types = [], atom_numbers = [] ;
    var atomic_numbers = {}, pc_atoms_car = [], pc_atoms_red = [];

    for (i=0; i<pc_atoms.length; i++) {
        var symbol = getYaml(['symbol'],pc_atoms[i]);
        var position = getYaml(['position','coordinates'],pc_atoms[i]);
        atom_numbers.push(atomic_number[symbol]);
        atom_types.push(symbol);
        pc_atoms_red.push(position);
        pc_atoms_car.push(red_car(position,lat));
    }
    this.natoms = pc_atoms.length;

    //get the phonon dispersion
    var kpoints = [], eivals, eivecs = [];
    var nmodes = this.natoms*3;
    var n, p, phononi, phononiband;

    var highcharts = [];
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

            //create bands
            phononiband = phononi['band'];
            eivec = [];
            for (n=0; n<nmodes; n++) {
                //get eigenvalues
                eivals[n].push([phononi['distance'],phononiband[n]['frequency']*thz2ev]);

                //get eigenvectors
                vec = getYaml(['eigenvector'],phononiband[n])
                eivec.push(vec);
            }
            eivecs.push(eivec);
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
            console.log(eivecqn);
            for (i=0;i<this.natoms;i++) {
                norm = sqrt_average_mass/sqrt_atom_masses[i];
                eivecqn[i][0][0] *= norm;
                eivecqn[i][1][0] *= norm;
                eivecqn[i][2][0] *= norm;
                eivecqn[i][0][1] *= norm;
                eivecqn[i][1][1] *= norm;
                eivecqn[i][2][1] *= norm;
            }
        }
    }
    console.log(norm);

    this.addatomphase = true;
    this.atom_types = atom_types;
    this.atom_numbers = atom_numbers;
    this.atomic_numbers = unique(atom_numbers).map(function(x) { return parseInt(x)});
    this.atom_pos_car = pc_atoms_car;
    this.atom_pos_red = pc_atoms_red;
    this.lat = lat;
    this.vec = eivecs;
    this.kpoints = kpoints;
    this.formula = atom_types.join('');
    this.highcharts = highcharts;
    this.repetitions = [nx,ny,nz];

    this.nndist = this.getBondingDistance();

    $('#nx').val(this.repetitions[0]);
    $('#ny').val(this.repetitions[1]);
    $('#nz').val(this.repetitions[2]);
    this.getRepetitions();
}

getFromJsonFile = function(file) {
    var json_reader = new FileReader();
    self = this;

    json_reader.readAsText(file);

    json_reader.onloadend = function(e) {
        self.getFromJsonString(json_reader.result);
        update();
    };
}

getFromJsonString = function(string) {
    json = JSON.parse(string);
    this.getFromJson.bind(this)(json);
}

// Read structure data from JSON format
// data is a string with the json file.
getFromJson = function(data) {
    this.k=0;
    this.n=0;
    this.addatomphase = false;

    this.name = data["name"];
    this.natoms = data["natoms"];
    this.atom_types = data["atom_types"];
    this.atom_numbers = data["atom_numbers"];
    this.atomic_numbers = data["atomic_numbers"];
    this.atom_pos_car = data["atom_pos_car"];
    this.atom_pos_red = data["atom_pos_red"];
    this.lat = data["lattice"];
    this.vec = data["vectors"];
    this.kpoints = data["qpoints"];
    this.distances = data["distances"];
    this.formula = data["formula"];
    this.eigenvalues = data["eigenvalues"];
    this.repetitions = data["repetitions"];

    //get qindex
    this.qindex = {};
    for (i=0; i<this.distances.length; i++) {
        this.qindex[this.distances[i]] = i;
    }

    //get high symmetry qpoints
    this.highsym_qpts = {}
    for (i=0; i<data["highsym_qpts"].length; i++) {
        var dist = this.distances[data["highsym_qpts"][i][0]]
        this.highsym_qpts[dist] = data["highsym_qpts"][i][1];
    }

    this.nndist = this.getBondingDistance();

    $('#nx').val(this.repetitions[0]);
    $('#ny').val(this.repetitions[1]);
    $('#nz').val(this.repetitions[2]);
    this.getRepetitions();

    //go through the eigenvalues and create eivals list
    eivals = this.eigenvalues;
    var nbands = eivals[0].length;
    var nqpoints = eivals.length;
    this.highcharts = [];

    for (n=0; n<nbands; n++) {
        eig = [];
        for (k=0; k<nqpoints; k++) {
            eig.push([this.distances[k],eivals[k][n]]);
        }

        this.highcharts.push({
                              name:  n.toString(),
                              color: "#0066FF",
                              marker: { radius: 2,
                                        symbol: "circle"},
                              data: eig
                            });
    }
}
