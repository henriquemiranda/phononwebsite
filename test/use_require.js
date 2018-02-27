requirejs.config({
    baseURL: 'src',
    paths: {
        'jquery': '../libs/jquery.min',
        'threejs': '../libs/three.min',
        'highcharts': '../libs/highcharts.min',
        'complex': '../libs/complex.min',
        'jsyaml': '../libs/jsyaml_amd_wrapper',
        'detector': '../libs/Detector',
        'ccapture': '../libs/CCapture.min',
        'gif': '../libs/gif',
        'phononwebsite': '../build/phononwebsite.min',
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
        'gif': {
            exports: "GIF"
        },
        'ccapture': {
            exports: "CCapture"
        },
        'phononwebsite': {
            deps: ['jquery','highcharts','complex','threejs','jsyaml','ccapture','gif'],
            exports: ['VibCrystal','PhononHighcharts','PhononWebpage']
        }
    }
});

requirejs(["test_phononwebsite"], function() {

  assert = chai.assert;
  if (window.mochaPhantomJS) { mochaPhantomJS.run(); }
  else { mocha.run(); }

});

