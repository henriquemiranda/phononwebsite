const pi = 3.14159265359;
const bohr2ang = 0.529177249;

//default folder
var folder = "graphene";

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

    loadCustomFile(event) {
        /*
        find the type of file and call the corresponding function to read it

        two formats available:
            phonopy files (band.yaml)
            internal .json format (*.json) description available in ./phononweb/phononweb.py
        */

        let yaml = null;
        let json = null;

        for (let i=0; i<event.target.files.length; i++) {
            let file = event.target.files[i];
            if (file.name.indexOf(".yaml") > -1) { yaml = file; }
            if (file.name.indexOf(".json") > -1) { json = file; }
        }

        this.name = "Custom file"
        if      (json) { 
            this.phonon = new PhononJson();
            this.phonon.getFromFile(json, this.loadCallback.bind(this) );
        }
        else if (yaml) { 
            this.phonon = new PhononYaml();
            this.phonon.getFromFile(yaml, this.loadCallback.bind(this) );
        }
        else { 
            alert("Ivalid file"); 
        }
    }

    loadURL(url_vars) {  
        /*
        load file from post request in the url
        
        two formats available:
            phonopy files (band.yaml)
            internal .json format (*.json) description available in ./phononweb/phononweb.py
        */

        let yaml = null;
        let json = null;

        for (let key in url_vars) {
            if ( key == "yaml" ) { yaml = $.get(url_vars[key]).responseText; }
            if ( key == "json" ) { json = $.get(url_vars[key]).responseText; }
            if ( key == "name" ) { $('#t1').html(url_vars[key]);     }
        }

        this.name = "Custom file"
        if      (json) { 
            this.phonon = new PhononJson();
            this.phonon.getFromString(json, this.loadCallback.bind(this) );
        }
        else if (yaml) { 
            this.phonon = new PhononYaml();
            this.phonon.getFromString(yaml, this.loadCallback.bind(this) );
        }
        else { 
            alert("Ivalid url"); 
        }
    }

    loadId(id) {
        /*
        load a material from phonodb
        http://phonondb.mtl.kyoto-u.ac.jp
        */

        this.loadURL( { yaml: this.materials[id]['url'] } );
        this.name = this.materials[id]['name'] +  " <a href='https://www.materialsproject.org/materials/mp-"+id+"'>mp-"+id+"</a>";
        this.update();
    }

    loadLocal() {
        /*
        read structure from a local file distributed with the repository
        */
 
        let readJson = function(string) {
            this.phonon = new PhononJson();
            this.phonon.getFromString(string, this.loadCallback.bind(this) );
        }

        $.get(folder+'/data.json', readJson.bind(this), "html" );
    }

    loadCallback() {
        /*
        Fuunction to be called once the file is loaded
        */
        this.setRepetitions(this.phonon.repetitions);
        this.update() 
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
        replicate the atoms two times in each direction
        */
        let atoms = this.getStructure(2,2,2);

        let combinations = getCombinations( atoms );
        let min = 1e9;
        for (let i=0; i<combinations.length; i++ ) {
            let a = combinations[i][0];
            let b = combinations[i][1];

            let distance = dist(a.slice(1),b.slice(1));
            if (min > distance) {
                min = distance;
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
                let phase = kpt[0]*phonon.atom_pos_red[i][0] + 
                        kpt[1]*phonon.atom_pos_red[i][1] + 
                        kpt[2]*phonon.atom_pos_red[i][2];
                atom_phase.push(phase);
            }
        }
        else {
            for (let i=0; i<phonon.natoms; i++) {
                atom_phase.push(0);
            }
        }

        for (var ix=0; ix<nx; ix++) {
            for (var iy=0; iy<ny; iy++) {
                for (var iz=0; iz<nz; iz++) {

                    for (let i=0; i<phonon.natoms; i++) {
                        let sprod = kpt[0]*ix + kpt[1]*iy + kpt[2]*iz + atom_phase[i];
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

    updatePage() {
        /*
        lattice vectors table
        */

        for (let i=0; i<3; i++) {
            for (let j=0; j<3; j++) {
                //round lattice values
                $('#uc_'+i+j).html( this.phonon.lat[i][j].toPrecision(5) );
            }
        }

        //unit cell table
        $('#uc_natoms').html( this.phonon.natoms );
        $('#uc_atypes').html( this.phonon.formula );

        //atomic positions table
        let pos = this.phonon.atom_pos_red;
        $('#atompos').empty() //clean the atomic positions table
        for (let i=0; i<this.phonon.natoms; i++) {
            $('#atompos').append('<tr></tr>');
            $('#atompos tr:last').append('<td class="ap">'+this.phonon.atom_types[i]+'</td>');
            for (let j=0; j<3; j++) {
                $('#atompos tr:last').append('<td>'+pos[i][j].toFixed(4)+'</td>');
            }
        }

        //update title
        $('#t1').html(this.name);
    }

    update() {
        /*
        Update all the aspects fo the webpage
        */

        this.getRepetitions();
        this.atoms = this.getStructure(this.nx,this.ny,this.nz);
        this.vibrations = this.getVibrations(this.nx,this.ny,this.nz);
        this.phonon.nndist = this.getBondingDistance();

        //update page
        this.updatePage();

        //update dispersion
        this.dispersion.update(this.phonon);

        //update visualizer
        this.visualizer.update(this);
    }

    createPhonodbMenu(phonodb) {
        /*
        Create the phonondb menu
        */

        $("#div-phonodb").css('display', 'inline')
        let materials = jsyaml.load(phonodb);
        let materials_ref = {}
        $('#phonodb').empty()
        for (let i=0;i<materials.length;i++) {
            let material = materials[i];
            materials_ref[material['id']] = material
            $('#phonodb').append('<li></li>');
            $('#phonodb li:last').append("<a href='#' onclick='p.loadId("+material['id']+")'>"+material['name']+"</a>");
        }
        this.materials = materials_ref;
    }

    static updateMenu() {
        /*
        create menu with:
            local files (files distributed with the website)
            files from the phonodb database
        */

        //get a list of local materials
        $.getJSON('models.json', function(data) {
            let nmodels = data["nmodels"];
            let models  = data["models"];
            $('#mat').empty() //clean the atomic positions table

            for (let i=0; i<nmodels; i++) {
                $('#mat').append('<li></li>');
                $('#mat li:last').append("<a href='#' onclick=\"folder=\'"+models[i]["folder"]+"\';"+
                                         "p.loadLocal(); p.update();\">"+models[i]["name"]+"</a>");
            }
        });

        //get a list of materials from phonodb
        $.get('phonondb.yaml', PhononWebpage.createPhonodbMenu);
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
    PhononWebpage.updateMenu();

    let url_vars = PhononWebpage.getUrlVars();
    if (url_vars) { p.loadURL(url_vars); }
    else          { p.loadLocal();       }

    // check if webgl is available
    if ( ! Detector.webgl ) {
        Detector.addGetWebGLMessage();
    }

    //jquery to make an action once you change the number of repetitions
    $(".input-rep").keyup(function(event){
        if(event.keyCode == 13) p.update();
    });

});
