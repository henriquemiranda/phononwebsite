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
        
        var objects = phonon.getVibmolObjects();
        for (i=0;i<objects.length;i++) {
            this.scene.add( objects[i] );
        }

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

    addLights: function() {
        light = new THREE.DirectionalLight( 0xffffff );
        light.position.set( 0, 0, 100 );
        this.scene.add( light );

        light = new THREE.AmbientLight( 0x222222 );
        this.scene.add( light );
    },

    updateObjects: function(phonon) {
        var nobjects = this.scene.children.length;
        var scene = this.scene
        for (i=nobjects-1;i>=0;i--) {
            if (scene.children[i].name == "atom") {
                scene.remove(scene.children[i]);
            }
        }

        var objects = phonon.getVibmolObjects();
        for (i=0;i<objects.length;i++) {
            this.scene.add( objects[i] );
        }
        this.animate();
    },

    getContainerDimensions: function() {
        self = this;
 
        w = self.container.width(), h = self.container.height();

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

        requestAnimationFrame( this.animate.bind(this) );
        this.controls.update();
        this.render();

    },

    render: function() {
        var timer = Date.now() % 1000 / 1000;

        p.getVibmolVibrations(timer);

        this.renderer.render( this.scene, this.camera );
        this.stats.update();

    }
}
