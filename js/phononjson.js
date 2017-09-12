class PhononJson { 

    getFromFile(file,callback) {
        /*
        file is a javasccript file object with the ".json" file
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

    getFromJson(data,callback) {
        /*
        Read structure data from JSON format
        data is a json object
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
}
