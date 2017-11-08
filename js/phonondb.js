class PhononDB {
    /*
    Interact with the database of phonondb
    Hosted in http://phonondb.mtl.kyoto-u.ac.jp/
    */

    constructor() {
        this.name = "phonondb";
        this.author = "A. Togo";
        this.year = 2015;
        this.url = "http://phonondb.mtl.kyoto-u.ac.jp/";
    }

    get_materials(callback) {
        /* 
        this function load the materials from a certain source and returns then to the callback
        Some pre-processing of the data might be required and can be implemented here
        */
        let reference = this.author+", "+"<a href="+this.url+">"+this.name+"</a> ("+this.year+")";
        let name = this.name;

        function dothings(materials) {

            for (let i=0; i<materials.length; i++) {
                let m = materials[i];
                m.source = name;
                m.type = "yaml";
                m.link = "https://materialsproject.org/materials/mp-"+m.id;
                m.reference = reference;
            }
            callback(materials)
        }

        $.get('phonondb2015/phonondb.json', dothings);
    }


}
