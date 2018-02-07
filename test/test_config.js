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

require([
  '../test/phononwebpage_test',
  '../test/phononjson_test'

], function() {
  assert = chai.assert;
  if (window.mochaPhantomJS) { mochaPhantomJS.run(); }
  else { mocha.run(); }
});

