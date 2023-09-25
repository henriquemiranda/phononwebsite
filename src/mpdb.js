export class MaterialsProjectDB {
    /*
    Interact with the local database of phonons
    Hosted on Github
    */

    constructor() {
        this.name = "mpdb";
        this.year = 2017;
        this.author = "G. Petretto et al.";
        this.url = "";
        this.apikey = "fAGQ0aT2TsXeidxU";
    }

    isAvailable() {
        return false;
    }

    get_materials(callback) {
        /*
        this function load the materials from a certain source and returns then to the callback
        Some pre-processing of the data might be required and can be implemented here
        */
        let reference = this.author+", "+"<a href="+this.url+">"+this.name+"</a> ("+this.year+")";
        let name = this.name;
        let apikey = this.apikey;

        function dothings(materials) {

            for (let i=0; i<materials.length; i++) {
                let m = materials[i];
                m.source = name;
                m.type = "rest";
                m.reference = reference;
                m.url = "https://materialsproject.org/rest/v2/materials/mp-"+m.id+"/phononbs?web=true";
                m.name = m.name;
                m.link = "https://materialsproject.org/materials/mp-"+m.id;
                m.apikey = apikey;
            }
            callback(materials);
        }

        $.get('mpdb/models.json', dothings);
    }

}
