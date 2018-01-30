define([], function() {

    return class ContribDB {
        /* 
        Interact with the local database of phonons contributed by users
        Hosted on Github
        */

        constructor() {
            this.name = "contribdb";
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
                    m.source = name;
                    m.type = "json";
                   
                    m.reference = m.author+", "+"<a href="+m.url+">"+m.journal+"</a> ("+m.year+")";
            

                    //create the url
                    m.url = m.folder+"/data.json";
                }
                callback(materials)
            }

            $.get('contribdb/models.json', dothings);
        }

    }
});
