export class MaterialsProjectDB {
    /*
    Interact with the local database of phonons
    Hosted on Github
    */

    constructor(apikey) {
        this.name = "mpdb";
        this.year = 2017;
        this.author = "G. Petretto et al.";
        this.url = "";
        this.apikey = apikey;
    }

    isAPIKeyValid(apikey,callback) {
        if (typeof apikey != 'string') {
            return false
        }
        if (apikey.length != 32) {
            return false
        }
        // now we make a simple request and check if APIkey is valid
        let xhr = new XMLHttpRequest();
        let url = "https://api.materialsproject.org/materials/phonon/?material_ids=mp-149&_fields=material_id"
        xhr.open('GET', url, true);
        xhr.setRequestHeader('x-api-key', apikey);
        xhr.onload = function () {
            if (xhr.status === 200) {
                callback();
            }
        }.bind(this)
        xhr.send(null);
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
                m.url = "https://api.materialsproject.org/materials/phonon/?material_ids=mp-"+m.id+"&_fields=ph_bs";
                m.name = m.name;
                m.link = "https://materialsproject.org/materials/mp-"+m.id;
                m.apikey = apikey;
            }
            callback(materials);
        }

        $.get('mpdb/models.json', dothings);
    }

}
