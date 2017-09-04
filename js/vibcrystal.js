/*
Class to show phonon vibrations using Three.js and WebGl
*/
var vec_y = new THREE.Vector3( 0, 1, 0 );
var vec_0 = new THREE.Vector3( 0, 0, 0 );

class VibCrystal {

    constructor(container) {
        this.time = 0,
        this.arrows = false;
        this.cell = false;
        this.paused = false;
        this.initialized = false;

        this.container = container;
        this.container0 = container.get(0);
        this.dimensions = this.getContainerDimensions();

        this.stats = null;
        this.camera = null;
        this.controls = null;
        this.scene = null;
        this.renderer = null;

        //camera options
        this.cameraDistance = 100;
        this.cameraViewAngle = 10;
        this.cameraNear = 0.1;
        this.cameraFar = 5000;

        //balls
        this.sphereRadius = 0.5;
        this.sphereLat = 12;
        this.sphereLon = 12;
        //bonds
        this.bondRadius = 0.1;
        this.bondSegments = 6;
        this.bondVertical = 1;
        //arrows
        this.arrowHeadRadiusRatio = 2;
        this.arrowHeadLengthRatio = .25;
        this.arrowRadius = 0.1;
        this.arrowLength = 1.0;
        this.arrowScale = 2.0;

        this.capturer = null;

        //options
        this.amplitude = 0.2;
        this.speed = 1.0;
        this.fps = 60;
    }

    init(phononweb) {
        /* 
        Initialize the phonon animation 
        */

        //obtain information from phonon structure
        this.getAtypes(phononweb);
        this.vibrations = phononweb.vibrations;
        this.atoms      = phononweb.atoms;

        this.camera = new THREE.PerspectiveCamera( this.cameraViewAngle, this.dimensions.ratio, 
                                                   this.cameraNear, this.cameraFar );
        this.setCameraDirection('z');

        //add lights to the camera
        let pointLight = new THREE.PointLight( 0xdddddd );
        pointLight.position.set(1,1,2);
        this.camera.add(pointLight);

        this.controls = new THREE.TrackballControls( this.camera, this.container0 );
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

        this.addStructure(phononweb.phonon);
        this.addCell(phononweb);
        this.addLights();

        // renderer
        this.renderer = new THREE.WebGLRenderer( { antialias: true } );
        this.renderer.setClearColor( 0xffffff );
        this.renderer.setPixelRatio( window.devicePixelRatio );
        this.renderer.shadowMap.enabled = false;
        this.renderer.setSize( this.dimensions.width , this.dimensions.height, false );
        this.renderer.domElement.className = "vibcrystal-class";

        this.container0.appendChild( this.renderer.domElement );
        this.canvas = this.renderer.domElement;

        this.stats = new Stats();
        //this.stats.domElement.style.position = 'relative';
        //this.stats.domElement.style.bottom = '0px';
        //this.stats.domElement.style.zIndex = 100;
        this.container0.appendChild( this.stats.domElement );

        window.addEventListener( 'resize', this.onWindowResize.bind(this), false );

        this.render();
    }

    captureend(format) {
        this.capturer.stop();

        callback_captureend = function( url ) {
            var element = document.createElement('a');
            element.setAttribute('href', url);
            element.setAttribute('download', p.k.toString()+'_'+p.n.toString()+'.'+ format);
            element.style.display = 'none';
            document.body.appendChild(element);
            element.click();
            document.body.removeChild(element);

            //remove progress bar
            progress.style.width = 0;
        }

        this.capturer.save( callback_captureend );
        this.capturer = null;
    }

    capturestart(format) {
        var progress = document.getElementById( 'progress' );

        options = { format: format,
                    workersPath: 'js/',
                    verbose: true,
                    frameMax: this.fps,
                    end: this.captureend.bind(this,format),
                    framerate: this.fps,
                    onProgress: function( p ) { progress.style.width = ( p * 100 ) + '%' }
                  }

        this.capturer = new CCapture( options ),
        this.capturer.start();
    }

    setCameraDirection(direction) {
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
    }

    getAtypes(phononweb) {
        this.materials = [];
        this.atom_numbers = phononweb.phonon.atom_numbers;
        for (let i=0; i < this.atom_numbers.length; i++) {
            let n = this.atom_numbers[i];
            let r = jmol_colors[n][0];
            let g = jmol_colors[n][1];
            let b = jmol_colors[n][2];

            let material = new THREE.MeshLambertMaterial( { blending: THREE.AdditiveBlending } );
            material.color.setRGB (r, g, b);
            this.materials.push( material );
        }
    }

    addCell(phononweb) {
        /*
        Represent the unit cell
        */
        if (this.cell) {
          lat = phonon.lat;
          o = this.geometricCenter;
          zero = new THREE.Vector3(0,0,0);
          c = new THREE.Vector3(0,0,0);
          x = new THREE.Vector3(lat[0][0], lat[0][1], lat[0][2]);
          y = new THREE.Vector3(lat[1][0], lat[1][1], lat[1][2]);
          z = new THREE.Vector3(lat[2][0], lat[2][1], lat[2][2]);
          
          //lower part
          var geometry = new THREE.Geometry();
          c.copy(zero);
          c.sub(o); geometry.vertices.push(c.clone());
          c.add(x); geometry.vertices.push(c.clone());
          c.add(y); geometry.vertices.push(c.clone());
          c.sub(x); geometry.vertices.push(c.clone());
          c.sub(y); geometry.vertices.push(c.clone());
          var material = new THREE.LineBasicMaterial({ color: 0x000000 });
          var line = new THREE.Line(geometry, material);
          this.scene.add(line);
                 
          //upper part
          var geometry = new THREE.Geometry();
          c.copy(zero); c.add(z);
          c.sub(o); geometry.vertices.push(c.clone());
          c.add(x); geometry.vertices.push(c.clone());
          c.add(y); geometry.vertices.push(c.clone());
          c.sub(x); geometry.vertices.push(c.clone());
          c.sub(y); geometry.vertices.push(c.clone());
          var material = new THREE.LineBasicMaterial({ color: 0x000000 });
          var line = new THREE.Line(geometry, material);
          this.scene.add(line);
          
          //vertical lines
          var geometry = new THREE.Geometry();
          c.copy(zero); 
          c.sub(o); geometry.vertices.push(c.clone());
          c.add(z); geometry.vertices.push(c.clone());
          
          c.add(x); geometry.vertices.push(c.clone());
          c.sub(z); geometry.vertices.push(c.clone());
          
          c.add(y); geometry.vertices.push(c.clone());
          c.add(z); geometry.vertices.push(c.clone());
          
          c.sub(x); geometry.vertices.push(c.clone());
          c.sub(z); geometry.vertices.push(c.clone());
          var material = new THREE.LineBasicMaterial({ color: 0x000000 });
          var line = new THREE.Line(geometry, material);
          this.scene.add(line);
        }
        
    }

    addStructure(phonon) {
        /*
        Add the atoms from the phononweb object
        */
        this.atomobjects  = [];
        this.bondobjects  = [];
        this.arrowobjects = []; 
        this.atompos = [];
        this.atomvel = [];
        this.bonds = [];
        this.nndist = phonon.nndist+0.05;

        console.log(phonon);

        //atoms balls geometry
        var sphereGeometry = new THREE.SphereGeometry( this.sphereRadius, this.sphereLat, 
                                                       this.sphereLon);
        //arrow geometry
        var arrowGeometry = new THREE.CylinderGeometry( 0, 
                                                        this.arrowHeadRadiusRatio*this.arrowRadius, 
                                                        this.arrowLength*this.arrowHeadLengthRatio );

        var axisGeometry  = new THREE.CylinderGeometry( this.arrowRadius, this.arrowRadius, 
                                                        this.arrowLength);

        var AxisMaterial  = new THREE.MeshLambertMaterial( { color: 0xbbffbb, 
                                                             blending: THREE.AdditiveBlending } );

        console.log(phonon.atoms);

        //get geometric center
        let geometricCenter = new THREE.Vector3(0,0,0);
        for (let i=0; i<phonon.atoms.length; i++) {
            let pos = new THREE.Vector3(phonon.atoms[i][1], phonon.atoms[i][2], phonon.atoms[i][3]);
            geometricCenter.add(pos);
        }
        geometricCenter.multiplyScalar(1.0/phonon.atoms.length);
        this.geometricCenter = geometricCenter;

        for (let i=0; i<phonon.atoms.length; i++) {
             
            //add a ball for each atom
            let object = new THREE.Mesh( sphereGeometry, this.materials[phonon.atoms[i][0]] );
            let pos = new THREE.Vector3(phonon.atoms[i][1], phonon.atoms[i][2], phonon.atoms[i][3]);
            pos.sub(geometricCenter);

            object.position.copy(pos);
            object.name = "atom";
            object.atom_number = phonon.atom_numbers[phonon.atoms[i][0]];
            object.velocity = vec_0.clone();

            this.scene.add( object );
            this.atomobjects.push( object );
            this.atompos.push( pos );

        }
        
        if (this.arrows) {
            for (let i=0; i<this.atoms.length; i++) {

                //add an arrow for each atom
                ArrowMesh     = new THREE.Mesh( arrowGeometry, AxisMaterial );
                length = (this.arrowLength+this.arrowLength*this.arrowHeadLengthRatio)/2;
                ArrowMesh.position.y = length; 

                //merge form of the arrow with cylinder
                ArrowMesh.updateMatrix();
                axisGeometry.merge(ArrowMesh.geometry,ArrowMesh.matrix);
                AxisMesh      = new THREE.Mesh( axisGeometry, AxisMaterial );
                AxisMesh.position.copy(pos);
                
                this.scene.add( AxisMesh );
                this.arrowobjects.push( AxisMesh );
            }
        }        

        //obtain combinations two by two of all the atoms
        let combinations = getCombinations( this.atomobjects );
        let a, b, length;
        let material = new THREE.MeshLambertMaterial( { color: 0xffffff,
                                                        blending: THREE.AdditiveBlending } );


        for (let i=0; i<combinations.length; i++) {
            a = combinations[i][0];
            b = combinations[i][1];
            let ad = a.position;
            let bd = b.position;

            //if the separation is smaller than the sum of the bonding radius create a bond
            length = ad.distanceTo(bd)
            let cra = covalent_radii[a.atom_number]
            let crb = covalent_radii[b.atom_number]
            if (length < cra + crb || length < this.nndist + 0.2 ) {
                this.bonds.push( [ad,bd,length] );

                //get transformations
                var bond = getBond(ad,bd);

                //create cylinder mesh
                var cylinderGeometry = new THREE.CylinderGeometry( this.bondRadius, this.bondRadius,
                                                                   length, this.bondSegments,
                                                                   this.bondVertical, true);
                var object = new THREE.Mesh(cylinderGeometry, material);

                object.setRotationFromQuaternion( bond.quaternion );
                object.position.copy( bond.midpoint )
                object.name = "bond";

                this.scene.add( object );
                this.bondobjects.push( object );
            }
        }


    }

    removeStructure() {
        var nobjects = this.scene.children.length;
        var scene = this.scene
        //just remove everything and then add the lights
        for (let i=nobjects-1; i>=0; i--) {
            scene.remove(scene.children[i]);
        }
        this.addLights();
    }

    addLights() {
        this.scene.add(this.camera);
        let light = new THREE.AmbientLight( 0x333333 );
        this.scene.add( light );
    }

    updateObjects(phonon) {
        
        //check if it is initialized
        if (!this.initialized) {
            this.init(phonon)
            this.initialized = true;
        }

        this.getAtypes(phonon);
        this.vibrations = phonon.vibrations;
        this.atoms      = phonon.atoms;
        this.removeStructure();
        this.addStructure(phonon);
        this.addCell(phonon);
        this.animate();
    }

    getContainerDimensions() {
        let w = this.container.width(); 
        let h = this.container.height();
        let dimensions = { width: w,
                           height: h,
                           ratio: ( w / h ) };
        return dimensions;
    }

    onWindowResize() {
        this.dimensions = this.getContainerDimensions();

        this.camera.aspect = this.dimensions.ratio;
        this.camera.updateProjectionMatrix();

        this.renderer.setSize( this.dimensions.width, this.dimensions.height, false );
        this.controls.handleResize();
        this.render();
    }

    playpause() {
        if (this.paused) {
            this.paused = false;
        }
        else {
            this.paused = true;
        }
        this.time
    }

    pause() {
        var id = requestAnimationFrame( this.animate.bind(this) );
        cancelAnimationFrame( id );
    }

    animate() {
        setTimeout( function() {
          requestAnimationFrame( this.animate.bind(this) );
        }.bind(this), 1000 / 60 );

        this.controls.update();
        this.render();
    }

    render() {
        let x,y,z,i;
        let atom, bond, atompos, bondobject;
        let vibrations;

        //get the current time in miliseconds and convert to seconds
        var currentTime = Date.now()/1000.0;
        var t = currentTime * this.speed;
        var phase = Complex.Polar(this.amplitude,t*2.0*pi);
        var v = new THREE.Vector3();
        var vlength;

        if (!this.paused) {

            //update positions according to vibrational modes
            for (i=0; i<this.atomobjects.length; i++) {
                atom       = this.atomobjects[i];
                atompos    = this.atompos[i];
                vibrations = this.vibrations[i];

                x  = atompos.x + phase.mult(vibrations[0]).real();
                y  = atompos.y + phase.mult(vibrations[1]).real();
                z  = atompos.z + phase.mult(vibrations[2]).real();
                this.atomobjects[i].position.set( x, y, z);

                if (this.arrows) {
                    vx = phase.mult(vibrations[0]).real();
                    vy = phase.mult(vibrations[1]).real();
                    vz = phase.mult(vibrations[2]).real();

                    //velocity vector
                    v.set(vx,vy,vz);
                    vlength = v.length()/this.amplitude;
                    s = .5*this.arrowScale/this.amplitude;
     
                    this.arrowobjects[i].position.set(x+vx*s,y+vy*s,z+vz*s);
                    this.arrowobjects[i].scale.y = vlength*this.arrowScale;
                    this.arrowobjects[i].quaternion.setFromUnitVectors(vec_y,v.normalize());
                }
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

        }

        this.renderer.render( this.scene, this.camera );

        //if the capturer exists then capture
        if (this.capturer) {
            this.capturer.capture( this.canvas );
        }

        this.stats.update();
    }
}

function getBond( point1, point2 ) {
    /*
    get a quarternion and midpoint that links two points
    */
    var direction = new THREE.Vector3().subVectors(point2, point1);

    quarternion = new THREE.Quaternion().setFromUnitVectors( vec_y, direction.clone().normalize() );
    return { quaternion: quarternion,
             midpoint: point1.clone().add( direction.multiplyScalar(0.5) ) };
}


