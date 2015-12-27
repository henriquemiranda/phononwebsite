/*$(document).ready(function(){

    if ( ! Detector.webgl ) Detector.addGetWebGLMessage();

    var container, stats;

    var camera, controls, scene, renderer;


    init();
    animate();	
	
})*/

function vibmol(phonon) {
    /* Initialize the phonon animation */

	var dimensions = containerDimensions();
	container = dimensions.container;

    camera = new THREE.PerspectiveCamera( 60, dimensions.ratio, 0.1, 5000 );
    camera.position.z = 20;

    controls = new THREE.TrackballControls( camera, container );

    controls.rotateSpeed = 1.0;
    controls.zoomSpeed = 1.2;
    controls.panSpeed = 0.8;

    controls.noZoom = false;
    controls.noPan = false;

    controls.staticMoving = true;
    controls.dynamicDampingFactor = 0.3;

    controls.addEventListener( 'change', render );

    // world
    scene = new THREE.Scene();
    
    var objects = phonon.getVibmolObjects();
    for (i=0;i<objects.length;i++) {
        scene.add( objects[i] );
    }

    addLights();   
 
    // renderer
    renderer = new THREE.WebGLRenderer( { antialias: true } );
    renderer.setClearColor( 0x000000 );
    //renderer.setPixelRatio( window.devicePixelRatio );
    renderer.setSize( dimensions.width , dimensions.height );

    container.appendChild( renderer.domElement );

    stats = new Stats();
    stats.domElement.style.position = 'relative';
    stats.domElement.style.top = '-52px';
    stats.domElement.style.zIndex = 100;
    container.appendChild( stats.domElement );

    window.addEventListener( 'resize', onWindowResize, false );

    render();
}

function addLights() {
    // lights
    light = new THREE.DirectionalLight( 0xffffff );
    light.position.set( 0, 0, 100 );
    scene.add( light );

    light = new THREE.AmbientLight( 0x222222 );
    scene.add( light );
}

function updateObjects(phonon) {
    var nobjects = scene.children.length;
    for (i=nobjects-1;i>=0;i--) {
        if (scene.children[i].name == "atom") {
            scene.remove(scene.children[i]);
        }
    }

    //add alights
    var objects = phonon.getVibmolObjects();
    for (i=0;i<objects.length;i++) {
        scene.add( objects[i] );
    }
    animate();
}

function containerDimensions() {
    /* Obtain the dimensions of the container object */
	container = $('#vibmol');
	w = container.width(), h = container.height();

	return {
        container: container.get(0),
		width: w,
		height: h,
		ratio: ( w / h )
	};
}

function onWindowResize() {
	var dimensions = containerDimensions();
    camera.aspect = dimensions.ratio;
    camera.updateProjectionMatrix();

    renderer.setSize( dimensions.width, dimensions.height );

    controls.handleResize();

    render();

}

function pause() {
    var id = requestAnimationFrame( animate );
    cancelAnimationFrame( id );
}

function animate() {

    requestAnimationFrame( animate );
    controls.update();
    render();

}

function render() {
    var timer = Date.now() % 1000 / 1000;

    p.getVibmolVibrations(timer);

    renderer.render( scene, camera );
    stats.update();

}
