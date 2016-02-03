var pi = 3.14159265359;
var thz2ev = 33.35641;
var bohr2ang = 0.529177249;
//default folder
folder="graphene";

//auxiliary functions
function unique(a) {
  var i, b = {};
  for (i=0; i<a.length; i++) {
    b[a[i]] = 0;
  }
  return Object.keys(b);
}

//this should DEFINITELY be avoided in the future!
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
    amplitude: 1,

    getRepetitions: function() {
      this.nx = $('#nx').val();
      this.ny = $('#ny').val();
      this.nz = $('#nz').val();
      this.getStructure() //calculate postions
      this.getVibrations() //calculate vibrations
    },

    getBondingDistance: function(atoms) {
      var combinations = getCombinations( atoms );
      var min = 1e9;
      for (i=0; i<combinations.length; i++ ) {
        a = combinations[i][0];
        b = combinations[i][1];

        distance = dist(a,b);
        if (min > distance) {
          min = distance;
        }
      }
      return min;
    },

    getFromFile: function(event) {
      //check which is which
      var file_band, file_disp;
      var disp_reader = new FileReader();
      var band_reader = new FileReader();
      var processedFiles = 0;
      var supercell_lat, rec, lat, nqpoint, npath, phonon, sc_atoms;
      var self = this;

      band_reader.onloadend = function(e) {
                                            var phononyaml = jsyaml.load(band_reader.result);

                                            rec = phononyaml['reciprocal_lattice'];
                                            nqpoint = phononyaml['nqpoint'];
                                            npath = phononyaml['npath'];
                                            phonon = phononyaml['phonon'];

                                            onLoadEndHandler();
                                          }

      disp_reader.onloadend = function(e) {
                                            var phononyaml = jsyaml.load(disp_reader.result);

                                            sc_atoms = phononyaml['atoms'];
                                            supercell_lat = phononyaml['lattice'];

                                            onLoadEndHandler();
                                          }

      //read the files
      for (i=0; i<event.target.files.length; i++) {
        file = event.target.files[i]
        if (file.name == "disp.yaml") { disp_reader.readAsText(file); }
        if (file.name == "band.yaml") { band_reader.readAsText(file); }
        if (file.name.indexOf(".json") > -1) { alert('Json file'); }
      }

      function onLoadEndHandler() {
        processedFiles++;
        if(processedFiles == 2){
          //calculate the lattice
          lat = matrix_transpose(matrix_inverse(rec));

          //get the number of repetitions
          nx = Math.round(vec_norm(supercell_lat[0])/vec_norm(lat[0]));
          ny = Math.round(vec_norm(supercell_lat[1])/vec_norm(lat[1]));
          nz = Math.round(vec_norm(supercell_lat[2])/vec_norm(lat[2]));

          //get the atoms inside the unit cell
          var pos,x,y,z,atom_types = [], atom_numbers = [] ;
          var atomic_numbers = {}, pc_atoms_car = [], pc_atoms = [];
          var places = 100000; //number of decimal places
          for (i=0; i<sc_atoms.length; i++) {
            pos = sc_atoms[i].position;

            //round the components
            x = Math.round(pos[0]*nx * places)/places;
            y = Math.round(pos[1]*ny * places)/places;
            z = Math.round(pos[2]*nz * places)/places;

            //get the atoms in the unit cell
            var n=0;
            if (( x>=0 && x<1) && ( y>=0 && y<1) && ( z>=0 && z<1)) {
              symbol = sc_atoms[i]['symbol'];
              atom_numbers.push(atomic_number[sc_atoms[i]['symbol']]);
              atom_types.push(sc_atoms[i]['symbol']);
              pc_atoms.push([x,y,z]);
              pc_atoms_car.push(red_car([x,y,z],lat));
            }
          }
          self.natoms = pc_atoms.length;

          //get the bonding distance
          self.nndist = self.getBondingDistance(sc_atoms.map(function(x){ return red_car(x.position,supercell_lat) }));

          //get the phonon dispersion
          var kpoints = [], eivals, eivecs = [];
          var nbands = self.natoms*3;
          var n, phononi, phononiband;

          var nqpointperpath = nqpoint/npath, p, index;
          var highcharts = [], highsym_qpts = [];
          self.qindex = {};
          for (p=0; p<npath; p++) {
            //clean eivals array
            eivals = [];
            for (i=0; i<nbands; i++) {
              eivals.push([]);
            }

            //vertical lines
            if (p != 0) {
              highsym_qpts.push({ "value": phononi['distance'], "color": 'black', "width": 1 });
            }

            for (i=0; i<nqpointperpath; i++) {
              index = p*nqpointperpath+i;
              phononi = phonon[index];
              kpoints.push(phononi['q-position']);

              //create bands
              phononiband = phononi['band'];
              eivec = [];
              for (n=0; n<nbands; n++) {
                eivals[n].push([phononi['distance'],phononiband[n]['frequency']*thz2ev]);
                self.qindex[ phononi['distance'] ] = index-p;
                eivec.push(phononiband[n]['eigenvector']);
              }
              eivecs.push(eivec);
            }

            for (i=0; i<nbands; i++) {
              highcharts.push({
                                name:  i.toString(),
                                color: "#0066FF",
                                marker: { radius: 2,
                                          symbol: "circle"},
                                data: eivals[i]
                              });
            }
          }

          self.addatomphase = true;
          self.atom_types = atom_types;
          self.atom_numbers = atom_numbers;
          self.atomic_numbers = unique(atom_numbers).map(function(x) { return parseInt(x)});
          self.atom_pos_car = pc_atoms_car;
          self.atom_pos_red = pc_atoms;
          self.lat = lat;
          self.vec = eivecs;
          self.kpoints = kpoints;
          self.formula = atom_types.join('');
          self.highcharts = highcharts;
          self.highsym_qpts = highsym_qpts;
          self.repetitions = [nx,ny,nz];

          $('#nx').val(self.repetitions[0]);
          $('#ny').val(self.repetitions[1]);
          $('#nz').val(self.repetitions[2]);
          self.getRepetitions();

          update();
        }
      }

    },

    //This function reads the JSON data for the model
    getModel: function() {
        self = this;
        this.k=0;
        this.n=0;
        this.addatomphase=false;
        $.getJSON(folder+'/data.json', function(data) {
            self.name = data["name"];
            self.natoms = data["natoms"];
            self.atom_types = data["atom_types"];
            self.atom_numbers = data["atom_numbers"];
            self.atomic_numbers = data["atomic_numbers"];
            self.atom_pos_car = data["atom_pos_car"];
            self.atom_pos_red = data["atom_pos_red"];
            self.lat = data["lattice"];
            self.vec = data["vectors"];
            self.kpoints = data["kpoints"];
            self.formula = data["formula"];
            self.highcharts = data["highcharts"];
            self.highsym_qpts = data["highsym_qpts"]
            self.repetitions = data["repetitions"];
        });
        $('#nx').val(this.repetitions[0]);
        $('#ny').val(this.repetitions[1]);
        $('#nz').val(this.repetitions[2]);
        this.getRepetitions();

        //get the bonding distance
        self.nndist = self.getBondingDistance(this.atom_pos_car);
        console.log(self.nndist);

        self.qindex = {};
        for (i=0; i<self.kpoints.length; i++) {
          self.qindex[i] = i;
        }
    },

    getStructure: function() {
 		  var i,j;
      var x,y,z;
      var lat = this.lat;
      var apc = this.atom_pos_car;
      var atoms = [];

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
      var phase, sprod;

      //additional phase in case necessary
      var atom_phase = []
      if (this.addatomphase) {
        for (i=0;i<this.natoms;i++) {
            atom_phase.push(kpt[0]*this.atom_pos_red[i][0] + kpt[1]*this.atom_pos_red[i][1] + kpt[2]*this.atom_pos_red[i][2]);
        }
      }
      else {
        for (i=0;i<this.natoms;i++) {
            atom_phase.push(0);
        }
      }

      for (var ix=0;ix<this.nx;ix++) {
          for (var iy=0;iy<this.ny;iy++) {
              for (var iz=0;iz<this.nz;iz++) {

                  for (i=0;i<this.natoms;i++) {
                      sprod = kpt[0]*ix + kpt[1]*iy + kpt[2]*iz + atom_phase[i];
                      phase = Complex.Polar(1,sprod*2.0*pi);

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

    exportXSF: function () {
      string = "CRYSTAL\n"
      string += "PRIMVEC\n"

      for (i=0; i<this.lat.length; i++) {
        string += (self.lat[i][0]*this.nx*bohr2ang).toFixed(12) + " " +
                  (self.lat[i][1]*this.ny*bohr2ang).toFixed(12) + " " +
                  (self.lat[i][2]*this.nz*bohr2ang).toFixed(12) + "\n";
      }

      string += "PRIMCOORD 1\n"
      string += this.atoms.length + " 1\n"

      var phase = Complex.Polar(this.amplitude,parseFloat($("#phase").val())/360*2.0*pi);

      for (i=0; i<this.atoms.length; i++) {
        vibrations = this.vibrations[i];
        string += self.atom_numbers[this.atoms[i][0]] + " ";
        for (j=1; j<4; j++) {
          string += (this.atoms[i][j]*bohr2ang + phase.mult(vibrations[j-1]).real()).toFixed(12) + " ";
        }
        string += "\n";
      }

      var element = document.createElement('a');
      element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(string));
      element.setAttribute('download', this.k.toString()+'_'+this.n.toString()+'_displacement.xsf');
      element.style.display = 'none';
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);

    },

    exportPOSCAR: function () {
      //deep copy
      var atoms = jQuery.extend(true, [], this.atoms);
      var counter = {};
      var order = [];

      //set the first element to be the atomic number
      for (i=0; i<atoms.length; i++) {
        var atom = atoms[i];
        atom[0] = self.atom_numbers[atom[0]];
        if ( $.inArray(atom[0].toString(), Object.keys(counter)) == -1 ) {
          order.push(atom[0]);
          counter[atom[0]] = 0;
        }
      }

      //we sort the atoms according to atom types (POSCAR format requires so)
      for (i=0; i<atoms.length; i++) {
        counter[atoms[i][0]] += 1;
      }
      atoms.sort();

      string = "";
      for (i=0; i<order.length; i++) {
        string += atomic_symbol[order[i]] + " ";
      }
      string += "generated by phononwebsite: http://henriquemiranda.github.io/phononwebsite/\n";

      string += "1.0\n"

      for (i=0; i<this.lat.length; i++) {
        string += (self.lat[i][0]*this.nx*bohr2ang).toFixed(12) + " " +
                  (self.lat[i][1]*this.ny*bohr2ang).toFixed(12) + " " +
                  (self.lat[i][2]*this.nz*bohr2ang).toFixed(12) + "\n";
      }

      for (i=0; i<order.length; i++) {
        string += counter[order[i]] + " ";
      }
      string += "\n";

      string += "Cartesian\n"
      var phase = Complex.Polar(this.amplitude,parseFloat($("#phase").val())/360*2.0*pi);
      for (i=0; i<atoms.length; i++) {
        vibrations = this.vibrations[i];
        for (j=1; j<4; j++) {
          string += (atoms[i][j]*bohr2ang + phase.mult(vibrations[j-1]).real()).toFixed(12) + " ";
        }
        string += "\n";
      }

      var element = document.createElement('a');
      element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(string));
      element.setAttribute('download', this.k.toString()+'_'+this.n.toString()+'_displacement.POSCAR');
      element.style.display = 'none';
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);

    },

    updateHighcharts: function(applet) {
      qindex = this.qindex;

      //function to set the minimum of the y axis as found in: http://stackoverflow.com/questions/16417124/set-highcharts-y-axis-min-value-to-0-unless-there-is-negative-data
      var setMin = function () {
        var chart = this,
        ex = chart.yAxis[0].getExtremes();

        // Sets the min value for the chart
        var minVal = 0;

        if (ex.dataMin < 0) {
          minVal = ex.dataMin;
        }

        //set the min and return the values
        chart.yAxis[0].setExtremes(minVal, null, true, false);
      }

      var HighchartsOptions = {
          chart: { type: 'line',
                   events: { load: setMin } },
          title: { text: 'Phonon dispersion' },
          xAxis: { title: { text: 'q-point' },
                   plotLines: [],
                   lineWidth: 0,
                   minorGridLineWidth: 0,
                   lineColor: 'transparent',
                   labels: {
                     enabled: false
                   },
                   minorTickLength: 0,
                   tickLength: 0
                  },
          yAxis: { title: { text: 'Frequency (cm-1)' },
                   plotLines: [ {value: 0, color: '#808080' } ] },
          tooltip: { formatter: function(x) { return Math.round(this.y*100)/100+'cm-1' } },
          plotOptions: {
              line: {
                  animation: false
              },
              series: {
                  cursor: 'pointer',
                  point: { events: {
                       click: function(event) {
                                  p.k = qindex[this.x];
                                  console.log(this.x, qindex[this.x]);
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
      HighchartsOptions.yAxis.plotLines = [{
          color: '#000000',
          width: 2,
          value: 0
      }];
      $('#highcharts').highcharts(HighchartsOptions);
    },


    updatePage: function() {
        //lattice vectors table
        var i, j;
        for (i=0;i<3;i++) {
            for (j=0;j<3;j++) {
              //round lattice values
              $('#uc_'+i+j).html( Math.round(this.lat[i][j]*1000)/1000 );
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

function update() {
    p.name = "Custom File"
    p.updateHighcharts();
    p.updatePage();
    v.updateObjects(p);
    v.animate();
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

    p = Phonon;
    v = VibCrystal;

    $('#file-input')[0].addEventListener('change', p.getFromFile.bind(p), false);
    $('#file-input')[0].addEventListener('click', function() { this.value = '';}, false);
    updateMenu();

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
