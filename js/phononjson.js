const thz2cm1 = 33.35641;
const ev2cm1 = 8065.73;

function distances(points) {
    /* Accumulate distances between points in a list
    */
    let distances = [0];
    let dist = 0;
    for (let i=1; i<points.length; i++) {
        dist = dist + distance(points[i-1],points[i]);
        distances.push(dist);
    }
    return distances;
}

function rec_lat(lat) {
    /* Calculate the reciprocal lattice
    */
    let a1 = lat[0];
    let a2 = lat[1];
    let a3 = lat[2];
    let b1 = vec_cross(a2,a3);
    let b2 = vec_cross(a3,a1);
    let b3 = vec_cross(a1,a2);
    let v = vec_dot(a1,b1);
    b1 = vec_scale(b1,1/v);
    b2 = vec_scale(b2,1/v);
    b3 = vec_scale(b3,1/v);
    return [b1,b2,b3] 
}

function point_in_list(point,points) {
    /* 
    Return the index of the point if it is present in a list of points
    */
    for (let i=0; i<points.length; i++) {
        if (distance(point,points[i]) < 1e-4) {
            return {found:true,index:i};
        }
    }
    return {found:false};
}

function red_car_list(red,lat) {
    let car = [];
    for (let i=0; i<red.length; i++) {
        car.push(red_car(red[i],lat));
    }
    return car;
}

class PhononJson { 

    getFromURL(url,callback) {
        /*
        load a file from url
        */

        function onLoadEndHandler(text) {
            this.getFromJson(text,callback);
        };

        $.get(url,onLoadEndHandler.bind(this));

    }

    getFromFile(file,callback) {
        /*
        file is a javasccript file object with the ".json" file in data 
        */

        let json_reader = new FileReader();

        function onLoadEndHandler() {
            this.getFromString(json_reader.result,callback);
        };

        //read the files
        json_reader.onloadend = onLoadEndHandler.bind(this);
        json_reader.readAsText(file);

    }

    getFromString(string,callback) {
        /*
        string is the content of the ".json" file as a string
        */

        let json = JSON.parse(string);
        this.getFromJson(json,callback);
    }

    getFromJson(json,callback) {
        if ('@class' in json) {
            this.getFromPMGJson(json,callback);
        }
        else {
            this.getFromInternalJson(json,callback);
        }
    }

    getFromInternalJson(data,callback) {
        /*
        It was determined the json dictionary is the internal format        
        */

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
        for (let i=0; i<this.distances.length; i++) {
            this.qindex[this.distances[i]] = i;
        }

        //get high symmetry qpoints
        this.highsym_qpts = {}
        for (let i=0; i<data["highsym_qpts"].length; i++) {
            let dist = this.distances[data["highsym_qpts"][i][0]];
            this.highsym_qpts[dist] = data["highsym_qpts"][i][1];
        }

        callback();
    }
    
    getFromPMGJson(data,callback) {
        /*
        It was determined that the json dictionary is the pymatgen format
        */

        this.addatomphase = false;

        //system information (not needed for now)
        let structure = data["structure"];

        //lattice 
        this.lat = structure["lattice"]["matrix"];
        let rlat = rec_lat(this.lat);
        this.repetitions = [3,3,3];

        this.atom_pos_car = [];
        this.atom_pos_red = [];
        this.atom_types = []; 
        this.atom_numbers = [];
 
        let sites = structure["sites"];
        for (let i=0; i<sites.length; i++) {
            let site = sites[i];
            
            let atom_type = site['label'];
            this.atom_types.push(atom_type);
            this.atom_numbers.push(atomic_number[atom_type]);
            this.atom_pos_car.push(site['xyz']);
            this.atom_pos_red.push(site['abc']);
        }

        //atomic sites
        this.natoms = sites.length; 

        /* I think the atomic numbers are not used at all and can be removed
        this.atomic_numbers = ;
        */

        //dispersion
        let qpoints_red = data['qpoints'];
        let qpoints_car = red_car_list(qpoints_red,rlat)
        this.kpoints = qpoints_car; 

        //calculate the distances between the qpoints
        this.distances = distances(this.kpoints);

        //get qindex
        this.qindex = {};
        for (let i=0; i<this.distances.length; i++) {
            this.qindex[this.distances[i]] = i;
        }

        /*
        get high symmetry qpoints
        Where we have to match the qpoint with a certain label with the
        high-symmetry point
        */ 

        let labels_dict = data["labels_dict"];
        let high_symmetry_points_red = [];
        let high_symmetry_labels = [];
        for (let label in labels_dict) {
            let qpoint = labels_dict[label];
            high_symmetry_points_red.push(qpoint);
            high_symmetry_labels.push(label);
        }

        let high_symmetry_points_car = red_car_list(high_symmetry_points_red,rlat); 
        this.highsym_qpts = {}
        for (let nq=0; nq<qpoints_car.length; nq++) {
            let result = point_in_list(qpoints_car[nq],high_symmetry_points_car);
            if (result["found"]) {
                let dist = this.distances[nq];
                this.highsym_qpts[dist] = high_symmetry_labels[result["index"]];
            }
        }

        /*
        fill in the list of eigenvalues and eigenvectors
        I will transpose to keep compatibility between the old interfaces
        even though this is super ugly
        */
        let eig = data["bands"];
        let eiv = data["eigendisplacements"];
        let nbands = eig.length;
        let nqpoints = eig[0].length;

        /*
        the eigenvectors have to be scaled.
        We should detemrine the scale with respect to the other conventions.
        For now we use a large value that visually looks ok
        */
        let scale = 200;

        this.vec = [];
        this.eigenvalues = [];
        for (let nq=0; nq<nqpoints; nq++) {
            let eig_qpoint = [];
            let eiv_qpoint = [];

            for (let n=0; n<nbands; n++) {
                eig_qpoint.push(eig[n][nq]*thz2cm1);
              
                let eiv_qpoint_atoms = [];

                for (let a=0; a<this.natoms; a++) { 
                    let real = eiv["real"][n][nq][a];
                    let imag = eiv["imag"][n][nq][a];

                    let x = [real[0]*scale,imag[0]*scale];
                    let y = [real[1]*scale,imag[1]*scale];
                    let z = [real[2]*scale,imag[2]*scale];

                    eiv_qpoint_atoms.push([x,y,z]);
                }
                eiv_qpoint.push(eiv_qpoint_atoms);
            }
            this.eigenvalues.push(eig_qpoint);
            this.vec.push(eiv_qpoint);
        }

        callback();
    }
}
