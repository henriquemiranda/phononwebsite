define(["phononwebsite"],
        function(phononwebsite) {

        VibCrystal = phononwebsite.VibCrystal;
        PhononHighcharts = phononwebsite.PhononHighcharts;
        PhononWebpage = phononwebsite.PhononWebpage;

        describe('PhononWebpage', function() {
            describe('initize all the classes', function() {

                it('initialize VibCrystal as v', function() { 
                    v = new VibCrystal($('#vibcrystal'));
                    assert(v instanceof VibCrystal,       'v is instance of VibCrystal'); 
                });

                it('initialize PhononHighcharts as d', function() { 
                    d = new PhononHighcharts($('#highcharts'));
                    assert(d instanceof PhononHighcharts, 'd is instance of PhononHighcharts'); 
                });

                it('initialize PhononWebpage as p', function() { 
                    p = new PhononWebpage(v,d);
                    assert(p instanceof PhononWebpage,    'p is instance of PhononWebpage'); 
                });

                it('p.updateMenu()', function() {
                    p.updateMenu();
                });

                function verify() {
                    a = 1;
                    //assert.isDefined(p.phonon.vec);
                }

                it('load a phononwebsite json file', function() {
                    p.getUrlVars({json: "localdb/graphene/data.json", name:"Graphene Phononwebsite"},verify);
                });

                it('load a phonopy yaml', function() {
                    p.getUrlVars({yaml: "tests/phonopy/band.yaml", name: "Graphene Phonopy"},verify);
                });

                it('load a pymatgen phonon json', function() {
                    p.getUrlVars({json: "tests/pymatgen/mp-149_pmg_bs.json", name: "Silicon PMG"},verify);
                });

            });
        });
});
