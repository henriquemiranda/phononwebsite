import * as atomic_data from './atomic_data.js';
import * as utils from './utils.js';
import * as mat from './mat.js';

var thz2cm1 = 33.35641;
var ev2cm1 = 8065.73;

export class PhononJson { 

    getFromURL(url,callback) {
        /*
        load a file from url
        */

        function onLoadEndHandler(text) {
            this.getFromJson(text,callback);
        };

        $.getJSON(url,onLoadEndHandler.bind(this));

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

    getFromREST(url,apikey,callback) {

        let xhr = new XMLHttpRequest();
        xhr.open('GET', url, true);
        if (apikey) { xhr.setRequestHeader('x-api-key', apikey) };
        xhr.onload = function () {
            let json = JSON.parse(xhr.responseText);
            this.getFromJson(json.response,callback);
        }.bind(this)
        xhr.send(null);
    }
    
    getFromJson(json,callback) {
        if (json.hasOwnProperty('@class')) {
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

        //get line breaks
        this.getLineBreaks(data);
                
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
        let rlat = utils.rec_lat(this.lat);
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
            this.atom_numbers.push(atomic_data.atomic_number[atom_type]);
            this.atom_pos_car.push(site['xyz']);
            this.atom_pos_red.push(site['abc']);
        }

        this.natoms = sites.length;
        this.name = utils.get_formula(this.atom_types);

        //dispersion
        let qpoints_red = data['qpoints'];
        this.kpoints = qpoints_red; 

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

        let high_symmetry_points_car = utils.red_car_list(high_symmetry_points_red,rlat); 
        let highsym_qpts_index = {}
        for (let nq=0; nq<qpoints_car.length; nq++) {
            let result = utils.point_in_list(qpoints_car[nq],high_symmetry_points_car);
            if (result["found"]) {
                let label = high_symmetry_labels[result["index"]]
                highsym_qpts_index[nq] = label;
            }
        }

        //calculate the distances between the qpoints
        this.distances = [0];
        this.line_breaks = []
        let nqstart = 0;
        let dist = 0;
        for (let nq=1; nq<this.kpoints.length; nq++) {
            //handle jumps
            if ((nq in highsym_qpts_index) && (nq-1 in highsym_qpts_index) &&
                (highsym_qpts_index[nq] != highsym_qpts_index[nq-1])) {
                highsym_qpts_index[nq] += "|"+highsym_qpts_index[nq-1];
                delete highsym_qpts_index[nq-1];
                this.line_breaks.push([nqstart,nq]);
                nqstart = nq;
            }
            else 
            {
                dist = dist + mat.distance(this.kpoints[nq-1],this.kpoints[nq]);
            }
            this.distances.push(dist);
        }
        this.line_breaks.push([nqstart,this.kpoints.length]);

        this.highsym_qpts = {}
        for (let nq in highsym_qpts_index) { 
            let dist = this.distances[nq];
            let label = highsym_qpts_index[nq];
            this.highsym_qpts[dist] = label;
        }

        //get qindex
        this.qindex = {};
        for (let i=0; i<this.distances.length; i++) {
            this.qindex[this.distances[i]] = i;
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

    getLineBreaks(data) {
        //get line breaks
        if ("line_breaks" in data) {
            this.line_breaks = data["line_breaks"]
        }
        else {
            //no line breaks
            this.line_breaks = [[0,this.kpoints.length]];
        }
    }

}
