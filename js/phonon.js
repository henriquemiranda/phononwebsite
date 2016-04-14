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
    this.k = 0;
    this.n = 0;
    this.nx = 1;
    this.ny = 1;
    this.nz = 1;
    this.amplitude = 1.0;

    this.getRepetitions = function() {
      this.nx = $('#nx').val();
      this.ny = $('#ny').val();
      this.nz = $('#nz').val();
      this.getStructure(this.nx,this.ny,this.nz) //calculate postions
      this.getVibrations() //calculate vibrations
    }

    this.getFromJsonFile = getFromJsonFile;
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
      else if (yaml) { this.getFromPhononpyFile(yaml); this.name = "Custom file"}
      else           { alert("Ivalid file"); }
    }

    //function to load a material from phonodb
    this.loadId = function(id) {
      this.loadURL({yaml:this.materials[id]['url']});
      this.name = this.materials[id]['name'] +  " <a href='https://www.materialsproject.org/materials/mp-"+id+"'>mp-"+id+"</a>";
      update();
    },

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
      return min;
    }

    this.loadURL = function(url_vars) {
      var yaml = null;
      var json = null;

      for (var key in url_vars) {
        if ( key == "yaml" ) { yaml = $.get(url_vars[key]).responseText; }
        if ( key == "json" ) { json = $.get(url_vars[key]).responseText; }
        if ( key == "name" ) { $('#t1').html(url_vars[key]);   }
      }

      if      (json)         { this.getFromJsonString(json);     }
      else if (yaml)         { this.getFromPhononpyString(yaml); }
      else                   { alert("Ivalid url"); }
    }

    this.getFromPhononpyString = getFromPhononpyString.bind(this);
    this.getFromPhononpyFile = getFromPhononpyFile.bind(this);
    this.getFromJson = getFromJson.bind(this);
    this.getFromJsonString = getFromJsonString.bind(this);

    //Read structure from model
    this.getModel = function() {
      $.get(folder+'/data.json', this.getFromJsonString, "html" );
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

      //normalize displacements with masses
      var norm = 0;
      for (i=0;i<this.natoms;i++) {
          norm += 1.0/Math.sqrt(atomic_mass[this.atom_numbers[i]]);
      }

      for (var ix=0;ix<this.nx;ix++) {
          for (var iy=0;iy<this.ny;iy++) {
              for (var iz=0;iz<this.nz;iz++) {

                  for (i=0;i<this.natoms;i++) {
                      sprod = kpt[0]*ix + kpt[1]*iy + kpt[2]*iz + atom_phase[i];
                      sqrt_mass = 1.0/Math.sqrt(atomic_mass[this.atom_numbers[i]])/norm;
                      phase = Complex.Polar(sqrt_mass,sprod*2.0*pi);

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

    this.exportXSF = exportXSF.bind(this);
    this.exportPOSCAR = exportPOSCAR.bind(this);

    this.updateHighcharts = function(self) { return function(applet) {
      qindex = this.qindex;

      var minVal = 0;
      for (i=0; i<this.eigenvalues.length; i++) {
        min = Math.min.apply(null, this.eigenvalues[i])
        if ( minVal > min ) {
          minVal = min;
        }
      }

      if (minVal > -1) minVal = 0;

      var HighchartsOptions = {
          chart: { type: 'line',
                   zoomType: 'xy'
                 },
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
                   plotLines: [ {value: 0, color: '#808080' } ],
                   min: minVal
                 },
          tooltip: { formatter: function(x) { return Math.round(this.y*100)/100+' cm-1' } },
          plotOptions: {
              line: {
                  animation: false
              },
              series: {
                  allowPointSelect: true,
                  marker: {
                      states: {
                          select: {
                              fillColor: 'red',
                              radius: 5,
                              lineWidth: 0
                          }
                      }
                  },
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
}

function createPhonodbMenu(phonodb) {
  $("#div-phonodb").css('display', 'inline')
  var materials = jsyaml.load(phonodb);
  var materials_ref = {}
  $('#phonodb').empty()
  for (i=0;i<materials.length;i++){
    material = materials[i];
    materials_ref[material['id']] = material
    $('#phonodb').append('<li></li>');
    $('#phonodb li:last').append("<a href='#' onclick='p.loadId("+material['id']+")'>"+material['name']+"</a>");
  }
  p.materials = materials_ref;
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

    //get a list of materials from phonodb
    //$.get('http://phonondb.mtl.kyoto-u.ac.jp/v/phonondb.yaml', createPhonodbMenu);
    $.get('phonondb.yaml', createPhonodbMenu);
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

function updateRepetitions() {
  v.pause();
  p.getRepetitions();
  v.updateObjects(p);
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
        if(event.keyCode == 13) updateRepetitions();
    });


});
