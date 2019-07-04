var Mocha = require('mocha');
var fs = require('fs');
var path = require('path');
var requirejs = require('requirejs');

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


// Instantiate a Mocha instance.
var mocha = new Mocha();
var testDir = 'test'

// Add each .js file to the mocha instance
fs.readdirSync(testDir).filter(function(file){
    // Only keep the .js files
    return file.substring(0,4) === 'test';

}).forEach(function(file){
    console.log('will load:', testDir+'/'+file);
    mocha.addFile(
        path.join(testDir, file)
    );
});

requirejs(["test_phononwebsite"], function() {

    // Run the tests.
    mocha.run(function(failures){
      process.on('exit', function () {
        process.exit(failures);  // exit with non-zero status if there were failures
      });
    });

});

