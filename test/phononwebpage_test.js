requirejs.config({
    baseUrl: '../js',
    paths: {
        'jquery': '../js/jquery.min',
        'threejs': '../js/three.min',
        'complex': '../js/complex.min',
        'stats': '../js/stats.min',
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

assert = chai.assert;

describe('PhononWebpage', function() {
    describe('initize all the classes', function() {

        it('initialize the classes', function() { 
            requirejs(["jquery", "vibcrystal", "phononhighcharts","phononweb", "Detector"],
                function(jquery, VibCrystal, PhononHighcharts, PhononWebpage, Detector) {

                //visualizer
                v = new VibCrystal($('#vibcrystal'));
                //dispersion
                d = new PhononHighcharts($('#highcharts'));
                //phonon class
                p = new PhononWebpage(v,d);

                assert.equal(1, 1); // 4 is not present in this array so indexOf returns -1

            });
        })

    });
});



