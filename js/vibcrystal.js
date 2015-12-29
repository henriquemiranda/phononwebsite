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

    /* Initialize the phonon animation */
    init: function(container,phonon) {

        this.container = container;
        var container0 = container.get(0);
        this.dimensions = this.getContainerDimensions();

        //obtain information from phonon structure
        this.getAtypes(phonon);
        this.vibrations = phonon.vibrations;
        this.atoms      = phonon.atoms;
        this.nndist     = phonon.nndist + 0.01;
        console.log(this.nndist);

        this.camera = new THREE.PerspectiveCamera( 10, this.dimensions.ratio, 0.1, 5000 );
        this.camera.position.z = 20;

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
        this.renderer.setClearColor( 0x000000 );
        this.renderer.setPixelRatio( window.devicePixelRatio );
        this.renderer.setSize( this.dimensions.width , this.dimensions.height );

        container0.appendChild( this.renderer.domElement );

        this.stats = new Stats();
        this.stats.domElement.style.position = 'relative';
        this.stats.domElement.style.top = '-52px';
        this.stats.domElement.style.zIndex = 100;
        container0.appendChild( this.stats.domElement );

        window.addEventListener( 'resize', this.onWindowResize.bind(this), false );

        this.render();
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

        var material = new THREE.MeshLambertMaterial( { color: 0xffffff, 
                                                        blending: THREE.AdditiveBlending } );

        var r=0.5, lat=20, lon=10;

        //add a ball for each atom
        for (i=0;i<this.atoms.length;i++) {

            object = new THREE.Mesh( new THREE.SphereGeometry(r,lat,lon),
                                     this.materials[this.atoms[i][0]] );
            pos = new THREE.Vector3(this.atoms[i][1], this.atoms[i][2], this.atoms[i][3]);

            object.position.copy(pos);
            object.name = "atom";

            this.scene.add( object );
            this.atomobjects.push(object);
            this.atompos.push( pos );
        }
        
        //obtain combinations two by two of all the atoms
        var combinations = getCombinations( this.atomobjects );
        var a, b;
        for (i=0;i<combinations.length;i++) {
            a = combinations[i][0].position;
            b = combinations[i][1].position;

            //if the separation is smaller than the sum of the bonding radius create a bond
            if (a.distanceTo(b) < this.nndist ) {
                this.bonds.push( [a,b] );

                //get transformations
                var bond = getBond(a,b); 

                //create cylinder mesh
                var cylinderGeometry = new THREE.CylinderGeometry(0.1,0.1,bond.length,8);
                var object = new THREE.Mesh(cylinderGeometry, material);
                
                object.setRotationFromQuaternion( bond.quaternion );
                object.position.copy( bond.midpoint )
                object.name = 'bond';

                this.scene.add( object );
                this.bondobjects.push( object );
            }
        }

        
    },

    removeStructure: function() {
        var nobjects = this.scene.children.length;
        var scene = this.scene
        for (i=nobjects-1;i>=0;i--) {
            if (scene.children[i].name == "atom" || scene.children[i].name == "bond") {
                scene.remove(scene.children[i]);
            }
        }
    },

    addLights: function() {
        light = new THREE.DirectionalLight( 0xffffff );
        light.position.set( 0, 0, 100 );
        this.scene.add( light );

        light = new THREE.AmbientLight( 0x222222 );
        this.scene.add( light );
    },

    updateObjects: function(phonon) {
        this.getAtypes(phonon);
        this.nndist     = phonon.nndist + 0.01;
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

        this.renderer.setSize( this.dimensions.width, this.dimensions.height );
        this.controls.handleResize();
        this.render();

    },

    pause: function() {
        var id = requestAnimationFrame( this.animate.bind(this) );
        cancelAnimationFrame( id );
    },

    animate: function() {
        var t = Date.now() * 0.001;
        var scale = 1.0;
        var x,y,z;
        var atom, atompos;
        requestAnimationFrame( this.animate.bind(this) );

        //update positions according to vibrational modes
        for (i=0; i<this.atomobjects.length; i++) {
            atom    = this.atomobjects[i];
            atompos = this.atompos[i];
            x = atompos.x + Complex.Polar(scale,t*2.0*pi).mult(this.vibrations[i][0]).real();
            y = atompos.y + Complex.Polar(scale,t*2.0*pi).mult(this.vibrations[i][1]).real();
            z = atompos.z + Complex.Polar(scale,t*2.0*pi).mult(this.vibrations[i][2]).real();
            this.atomobjects[i].position.set(x,y,z);
        }

        //update the bonds positions
        for (i=0; i<this.bonds.length; i++) {
            var a = this.bonds[i][0]; 
            var b = this.bonds[i][1]; 
            var bond = getBond(a,b);            

            this.bondobjects[i].setRotationFromQuaternion( bond.quaternion );
            this.bondobjects[i].position.copy( bond.midpoint );
        }

        this.controls.update();
        this.render();
    },

    render: function() {

        this.renderer.render( this.scene, this.camera );
        this.stats.update();

    }
}

function getBond( point1, point2, material ) {
    /*
    function to obtain a rotation matrix and the midpoint defined by two points
    inspired in:
    http://stackoverflow.com/questions/15316127/three-js-line-vector-to-cylinder
    */
    var direction = new THREE.Vector3().subVectors(point2, point1);
    var arrow = new THREE.ArrowHelper(direction.clone().normalize(), point1);

    return { quaternion: arrow.quaternion,
             length: direction.length(),
             midpoint: point1.clone().add( direction.multiplyScalar(0.5) ) };
}

