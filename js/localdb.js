class LocalDB {
    /* 
    Interact with the local database of phonons
    Hosted on Github
    */

    constructor() {
        this.name = "localdb";
        this.year = 2015;
        this.author = "H. Miranda";
        this.url = "http://henriquemiranda.github.io/";
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
                m.type = "json";
                m.reference = reference;

                //create the url
                let folder = m.folder;
                m.url = folder+"/data.json";
            }
            callback(materials)
        }

        $.get('localdb/models.json', dothings);
    }

}
