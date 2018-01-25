requirejs.config({
    paths: {
        'jquery': 'jquery.min',
        'threejs': 'three.min',
        'complex': 'complex.min',
        'stats': 'stats.min',
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
        'highcharts': {
            deps: ["jquery"],
            exports: "Highcharts"
        },
        'Detector': {
            exports: "Detector"
        },
        'TrackballControls': {
            deps: ['threejs'],
            exports: 'THREE.TrackballControls'
        }
    }
});

requirejs(["jquery", "vibcrystal", "phononhighcharts","phononweb", "Detector"], 
        function(jquery, VibCrystal, PhononHighcharts, PhononWebpage, Detector) {

    //visualizer
    v = new VibCrystal($('#vibcrystal'));
    //dispersion
    d = new PhononHighcharts($('#highcharts'));
    //phonon class
    p = new PhononWebpage(v,d);

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
    p.getUrlVars();

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
    v.setAmplitudeInput($('#amplitude_box'),$('#amplitude_range'))
    v.setPlayPause($('#playpause'))

    //bind click event from highcharts with action
    d.setClickEvent(p);

    // check if webgl is available
    if ( ! Detector.webgl ) {
        Detector.addGetWebGLMessage();
    }
});
