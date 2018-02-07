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

describe('PhononJson', function() {
    describe('loadJSON', function() {
        it('load phononwebsite json file', function(){

        assert.equal(-1, [1,2,3].indexOf(4)); // 4 is not present in this array so indexOf returns -1
        })
    })
});
