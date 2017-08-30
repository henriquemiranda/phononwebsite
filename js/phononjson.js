class PhononJson() { 

    getFromJsonFile = function(file) {
        var json_reader = new FileReader();
        self = this;

        console.log(file);
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

    getFromJson = function(data) {
        /*
        Read structure data from JSON format
        data is a string with the json file.
        */

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
}
