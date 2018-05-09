/*
Class to show phonon vibrations using Three.js and WebGl
*/
var vec_y = new THREE.Vector3( 0, 1, 0 );
var vec_0 = new THREE.Vector3( 0, 0, 0 );
var direction = new THREE.Vector3( 0, 0, 0 );
var quarternion = new THREE.Quaternion();

class VibCrystal {

    constructor(container) {

        this.vesta = false; //use jmol or vesta displaystyle

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
        this.capturer = null;

        //camera options
        this.cameraDistance = 100;
        this.cameraViewAngle = 10;
        this.cameraNear = 0.1;
        this.cameraFar = 5000;

        //balls
        this.sphereRadius = 0.5;
        if (this.vesta == true) {
            this.sphereLat = 16;
            this.sphereLon = 16;
        } else {
            this.sphereLat = 12;
            this.sphereLon = 12;
        }

        //bonds
        this.bondRadius = 0.1;
        this.bondSegments = 6;
        this.bondVertical = 1;

        //arrows
        this.arrowHeadRadiusRatio = 2;
        this.arrowHeadLengthRatio = .25;
        this.arrowRadius = 0.1;
        this.arrowLength = 1.0;

        //arrowscale
        this.arrowScale = 2.0;
        this.minArrowScale = 0.0;
        this.maxArrowScale = 5.0;
        this.stepArrowScale = 0.01;

        //amplitude
        this.amplitude = 0.2;
        this.minAmplitude = 0.0;
        this.maxAmplitude = 1.0;
        this.stepAmplitude = 0.01;

        //speed
        this.speed = 1.0;
        this.minSpeed = 0.01;
        this.maxSpeed = 3.0;
        this.stepSpeed = 0.01;
       
        this.fps = 60;

        this.arrowcolor = 0xbbffbb;
        this.bondscolor = 0xffffff;
        this.arrowobjects = [];
        this.atomobjects = [];
        this.bondobjects = [];
        this.bonds = [];
    }

    //functions to link the DOM buttons with this class
    setCameraDirectionButton(dom_button,direction) {
    /* Bind the action to set the direction of the camera using direction
       direction can be 'x','y','z'
    */
        var self = this;
        dom_button.click( function() { self.setCameraDirection(direction) } )
    }

    setPlayPause(dom_input) {
        dom_input.click( this.playpause.bind(this) );
    }

    setCellCheckbox(dom_checkbox) {
        var self = this;
        dom_checkbox.click( function() { 
            self.cell = this.checked;
            self.updatelocal();
        } ) 
    }

    setWebmButton(dom_button) {
        var self = this;
        /*
        check if its Chrome 1+ taken from
        http://stackoverflow.com/questions/9847580/how-to-detect-safari-chrome-ie-firefox-and-opera-browser
        only show webm button for chrome
        */
        let isChrome = !!window.chrome && !!window.chrome.webstore;
        if (!isChrome) {
            dom_button[0].style.visibility = 'hidden';
        }

        dom_button.click(function() { self.capturestart('webm'); }); 
    }

    setGifButton(dom_button) { 
        var self = this;
        dom_button.click(function() { self.capturestart('gif'); }); 
    } 

    setArrowsCheckbox(dom_checkbox) {
        var self = this;
        this.arrows = dom_checkbox.checked;
        dom_checkbox.click( function() { 
            self.arrows = this.checked; 
            self.updatelocal();
        });
    }

    setArrowsInput(dom_range) {
        var self = this;

        dom_range.val(self.arrowScale);
        dom_range.attr('min',self.minArrowScale);
        dom_range.attr('max',self.maxArrowScale);
        dom_range.attr('step',self.stepArrowScale);
        dom_range.change( function () {
            self.arrowScale = this.value;
        });
    }

   setAmplitudeInput(dom_number,dom_range) {
        var self = this;

        dom_number.val(self.amplitude);
        dom_number.keyup( function () {
            if (this.value < dom_range.min) { dom_range.attr('min', this.value); }
            if (this.value > dom_range.max) { dom_range.attr('max', this.value); }
            self.amplitude = this.value;
            dom_range.val(this.value)
        });

        dom_range.val(self.amplitude);
        dom_range.attr('min',self.minAmplitude);
        dom_range.attr('max',self.maxAmplitude);
        dom_range.attr('step',self.stepAmplitude);
        dom_range.change( function () {
            self.amplitude = this.value;
            dom_number.val(this.value);
        });
    }

    setSpeedInput(dom_range) {
        var self = this;

        dom_range.val(self.speed);
        dom_range.attr('min',self.minSpeed);
        dom_range.attr('max',self.maxSpeed);
        dom_range.attr('step',self.stepSpeed);
        dom_range.change( function () {
            self.speed = this.value;
        });
    }

    init(phonon) {
        /* 
        Initialize the phonon animation 
        */

        //add camera
        this.camera = new THREE.PerspectiveCamera( this.cameraViewAngle, this.dimensions.ratio, 
                                                   this.cameraNear, this.cameraFar );
        this.setCameraDirection('z');

        //add lights to the camera
        if (this.vesta == true) {
            let pointLight = new THREE.PointLight(  0xffffff, 1.2 );
            pointLight.position.set(1, 1, 1);
            this.camera.add(pointLight);
        } else {
            let pointLight = new THREE.PointLight( 0xdddddd );
            pointLight.position.set(1,1,2);
            this.camera.add(pointLight);
        }

        //controls
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

        // renderer
        this.renderer = new THREE.WebGLRenderer( { antialias: true } );
        this.renderer.setClearColor( 0xffffff );
        this.renderer.setPixelRatio( window.devicePixelRatio );
        this.renderer.shadowMap.enabled = false;
        this.renderer.setSize( this.dimensions.width , this.dimensions.height, false );
        this.renderer.domElement.className = "vibcrystal-class";
        this.container0.appendChild( this.renderer.domElement );
        this.canvas = this.renderer.domElement;

        //frame counter
        this.stats = new Stats();
        this.container0.appendChild( this.stats.domElement );

        //resizer
        window.addEventListener( 'resize', this.onWindowResize.bind(this), false );
    }

    captureend(format) {
        this.capturer.stop();

        function callback_captureend( url ) {
            let element = document.createElement('a');
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
        let progress = document.getElementById( 'progress' );

        let options = { format: format,
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

    getAtypes(atom_numbers) {
        this.materials = [];
        this.atom_numbers = atom_numbers;

        for (let i=0; i < atom_numbers.length; i++) {
            let n = atom_numbers[i];
            if (this.vesta == true) {
                 let r = vesta_colors[n][0];
                 let g = vesta_colors[n][1];
                 let b = vesta_colors[n][2];

                 let material = new THREE.MeshPhongMaterial( {reflectivity:1, shininess: 80} );
                 material.color.setRGB (r, g, b);
                 this.materials.push( material );
            } else {
                let r = jmol_colors[n][0];
                let g = jmol_colors[n][1];
                let b = jmol_colors[n][2];

                let material = new THREE.MeshLambertMaterial( { blending: THREE.AdditiveBlending } );
                material.color.setRGB (r, g, b);
                this.materials.push( material );
            }
        }
    }

    addCell(lat) {
        /*
        Represent the unit cell
        */
        if (this.cell) {
          let material = new THREE.LineBasicMaterial({ color: 0x000000 });
          let geometry = new THREE.Geometry();

          let o = this.geometricCenter;
          let zero = new THREE.Vector3(0,0,0);
          let c = new THREE.Vector3(0,0,0);
          let x = new THREE.Vector3(lat[0][0], lat[0][1], lat[0][2]);
          let y = new THREE.Vector3(lat[1][0], lat[1][1], lat[1][2]);
          let z = new THREE.Vector3(lat[2][0], lat[2][1], lat[2][2]);
          
          //lower part
          c.copy(zero);
          c.sub(o); geometry.vertices.push(c.clone());
          c.add(x); geometry.vertices.push(c.clone());
          c.add(y); geometry.vertices.push(c.clone());
          c.sub(x); geometry.vertices.push(c.clone());
          c.sub(y); geometry.vertices.push(c.clone());
                 
          //upper part
          c.copy(zero); c.add(z);
          c.sub(o); geometry.vertices.push(c.clone());
          c.add(x); geometry.vertices.push(c.clone());
          c.add(y); geometry.vertices.push(c.clone());
          c.sub(x); geometry.vertices.push(c.clone());
          c.sub(y); geometry.vertices.push(c.clone());
          
          //vertical lines
          c.copy(zero); 
          c.sub(o); geometry.vertices.push(c.clone());
          c.add(z); geometry.vertices.push(c.clone());
          
          c.add(x); geometry.vertices.push(c.clone());
          c.sub(z); geometry.vertices.push(c.clone());
          
          c.add(y); geometry.vertices.push(c.clone());
          c.add(z); geometry.vertices.push(c.clone());
          
          c.sub(x); geometry.vertices.push(c.clone());
          c.sub(z); geometry.vertices.push(c.clone());

          let line = new THREE.Line(geometry, material);
          this.scene.add(line);
        }
        
    }

    addStructure(atoms,atom_numbers) {
        /*
        Add the atoms from the phononweb object
        */
        this.atomobjects  = [];
        this.bondobjects  = [];
        this.arrowobjects = []; 
        this.atompos = [];
        this.atomvel = [];
        this.bonds = [];
        this.nndist = this.phonon.nndist+0.05;

        //get geometric center
        let geometricCenter = new THREE.Vector3(0,0,0);
        for (let i=0; i<atoms.length; i++) {
            let pos = new THREE.Vector3(atoms[i][1], atoms[i][2], atoms[i][3]);
            geometricCenter.add(pos);
        }
        geometricCenter.multiplyScalar(1.0/atoms.length);
        this.geometricCenter = geometricCenter;

        //atoms balls geometry
        let sphereGeometry = null;
        if (this.vesta == false) { sphereGeometry = new THREE.SphereGeometry( this.sphereRadius, this.sphereLat, this.sphereLon); }

        //add a ball for each atom
        for (let i=0; i<atoms.length; i++) {
            if (this.vesta == true) { sphereGeometry = new THREE.SphereGeometry( covalent_radii[atom_numbers[atoms[i][0]]]/2.3, this.sphereLat, this.sphereLon); }
            let object = new THREE.Mesh( sphereGeometry, this.materials[atoms[i][0]] );
            let pos = new THREE.Vector3(atoms[i][1], atoms[i][2], atoms[i][3]);
            pos.sub(geometricCenter);

            object.position.copy(pos);
            object.name = "atom";
            object.atom_number = atom_numbers[atoms[i][0]];

            object.velocity = vec_0.clone();

            this.scene.add( object );
            this.atomobjects.push( object );
            this.atompos.push( pos );

        }

        //add arrows
        if (this.arrows) {

            //arrow geometry
            let arrowGeometry = new THREE.CylinderGeometry( 0, 
                                                            this.arrowHeadRadiusRatio*this.arrowRadius, 
                                                            this.arrowLength*this.arrowHeadLengthRatio );

            let axisGeometry  = new THREE.CylinderGeometry( this.arrowRadius, this.arrowRadius, 
                                                            this.arrowLength );

            let AxisMaterial  = new THREE.MeshLambertMaterial( { color: this.arrowcolor, 
                                                                 blending: THREE.AdditiveBlending } );

            for (let i=0; i<atoms.length; i++) {

                //add an arrow for each atom
                let ArrowMesh = new THREE.Mesh( arrowGeometry, AxisMaterial );
                let length = (this.arrowLength+this.arrowLength*this.arrowHeadLengthRatio)/2;
                ArrowMesh.position.y = length; 

                //merge form of the arrow with cylinder
                ArrowMesh.updateMatrix();
                axisGeometry.merge(ArrowMesh.geometry,ArrowMesh.matrix);
                let object = new THREE.Mesh( axisGeometry, AxisMaterial );
                object.position.copy( geometricCenter );
 
                this.scene.add( object );
                this.arrowobjects.push( object );
            }
        }

        //obtain combinations two by two of all the atoms
        let combinations = getCombinations( this.atomobjects );
        let a, b, length;
        let material = new THREE.MeshLambertMaterial( { color: this.bondscolor,
                                                        blending: THREE.AdditiveBlending } );

        //add bonds
        for (let i=0; i<combinations.length; i++) {
            a = combinations[i][0];
            b = combinations[i][1];
            let ad = a.position;
            let bd = b.position;

            //if the separation is smaller than the sum of the bonding radius create a bond
            length = ad.distanceTo(bd)
            let cra = covalent_radii[a.atom_number]
            let crb = covalent_radii[b.atom_number]
            if (length < cra + crb || length < this.nndist ) {
                this.bonds.push( [ad,bd,length] );
                if (this.vesta == true) {
                    let colbind = [];
                    for (let i=0; i<3; i++) {
                        colbind[i] = (vesta_colors[a.atom_number][i] + vesta_colors[b.atom_number][i]) / 2;
                    }
                    material.color.setRGB( colbind[0], colbind[1], colbind[2] );i
                }

                //get transformations
                let bond = getBond(ad,bd);

                //create cylinder mesh
                let cylinderGeometry = new THREE.CylinderGeometry( this.bondRadius, this.bondRadius,
                                                                   length, this.bondSegments,
                                                                   this.bondVertical, true);
                let object = new THREE.Mesh(cylinderGeometry, material);

                object.setRotationFromQuaternion( bond.quaternion );
                object.position.copy( bond.midpoint );
                object.name = "bond";

                this.scene.add( object );
                this.bondobjects.push( object );
            }
        }

    }

    removeStructure() {
        let nobjects = this.scene.children.length;
        let scene = this.scene

        //remove everything
        for (let i=nobjects-1; i>=0; i--) {
            scene.remove(scene.children[i]);
        }
    }

    addLights() {
        this.scene.add(this.camera);
        let light = new THREE.AmbientLight( 0x333333 );
        this.scene.add( light );
    }

    update(phononweb) {
        /*
        this is the entry point of the phononweb 
        structure.
        It must contain:
            1. atoms
            2. vibrations
            3. phonon
        */
        
        this.phonon     = phononweb.phonon;
        this.vibrations = phononweb.vibrations;
        this.atoms      = phononweb.atoms;

        //check if it is initialized
        if (!this.initialized) {
            this.init(phononweb)
            this.initialized = true;
        }

        this.updatelocal();
    }

    updatelocal() {
        this.removeStructure();
        this.addLights();
        this.getAtypes(this.phonon.atom_numbers);
        this.addStructure(this.atoms,this.phonon.atom_numbers);
        this.addCell(this.phonon.lat);
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
        if (this.paused) { this.paused = false; }
        else             { this.paused = true;  }
        this.time
    }

    pause() {
        let id = requestAnimationFrame( this.animate.bind(this) );
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
        //get the current time in miliseconds and convert to seconds
        let currentTime = Date.now()/1000.0;
        let t = currentTime * this.speed;
        let phase = Complex.Polar(this.amplitude,t*2.0*pi);
        let v = new THREE.Vector3();

        if (!this.paused) {
            
            //update positions according to vibrational modes
            for (let i=0; i<this.atomobjects.length; i++) {
                let atom       = this.atomobjects[i];
                let atompos    = this.atompos[i];
                let vibrations = this.vibrations[i];

                let vx = phase.mult(vibrations[0]).real();
                let vy = phase.mult(vibrations[1]).real();
                let vz = phase.mult(vibrations[2]).real();

                let x  = atompos.x + vx;
                let y  = atompos.y + vy;
                let z  = atompos.z + vz;

                this.atomobjects[i].position.set( x, y, z);

                if (this.arrows) {

                    //velocity vector
                    v.set(vx,vy,vz);
                    let vlength = v.length()/this.amplitude;
                    let s = .5*this.arrowScale/this.amplitude;
     
                    this.arrowobjects[i].position.set(x+vx*s,y+vy*s,z+vz*s);
                    this.arrowobjects[i].scale.y = vlength*this.arrowScale;
                    this.arrowobjects[i].quaternion.setFromUnitVectors(vec_y,v.normalize());
                }
            }

            //update the bonds positions
            for (let i=0; i<this.bonds.length; i++) {
                let bond       = this.bonds[i];
                let bonddata   = getBond(bond[0],bond[1]);
                let bondobject = this.bondobjects[i];

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
    direction.subVectors(point2, point1);
    quarternion.setFromUnitVectors( vec_y, direction.clone().normalize() );

    return { quaternion: quarternion,
             midpoint: point1.clone().add( direction.multiplyScalar(0.5) ) };
}
