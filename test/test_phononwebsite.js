define(["phononwebsite"],
        function(phononwebsite) {

        VibCrystal = phononwebsite.VibCrystal;
        PhononHighcharts = phononwebsite.PhononHighcharts;
        PhononWebpage = phononwebsite.PhononWebpage;

        return describe('PhononWebpage', function() {
            describe('initize the classes', function() {

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
            });
            
            describe('test the classes', function() {

                it('p.updateMenu()', function() {
                    v = new VibCrystal($('#vibcrystal'));
                    d = new PhononHighcharts($('#highcharts'));
                    p = new PhononWebpage(v,d);
                    assert(p instanceof PhononWebpage,    'p is instance of PhononWebpage'); 
                    p.updateMenu();
                });

                it('load a phononwebsite json file', function() {
                    vj = new VibCrystal($('#vibcrystaljsonweb'));
                    dj = new PhononHighcharts($('#highchartsjsonweb'));
                    pj = new PhononWebpage(vj,dj);
                    pj.loadURL({json: "localdb/graphene/data.json", name:"Graphene Phononwebsite"});
                });

                it('load a pymatgen phonon json', function() {
                    v = new VibCrystal($('#vibcrystaljsonpmg'));
                    d = new PhononHighcharts($('#highchartsjsonpmg'));
                    p = new PhononWebpage(v,d);
                    p.loadURL({json: "tests/pymatgen/mp-149_pmg_bs.json", name: "Silicon PMG"});
                });

                it('load a phonopy yaml', function() {
                    vy = new VibCrystal($('#vibcrystalyaml'));
                    dy = new PhononHighcharts($('#highchartsyaml'));
                    py = new PhononWebpage(vy,dy);
                    py.loadURL({yaml: "tests/phonopy/band.yaml", name: "Graphene Phonopy"});
                });

                it('export with gif', function() {
                    v = new VibCrystal($('#vibcrystaljson'));
                    d = new PhononHighcharts($('#highchartsjson'));
                    p = new PhononWebpage(v,d);
                    //setTimeout(function(){v.capturestart('gif');},5000);
                });

            });
        });
});
