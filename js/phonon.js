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

//Phonon Class
function Phonon() {
    var k = 0;
    var n = 0;
    var nx = 1;
    var ny = 1;
    var nz = 1;
    var amplitude = 0.5;

    this.getRepetitions = function() {
      this.nx = $('#nx').val();
      this.ny = $('#ny').val();
      this.nz = $('#nz').val();
      this.getStructure(this.nx,this.ny,this.nz) //calculate postions
      this.getVibrations() //calculate vibrations
    }

    this.getBondingDistance = function() {
      //replicate the atoms two times in each direction
      atoms = this.getStructure(2,2,2);

      var combinations = getCombinations( atoms );
      var min = 1e9;
      for (i=0; i<combinations.length; i++ ) {
        a = combinations[i][0];
        b = combinations[i][1];

        distance = dist(a.slice(1),b.slice(1));
        if (min > distance) {
          min = distance;
        }
      }
      console.log(min);
      return min;
    }

    //find the type of file and call the corresponding function that will read it
    //currently there are two formats available:
    //phonopy files (band.yaml) and a special .json format (description available in ./phononweb/phononweb.py)
    this.loadCustomFile = function(event) {
      var yaml = null;
      var json = null;

      for (i=0; i<event.target.files.length; i++) {
        file = event.target.files[i];
        if (file.name.indexOf(".yaml") > -1) { yaml = file; }
        if (file.name.indexOf(".json") > -1) { json = file; }
      }

      if      (json) { this.getFromJsonFile(json);     }
      else if (yaml) { this.getFromPhononpyFile(yaml); }
      else           { alert("Ivalid file"); }
    }

    this.loadURL = function(url_vars) {
      var yaml = null;
      var json = null;

      for (var key in url_vars) {
        if ( key == "yaml" ) { yaml = $.get('http://cors.io/?u='+url_vars[key]).responseText; }
        if ( key == "json" ) { json = $.get('http://cors.io/?u='+url_vars[key]).responseText; }
        if ( key == "name" ) { $('#t1').html(url_vars[key]);                                  }
      }

      if      (json)         { this.getFromJsonString(json);     }
      else if (yaml)         { this.getFromPhononpyString(yaml); }
      else                   { alert("Ivalid url"); }
    }

    //yaml is a file object with the "band.yaml" file
    this.getFromPhononpyFile = function(yaml) {
      var yaml_reader = new FileReader();
      self = this;

      //read the files
      yaml_reader.onloadend = onLoadEndHandler;
      yaml_reader.readAsText(yaml);

      function onLoadEndHandler() {
        self.getFromPhononpyString(yaml_reader.result);
        update();
      }
    },

    //yaml is the content of "band.yaml" file as a string
    this.getFromPhononpyString = function(yaml) {
      this.k = 0;
      this.n = 0;
      var supercell_lat, rec, lat, nqpoint, npath, phonon, sc_atoms, segment_nqpoint;

      //read the yaml files
      var phononyaml = jsyaml.load(yaml);
      lat = phononyaml['lattice'];
      nqpoint = phononyaml['nqpoint'];
      npath = phononyaml['npath'];
      tmat = phononyaml['supercell_matrix'];
      pc_atoms = phononyaml['atoms'];
      phonon = phononyaml['phonon'];
      if (phononyaml['segment_nqpoint']) {
        segment_nqpoint = phononyaml['segment_nqpoint'];
      }
      else {
        segment_nqpoint = []
        for (i=0; i<npath; i++) {
          segment_nqpoint.push(nqpoint/npath);
        }
      }

      //get the number of repetitions
      pmat = matrix_multiply(lat,tmat);

      //this will be changed
      nx = 3;
      ny = 3;
      nz = 3;

      //get the atoms inside the unit cell
      var pos,x,y,z,atom_types = [], atom_numbers = [] ;
      var atomic_numbers = {}, pc_atoms_car = [], pc_atoms_red = [];
      for (i=0; i<pc_atoms.length; i++) {
        var symbol = pc_atoms[i]['symbol'];
        var position = pc_atoms[i]['position'];
        atom_numbers.push(atomic_number[symbol]);
        atom_types.push(symbol);
        pc_atoms_red.push(position);
        pc_atoms_car.push(red_car(position,lat));
      }
      this.natoms = pc_atoms.length;

      //get the phonon dispersion
      var kpoints = [], eivals, eivecs = [];
      var nbands = this.natoms*3;
      var n, p, phononi, phononiband;

      var highcharts = [];
      this.highsym_qpts = {};
      this.qindex = {};
      var qpoint = 0;

      var check_high_sym_qpoint = function(phononi,highsym_qpts) {
        //check if a label is present
        if (phononi['label']) {
          highsym_qpts[phononi['distance']] = phononi['label'];
        }
        else {
          highsym_qpts[phononi['distance']] = '';
        }
      }

      for (p=0; p<npath; p++) {

        //clean eivals array
        eivals = [];
        for (i=0; i<nbands; i++) {
          eivals.push([]);
        }

        check_high_sym_qpoint(phonon[qpoint],this.highsym_qpts);

        for (i=0; i<segment_nqpoint[p]; i++) {
          phononi = phonon[qpoint+i];

          this.qindex[phononi['distance']] = kpoints.length;
          kpoints.push(phononi['q-position']);

          //create bands
          phononiband = phononi['band'];
          eivec = [];
          for (n=0; n<nbands; n++) {
            eivals[n].push([phononi['distance'],phononiband[n]['frequency']*thz2ev]);
            eivec.push(phononiband[n]['eigenvector']);
          }
          eivecs.push(eivec);
        }
        check_high_sym_qpoint(phononi,this.highsym_qpts);

        qpoint+=segment_nqpoint[p];

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

      this.addatomphase = true;
      this.atom_types = atom_types;
      this.atom_numbers = atom_numbers;
      this.atomic_numbers = unique(atom_numbers).map(function(x) { return parseInt(x)});
      this.atom_pos_car = pc_atoms_car;
      this.atom_pos_red = pc_atoms_red;
      this.lat = lat;
      this.vec = eivecs;
      this.kpoints = kpoints;
      this.formula = atom_types.join('');
      this.highcharts = highcharts;
      this.repetitions = [nx,ny,nz];

      this.nndist = this.getBondingDistance();

      $('#nx').val(this.repetitions[0]);
      $('#ny').val(this.repetitions[1]);
      $('#nz').val(this.repetitions[2]);
      this.getRepetitions();
    },

    //Read structure from model
    this.getModel = function() {
      $.get(folder+'/data.json', this.getFromJsonString, "html" );
    }

    this.getFromJsonFile = function(file) {
      var json_reader = new FileReader();
      self = this;

      json_reader.readAsText(file);

      json_reader.onloadend = function(e) {
        self.getFromJsonString(json_reader.result);
        update();
      };
    }

    this.getFromJsonString = function(string) {
      json = JSON.parse(string);
      this.getFromJson.bind(this)(json);
    }.bind(this)

    // Read structure data from JSON format
    // data is a string with the json file.
    this.getFromJson = function(data) {
        this.k=0;
        this.n=0;
        this.addatomphase = false;

        this.name = data["name"];
        this.natoms = data["natoms"];
        this.atom_types = data["atom_types"];
        this.atom_numbers = data["atom_numbers"];
        this.atomic_numbers = data["atomic_numbers"];
        this.atom_pos_car = data["atom_pos_car"];
        this.atom_pos_red = data["atom_pos_red"];
        this.lat = data["lattice"];
        this.vec = data["vectors"];
        this.kpoints = data["qpoints"];
        this.distances = data["distances"];
        this.formula = data["formula"];
        this.eigenvalues = data["eigenvalues"];
        this.repetitions = data["repetitions"];

        //get qindex
        this.qindex = {};
        for (i=0; i<this.distances.length; i++) {
          this.qindex[this.distances[i]] = i;
        }

        //get high symmetry qpoints
        this.highsym_qpts = {}
        //"highsym_qpts":[[0,'Gamma'],[20,'M'],[30,'K'],[50,'Gamma']];
        for (i=0; i<data["highsym_qpts"].length; i++) {
          var dist = this.distances[data["highsym_qpts"][i][0]]
          this.highsym_qpts[dist] = data["highsym_qpts"][i][1];
        }

        //get the bonding distance
        this.nndist = this.getBondingDistance();

        $('#nx').val(this.repetitions[0]);
        $('#ny').val(this.repetitions[1]);
        $('#nz').val(this.repetitions[2]);
        this.getRepetitions();

        //go through the eigenvalues and create eivals list
        eivals = this.eigenvalues;
        var nbands = eivals[0].length;
        var nqpoints = eivals.length;
        this.highcharts = [];

        for (n=0; n<nbands; n++) {
          eig = [];
          for (k=0; k<nqpoints; k++) {
            eig.push([this.distances[k],eivals[k][n]]);
          }

          this.highcharts.push({
                                  name:  n.toString(),
                                  color: "#0066FF",
                                  marker: { radius: 2,
                                            symbol: "circle"},
                                  data: eig
                                });
        }
    }

    this.getStructure = function(nx,ny,nz) {
 		  var i,j;
      var x,y,z;
      var lat = this.lat;
      var apc = this.atom_pos_car;
      var atoms = [];

	    for (var ix=0;ix<nx;ix++) {
          for (var iy=0;iy<ny;iy++) {
              for (var iz=0;iz<nz;iz++) {
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

    this.getVibrations = function() {
      var i,j,n=0;
      var veckn = this.vec[this.k][this.n];
      var vibrations = [];
      var kpt = this.kpoints[this.k];
      var phase, sprod;

      //additional phase in case necessary
      var atom_phase = []
      if (this.addatomphase) {
        for (i=0;i<this.natoms;i++) {
          phase = kpt[0]*this.atom_pos_red[i][0] + kpt[1]*this.atom_pos_red[i][1] + kpt[2]*this.atom_pos_red[i][2]
          atom_phase.push(phase);
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
    }

    this.exportXSF = function () {
      string = "CRYSTAL\n"
      string += "PRIMVEC\n"

      for (i=0; i<this.lat.length; i++) {
        string += (self.lat[i][0]*this.nx).toFixed(12) + " " +
                  (self.lat[i][1]*this.ny).toFixed(12) + " " +
                  (self.lat[i][2]*this.nz).toFixed(12) + "\n";
      }

      string += "PRIMCOORD 1\n"
      string += this.atoms.length + " 1\n"

      var phase = Complex.Polar(this.amplitude,parseFloat($("#phase").val())/360*2.0*pi);

      for (i=0; i<this.atoms.length; i++) {
        vibrations = this.vibrations[i];
        string += self.atom_numbers[this.atoms[i][0]] + " ";
        for (j=1; j<4; j++) {
          string += (this.atoms[i][j] + phase.mult(vibrations[j-1]).real()).toFixed(12) + " ";
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

    }

    this.exportPOSCAR = function () {
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
        string += (self.lat[i][0]*this.nx).toFixed(12) + " " +
                  (self.lat[i][1]*this.ny).toFixed(12) + " " +
                  (self.lat[i][2]*this.nz).toFixed(12) + "\n";
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
          string += (atoms[i][j] + phase.mult(vibrations[j-1]).real()).toFixed(12) + " ";
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

    }

    this.updateHighcharts = function(self) { return function(applet) {
      qindex = this.qindex;

      //function to set the minimum of the y axis as found in: http://stackoverflow.com/questions/16417124/set-highcharts-y-axis-min-value-to-0-unless-there-is-negative-data
      var setMin = function () {
        var chart = this,
        ex = chart.yAxis[0].getExtremes();

        // Sets the min value for the chart
        var minVal = 0;

        if (ex.dataMin < -1) {
          minVal = ex.dataMin;
        }

        //set the min and return the values
        chart.yAxis[0].setExtremes(minVal, null, true, false);
      }

      var HighchartsOptions = {
          chart: { type: 'line',
                   events: { load: setMin } },
          title: { text: 'Phonon dispersion' },
          xAxis: { plotLines: [],
                   lineWidth: 0,
                   minorGridLineWidth: 0,
                   lineColor: 'transparent',
                   labels: {
                     style: { fontSize:'20px' },
                     formatter: function() {
                        if ( self.highsym_qpts[this.value] ) {
                          var label = self.highsym_qpts[this.value];
                          label = label.replace("$","").replace("$","");
                          label = label.replace("\\Gamma","Γ");
                          label = label.replace("\\Sigma","Σ");
                          label = label.replace("_","");
                          return label;
                        }
                        return ''
                     }
                   },
                   minorTickLength: 0,
                   tickLength: 0
                  },
          yAxis: { title: { text: 'Frequency (cm-1)' },
                   plotLines: [ {value: 0, color: '#808080' } ] },
          tooltip: { formatter: function(x) { return Math.round(this.y*100)/100+' cm-1' } },
          plotOptions: {
              line: {
                  animation: false
              },
              series: {
                  cursor: 'pointer',
                  point: { events: {
                       click: function(event) {
                                  p.k = qindex[this.x];
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

      //get positions of high symmetry qpoints
      var ticks = [];
      for(var k in this.highsym_qpts) ticks.push(k);

      //get the high symmetry qpoints for highcharts
      plotLines = []
      for ( i=0; i<ticks.length ; i++ ) {
        plotLines.push({ value: ticks[i],
                         color: '#000000',
                         width: 2 })
      }

      HighchartsOptions.series = this.highcharts;
      HighchartsOptions.xAxis.tickPositions = ticks;
      HighchartsOptions.xAxis.plotLines = plotLines;
      HighchartsOptions.yAxis.plotLines = [{ color: '#000000',
                                             width: 2,
                                             value: 0 }];
      $('#highcharts').highcharts(HighchartsOptions);
    }}(this)

    this.updatePage = function() {
        //lattice vectors table
        var i, j;
        for (i=0;i<3;i++) {
            for (j=0;j<3;j++) {
              //round lattice values
              $('#uc_'+i+j).html( this.lat[i][j].toPrecision(5) );
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
                $('#atompos tr:last').append('<td>'+pos[i][j].toFixed(4)+'</td>');
            }
        }

        //update title
        $('#t1').html(this.name);
    }
}

function updateAll() {
    p.getModel();
    p.updateHighcharts();
    p.updatePage();
    v.updateObjects(p);
}

function update() {
    p.updateHighcharts();
    p.updatePage();
    v.updateObjects(p);
    //v.animate();
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

// from http://stackoverflow.com/questions/4656843/jquery-get-querystring-from-url
function getUrlVars()
{
    var vars = {}, hash;
    if (location.search) {
      var hashes = location.search.slice(1).split('&');
      for(var i = 0; i < hashes.length; i++)
      {
          hash = hashes[i].split('=');
          vars[hash[0]] = hash[1];
      }
      return vars;
    }
    else {
      return null;
    }
}

$(document).ready(function(){

    p = new Phonon();
    v = VibCrystal;

    $('#file-input')[0].addEventListener('change', p.loadCustomFile.bind(p), false);
    $('#file-input')[0].addEventListener('click', function() { this.value = '';}, false);
    updateMenu();

    var url_vars = getUrlVars();
    if (url_vars) {
      p.loadURL(url_vars);
    }
    else {
      p.getModel();
    }

    if ( ! Detector.webgl ) Detector.addGetWebGLMessage();
    v.init($('#vibcrystal'),p);

    update();

    //jquery to make an action once you change the number of repetitions
    $(".input-rep").keyup(function(event){
        if(event.keyCode == 13){
            v.pause();
            p.getRepetitions();
            v.updateObjects(p);
        }
    });

});
