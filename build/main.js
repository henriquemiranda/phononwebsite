requirejs.config({
    baseURL: 'src',
    paths: {
        'jquery': '../libs/jquery.min',
        'threejs': '../libs/three.min',
        'highcharts': '../libs/highcharts.min',
        'complex': '../libs/complex.min',
        'jsyaml': '../libs/jsyaml_amd_wrapper',
        'detector': '../libs/Detector'
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
        'phononwebsite': {
            deps: ['jquery','jsyaml','highcharts','complex','threejs'],
            exports: ['VibCrystal','PhononHighcharts','PhononWebpage']
        }
    }
});

requirejs(["phononwebsite", "detector"], function(phononwebsite) {

    console.log($);
    console.log(Highcharts);
    console.log(Complex);
    console.log(THREE);
    console.log(Detector);
    console.log(jsyaml);

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
    
    v.setCellCheckbox($('#drawcell'));
    v.setWebmButton($('#webmbutton'));
    v.setGifButton($('#gifbutton'));
    v.setArrowsCheckbox($('#drawvectors'));
    v.setArrowsInput($('#vectors_amplitude_range'));
    v.setSpeedInput($('#speed_range'));
    v.setAmplitudeInput($('#amplitude_box'),$('#amplitude_range'));
    v.setPlayPause($('#playpause'));

    //bind click event from highcharts with action
    d.setClickEvent(p);

    // check if webgl is available
    if ( ! Detector.webgl ) {
        Detector.addGetWebGLMessage();
    }
});
