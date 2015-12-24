$(document).ready(function(){

    if ( ! Detector.webgl ) Detector.addGetWebGLMessage();

    var container, stats;

    var camera, controls, scene, renderer;

    var cross;

    init();
    animate();	
	
})

function init() {
    container = $('#vibmol');
	var dimensions = containerDimensions();
	
    camera = new THREE.PerspectiveCamera( 60, dimensions.ratio, 0.1, 5000 );
    camera.position.z = 500;

    controls = new THREE.TrackballControls( camera );

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
    
    var map = THREE.ImageUtils.loadTexture( 'textures/me.jpg' );
    map.wrapS = map.wrapT = THREE.RepeatWrapping;
    map.anisotropy = 16;

    var material = new THREE.MeshLambertMaterial( { map: map, side: THREE.DoubleSide } );

    for (i=-5;i<5;i++) {
        for (j=-5;j<5;j++) {   
            object = new THREE.Mesh( new THREE.SphereGeometry( 50, 20, 10 ), material );
            object.position.set( i*100, j*100, 0 );
            scene.add( object );
        }
    }

    // lights

    light = new THREE.DirectionalLight( 0xffffff );
    light.position.set( 0, 0, 100 );
    scene.add( light );

    light = new THREE.AmbientLight( 0x222222 );
    scene.add( light );

    // renderer

    renderer = new THREE.WebGLRenderer( { antialias: true } );
    renderer.setClearColor( 0x000000 );
    renderer.setPixelRatio( window.devicePixelRatio );
    renderer.setSize( dimensions.width , dimensions.height );

    container.get(0).appendChild( renderer.domElement );

    stats = new Stats();
    stats.domElement.style.position = 'absolute';
    stats.domElement.style.top = '0px';
    stats.domElement.style.zIndex = 100;
    container.get(0).appendChild( stats.domElement );

    //

    window.addEventListener( 'resize', onWindowResize, false );
    //

    render();

}

function containerDimensions() {
	var container = $('#vibmol');
	var w = container.width(), h = container.height();

	return {
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

function animate() {

    requestAnimationFrame( animate );
    controls.update();
    render();

}

function render() {

    renderer.render( scene, camera );
    stats.update();

}
