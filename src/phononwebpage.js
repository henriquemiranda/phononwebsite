import { LocalDB } from './localdb.js';
import { ContribDB } from './contribdb.js';
import { PhononDB2015 } from './phonondb2015.js';
import { PhononDB2018 } from './phonondb2018.js';
import { LocalPhononDB2015 } from './localphonondb2015.js';
import { LocalPhononDB2018 } from './localphonondb2018.js';
import { MaterialsProjectDB } from './mpdb.js';
import { LocalMaterialsProjectDB } from './localmpdb.js';
import { PhononJson } from './phononjson.js';
import { PhononYaml } from './phononyaml.js';
import { exportXSF, exportPOSCAR }  from './exportfiles.js';
import * as mat from './mat.js';
import * as utils from './utils.js';

function SubscriptNumbers(old_string) {
    let string = "";
    for (let a of old_string) {
        if (!isNaN(a)) {
            string += "<sub>"+a+"</sub>";
        }
        else {
            string += a;
        }
    }
    return string;
}

export class PhononWebpage {

    constructor(visualizer, dispersion) {
        this.k = 0;
        this.n = 0;
        this.nx = 1;
        this.ny = 1;
        this.nz = 1;

        //select visualization
        this.visualizer = visualizer;

        //select dispersion
        this.dispersion = dispersion;

        //bind some functions (TODO: improve this)
        this.exportXSF    = exportXSF.bind(this);
        this.exportPOSCAR = exportPOSCAR.bind(this);

        //bind click event from highcharts with action
        dispersion.setClickEvent(this);

        // set null materials project API key
        this.mpapikey = null;
    }

    //functions to link the DOM buttons with this class
    setMaterialsList(dom_mat)      { this.dom_mat = dom_mat; }
    setReferencesList(dom_ref)     { this.dom_ref = dom_ref; }
    setAtomPositions(dom_atompos)  { this.dom_atompos = dom_atompos; }
    setLattice(dom_lattice)        { this.dom_lattice = dom_lattice; }
    setTitle(dom_title)            { this.dom_title = dom_title; }

    setUpdateButton(dom_button) {
        self = this;
        dom_button.click( function() { self.update(); } );
    }

    setExportXSFButton(dom_button) {
        dom_button.click(this.exportXSF.bind(this));
    }

    setExportPOSCARButton(dom_button) {
        dom_button.click(this.exportPOSCAR.bind(this));
    }

    setRepetitionsInput(dom_nx,dom_ny,dom_nz) {

        this.dom_nx = dom_nx;
        this.dom_ny = dom_ny;
        this.dom_nz = dom_nz;

        function keyup(event) {
            if(event.keyCode == 13) {
                this.update(false);
            }
        }

        dom_nx.keyup( keyup.bind(this) );
        dom_ny.keyup( keyup.bind(this) );
        dom_nz.keyup( keyup.bind(this) );
    }

    setFileInput(dom_input) {
        /* Load a custom file button
        */
        dom_input.change( this.loadCustomFile.bind(this) );
        dom_input.click( function() { this.value = '';} );
    }

    setMaterialsProjectAPIKey(dom_input, dom_button) {
        let self = this;

        // Handle button click
        dom_button.click(function () {
            console.log('click');
            self.mpapikey = dom_input[0].value;
            self.updateMenu();
        });

        // Handle Enter key press
        dom_input.keypress(function (event) {
            if (event.keyCode === 13) { // Check if Enter key is pressed
                console.log('enter');
                self.mpapikey = dom_input[0].value;
                //self.updateMenu();
            }
        });
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

    loadURL(url_vars,callback) {
        /*
        load file from post request in the url
        */

        this.k = 0;
        this.n = 0;
        delete this.link;
        if (callback == null) {
            callback = this.loadCallback.bind(this);
        }

        if ( "name" in url_vars ) {
            this.name = url_vars.name;
        }
        if ( "link" in url_vars ) {
            this.link = url_vars.link;
        }

        if ("yaml" in url_vars) {
            this.phonon = new PhononYaml();
            this.phonon.getFromURL(url_vars.yaml,callback);
        }
        else if ("json" in url_vars) {
            this.phonon = new PhononJson();
            this.phonon.getFromURL(url_vars.json,callback);
        }
        else if ("rest" in url_vars) {
            this.phonon = new PhononJson();
            this.phonon.getFromREST(url_vars.rest,url_vars.apikey,callback);
        }
        else {
            //alert("Ivalid url");
        }
    }

    getUrlVars(default_vars) {
        /*
        get variables from the url
        from http://stackoverflow.com/questions/4656843/jquery-get-querystring-from-url

        currently the possible options are:
            json : load a json file from location
            yaml : load a yaml file from location
            name : change the display name of the material
        */
        let hash;
        let vars = {};

        if (location.search) {
            let hashes = location.search.slice(1).split('&');
            for(let i = 0; i < hashes.length; i++) {
                hash = hashes[i].split('=');
                vars[hash[0]] = hash[1];
            }
        }

        //if no argument is present use the default vars
        if (Object.keys(vars).length < 1) {
            vars = default_vars;
        }

        this.loadURL(vars);
    }

    loadCallback() {
        /*
        Fuunction to be called once the file is loaded
        */
        this.setRepetitions(this.phonon.repetitions);
        this.update();
    }

    getRepetitions() {
        /*
        read the number of repetitions in each direction and update it
        */
        if (this.dom_nx) { this.nx = this.dom_nx.val(); }
        if (this.dom_ny) { this.ny = this.dom_ny.val(); }
        if (this.dom_nz) { this.nz = this.dom_nz.val(); }
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

        if (this.dom_nx) { this.dom_nx.val(this.nx); }
        if (this.dom_ny) { this.dom_ny.val(this.ny); }
        if (this.dom_nz) { this.dom_nz.val(this.nz); }
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

        let combinations = utils.getCombinations( atoms );
        let min = 1e9;
        for (let i=0; i<combinations.length; i++ ) {
            let a = combinations[i][0];
            let b = combinations[i][1];

            let dist = mat.distance(a.slice(1),b.slice(1));
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
        let atom_phase = [];
        if (phonon.addatomphase) {
            for (let i=0; i<phonon.natoms; i++) {
                let phase = mat.vec_dot(kpt,phonon.atom_pos_red[i]);
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
                        let sprod = mat.vec_dot(kpt,[ix,iy,iz]) + atom_phase[i];
                        let phase = Complex.Polar(1.0,sprod*2.0*mat.pi);

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

    update(dispersion = true) {
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

        if (this.dom_lattice)  {
            this.dom_lattice.empty();
            for (let i=0; i<3; i++) {
                let tr = document.createElement("TR");
                for (let j=0; j<3; j++) {
                    let td = document.createElement("TD");
                    let x = document.createTextNode(this.phonon.lat[i][j].toPrecision(4));
                    td.appendChild(x);
                    tr.append(td);
                }
                this.dom_lattice.append(tr);
            }
        }

        //atomic positions table
        if (this.dom_atompos) {
            this.dom_atompos.empty();
            let pos = this.phonon.atom_pos_red;
            for (let i=0; i<pos.length; i++) {
                let tr = document.createElement("TR");

                let td = document.createElement("TD");
                let atom_type = document.createTextNode(this.phonon.atom_types[i]);
                td.class = "ap";
                td.appendChild(atom_type);
                tr.append(td);

                for (let j=0; j<3; j++) {
                    let td = document.createElement("TD");
                    let x = document.createTextNode(pos[i][j].toFixed(4));
                    td.appendChild(x);
                    tr.append(td);
                }
                this.dom_atompos.append(tr);
            }
        }

        //update title
        if (this.dom_title) {
            let title = this.dom_title[0];
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
    }

    updateMenu() {
        /*
        create menu with:
            1. local files (files distributed with the website)
            2. files from the phonodb database 2015 and 2017
            3. potentially more sources of data can be added
        */

        let self = this;

        let dom_mat = this.dom_mat;
        let dom_ref = this.dom_ref;
        if (dom_mat) { dom_mat.empty(); }
        let unique_references = {};
        let nreferences = 1;

        function addMaterials(materials) {

            if (dom_mat) {
                for (let i=0; i<materials.length; i++) {

                    let m = materials[i];

                    //reference
                    let ref = m["reference"];
                    if (!unique_references.hasOwnProperty(ref)) {
                        unique_references[ref] = nreferences;
                        nreferences+=1;
                    }

                    //name + refenrece
                    let name = SubscriptNumbers(m.name);
                    let name_ref = name + " ["+unique_references[ref]+"]";

                    let li = document.createElement("LI");
                    let a = document.createElement("A");

                    a.onclick = function() {
                        let url_vars = {};
                        url_vars[m.type] = m.url;
                        url_vars.name = name_ref;
                        url_vars.apikey = m.apikey;
                        if ("link" in m) { url_vars.link = m.link }
                        self.loadURL(url_vars);
                    };

                    a.innerHTML = name;
                    li.appendChild(a);

                    dom_mat.append(li);
                }
            }

            //add references
            if (dom_ref) {
                dom_ref.empty();
                for (let ref in unique_references) {
                    let i = unique_references[ref];
                    let li = document.createElement("LI");
                    li.innerHTML = "["+i+"] "+ref;
                    dom_ref.append(li);
                    i += 1;
                }
            }
        }

        //local database
        let source = new LocalDB();
        source.get_materials(addMaterials);

        //contributions database
        source = new ContribDB();
        source.get_materials(addMaterials);

        //materials project database
        source = new MaterialsProjectDB(self.mpapikey);
        //get materials but only if the api key is valid
        let callback = function() {
                     //TODO change something in the interface to know that the API key is valid
                     source.get_materials(addMaterials);
                   }.bind(this)
        source.isAPIKeyValid(self.mpapikey,callback);

        /*
        //phonondb2015 database
        for (let sourceclass of [PhononDB2015, LocalPhononDB2015 ]) {
            source = new sourceclass;
            if (source.isAvailable()) {
                source.get_materials(addMaterials);
                break;
            }
        }

        //phonondb2018 database
        for (let sourceclass of [PhononDB2018, LocalPhononDB2018 ]) {
            source = new sourceclass;
            if (source.isAvailable()) {
                source.get_materials(addMaterials);
                break;
            }
        }

        //mp databse
        for (let sourceclass of [MaterialsProjectDB, LocalMaterialsProjectDB ]) {
            source = new sourceclass(self.mpapikey);
            if (source.isAvailable()) {
                source.get_materials(addMaterials);
                break;
            }
        }*/

    }

}
