var pi = 3.14159265359;
var nsteps = 20.0;
//default folder
folder="graphene";

$.ajaxSetup({
    async: false
});

updateMenu = function() {
    $.getJSON('models.json', function(data) {
        var nmodels = data["nmodels"];
        var models = data["models"];
        $('#mat').empty() //clean the atomic positions table
        for (var i=0;i<nmodels;i++) {
            $('#mat').append('<li></li>');
            $('#mat li:last').append("<a href='#' onclick=\"folder=\'"+models[i]["folder"]+"\';"+
                                     "p.updateAll(jmolApplet0);\">"+models[i]["name"]+"</a>");
        }
    });
}

//class
Phonon = {
    k: 0,
    n: 0,
    animcmd: "vectors on; vectors 0.15; color vectors green; axes on; axes POSITION [5 5 %]; animation on; animation mode loop 0 0; show data;",
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
            $('#nx').val(self.repetitions[0]);
            $('#ny').val(self.repetitions[1]);
            $('#nz').val(self.repetitions[2]);
        });
    },

    getJmolStructure: function() {
 		var i,j;
        var veckn = this.vec[this.k][this.n];

		//get the number of repetitions
		nx = $('#nx').val();
		ny = $('#ny').val();
		nz = $('#nz').val();
		
		//create jmol command
		var cmd = "", cmdv = "";
        for (var t=0;t<nsteps;t++) {
		    var ni = 0;
            cmdv += "frame "+t+";";
            if (t == 0) { cmd += 	"data 'model'|"+this.natoms*nx*ny*nz+"|model|";  }
            else        { cmd += 	"data 'append'|"+this.natoms*nx*ny*nz+"|model|"; }
				
            for (var ix=0;ix<nx;ix++) {
                for (var iy=0;iy<ny;iy++) {
                    for (var iz=0;iz<nz;iz++) {				
                        for (i=0;i<this.natoms;i++) {
                            ni+=1;
                            cmd += this.atom_types[i]+" ";
                            cmdv += "{atomno="+(ni)+" and thisModel}.vXyz = {";

                            for (j=0;j<3;j++) {
                                //postions of the atoms
                                var kpt = this.kpoints[this.k];
                                var sprod = kpt[0]*ix + kpt[1]*iy + kpt[2]*iz;
                                pos = this.atom_pos_car[i][j] + ix*this.lat[0][j] + iy*this.lat[1][j] + iz*this.lat[2][j];
                                var c = Complex(veckn[i][j][0],veckn[i][j][1]);
                                dpos = c.mult(Complex.exp(Complex(0,(t/nsteps + sprod)*2.0*pi))).real();
                                cmd += (pos+dpos*0.1) + " ";
                                //vectors of the atoms
                                cmdv += c.mult(Complex.exp(Complex(0,(t/nsteps + sprod)*2.0*pi))).real() + " ";
                            }
                            cmd += '|';
                            cmdv += '};';
                        }
                    }
                }
            }
            
            if (t == 0) { cmd += "end 'model'; ";  }
            else        { cmd += "end 'append';"; }
        }
        cmd += cmdv;
        return cmd;
    },

    updateHighcharts: function(applet) {
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
        this.updateHighcharts();
        this.updatePage();
    }
};

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
							//update structure
                                        }
				}
			}
		}
	},
	legend: { enabled: false },
	series: []
};

$(document).ready(function(){
    //create the atom models menu
    updateMenu();

    p = Phonon;
    p.getModel();

    //update jsmol

    p.updateHighcharts();
    p.updatePage();

    //jquery to make an action once you change the number of repetitions
    $(".input-rep").keyup(function(event){
        if(event.keyCode == 13){
            //update structure            
        }
    });
 
});
