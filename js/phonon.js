var pi = 3.14159265359;
//default folder
folder="graphene";

$.ajaxSetup({
    async: false
});

//class
Phonon = {
    k: 0,
    n: 0,
    nx: 1,
    ny: 1,
    nz: 1,

    getRepetitions: function() {
        this.nx = $('#nx').val();
        this.ny = $('#ny').val();
        this.nz = $('#nz').val();
        this.getStructure() //calculate postions
        this.getVibrations() //calculate vibrations
    },

    //This function reads the JSON data for the model
    getModel: function() {
        self = this;
        this.k=0;
        this.n=0;
        $.getJSON(folder+'/data.json', function(data) {
            self.name = data["name"];
            self.natoms = data["natoms"];
            self.atom_types = data["atom_types"];
            self.atom_numbers = data["atom_numbers"];
            self.atomic_numbers = data["atomic_numbers"];
            self.atom_pos_car = data["atom_pos_car"];
            self.atom_pos_red = data["atom_pos_red"];
            self.nndist = data["nndist"];
            self.lat = data["lattice"];
            self.vec = data["vectors"];
            self.kpoints = data["kpoints"];
            self.formula = data["formula"];
            self.highcharts = data["highcharts"]
            self.highsym_qpts = data["highsym_qpts"]
            self.repetitions = data["repetitions"];
        });
        $('#nx').val(this.repetitions[0]);
        $('#ny').val(this.repetitions[1]);
        $('#nz').val(this.repetitions[2]);
        this.getRepetitions();
    },

    getStructure: function() {
 		var i,j;
        var veckn = this.vec[this.k][this.n];
        var x,y,z;
        var lat = this.lat;
        var apc = this.atom_pos_car;
        var atoms = [];

		//create jmol command
        for (var ix=0;ix<this.nx;ix++) {
            for (var iy=0;iy<this.ny;iy++) {
                for (var iz=0;iz<this.nz;iz++) {
                    for (i=0;i<this.natoms;i++) {

                        //postions of the atoms
                        x = apc[i][0] + ix*lat[0][0] + iy*lat[1][0] + iz*lat[2][0];
                        y = apc[i][1] + ix*lat[0][1] + iy*lat[1][1] + iz*lat[2][1];
                        z = apc[i][2] + ix*lat[0][2] + iy*lat[1][2] + iz*lat[2][2];

                        atoms.push( [i,x,y,z] );
                    }
                }
            }
        }

        this.atoms = atoms;
        return atoms;
    },

    getVibrations: function() {
 		var i,j,n=0;
        var veckn = this.vec[this.k][this.n];
        var vibrations = [];
        var kpt = this.kpoints[this.k];

        for (var ix=0;ix<this.nx;ix++) {
            for (var iy=0;iy<this.ny;iy++) {
                for (var iz=0;iz<this.nz;iz++) {

                    var sprod = kpt[0]*ix + kpt[1]*iy + kpt[2]*iz;
                    var phase = Complex.Polar(1,sprod*2.0*pi);

                    for (i=0;i<this.natoms;i++) {

                        //Displacements of the atoms
                        x = Complex(veckn[i][0][0],veckn[i][0][1]).mult(phase);
                        y = Complex(veckn[i][1][0],veckn[i][1][1]).mult(phase);
                        z = Complex(veckn[i][2][0],veckn[i][2][1]).mult(phase);

                        vibrations.push( [x,y,z] );
                    }
                }
            }
        }

        this.vibrations = vibrations;
        return vibrations;
    },

    updateHighcharts: function(applet) {
        var HighchartsOptions = {
            chart: { type: 'line'},
            title: { text: 'Phonon dispersion' },
            xAxis: { title: { text: 'q-point' },
                     plotLines: [] },
            yAxis: { min: 0,
                     title: { text: 'Frequency (cm-1)' },
                     plotLines: [ {value: 0, color: '#808080' } ] },
            tooltip: { valueSuffix: 'cm-1' },
            plotOptions: {
                line: {
                    animation: false
                },
                series: {
                    cursor: 'pointer',
                    point: { events: {
                         click: function(event) {
                                    p.k = this.x;
                                    p.n = this.series.name;
                                    p.getVibrations();
                                    v.updateObjects(p);
                                                }
                        }
                    }
                }
            },
            legend: { enabled: false },
            series: []
        };

        HighchartsOptions.series = this.highcharts;
        HighchartsOptions.xAxis.plotLines = this.highsym_qpts;
        $('#highcharts').highcharts(HighchartsOptions);
    },


    updatePage: function() {
        //lattice vectors table
        var i, j;
        for (i=0;i<3;i++) {
            for (j=0;j<3;j++) {
                $('#uc_'+i+j).html( this.lat[i][j] );
            }
        }

        //unit cell table
        $('#uc_natoms').html( this.natoms );
        $('#uc_atypes').html( this.formula );

        //atomic positions table
        var pos = this.atom_pos_red;
        $('#atompos').empty() //clean the atomic positions table
        for (i=0;i<this.natoms;i++) {
            $('#atompos').append('<tr></tr>');
            $('#atompos tr:last').append('<td class="ap">'+this.atom_types[i]+'</td>');
            for (j=0;j<3;j++) {
                $('#atompos tr:last').append('<td>'+pos[i][j]+'</td>');
            }
        }

        //update title
        $('#t1').html(this.name);
    }

};

function updateAll() {
    p.getModel();
    p.updateHighcharts();
    p.updatePage();
    v.updateObjects(p);
}

function updateMenu() {
    $.getJSON('models.json', function(data) {
        var nmodels = data["nmodels"];
        var models = data["models"];
        $('#mat').empty() //clean the atomic positions table
        for (var i=0;i<nmodels;i++) {
            $('#mat').append('<li></li>');
            $('#mat li:last').append("<a href='#' onclick=\"folder=\'"+models[i]["folder"]+"\';"+
                                     "updateAll();\">"+models[i]["name"]+"</a>");
        }
    });
}

$(document).ready(function(){

    updateMenu();

    p = Phonon;
    v = VibCrystal;

    p.getModel();

    if ( ! Detector.webgl ) Detector.addGetWebGLMessage();
    v.init($('#vibcrystal'),p);
    v.animate();

    p.updateHighcharts();
    p.updatePage();

    //jquery to make an action once you change the number of repetitions
    $(".input-rep").keyup(function(event){
        if(event.keyCode == 13){
            v.pause();
            p.getRepetitions();
            v.updateObjects(p);
        }
    });

});
