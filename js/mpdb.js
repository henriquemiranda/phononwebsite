class MaterialsProjectDB {
    /* 
    Interact with the local database of phonons
    Hosted on Github
    */

    constructor() {
        this.name = "Materials project phonon database";
        this.year = 2017;
        this.author = "G. Petretto et al. (in preparation)";
        this.url = "";
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
                m.type = "rest";
                m.reference = reference;
                m.url = "mp-"+m.id;
            }
            callback(materials);
        }

        $.get('mpdb/models.json', dothings);
    }

}
