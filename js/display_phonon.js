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
        var self = this;
        self.nx = $('#nx').val();
        self.ny = $('#ny').val();
        self.nz = $('#nz').val();
    },

    //This function reads the JSON data for the model 
    getModel: function() {
        var self = this;
        this.k=0;
        this.n=0;
        $.getJSON(folder+'/data.json', function(data) {
            self.name = data["name"];
            self.natoms = data["natoms"];
            self.atom_types = data["atom_types"];
            self.atom_pos_car = data["atom_pos_car"];
            self.atom_pos_red = data["atom_pos_red"];
            self.lat = data["lattice"];
            self.vec = data["vectors"];
            self.kpoints = data["kpoints"];
            self.formula = data["formula"];
            self.highcharts = data["highcharts"]
            self.highsym_qpts = data["highsym_qpts"]
            //repetitions
            self.repetitions = data["repetitions"];
            self.nx = $('#nx').val(self.repetitions[0]);
            self.ny = $('#ny').val(self.repetitions[1]);
            self.nz = $('#nz').val(self.repetitions[2]);
            self.getRepetitions();
        });
    },
 
    getVibmolStructure: function() {
        var self = this;
 		var i,j,n=0;
        var veckn = this.vec[this.k][this.n];
        var r=0.5, lat=20, lon=10;
        var pos = [0,0,0];
        var objects = [];	

		//create jmol command
        for (var ix=0;ix<this.nx;ix++) {
            for (var iy=0;iy<this.ny;iy++) {
                for (var iz=0;iz<this.nz;iz++) {				
                    for (i=0;i<this.natoms;i++) {
                        object = self.objects[ n ];
                        
                        //postions of the atoms
                        for (j=0;j<3;j++) {
                            pos[j] = self.atom_pos_car[i][j] + ix*self.lat[0][j]
                                                             + iy*self.lat[1][j]
                                                             + iz*self.lat[2][j];
                        }                       
 
                        object.position.set(pos[0],pos[1],pos[2]);
                        n+=1;
                    }
                }
            }
        }
    },

    getVibmolObjects: function() {
        var self = this;
 		var i,j;
        var veckn = this.vec[this.k][this.n];
        var r=0.5, lat=20, lon=10;
        var pos = [0,0,0];
        var objects = [];	

        var material = new THREE.MeshLambertMaterial( { color: 0xffaa00, 
                                                      blending: THREE.AdditiveBlending } );

		//create jmol command
        for (var ix=0;ix<this.nx;ix++) {
            for (var iy=0;iy<this.ny;iy++) {
                for (var iz=0;iz<this.nz;iz++) {				
                    for (i=0;i<this.natoms;i++) {
                        
                        //postions of the atoms
                        for (j=0;j<3;j++) {
                            pos[j] = self.atom_pos_car[i][j] + ix*self.lat[0][j]
                                                             + iy*self.lat[1][j]
                                                             + iz*self.lat[2][j];
                        }                       
 
                        object = new THREE.Mesh( new THREE.SphereGeometry(r,lat,lon), material );
                        object.position.set(pos[0],pos[1],pos[2]);
                        object.name = "atom";
                        objects.push(object);
                    }
                }
            }
        }
        self.objects = objects;
        return objects;
    },

    getVibmolVibrations: function(t) {
        var self = this;
 		var i,j,n=0;
        var veckn = self.vec[self.k][self.n];
        var object;

		//create jmol command
        for (var ix=0;ix<self.nx;ix++) {
            for (var iy=0;iy<self.ny;iy++) {
                for (var iz=0;iz<self.nz;iz++) {
                    for (i=0;i<self.natoms;i++) {
                        object = self.objects[ n ];
 
                        //Displacements of the atoms
                        kpt = self.kpoints[self.k];
                        sprod = kpt[0]*ix + kpt[1]*iy + kpt[2]*iz;
                        
                        x = Complex(veckn[i][0][0],veckn[i][0][1]);
                        y = Complex(veckn[i][1][0],veckn[i][1][1]);
                        z = Complex(veckn[i][2][0],veckn[i][2][1]);
                        object.position.x += x.mult(Complex.exp(Complex(0,(t+sprod)*2.0*pi))).real();
                        object.position.y += y.mult(Complex.exp(Complex(0,(t+sprod)*2.0*pi))).real();
                        object.position.z += z.mult(Complex.exp(Complex(0,(t+sprod)*2.0*pi))).real();
                        
                        n+=1;
                    }
                }
            }
        }
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
                series: {
                    cursor: 'pointer',
                    point: { events: {
                         click: function(event) {
                                    Phonon.k = this.x;
                                    Phonon.n = this.series.name;
                                    Phonon.getVibmolStructure();
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
        
        //atomic postions table
        var pos = this.atom_pos_red;
        $('#ap').empty() //clean the atomic positions table
        for (i=0;i<this.natoms;i++) {
            $('#ap').append('<tr></tr>');
            for (j=0;j<3;j++) {
                $('#ap tr:last').append('<td>'+pos[i][j]+'</td>');
            }
        }
        
        //update title
        $('#t1').html(this.name);
    },
    
    updateAll: function(jmolApplet0) {
        this.getModel();
        updateObjects(p);
        this.updateHighcharts();
        this.updatePage();
    }
};

function updateMenu() {
    $.getJSON('models.json', function(data) {
        var nmodels = data["nmodels"];
        var models = data["models"];
        $('#mat').empty() //clean the atomic positions table
        for (var i=0;i<nmodels;i++) {
            $('#mat').append('<li></li>');
            $('#mat li:last').append("<a href='#' onclick=\"folder=\'"+models[i]["folder"]+"\';"+
                                     "p.updateAll();\">"+models[i]["name"]+"</a>");
        }
    });
}

$(document).ready(function(){

    p = Phonon;

    p.getModel();

    if ( ! Detector.webgl ) Detector.addGetWebGLMessage();
    var container, stats;
    var camera, controls, scene, renderer;
    vibmol(p);
    animate();

    updateMenu();
    p.updateHighcharts();
    p.updatePage();

    //jquery to make an action once you change the number of repetitions
    $(".input-rep").keyup(function(event){
        if(event.keyCode == 13){
            pause();
            p.getRepetitions();
            updateObjects(p);
        }
    });
 
});
