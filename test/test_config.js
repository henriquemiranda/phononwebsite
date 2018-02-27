requirejs.config({
    baseURL: 'src',
    paths: {
        'jquery': '../libs/jquery.min',
        'threejs': '../libs/three.min',
        'highcharts': '../libs/highcharts.min',
        'complex': '../libs/complex.min',
        'jsyaml': '../libs/jsyaml_amd_wrapper',
        'detector': '../libs/Detector',
        'phononwebsite': '../build/phononwebsite'
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
            deps: ['jquery', 'highcharts', 'complex', 'threejs','jsyaml'],
            exports: ['VibCrystal','PhononHighcharts','PhononWebpage']
        }
    }
});

requirejs([
  "phononwebsite_test"
], function() {
  assert = chai.assert;
  if (window.mochaPhantomJS) { mochaPhantomJS.run(); }
  else { mocha.run(); }
});

