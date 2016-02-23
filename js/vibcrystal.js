/*
Class to show phonon vibrations using Three.js and WebGl
*/

VibCrystal = {
    container: null,
    container0: null,
    dimensions: null,
    stats: null,
    camera: null,
    controls: null,
    scene: null,
    renderer: null,
    cameraDistance: 100,

    //camera options
    cameraViewAngle: 10,
    cameraNear: 0.1,
    cameraFar: 5000,

    //balls
    sphereRadius: 0.5,
    sphereLat: 12,
    sphereLon: 12,
    bondRadius: 0.1,
    bondSegments: 6,
    bondVertical: 1,

    //options
    amplitude: 1.0,
    fps: 30,

    /* Initialize the phonon animation */
    init: function(container,phonon) {

        this.container = container;
        var container0 = container.get(0);
        this.dimensions = this.getContainerDimensions();

        //obtain information from phonon structure
        this.getAtypes(phonon);
        this.vibrations = phonon.vibrations;
        this.atoms      = phonon.atoms;

        this.camera = new THREE.PerspectiveCamera( this.cameraViewAngle,
                    this.dimensions.ratio, this.cameraNear, this.cameraFar );
        //this.camera.aspect = this.dimensions.ratio;
        this.setCameraDirection('z');

        this.controls = new THREE.TrackballControls( this.camera, container0 );
        this.controls.rotateSpeed = 1.0;
        this.controls.zoomSpeed = 1.0;
        this.controls.panSpeed = 0.3;
        this.controls.noZoom = false;
        this.controls.noPan = false;
        this.controls.staticMoving = true;
        this.controls.dynamicDampingFactor = 0.3;

        this.controls.addEventListener( 'change', this.render.bind(this) );

        // world
        this.scene = new THREE.Scene();

        this.addStructure(phonon);
        this.addLights();

        // renderer
        this.renderer = new THREE.WebGLRenderer( { antialias: true } );
        this.renderer.setClearColor( 0xffffff );
        this.renderer.setPixelRatio( window.devicePixelRatio );
        this.renderer.shadowMap.enabled = false;
        this.renderer.setSize( this.dimensions.width , this.dimensions.height, false );
        this.renderer.domElement.className = "vibcrystal-class";

        container0.appendChild( this.renderer.domElement );
        this.canvas = this.renderer.domElement;

        this.stats = new Stats();
        //this.stats.domElement.style.position = 'relative';
        //this.stats.domElement.style.bottom = '0px';
        //this.stats.domElement.style.zIndex = 100;
        container0.appendChild( this.stats.domElement );

        window.addEventListener( 'resize', this.onWindowResize.bind(this), false );

        this.render();
    },

    capture: function(format) {
      var progress = document.getElementById( 'progress' );

      //get gifs
      this.capturer = new CCapture( { format: format,
                                      workersPath: 'js/',
                                      verbose: false,
                                      framerate: this.fps,
                                      onProgress: function( p ) { progress.style.width = ( p * 100 ) + '%' }
                                    } ),

      this.frame=0;
      this.capturer.start();

      this.end = function(){
        this.capturer.stop();
        this.capturer.save( function( url ) {
          var element = document.createElement('a');
          element.setAttribute('href', url);
          element.setAttribute('download', p.k.toString()+'_'+p.n.toString()+'.'+ format);
          element.style.display = 'none';
          document.body.appendChild(element);
          element.click();
          document.body.removeChild(element);

          //remove progress bar
          progress.style.width = 0;
          } );
      };
    },

    setCameraDirection: function(direction) {
        if (direction == 'x') {
            this.camera.position.set( this.cameraDistance, 0, 0);
            this.camera.up.set( 0, 0, 1 );
        }
        if (direction == 'y') {
            this.camera.position.set( 0, this.cameraDistance, 0);
            this.camera.up.set( 0, 0, 1 );
        }
        if (direction == 'z') {
            this.camera.position.set( 0, 0, this.cameraDistance);
            this.camera.up.set( 0, 1, 0 );
        }
    },

    getAtypes: function(phonon) {
        this.materials = [];
        this.atom_numbers = phonon.atom_numbers;
        for (i=0;i<this.atom_numbers.length;i++) {
            var n = this.atom_numbers[i];
            r = jmol_colors[n][0];
            g = jmol_colors[n][1];
            b = jmol_colors[n][2];

            var material = new THREE.MeshLambertMaterial( { blending: THREE.AdditiveBlending } );
            material.color.setRGB (r, g, b);

            this.materials.push( material );
        }
    },

    addStructure: function(phonon) {
        this.atomobjects = [];
        this.bondobjects = [];
        this.atompos = [];
        this.bonds = [];

        var sphereGeometry = new THREE.SphereGeometry(this.sphereRadius,this.sphereLat,this.sphereLon);

        //get geometric center
        geometricCenter = new THREE.Vector3(0,0,0);
        for (i=0;i<this.atoms.length;i++) {
            pos = new THREE.Vector3(this.atoms[i][1], this.atoms[i][2], this.atoms[i][3]);
            geometricCenter.add(pos);
        }
        geometricCenter.multiplyScalar(1.0/this.atoms.length);

        //add a ball for each atom
        for (i=0;i<this.atoms.length;i++) {

            object = new THREE.Mesh( sphereGeometry, this.materials[this.atoms[i][0]] );
            pos = new THREE.Vector3(this.atoms[i][1], this.atoms[i][2], this.atoms[i][3]);
            pos.sub(geometricCenter);

            object.position.copy(pos);
            object.name = "atom";
            object.atom_number = this.atom_numbers[this.atoms[i][0]];

            this.scene.add( object );
            this.atomobjects.push(object);
            this.atompos.push( pos );
        }

        //obtain combinations two by two of all the atoms
        var combinations = getCombinations( this.atomobjects );
        var a, b, length;
        var material = new THREE.MeshLambertMaterial( { color: 0xffffff,
                                                        blending: THREE.AdditiveBlending } );


        for (i=0;i<combinations.length;i++) {
            a = combinations[i][0];
            b = combinations[i][1];
            ad = a.position;
            bd = b.position;

            //if the separation is smaller than the sum of the bonding radius create a bond
            length = ad.distanceTo(bd)
            if (length < covalent_radii[a.atom_number]+covalent_radii[b.atom_number]+0.05 ) {
                this.bonds.push( [ad,bd,length] );

                //get transformations
                var bond = getBond(ad,bd);

                var cylinderGeometry =
                    new THREE.CylinderGeometry(this.bondRadius,this.bondRadius,length,
                                               this.bondSegments,this.bondVertical,true);

                //create cylinder mesh
                var object = new THREE.Mesh(cylinderGeometry, material);

                object.setRotationFromQuaternion( bond.quaternion );
                object.position.copy( bond.midpoint )
                object.name = "bond";

                this.scene.add( object );
                this.bondobjects.push( object );
            }
        }


    },

    removeStructure: function() {
        var nobjects = this.scene.children.length;
        var scene = this.scene
        //just remove everything and then add the lights
        for (i=nobjects-1;i>=0;i--) {
            scene.remove(scene.children[i]);
        }
        this.addLights();
    },

    addLights: function() {
        light = new THREE.DirectionalLight( 0xffffff );
        light.position.set( 0, 0, 100 );
        light.target.position.set(0, 0, 0);
        light.castShadow = false;
        this.scene.add( light );

        light = new THREE.DirectionalLight( 0xffffff );
        light.position.set( 0, 0, -100 );
        light.target.position.set(0, 0, 0);
        light.castShadow = false;
        this.scene.add( light );

        light = new THREE.AmbientLight( 0x222222 );
        this.scene.add( light );
    },

    updateObjects: function(phonon) {
        this.getAtypes(phonon);
        this.vibrations = phonon.vibrations;
        this.atoms      = phonon.atoms;
        this.removeStructure();
        this.addStructure(phonon);
        this.animate();
    },

    getContainerDimensions: function() {
        w = this.container.width(), h = this.container.height();

        return {
            width: w,
            height: h,
            ratio: ( w / h )
        };
    },

    onWindowResize: function() {
        this.dimensions = this.getContainerDimensions();

        this.camera.aspect = this.dimensions.ratio;
        this.camera.updateProjectionMatrix();

        this.renderer.setSize( this.dimensions.width, this.dimensions.height, false );
        this.controls.handleResize();
        this.render();

    },

    pause: function() {
        var id = requestAnimationFrame( this.animate.bind(this) );
        cancelAnimationFrame( id );
    },

    animate: function() {
        requestAnimationFrame( this.animate.bind(this) );
        this.controls.update();
        this.render();
    },

    render: function() {
        var x,y,z,i;
        var atom, bond, atompos, bondobject;
        var vibrations;

        var currentTime = Date.now();
        var t = currentTime * 0.001;
        var phase = Complex.Polar(this.amplitude,t*2.0*pi);

        //update positions according to vibrational modes
        for (i=0; i<this.atomobjects.length; i++) {
            atom       = this.atomobjects[i];
            atompos    = this.atompos[i];
            vibrations = this.vibrations[i];

            x = atompos.x + phase.mult(vibrations[0]).real();
            y = atompos.y + phase.mult(vibrations[1]).real();
            z = atompos.z + phase.mult(vibrations[2]).real();
            this.atomobjects[i].position.set(x,y,z);
        }

        //update the bonds positions
        for (i=0; i<this.bonds.length; i++) {
            bond       = this.bonds[i];
            bonddata   = getBond(bond[0],bond[1]);
            bondobject = this.bondobjects[i];

            bondobject.setRotationFromQuaternion( bonddata.quaternion );
            bondobject.scale.y = bond[0].distanceTo(bond[1])/bond[2];
            bondobject.position.copy( bonddata.midpoint );
        }

        this.renderer.render( this.scene, this.camera );

        //if the capturer exists then capture
        if (this.capturer) {
          this.frame++;
          this.capturer.capture( this.canvas );
          if (this.frame == this.fps) {
            this.end();
          }
        };

        this.stats.update();
    }
}

var vec_y = new THREE.Vector3( 0, 1, 0 );
function getBond( point1, point2 ) {
    var direction = new THREE.Vector3().subVectors(point2, point1);

    return { quaternion: new THREE.Quaternion().setFromUnitVectors( vec_y, direction.clone().normalize() ),
             midpoint: point1.clone().add( direction.multiplyScalar(0.5) ) };
}
