requirejs.config({
    baseURL: 'src',
    paths: {
        'jquery': '../libs/jquery.min',
        'threejs': '../libs/three.min',
        'highcharts': '../libs/highcharts.min',
        'complex': '../libs/complex.min',
        'jsyamlwrapper': '../libs/jsyaml_amd_wrapper',
        'jsyaml': '../libs/js-yaml.min',
        'detector': '../libs/Detector',
        'ccapture': '../libs/CCapture',
        'gif': '../libs/gif',
        'whammy': '../libs/Whammy'
    },
    shim: {
        'jquery': {
            exports: '$'
        },
        'threejs': {
            exports: 'THREE'
        },
        'complex': {
            exports: "Complex"
        },
        'detector': {
            exports: "Detector"
        },
        'highcharts': {
            deps: ["jquery"],
            exports: "Highcharts"
        },
        'ccapture': {
            deps: ["whammy","gif"]
        },
        'phononwebsite': {
            deps: ['jquery','jsyamlwrapper','highcharts','complex','threejs','ccapture'],
            exports: ['VibCrystal','PhononHighcharts','PhononWebpage']
        }
    }
});

requirejs(["phononwebsite", "detector"], function(phononwebsite) {

    //visualizer
    v = new phononwebsite.VibCrystal($('#vibcrystal'));
    //dispersion
    d = new phononwebsite.PhononHighcharts($('#highcharts'));
    //phonon class
    p = new phononwebsite.PhononWebpage(v,d);

    //set dom objects phononwebsite
    p.setMaterialsList( $('#mat') );
    p.setReferencesList( $('#ref') );
    p.setAtomPositions( $('#atompos') );
    p.setLattice( $('#lattice') );
    p.setRepetitionsInput( $('#nx'), $('#ny'), $('#nz') );
    p.setUpdateButton( $('#update') );
    p.setFileInput( $('#file-input') );
    p.setExportPOSCARButton($('#poscar'));
    p.setExportXSFButton($('#xsf'));
    p.setTitle($('#name'));

    p.updateMenu();
    p.getUrlVars({json: "localdb/graphene/data.json", name:"Graphene [1]"});

    //set dom objects vibcrystal
    v.setCameraDirectionButton($('#camerax'),'x');
    v.setCameraDirectionButton($('#cameray'),'y');
    v.setCameraDirectionButton($('#cameraz'),'z');

    v.setDisplayCombo($('#displaystyle'));
    v.setCellCheckbox($('#drawcell'));
    v.setWebmButton($('#webmbutton'));
    v.setGifButton($('#gifbutton'));
    v.setArrowsCheckbox($('#drawvectors'));
    v.setArrowsInput($('#vectors_amplitude_range'));
    v.setSpeedInput($('#speed_range'));
    v.setAmplitudeInput($('#amplitude_box'),$('#amplitude_range'));
    v.setPlayPause($('#playpause'));

    // check if webgl is available
    if ( ! Detector.webgl ) {
        Detector.addGetWebGLMessage();
    }
});
