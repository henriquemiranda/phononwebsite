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

        this.camera = new THREE.PerspectiveCamera( 60, this.dimensions.ratio, 0.1, 5000 );
        this.camera.position.z = 20;

        this.controls = new THREE.TrackballControls( this.camera, container0 );

        this.controls.rotateSpeed = 1.0;
        this.controls.zoomSpeed = 1.2;
        this.controls.panSpeed = 0.8;

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

        window.addEventListener( 'resize', this.onWindowResize, false );

        this.render();
    },

    addStructure: function(phonon) {
        this.atomobjects = [];
        var material = new THREE.MeshLambertMaterial( { color: 0xffaa00, 
                                                        blending: THREE.AdditiveBlending } );

        var atoms = this.atoms = phonon.atoms;
        this.vibrations = phonon.vibrations;

        var r=0.5, lat=20, lon=10;
        for (i=0;i<atoms.length;i++) {

            object = new THREE.Mesh( new THREE.SphereGeometry(r,lat,lon), material );
            pos = new THREE.Vector3(atoms[i][0],atoms[i][1], atoms[i][2]);

            object.position.copy(pos);
            object.name = "atom";

            this.scene.add( object );
            this.atomobjects.push(object.position);
        }
        
    },

    removeStructure: function() {
        var nobjects = this.scene.children.length;
        var scene = this.scene
        for (i=nobjects-1;i>=0;i--) {
            if (scene.children[i].name == "atom") {
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
        camera.aspect = this.dimensions.ratio;
        camera.updateProjectionMatrix();

        this.renderer.setSize( this.dimensions.width, this.dimensions.height );

        this.controls.handleResize();

        this.render();

    },

    pause: function() {
        var id = requestAnimationFrame( this.animate.bind(this) );
        cancelAnimationFrame( id );
    },

    animate: function() {
        var t = Date.now() % 1000 / 1000;
        var vibrations = this.vibrations;
        var scale = 0.01;
        requestAnimationFrame( this.animate.bind(this) );

        //update positions according to vibrational modes
        for (i=0;i<this.atomobjects.length;i++) {
            x = vibrations[i][0].mult(Complex.exp(Complex(0,t*2*pi))).real()*scale;
            y = vibrations[i][1].mult(Complex.exp(Complex(0,t*2*pi))).real()*scale;
            z = vibrations[i][2].mult(Complex.exp(Complex(0,t*2*pi))).real()*scale;
            this.atomobjects[i].add(new THREE.Vector3( x, y, z ));
        }

        this.controls.update();
        this.render();

    },

    render: function() {

        this.renderer.render( this.scene, this.camera );
        this.stats.update();

    }
}
