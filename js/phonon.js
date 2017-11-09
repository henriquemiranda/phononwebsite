const pi = 3.14159265359;
const bohr2ang = 0.529177249;

function subscript_numbers(old_string) {
    string = "";
    for (a of old_string) {
        if (!isNaN(a)) {
            string += "<sub>"+a+"</sub>";
        }
        else {
            string += a;
        }
    }
    return string;
}

class PhononWebpage {

    constructor(visualizer, dispersion) {
        this.k = 0;
        this.n = 0;
        this.nx = 1;
        this.ny = 1;
        this.nz = 1;
        this.amplitude = 0.5;

        //select visualization
        this.visualizer = visualizer;

        //select dispersion
        this.dispersion = dispersion;

        //bind some functions (TODO: improve this)
        this.exportXSF    = exportXSF.bind(this);
        this.exportPOSCAR = exportPOSCAR.bind(this);
    }

    loadCustomFile(event) {
        /*
        find the type of file and call the corresponding function to read it

        two formats available:
            1. band.yaml generated with phonopy with eigenvectors
            2. internal .json format description available in 
            http://henriquemiranda.github.io/phononwebsite/
            3. pymatgen phononBS format
        */
        this.k = 0;
        this.n = 0;
        self = this;

        function set_name() {
            delete self.link;
            self.name = self.phonon.name; 
            self.loadCallback();
        }

        let file = event.target.files[0];
        if (file.name.indexOf(".yaml") > -1) {
            this.phonon = new PhononYaml();
            this.phonon.getFromFile(file, set_name );
         }
        else if (file.name.indexOf(".json") > -1) { 
            this.phonon = new PhononJson();
            this.phonon.getFromFile(file, set_name );
        }
        else { 
            alert("Ivalid file"); 
        }
    }

    loadURL(url_vars) {  
        /*
        load file from post request in the url
        */

        this.k = 0;
        this.n = 0;
        delete this.link;

        if ( "name" in url_vars ) {
            this.name = url_vars.name;
        }
        if ( "link" in url_vars ) {
            this.link = url_vars.link;
        }

        if ("yaml" in url_vars) {
            this.phonon = new PhononYaml();
            this.phonon.getFromURL(url_vars.yaml,this.loadCallback.bind(this));
        }
        else if ("json" in url_vars) {
            this.phonon = new PhononJson();
            this.phonon.getFromURL(url_vars.json,this.loadCallback.bind(this));
        }
        else {
            alert("Ivalid url"); 
        }
    }

    static getUrlVars() {
        /* 
        get variables from the url
        from http://stackoverflow.com/questions/4656843/jquery-get-querystring-from-url

        currently the possible options are: 
            json : load a json file from location
            yaml : load a yaml file from location
            name : change the display name of the material
        */
        let vars = {};
        let hash;

        if (location.search) {
            let hashes = location.search.slice(1).split('&');
            for(let i = 0; i < hashes.length; i++) {
                hash = hashes[i].split('=');
                vars[hash[0]] = hash[1];
            }
            return vars;
        }
        else {
            return null;
        }
    }

    loadCallback() {
        /*
        Fuunction to be called once the file is loaded
        */
        this.setRepetitions(this.phonon.repetitions);
        this.update() 
    }

    getRepetitions() {
        /*
        read the number of repetitions in each direction and update it
        */
        this.nx = $('#nx').val();
        this.ny = $('#ny').val();
        this.nz = $('#nz').val();
    }

    setRepetitions(repetitions) {
        /*
        set the number of repetitions on the interface
        */
    
        if (repetitions) {
            this.nx = repetitions[0];
            this.ny = repetitions[1];
            this.nz = repetitions[2];
        }

        $('#nx').val(this.nx);
        $('#ny').val(this.ny);
        $('#nz').val(this.nz);
    }

    getStructure(nx,ny,nz) {
        let lat = this.phonon.lat;
        let apc = this.phonon.atom_pos_car;
        let atoms = [];

	    for (let ix=0;ix<nx;ix++) {
            for (let iy=0;iy<ny;iy++) {
                for (let iz=0;iz<nz;iz++) {
                    for (let i=0;i<this.phonon.natoms;i++) {

                        //postions of the atoms
                        let x = apc[i][0] + ix*lat[0][0] + iy*lat[1][0] + iz*lat[2][0];
                        let y = apc[i][1] + ix*lat[0][1] + iy*lat[1][1] + iz*lat[2][1];
                        let z = apc[i][2] + ix*lat[0][2] + iy*lat[1][2] + iz*lat[2][2];

                        atoms.push( [i,x,y,z] );
                    }
                }
            }
        }

        return atoms;
    }

    getBondingDistance() {
        /*
        replicate the unit cell two times in each direction
        and clauclate the minimum bonding distance
        */
        let atoms = this.getStructure(2,2,2);

        let combinations = getCombinations( atoms );
        let min = 1e9;
        for (let i=0; i<combinations.length; i++ ) {
            let a = combinations[i][0];
            let b = combinations[i][1];

            let dist = distance(a.slice(1),b.slice(1));
            if (min > dist) {
                min = dist;
            }
        }
        return min;
    }

    getVibrations(nx,ny,nz) {
        /*
        Calculate the vibration patterns for all the atoms
        */
        let phonon = this.phonon;
        let veckn = phonon.vec[this.k][this.n];
        let vibrations = [];
        let kpt = phonon.kpoints[this.k];

        //additional phase if necessary
        let atom_phase = []
        if (phonon.addatomphase) {
            for (let i=0; i<phonon.natoms; i++) {
                let phase = vec_dot(kpt,phonon.atom_pos_red[i]);
                atom_phase.push(phase);
            }
        }
        else {
            for (let i=0; i<phonon.natoms; i++) {
                atom_phase.push(0);
            }
        }

        for (let ix=0; ix<nx; ix++) {
            for (let iy=0; iy<ny; iy++) {
                for (let iz=0; iz<nz; iz++) {

                    for (let i=0; i<phonon.natoms; i++) {
                        let sprod = vec_dot(kpt,[ix,iy,iz]) + atom_phase[i];
                        let phase = Complex.Polar(1.0,sprod*2.0*pi);

                        //Displacements of the atoms
                        let x = Complex(veckn[i][0][0],veckn[i][0][1]).mult(phase);
                        let y = Complex(veckn[i][1][0],veckn[i][1][1]).mult(phase);
                        let z = Complex(veckn[i][2][0],veckn[i][2][1]).mult(phase);

                        vibrations.push( [x,y,z] );
                    }
                }
            }
        }

        return vibrations;
    }

    setVibrations() {
        this.vibrations = this.getVibrations(this.nx,this.ny,this.nz);
    }

    update(dispersion=true) {
        /*
        Update all the aspects fo the webpage
        */

        //update structure       
        this.getRepetitions();
        this.atoms = this.getStructure(this.nx,this.ny,this.nz);
        this.vibrations = this.getVibrations(this.nx,this.ny,this.nz);
        this.phonon.nndist = this.getBondingDistance();

        //update page
        this.updatePage();

        //update dispersion
        if (dispersion) { this.dispersion.update(this.phonon); }

        //update visualizer
        this.visualizer.update(this);
    }

    updatePage() {
        /*
        lattice vectors table
        */
        let lattice = $('#lattice');
        lattice.empty();

        for (let i=0; i<3; i++) {
            let tr = document.createElement("TR");
            for (let j=0; j<3; j++) {
                let td = document.createElement("TD");
                x = document.createTextNode(this.phonon.lat[i][j].toPrecision(4));
                td.appendChild(x);
                tr.append(td);
            }
            lattice.append(tr);
        }

        //atomic positions table
        let pos = this.phonon.atom_pos_red;
        let atompos = $('#atompos');
        atompos.empty();

        for (let i=0; i<pos.length; i++) {
            let tr = document.createElement("TR");

            let td = document.createElement("TD");
            let atom_type = document.createTextNode(this.phonon.atom_types[i]);
            td.class = "ap";
            td.appendChild(atom_type);
            tr.append(td);

            for (let j=0; j<3; j++) {
                td = document.createElement("TD");
                x = document.createTextNode(pos[i][j].toFixed(4));
                td.appendChild(x);
                tr.append(td);
            }
            atompos.append(tr);
        }

        //update title
        let title = $('#name')[0];
        while (title.hasChildNodes()) {
            title.removeChild(title.lastChild);
        }
        
        //make link
        if ("link" in this) {
            let a = document.createElement("A");
            a.href = this.link;
            a.innerHTML = this.name;
            title.appendChild(a);
        }
        else {
            title.innerHTML = this.name;
        }
    }

    updateMenu() {
        /*
        create menu with:
            1. local files (files distributed with the website)
            2. files from the phonodb database 2015 and 2017
            3. potentially more sources of data can be added
        */

        let self = this;

        let materials_list = $('#mat');
        materials_list.empty();

        let references_list = $('#ref');
        let unique_references = {};
        let nreferences = 1;

        function add_materials(materials) {

            for (let i=0; i<materials.length; i++) {

                let m = materials[i];
                
                //reference
                let ref = m["reference"];
                if (!unique_references.hasOwnProperty(ref)) {
                    unique_references[ref] = nreferences;
                    nreferences+=1;
                }

                //name + refenrece
                let name = subscript_numbers(m.name);
                let name_ref = name + " ["+unique_references[ref]+"]";

                let li = document.createElement("LI");
                let a = document.createElement("A");
                
                a.onclick = function() {
                    let url_vars = {};
                    url_vars[m.type] = m.url;
                    url_vars.name = name_ref;
                    if ("link" in m) { url_vars.link = m.link }
                    self.loadURL(url_vars);
                };

                a.innerHTML = name;
                li.appendChild(a);

                materials_list.append(li);
            }

            //add references
            references_list.empty();
            for (let ref in unique_references) {
                let i = unique_references[ref];
                let li = document.createElement("LI");
                li.innerHTML = "["+i+"] "+ref;
                references_list.append(li);
                i += 1;
            }
        }

        //local database
        let source = new LocalDB();
        source.get_materials(add_materials);

        //phonondb database
        /*source = new PhononDB();
        source.get_materials(add_materials);*/

        //local phonondb database
        source = new LocalPhononDB2015();
        source.get_materials(add_materials);

        //local phonondb database
        source = new LocalPhononDB2017();
        source.get_materials(add_materials);

    }
}

$(document).ready(function() {

    //visualizer
    v = new VibCrystal($('#vibcrystal'));
    //dispersion
    d = new PhononHighcharts($('#highcharts'));
    //phonon class
    p = new PhononWebpage(v,d);

    /*
    check if its Chrome 1+ taken from
    http://stackoverflow.com/questions/9847580/how-to-detect-safari-chrome-ie-firefox-and-opera-browser
    only show webm button for chrome
    */
    let isChrome = !!window.chrome && !!window.chrome.webstore;
    if (!isChrome) {
        $('#webmbutton')[0].style.visibility = 'hidden';
    }

    //get if the draw vectors option is activated
    v.arrows = $('#drawvectors')[0].checked;
    $('#file-input')[0].addEventListener('change', p.loadCustomFile.bind(p), false);
    $('#file-input')[0].addEventListener('click', function() { this.value = '';}, false);
    p.updateMenu();

    let url_vars = PhononWebpage.getUrlVars();
    if (url_vars) { p.loadURL(url_vars); }
    else          { p.loadURL({json: "localdb/graphene/data.json", name:"Graphene [1]"}); }

    // check if webgl is available
    if ( ! Detector.webgl ) {
        Detector.addGetWebGLMessage();
    }

    //jquery to make an action once you press enter after changing the number of repetitions
    $(".input-rep").keyup(function(event){
        if(event.keyCode == 13) p.update(dispersion=false);
    });

});
