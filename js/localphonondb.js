class LocalPhononDB {
    /*
    Interact with the database of phonondb
    Hosted in http://phonondb.mtl.kyoto-u.ac.jp/
    */

    constructor() {
        this.name = "phonondb";
        this.author = "Atsushi Togo";
        this.url = "http://phonondb.mtl.kyoto-u.ac.jp/";
    }

    get_materials(callback) {
        /* 
        this function load the materials from a certain source and returns then to the callback
        Some pre-processing of the data might be required and can be implemented here
        */
        let name = this.name;

        function dothings(materials) {

            for (let i=0; i<materials.length; i++) {
                let m = materials[i];
                m.url = "localphonondb/band-"+m.id+".yaml";
                m.source = name;
                m.type = "yaml";
                m.link = "https://materialsproject.org/materials/mp-"+m.id;
            }
            callback(materials)
        }

        $.get('phonondb/phonondb.json', dothings);
    }


}