define(["jquery", "vibcrystal", "phononhighcharts","phononweb", "Detector"],
        function(jquery, VibCrystal, PhononHighcharts, PhononWebpage, Detector) {

        describe('PhononWebpage', function() {
            describe('initize all the classes', function() {

                it('initialize the classes', function() { 
                    //visualizer
                    v = new VibCrystal($('#vibcrystal'));
                    //dispersion
                    d = new PhononHighcharts($('#highcharts'));
                    //phonon class
                    p = new PhononWebpage(v,d);

                    assert.equal(1, 1); // 4 is not present in this array so indexOf returns -1

                });
            });
        });
});
