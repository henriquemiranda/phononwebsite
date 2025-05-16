/**
 * @author Eberhard Graether / http://egraether.com/
 * @author Mark Lundin 	/ http://mark-lundin.com
 * @author Simone Manini / http://daron1337.github.io
 * @author Luca Antiga 	/ http://lantiga.github.io
 */

var TrackballControls = function ( object, domElement ) {

	var _this = this;
	var STATE = { NONE: -1, ROTATE: 0, ZOOM: 1, PAN: 2, TOUCH_ROTATE: 3, TOUCH_ZOOM_PAN: 4 };

	this.object = object;
	this.domElement = ( domElement !== undefined ) ? domElement : document;

	// API

	this.enabled = true;

	this.screen = { left: 0, top: 0, width: 0, height: 0 };

	this.rotateSpeed = 1.0;
	this.zoomSpeed = 1.2;
	this.panSpeed = 0.3;

	this.noRotate = false;
	this.noZoom = false;
	this.noPan = false;

	this.staticMoving = false;
	this.dynamicDampingFactor = 0.2;

	this.minDistance = 0;
	this.maxDistance = Infinity;

	this.keys = [ 65 /*A*/, 83 /*S*/, 68 /*D*/ ];

	// internals

	this.target = new THREE.Vector3();

	var EPS = 0.000001;

	var lastPosition = new THREE.Vector3();

	var _state = STATE.NONE,
	_prevState = STATE.NONE,

	_eye = new THREE.Vector3(),

	_movePrev = new THREE.Vector2(),
	_moveCurr = new THREE.Vector2(),

	_lastAxis = new THREE.Vector3(),
	_lastAngle = 0,

	_zoomStart = new THREE.Vector2(),
	_zoomEnd = new THREE.Vector2(),

	_touchZoomDistanceStart = 0,
	_touchZoomDistanceEnd = 0,

	_panStart = new THREE.Vector2(),
	_panEnd = new THREE.Vector2();

	// for reset

	this.target0 = this.target.clone();
	this.position0 = this.object.position.clone();
	this.up0 = this.object.up.clone();

	// events

	var changeEvent = { type: 'change' };
	var startEvent = { type: 'start' };
	var endEvent = { type: 'end' };


	// methods

	this.handleResize = function () {

		if ( this.domElement === document ) {

			this.screen.left = 0;
			this.screen.top = 0;
			this.screen.width = window.innerWidth;
			this.screen.height = window.innerHeight;

		} else {

			var box = this.domElement.getBoundingClientRect();
			// adjustments come from similar code in the jquery offset() function
			var d = this.domElement.ownerDocument.documentElement;
			this.screen.left = box.left + window.pageXOffset - d.clientLeft;
			this.screen.top = box.top + window.pageYOffset - d.clientTop;
			this.screen.width = box.width;
			this.screen.height = box.height;

		}

	};

	this.handleEvent = function ( event ) {

		if ( typeof this[ event.type ] == 'function' ) {

			this[ event.type ]( event );

		}

	};

	var getMouseOnScreen = ( function () {

		var vector = new THREE.Vector2();

		return function getMouseOnScreen( pageX, pageY ) {

			vector.set(
				( pageX - _this.screen.left ) / _this.screen.width,
				( pageY - _this.screen.top ) / _this.screen.height
			);

			return vector;

		};

	}() );

	var getMouseOnCircle = ( function () {

		var vector = new THREE.Vector2();

		return function getMouseOnCircle( pageX, pageY ) {

			vector.set(
				( ( pageX - _this.screen.width * 0.5 - _this.screen.left ) / ( _this.screen.width * 0.5 ) ),
				( ( _this.screen.height + 2 * ( _this.screen.top - pageY ) ) / _this.screen.width ) // screen.width intentional
			);

			return vector;

		};

	}() );

	this.rotateCamera = ( function() {

		var axis = new THREE.Vector3(),
			quaternion = new THREE.Quaternion(),
			eyeDirection = new THREE.Vector3(),
			objectUpDirection = new THREE.Vector3(),
			objectSidewaysDirection = new THREE.Vector3(),
			moveDirection = new THREE.Vector3(),
			angle;

		return function rotateCamera() {

			moveDirection.set( _moveCurr.x - _movePrev.x, _moveCurr.y - _movePrev.y, 0 );
			angle = moveDirection.length();

			if ( angle ) {

				_eye.copy( _this.object.position ).sub( _this.target );

				eyeDirection.copy( _eye ).normalize();
				objectUpDirection.copy( _this.object.up ).normalize();
				objectSidewaysDirection.crossVectors( objectUpDirection, eyeDirection ).normalize();

				objectUpDirection.setLength( _moveCurr.y - _movePrev.y );
				objectSidewaysDirection.setLength( _moveCurr.x - _movePrev.x );

				moveDirection.copy( objectUpDirection.add( objectSidewaysDirection ) );

				axis.crossVectors( moveDirection, _eye ).normalize();

				angle *= _this.rotateSpeed;
				quaternion.setFromAxisAngle( axis, angle );

				_eye.applyQuaternion( quaternion );
				_this.object.up.applyQuaternion( quaternion );

				_lastAxis.copy( axis );
				_lastAngle = angle;

			} else if ( ! _this.staticMoving && _lastAngle ) {

				_lastAngle *= Math.sqrt( 1.0 - _this.dynamicDampingFactor );
				_eye.copy( _this.object.position ).sub( _this.target );
				quaternion.setFromAxisAngle( _lastAxis, _lastAngle );
				_eye.applyQuaternion( quaternion );
				_this.object.up.applyQuaternion( quaternion );

			}

			_movePrev.copy( _moveCurr );

		};

	}() );


	this.zoomCamera = function () {

		var factor;

		if ( _state === STATE.TOUCH_ZOOM_PAN ) {

			factor = _touchZoomDistanceStart / _touchZoomDistanceEnd;
			_touchZoomDistanceStart = _touchZoomDistanceEnd;
			_eye.multiplyScalar( factor );

		} else {

			factor = 1.0 + ( _zoomEnd.y - _zoomStart.y ) * _this.zoomSpeed;

			if ( factor !== 1.0 && factor > 0.0 ) {

				_eye.multiplyScalar( factor );

				if ( _this.staticMoving ) {

					_zoomStart.copy( _zoomEnd );

				} else {

					_zoomStart.y += ( _zoomEnd.y - _zoomStart.y ) * this.dynamicDampingFactor;

				}

			}

		}

	};

	this.panCamera = ( function() {

		var mouseChange = new THREE.Vector2(),
			objectUp = new THREE.Vector3(),
			pan = new THREE.Vector3();

		return function panCamera() {

			mouseChange.copy( _panEnd ).sub( _panStart );

			if ( mouseChange.lengthSq() ) {

				mouseChange.multiplyScalar( _eye.length() * _this.panSpeed );

				pan.copy( _eye ).cross( _this.object.up ).setLength( mouseChange.x );
				pan.add( objectUp.copy( _this.object.up ).setLength( mouseChange.y ) );

				_this.object.position.add( pan );
				_this.target.add( pan );

				if ( _this.staticMoving ) {

					_panStart.copy( _panEnd );

				} else {

					_panStart.add( mouseChange.subVectors( _panEnd, _panStart ).multiplyScalar( _this.dynamicDampingFactor ) );

				}

			}

		};

	}() );

	this.checkDistances = function () {

		if ( ! _this.noZoom || ! _this.noPan ) {

			if ( _eye.lengthSq() > _this.maxDistance * _this.maxDistance ) {

				_this.object.position.addVectors( _this.target, _eye.setLength( _this.maxDistance ) );
				_zoomStart.copy( _zoomEnd );

			}

			if ( _eye.lengthSq() < _this.minDistance * _this.minDistance ) {

				_this.object.position.addVectors( _this.target, _eye.setLength( _this.minDistance ) );
				_zoomStart.copy( _zoomEnd );

			}

		}

	};

	this.update = function () {

		_eye.subVectors( _this.object.position, _this.target );

		if ( ! _this.noRotate ) {

			_this.rotateCamera();

		}

		if ( ! _this.noZoom ) {

			_this.zoomCamera();

		}

		if ( ! _this.noPan ) {

			_this.panCamera();

		}

		_this.object.position.addVectors( _this.target, _eye );

		_this.checkDistances();

		_this.object.lookAt( _this.target );

		if ( lastPosition.distanceToSquared( _this.object.position ) > EPS ) {

			_this.dispatchEvent( changeEvent );

			lastPosition.copy( _this.object.position );

		}

	};

	this.reset = function () {

		_state = STATE.NONE;
		_prevState = STATE.NONE;

		_this.target.copy( _this.target0 );
		_this.object.position.copy( _this.position0 );
		_this.object.up.copy( _this.up0 );

		_eye.subVectors( _this.object.position, _this.target );

		_this.object.lookAt( _this.target );

		_this.dispatchEvent( changeEvent );

		lastPosition.copy( _this.object.position );

	};

	// listeners

	function keydown( event ) {

		if ( _this.enabled === false ) return;

		window.removeEventListener( 'keydown', keydown );

		_prevState = _state;

		if ( _state !== STATE.NONE ) {

			return;

		} else if ( event.keyCode === _this.keys[ STATE.ROTATE ] && ! _this.noRotate ) {

			_state = STATE.ROTATE;

		} else if ( event.keyCode === _this.keys[ STATE.ZOOM ] && ! _this.noZoom ) {

			_state = STATE.ZOOM;

		} else if ( event.keyCode === _this.keys[ STATE.PAN ] && ! _this.noPan ) {

			_state = STATE.PAN;

		}

	}

	function keyup( event ) {

		if ( _this.enabled === false ) return;

		_state = _prevState;

		window.addEventListener( 'keydown', keydown, false );

	}

	function mousedown( event ) {

		if ( _this.enabled === false ) return;

		event.preventDefault();
		event.stopPropagation();

		if ( _state === STATE.NONE ) {

			_state = event.button;

		}

		if ( _state === STATE.ROTATE && ! _this.noRotate ) {

			_moveCurr.copy( getMouseOnCircle( event.pageX, event.pageY ) );
			_movePrev.copy( _moveCurr );

		} else if ( _state === STATE.ZOOM && ! _this.noZoom ) {

			_zoomStart.copy( getMouseOnScreen( event.pageX, event.pageY ) );
			_zoomEnd.copy( _zoomStart );

		} else if ( _state === STATE.PAN && ! _this.noPan ) {

			_panStart.copy( getMouseOnScreen( event.pageX, event.pageY ) );
			_panEnd.copy( _panStart );

		}

		document.addEventListener( 'mousemove', mousemove, false );
		document.addEventListener( 'mouseup', mouseup, false );

		_this.dispatchEvent( startEvent );

	}

	function mousemove( event ) {

		if ( _this.enabled === false ) return;

		event.preventDefault();
		event.stopPropagation();

		if ( _state === STATE.ROTATE && ! _this.noRotate ) {

			_movePrev.copy( _moveCurr );
			_moveCurr.copy( getMouseOnCircle( event.pageX, event.pageY ) );

		} else if ( _state === STATE.ZOOM && ! _this.noZoom ) {

			_zoomEnd.copy( getMouseOnScreen( event.pageX, event.pageY ) );

		} else if ( _state === STATE.PAN && ! _this.noPan ) {

			_panEnd.copy( getMouseOnScreen( event.pageX, event.pageY ) );

		}

	}

	function mouseup( event ) {

		if ( _this.enabled === false ) return;

		event.preventDefault();
		event.stopPropagation();

		_state = STATE.NONE;

		document.removeEventListener( 'mousemove', mousemove );
		document.removeEventListener( 'mouseup', mouseup );
		_this.dispatchEvent( endEvent );

	}

	function mousewheel( event ) {

		if ( _this.enabled === false ) return;

		event.preventDefault();
		event.stopPropagation();

		var delta = 0;

		if ( event.wheelDelta ) {

			// WebKit / Opera / Explorer 9

			delta = event.wheelDelta / 40;

		} else if ( event.detail ) {

			// Firefox

			delta = - event.detail / 3;

		}

		_zoomStart.y += delta * 0.01;
		_this.dispatchEvent( startEvent );
		_this.dispatchEvent( endEvent );

	}

	function touchstart( event ) {

		if ( _this.enabled === false ) return;

		switch ( event.touches.length ) {

			case 1:
				_state = STATE.TOUCH_ROTATE;
				_moveCurr.copy( getMouseOnCircle( event.touches[ 0 ].pageX, event.touches[ 0 ].pageY ) );
				_movePrev.copy( _moveCurr );
				break;

			case 2:
				_state = STATE.TOUCH_ZOOM_PAN;
				var dx = event.touches[ 0 ].pageX - event.touches[ 1 ].pageX;
				var dy = event.touches[ 0 ].pageY - event.touches[ 1 ].pageY;
				_touchZoomDistanceEnd = _touchZoomDistanceStart = Math.sqrt( dx * dx + dy * dy );

				var x = ( event.touches[ 0 ].pageX + event.touches[ 1 ].pageX ) / 2;
				var y = ( event.touches[ 0 ].pageY + event.touches[ 1 ].pageY ) / 2;
				_panStart.copy( getMouseOnScreen( x, y ) );
				_panEnd.copy( _panStart );
				break;

			default:
				_state = STATE.NONE;

		}
		_this.dispatchEvent( startEvent );


	}

	function touchmove( event ) {

		if ( _this.enabled === false ) return;

		event.preventDefault();
		event.stopPropagation();

		switch ( event.touches.length ) {

			case 1:
				_movePrev.copy( _moveCurr );
				_moveCurr.copy( getMouseOnCircle(  event.touches[ 0 ].pageX, event.touches[ 0 ].pageY ) );
				break;

			case 2:
				var dx = event.touches[ 0 ].pageX - event.touches[ 1 ].pageX;
				var dy = event.touches[ 0 ].pageY - event.touches[ 1 ].pageY;
				_touchZoomDistanceEnd = Math.sqrt( dx * dx + dy * dy );

				var x = ( event.touches[ 0 ].pageX + event.touches[ 1 ].pageX ) / 2;
				var y = ( event.touches[ 0 ].pageY + event.touches[ 1 ].pageY ) / 2;
				_panEnd.copy( getMouseOnScreen( x, y ) );
				break;

			default:
				_state = STATE.NONE;

		}

	}

	function touchend( event ) {

		if ( _this.enabled === false ) return;

		switch ( event.touches.length ) {

			case 1:
				_movePrev.copy( _moveCurr );
				_moveCurr.copy( getMouseOnCircle(  event.touches[ 0 ].pageX, event.touches[ 0 ].pageY ) );
				break;

			case 2:
				_touchZoomDistanceStart = _touchZoomDistanceEnd = 0;

				var x = ( event.touches[ 0 ].pageX + event.touches[ 1 ].pageX ) / 2;
				var y = ( event.touches[ 0 ].pageY + event.touches[ 1 ].pageY ) / 2;
				_panEnd.copy( getMouseOnScreen( x, y ) );
				_panStart.copy( _panEnd );
				break;

		}

		_state = STATE.NONE;
		_this.dispatchEvent( endEvent );

	}

	function contextmenu( event ) {

		event.preventDefault();

	}

	this.dispose = function() {

		this.domElement.removeEventListener( 'contextmenu', contextmenu, false );
		this.domElement.removeEventListener( 'mousedown', mousedown, false );
		this.domElement.removeEventListener( 'mousewheel', mousewheel, false );
		this.domElement.removeEventListener( 'MozMousePixelScroll', mousewheel, false ); // firefox

		this.domElement.removeEventListener( 'touchstart', touchstart, false );
		this.domElement.removeEventListener( 'touchend', touchend, false );
		this.domElement.removeEventListener( 'touchmove', touchmove, false );

		document.removeEventListener( 'mousemove', mousemove, false );
		document.removeEventListener( 'mouseup', mouseup, false );

		window.removeEventListener( 'keydown', keydown, false );
		window.removeEventListener( 'keyup', keyup, false );

	};

	this.domElement.addEventListener( 'contextmenu', contextmenu, false );
	this.domElement.addEventListener( 'mousedown', mousedown, false );
	this.domElement.addEventListener( 'mousewheel', mousewheel, false );
	this.domElement.addEventListener( 'MozMousePixelScroll', mousewheel, false ); // firefox

	this.domElement.addEventListener( 'touchstart', touchstart, false );
	this.domElement.addEventListener( 'touchend', touchend, false );
	this.domElement.addEventListener( 'touchmove', touchmove, false );

	window.addEventListener( 'keydown', keydown, false );
	window.addEventListener( 'keyup', keyup, false );

	this.handleResize();

	// force an update at start
	this.update();

};

TrackballControls.prototype = Object.create( THREE.EventDispatcher.prototype );
TrackballControls.prototype.constructor = THREE.TrackballControls;

// stats.js - http://github.com/mrdoob/stats.js
var Stats=function(){function f(a,e,b){a=document.createElement(a);a.id=e;a.style.cssText=b;return a}function l(a,e,b){var c=f("div",a,"padding:0 0 3px 3px;text-align:left;background:"+b),d=f("div",a+"Text","font-family:Helvetica,Arial,sans-serif;font-size:9px;font-weight:bold;line-height:15px;color:"+e);d.innerHTML=a.toUpperCase();c.appendChild(d);a=f("div",a+"Graph","width:74px;height:30px;background:"+e);c.appendChild(a);for(e=0;74>e;e++)a.appendChild(f("span","","width:1px;height:30px;float:left;opacity:0.9;background:"+
b));return c}function m(a){for(var b=c.children,d=0;d<b.length;d++)b[d].style.display=d===a?"block":"none";n=a;}function p(a,b){a.appendChild(a.firstChild).style.height=Math.min(30,30-30*b)+"px";}var q=self.performance&&self.performance.now?self.performance.now.bind(performance):Date.now,k=q(),r=k,t=0,n=0,c=f("div","stats","width:80px;opacity:0.9;cursor:pointer");c.addEventListener("mousedown",function(a){a.preventDefault();m(++n%c.children.length);},false);var d=0,u=Infinity,v=0,b=l("fps","#0ff","#002"),
A=b.children[0],B=b.children[1];c.appendChild(b);var g=0,w=Infinity,x=0,b=l("ms","#0f0","#020"),C=b.children[0],D=b.children[1];c.appendChild(b);if(self.performance&&self.performance.memory){var h=0,y=Infinity,z=0,b=l("mb","#f08","#201"),E=b.children[0],F=b.children[1];c.appendChild(b);}m(n);return {REVISION:14,domElement:c,setMode:m,begin:function(){k=q();},end:function(){var a=q();g=a-k;w=Math.min(w,g);x=Math.max(x,g);C.textContent=(g|0)+" MS ("+(w|0)+"-"+(x|0)+")";p(D,g/200);t++;if(a>r+1E3&&(d=Math.round(1E3*
t/(a-r)),u=Math.min(u,d),v=Math.max(v,d),A.textContent=d+" FPS ("+u+"-"+v+")",p(B,d/100),r=a,t=0,void 0!==h)){var b=performance.memory.usedJSHeapSize,c=performance.memory.jsHeapSizeLimit;h=Math.round(9.54E-7*b);y=Math.min(y,h);z=Math.max(z,h);E.textContent=h+" MB ("+y+"-"+z+")";p(F,b/c);}return a},update:function(){k=this.end();}}};"object"===typeof module&&(module.exports=Stats);

var jmol_colors = [
[1.000,0.000,0.000] ,// None
[1.000,1.000,1.000], // H
[0.851,1.000,1.000], // He
[0.800,0.502,1.000], // Li
[0.761,1.000,0.000], // Be
[1.000,0.710,0.710], // B
[0.565,0.565,0.565], // C
[0.188,0.314,0.973], // N
[1.000,0.051,0.051], // O
[0.565,0.878,0.314], // F
[0.702,0.890,0.961], // Ne
[0.671,0.361,0.949], // Na
[0.541,1.000,0.000], // Mg
[0.749,0.651,0.651], // Al
[0.941,0.784,0.627], // Si
[1.000,0.502,0.000], // P
[1.000,1.000,0.188], // S
[0.122,0.941,0.122], // Cl
[0.502,0.820,0.890], // Ar
[0.561,0.251,0.831], // K
[0.239,1.000,0.000], // Ca
[0.902,0.902,0.902], // Sc
[0.749,0.761,0.780], // Ti
[0.651,0.651,0.671], // V
[0.541,0.600,0.780], // Cr
[0.612,0.478,0.780], // Mn
[0.878,0.400,0.200], // Fe
[0.941,0.565,0.627], // Co
[0.314,0.816,0.314], // Ni
[0.784,0.502,0.200], // Cu
[0.490,0.502,0.690], // Zn
[0.761,0.561,0.561], // Ga
[0.400,0.561,0.561], // Ge
[0.741,0.502,0.890], // As
[1.000,0.631,0.000], // Se
[0.651,0.161,0.161], // Br
[0.361,0.722,0.820], // Kr
[0.439,0.180,0.690], // Rb
[0.000,1.000,0.000], // Sr
[0.580,1.000,1.000], // Y
[0.580,0.878,0.878], // Zr
[0.451,0.761,0.788], // Nb
[0.329,0.710,0.710], // Mo
[0.231,0.620,0.620], // Tc
[0.141,0.561,0.561], // Ru
[0.039,0.490,0.549], // Rh
[0.000,0.412,0.522], // Pd
[0.753,0.753,0.753], // Ag
[1.000,0.851,0.561], // Cd
[0.651,0.459,0.451], // In
[0.400,0.502,0.502], // Sn
[0.620,0.388,0.710], // Sb
[0.831,0.478,0.000], // Te
[0.580,0.000,0.580], // I
[0.259,0.620,0.690], // Xe
[0.341,0.090,0.561], // Cs
[0.000,0.788,0.000], // Ba
[0.439,0.831,1.000], // La
[1.000,1.000,0.780], // Ce
[0.851,1.000,0.780], // Pr
[0.780,1.000,0.780], // Nd
[0.639,1.000,0.780], // Pm
[0.561,1.000,0.780], // Sm
[0.380,1.000,0.780], // Eu
[0.271,1.000,0.780], // Gd
[0.188,1.000,0.780], // Tb
[0.122,1.000,0.780], // Dy
[0.000,1.000,0.612], // Ho
[0.000,0.902,0.459], // Er
[0.000,0.831,0.322], // Tm
[0.000,0.749,0.220], // Yb
[0.000,0.671,0.141], // Lu
[0.302,0.761,1.000], // Hf
[0.302,0.651,1.000], // Ta
[0.129,0.580,0.839], // W
[0.149,0.490,0.671], // Re
[0.149,0.400,0.588], // Os
[0.090,0.329,0.529], // Ir
[0.816,0.816,0.878], // Pt
[1.000,0.820,0.137], // Au
[0.722,0.722,0.816], // Hg
[0.651,0.329,0.302], // Tl
[0.341,0.349,0.380], // Pb
[0.620,0.310,0.710], // Bi
[0.671,0.361,0.000], // Po
[0.459,0.310,0.271], // At
[0.259,0.510,0.588], // Rn
[0.259,0.000,0.400], // Fr
[0.000,0.490,0.000], // Ra
[0.439,0.671,0.980], // Ac
[0.000,0.729,1.000], // Th
[0.000,0.631,1.000], // Pa
[0.000,0.561,1.000], // U
[0.000,0.502,1.000], // Np
[0.000,0.420,1.000], // Pu
[0.329,0.361,0.949], // Am
[0.471,0.361,0.890], // Cm
[0.541,0.310,0.890], // Bk
[0.631,0.212,0.831], // Cf
[0.702,0.122,0.831], // Es
[0.702,0.122,0.729], // Fm
[0.702,0.051,0.651], // Md
[0.741,0.051,0.529], // No
[0.780,0.000,0.400], // Lr
[0.800,0.000,0.349], // Rf
[0.820,0.000,0.310], // Db
[0.851,0.000,0.271], // Sg
[0.878,0.000,0.220], // Bh
[0.902,0.000,0.180], // Hs
[0.922,0.000,0.149]  // Mt
];

// Previous colors are the REAL jmol colors. following list contains VESTA colors.

var vesta_colors = [
[1.000,0.000,0.000] ,// None
[1.00000,0.80000,0.80000] ,// H
[0.98907,0.91312,0.81091] ,// He
[0.52731,0.87953,0.45670] ,// Li
[0.37147,0.84590,0.48292] ,// Be
[0.12490,0.63612,0.05948] ,// B
[0.50430,0.28659,0.16236] ,// C
[0.69139,0.72934,0.90280] ,// N
[0.99997,0.01328,0.00000] ,// O
[0.69139,0.72934,0.90280] ,// F
[0.99954,0.21788,0.71035] ,// Ne
[0.97955,0.86618,0.23787] ,// Na
[0.98773,0.48452,0.08470] ,// Mg
[0.50718,0.70056,0.84062] ,// Al
[0.10596,0.23226,0.98096] ,// Si
[0.75557,0.61256,0.76425] ,// P
[1.00000,0.98071,0.00000] ,// S
[0.19583,0.98828,0.01167] ,// Cl
[0.81349,0.99731,0.77075] ,// Ar
[0.63255,0.13281,0.96858] ,// K
[0.35642,0.58863,0.74498] ,// Ca
[0.71209,0.38930,0.67279] ,// Sc
[0.47237,0.79393,1.00000] ,// Ti
[0.90000,0.10000,0.00000] ,// V
[0.00000,0.00000,0.62000] ,// Cr
[0.66148,0.03412,0.62036] ,// Mn
[0.71051,0.44662,0.00136] ,// Fe
[0.00000,0.00000,0.68666] ,// Co
[0.72032,0.73631,0.74339] ,// Ni
[0.13390,0.28022,0.86606] ,// Cu
[0.56123,0.56445,0.50799] ,// Zn
[0.62292,0.89293,0.45486] ,// Ga
[0.49557,0.43499,0.65193] ,// Ge
[0.45814,0.81694,0.34249] ,// As
[0.60420,0.93874,0.06122] ,// Se
[0.49645,0.19333,0.01076] ,// Br
[0.98102,0.75805,0.95413] ,// Kr
[1.00000,0.00000,0.60000] ,// Rb
[0.00000,1.00000,0.15259] ,// Sr
[0.40259,0.59739,0.55813] ,// Y
[0.00000,1.00000,0.00000] ,// Zr
[0.29992,0.70007,0.46459] ,// Nb
[0.70584,0.52602,0.68925] ,// Mo
[0.80574,0.68699,0.79478] ,// Tc
[0.81184,0.72113,0.68089] ,// Ru
[0.80748,0.82205,0.67068] ,// Rh
[0.75978,0.76818,0.72454] ,// Pd
[0.72032,0.73631,0.74339] ,// Ag
[0.95145,0.12102,0.86354] ,// Cd
[0.84378,0.50401,0.73483] ,// In
[0.60764,0.56052,0.72926] ,// Sn
[0.84627,0.51498,0.31315] ,// Sb
[0.67958,0.63586,0.32038] ,// Te
[0.55914,0.12200,0.54453] ,// I
[0.60662,0.63218,0.97305] ,// Xe
[0.05872,0.99922,0.72578] ,// Cs
[0.11835,0.93959,0.17565] ,// Ba
[0.35340,0.77057,0.28737] ,// La
[0.82055,0.99071,0.02374] ,// Ce
[0.99130,0.88559,0.02315] ,// Pr
[0.98701,0.55560,0.02744] ,// Nd
[0.00000,0.00000,0.96000] ,// Pm
[0.99042,0.02403,0.49195] ,// Sm
[0.98367,0.03078,0.83615] ,// Eu
[0.75325,0.01445,1.00000] ,// Gd
[0.44315,0.01663,0.99782] ,// Tb
[0.19390,0.02374,0.99071] ,// Dy
[0.02837,0.25876,0.98608] ,// Ho
[0.28688,0.45071,0.23043] ,// Er
[0.00000,0.00000,0.88000] ,// Tm
[0.15323,0.99165,0.95836] ,// Yb
[0.15097,0.99391,0.71032] ,// Lu
[0.70704,0.70552,0.35090] ,// Hf
[0.71952,0.60694,0.33841] ,// Ta
[0.55616,0.54257,0.50178] ,// W
[0.70294,0.69401,0.55789] ,// Re
[0.78703,0.69512,0.47379] ,// Os
[0.78975,0.81033,0.45049] ,// Ir
[0.79997,0.77511,0.75068] ,// Pt
[0.99628,0.70149,0.22106] ,// Au
[0.82940,0.72125,0.79823] ,// Hg
[0.58798,0.53854,0.42649] ,// Tl
[0.32386,0.32592,0.35729] ,// Pb
[0.82428,0.18732,0.97211] ,// Bi
[0.00000,0.00000,1.00000] ,// Po
[0.00000,0.00000,1.00000] ,// At
[1.00000,1.00000,0.00000] ,// Rn
[0.00000,0.00000,0.00000] ,// Fr
[0.42959,0.66659,0.34786] ,// Ra
[0.39344,0.62101,0.45034] ,// Ac
[0.14893,0.99596,0.47106] ,// Th
[0.16101,0.98387,0.20855] ,// Pa
[0.47774,0.63362,0.66714] ,// U
[0.30000,0.30000,0.30000] ,// Np
[0.30000,0.30000,0.30000] ,// Pu
[0.30000,0.30000,0.30000] ,// Am
[0.471,0.361,0.890], // Cm
[0.541,0.310,0.890], // Bk
[0.631,0.212,0.831], // Cf
[0.702,0.122,0.831], // Es
[0.702,0.122,0.729], // Fm
[0.702,0.051,0.651], // Md
[0.741,0.051,0.529], // No
[0.780,0.000,0.400], // Lr
[0.800,0.000,0.349], // Rf
[0.820,0.000,0.310], // Db
[0.851,0.000,0.271], // Sg
[0.878,0.000,0.220], // Bh
[0.902,0.000,0.180], // Hs
[0.922,0.000,0.149]  // Mt
];

var atomic_number = {};
atomic_number['H' ]  =1;
atomic_number['He']  =2;
atomic_number['Li']  =3;
atomic_number['Be']  =4;
atomic_number['B' ]  =5;
atomic_number['C' ]  =6;
atomic_number['N' ]  =7;
atomic_number['O' ]  =8;
atomic_number['F' ]  =9;
atomic_number['Ne']  =10;
atomic_number['Na']  =11;
atomic_number['Mg']  =12;
atomic_number['Al']  =13;
atomic_number['Si']  =14;
atomic_number['P' ]  =15;
atomic_number['S' ]  =16;
atomic_number['Cl']  =17;
atomic_number['Ar']  =18;
atomic_number['K' ]  =19;
atomic_number['Ca']  =20;
atomic_number['Sc']  =21;
atomic_number['Ti']  =22;
atomic_number['V' ]  =23;
atomic_number['Cr']  =24;
atomic_number['Mn']  =25;
atomic_number['Fe']  =26;
atomic_number['Co']  =27;
atomic_number['Ni']  =28;
atomic_number['Cu']  =29;
atomic_number['Zn']  =30;
atomic_number['Ga']  =31;
atomic_number['Ge']  =32;
atomic_number['As']  =33;
atomic_number['Se']  =34;
atomic_number['Br']  =35;
atomic_number['Kr']  =36;
atomic_number['Rb']  =37;
atomic_number['Sr']  =38;
atomic_number['Y' ]  =39;
atomic_number['Zr']  =40;
atomic_number['Nb']  =41;
atomic_number['Mo']  =42;
atomic_number['Tc']  =43;
atomic_number['Ru']  =44;
atomic_number['Rh']  =45;
atomic_number['Pd']  =46;
atomic_number['Ag']  =47;
atomic_number['Cd']  =48;
atomic_number['In']  =49;
atomic_number['Sn']  =50;
atomic_number['Sb']  =51;
atomic_number['Te']  =52;
atomic_number['I' ]  =53;
atomic_number['Xe']  =54;
atomic_number['Cs']  =55;
atomic_number['Ba']  =56;
atomic_number['La']  =57;
atomic_number['Ce']  =58;
atomic_number['Pr']  =59;
atomic_number['Nd']  =60;
atomic_number['Pm']  =61;
atomic_number['Sm']  =62;
atomic_number['Eu']  =63;
atomic_number['Gd']  =64;
atomic_number['Tb']  =65;
atomic_number['Dy']  =66;
atomic_number['Ho']  =67;
atomic_number['Er']  =68;
atomic_number['Tm']  =69;
atomic_number['Yb']  =70;
atomic_number['Lu']  =71;
atomic_number['Hf']  =72;
atomic_number['Ta']  =73;
atomic_number['W' ]  =74;
atomic_number['Re']  =75;
atomic_number['Os']  =76;
atomic_number['Ir']  =77;
atomic_number['Pt']  =78;
atomic_number['Au']  =79;
atomic_number['Hg']  =80;
atomic_number['Tl']  =81;
atomic_number['Pb']  =82;
atomic_number['Bi']  =83;
atomic_number['Po']  =84;
atomic_number['At']  =85;
atomic_number['Rn']  =86;
atomic_number['Fr']  =87;
atomic_number['Ra']  =88;
atomic_number['Ac']  =89;
atomic_number['Th']  =90;
atomic_number['Pa']  =91;
atomic_number['U' ]  =92;
atomic_number['Np']  =93;
atomic_number['Pu']  =94;
atomic_number['Am']  =95;
atomic_number['Cm']  =96;
atomic_number['Bk']  =97;
atomic_number['Cf']  =98;
atomic_number['Es']  =99;
atomic_number['Fm']  =100;
atomic_number['Md']  =101;
atomic_number['No']  =102;
atomic_number['Lr']  =103;
atomic_number['Rf']  =104;
atomic_number['Db']  =105;
atomic_number['Sg']  =106;
atomic_number['Bh']  =107;
atomic_number['Hs']  =108;
atomic_number['Mt']  =109;


var atomic_symbol$1 = ['','H','He','Li','Be','B','C','N','O','F','Ne','Na','Mg','Al','Si',
'P','S','Cl','Ar','K' ,'Ca','Sc','Ti','Vi','Cr','Mn','Fe','Co','Ni','Cu','Zn','Ga',
'Ge','As','Se','Br','Kr','Rb','Sr','Y' ,'Zr','Nb','Mo','Tc','Ru','Rh','Pd','Ag',
'Cd','In','Sn','Sb','Te','I' ,'Xe','Cs','Ba','La','Ce','Pr','Nd','Pm','Sm','Eu',
'Gd','Tb','Dy','Ho','Er','Tm','Yb','Lu','Hf','Ta','W' ,'Re','Os','Ir','Pt','Au',
'Hg','Tl','Pb','Bi','Po','At','Rn','Fr','Ra','Ac','Th','Pa','U' ,'Np','Pu','Am',
'Cm','Bk','Cf','Es','Fm','Md','No','Lr','Rf','Db','Sg','Bh','Hs','Mt'];

//from phonopy
var atomic_mass = [null,1.00794,4.002602,6.941,9.012182,10.811,12.0107,14.0067,15.9994,
18.9984032,20.1797, 22.98976928,24.305,26.9815386,28.0855,30.973762,32.065,35.453,39.948,
39.0983,40.078,44.955912,47.867,50.9415,51.9961,54.938045,55.845,58.933195,58.6934,63.546,
65.38,69.723,72.64,74.9216,78.96,79.904,83.798,85.4678,87.62,88.90585,91.224,92.90638,95.96,
null,101.07,102.9055,106.42,107.8682,112.411,114.818,118.71,121.76,127.6,126.90447,131.293,
132.9054519,137.327,138.90547,140.116,140.90765,144.242,null,150.36,151.964,157.25,
158.92535,162.5,164.93032,167.259,168.93421,173.054,174.9668,178.49,180.94788,183.84,
186.207,190.23,192.217,195.084,196.966569,200.59,204.3833,207.2,208.9804,null,null,null,
null,null,null,232.03806,231.03588,238.02891,null,null,null,null,null,null,null,null,
null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null];

/* Covalent radii from:

  Covalent radii revisited,
  Beatriz Cordero, Verónica Gómez, Ana E. Platero-Prats, Marc Revés,
  Jorge Echeverría, Eduard Cremades, Flavia Barragán and Santiago Alvarez,
  Dalton Trans., 2008, 2832-2838 DOI:10.1039/B801115J
  */

var covalent_radii =
[0.0,  0.31, 0.28, 1.28, 0.96, 0.84, 0.76, 0.71, 0.66, 0.57, //0
 0.58, 1.66, 1.41, 1.21, 1.11, 1.07, 1.05, 1.02, 1.06, 2.03, //1
 1.76, 1.70, 1.60, 1.53, 1.39, 1.39, 1.32, 1.26, 1.24, 1.32, //2
 1.22, 1.22, 1.20, 1.19, 1.20, 1.20, 1.16, 2.20, 1.95, 1.90, //3
 1.75, 1.64, 1.54, 1.47, 1.46, 1.42, 1.39, 1.45, 1.44, 1.42, //4
 1.39, 1.39, 1.38, 1.39, 1.40, 2.44, 2.15, 2.07, 2.04, 2.03, //5
 2.01, 1.99, 1.98, 1.98, 1.96, 1.94, 1.92, 1.92, 1.89, 1.90, //6
 1.87, 1.87, 1.75, 1.70, 1.62, 1.51, 1.44, 1.41, 1.36, 1.36, //7
 1.32, 1.45, 1.46, 1.48, 1.40, 1.50, 1.50, 2.60, 2.21, 2.15, //8
 2.06, 2.00, 1.96, 1.90, 1.87, 1.80, 1.69, 0,    0,    0,    //9
 0,    0,    0,    0 ];                                       //10

const pi$1 = 3.14159265359;

function matrix_scale(a,scale) {
  return [a[0].map(function(x) {return x*scale}),
          a[1].map(function(x) {return x*scale}),
          a[2].map(function(x) {return x*scale})];
}

function vec_scale(a,scale) {
    return [a[0]*scale,a[1]*scale,a[2]*scale];
}

function vec_dot(a,b) {
    return a[0]*b[0] + a[1]*b[1] + a[2]*b[2];
}

function vec_cross(a,b) {
    return [a[1]*b[2]-a[2]*b[1],
            a[2]*b[0]-a[0]*b[2],
            a[0]*b[1]-a[1]*b[0]]
}

function distance(a,b) {
    /* Distance between two points
    */
    let x = a[0]-b[0];
    let y = a[1]-b[1];
    let z = a[2]-b[2];
    return Math.sqrt(x*x + y*y + z*z);
}

function getCombinations(elements) {
    /*
    Get combintations 2 by two based on:
    http://stackoverflow.com/questions/29169011/javascript-arrays-finding-the-number-of-combinations-of-2-elements
    */
    let combos = [];
    for (var i = 0; i < elements.length; i++)
        for (var j = i + 1; j < elements.length; j++)
            combos.push([elements[i], elements[j]]);
    return combos;
}

function rec_lat(lat) {
    /* Calculate the reciprocal lattice
    */
    let a1 = lat[0];
    let a2 = lat[1];
    let a3 = lat[2];
    let b1 = vec_cross(a2,a3);
    let b2 = vec_cross(a3,a1);
    let b3 = vec_cross(a1,a2);
    let v = vec_dot(a1,b1);
    b1 = vec_scale(b1,1/v);
    b2 = vec_scale(b2,1/v);
    b3 = vec_scale(b3,1/v);
    return [b1,b2,b3]
}

function point_in_list(point,points) {
    /*
    Return the index of the point if it is present in a list of points
    */
    for (let i=0; i<points.length; i++) {
        if (distance(point,points[i]) < 1e-4) {
            return {found:true,index:i};
        }
    }
    return {found:false};
}

function red_car(a,lat) {
    let x=a[0];
    let y=a[1];
    let z=a[2];
    return [x*lat[0][0] + y*lat[1][0] + z*lat[2][0],
            x*lat[0][1] + y*lat[1][1] + z*lat[2][1],
            x*lat[0][2] + y*lat[1][2] + z*lat[2][2]]
}

function red_car_list(red,lat) {
    let car = [];
    for (let i=0; i<red.length; i++) {
        car.push(red_car(red[i],lat));
    }
    return car;
}

function get_formula(atom_types) {
    //create the name from the elements
    //from https://stackoverflow.com/questions/15052702/count-unique-elements-in-array-without-sorting
    let counts = {};
    for (var i = 0; i < atom_types.length; i++) {
        counts[atom_types[i]] = 1 + (counts[atom_types[i]] || 0);
    }

    //make the name from the counter
    let name = "";
    for (let element in counts) {
        name += element+counts[element];
    }
    return name;
}

function getReasonableRepetitions(natoms,lat) {
    /*
    choose a reasonable number of repetitions
    Some logic can be implemented here to improve
    in which directions the repetitions are made
    */

    if (natoms < 4)        { return [3,3,3] }    if (4 < natoms < 15)   { return [2,2,2] }    if (15 < natoms < 50)  { return [2,2,1] }    if (50 < natoms)       { return [1,1,1] }
}

THREE.TrackballControls =  TrackballControls;

const vec_y = new THREE.Vector3( 0, 1, 0 );
const vec_0 = new THREE.Vector3( 0, 0, 0 );
const direction = new THREE.Vector3( 0, 0, 0 );
const quaternion = new THREE.Quaternion();

function getBond( point1, point2 ) {
    /*
    get a quaternion and midpoint that links two points
    */
    direction.subVectors(point2, point1);
    quaternion.setFromUnitVectors( vec_y, direction.clone().normalize() );

    return { quaternion: quaternion,
             midpoint: point1.clone().add( direction.multiplyScalar(0.5) ) };
}

class VibCrystal {
    /*
    Class to show phonon vibrations using Three.js and WebGl
    */

    constructor(container) {

        this.display = 'jmol'; //use jmol or vesta displaystyle

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
        if (this.display == 'vesta') {
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
		this.modified_covalent_radii = JSON.parse(JSON.stringify(covalent_radii));
    }

    //functions to link the DOM buttons with this class
    setCameraDirectionButton(dom_button,direction) {
    /* Bind the action to set the direction of the camera using direction
       direction can be 'x','y','z'
    */
        let self = this;
        dom_button.click( function() { self.setCameraDirection(direction); } );
    }

    setPlayPause(dom_input) {
        dom_input.click( this.playpause.bind(this) );
    }

    setCellCheckbox(dom_checkbox) {
        let self = this;
        dom_checkbox.click( function() {
            self.cell = this.checked;
            self.updatelocal();
        } );
    }

    setDisplayCombo(dom_combo) {
        var self = this;
        dom_combo[0].onchange = function() {
            self.display = dom_combo[0].options[dom_combo[0].selectedIndex].value;
            self.updatelocal();
        };
    }

    setWebmButton(dom_button) {
        let self = this;
        /*
        check if its Chrome 1+ taken from
        http://stackoverflow.com/questions/9847580/how-to-detect-safari-chrome-ie-firefox-and-opera-browser
        only show webm button for chrome
        */
        let isChrome = !!window.chrome && !!window.chrome.webstore;
        if (!isChrome) {
            dom_button.hide();
        }

        dom_button.click(function() { self.capturestart('webm'); });
    }

    setGifButton(dom_button) {
        let self = this;
        dom_button.click(function() { self.capturestart('gif'); });
    }

    setArrowsCheckbox(dom_checkbox) {
        let self = this;
        this.arrows = dom_checkbox.checked;
        dom_checkbox.click( function() {
            self.arrows = this.checked;
            self.updatelocal();
        });
    }

    setArrowsInput(dom_range) {
        let self = this;

        dom_range.val(self.arrowScale);
        dom_range.attr('min',self.minArrowScale);
        dom_range.attr('max',self.maxArrowScale);
        dom_range.attr('step',self.stepArrowScale);
        dom_range.change( function () {
            self.arrowScale = this.value;
        });
    }

   setAmplitudeInput(dom_number,dom_range) {
        let self = this;

        dom_number.val(self.amplitude);
        dom_number.keyup( function () {
            if (this.value < dom_range.min) { dom_range.attr('min', this.value); }
            if (this.value > dom_range.max) { dom_range.attr('max', this.value); }
            self.amplitude = this.value;
            dom_range.val(this.value);
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
        let self = this;

        dom_range.val(self.speed);
        dom_range.attr('min',self.minSpeed);
        dom_range.attr('max',self.maxSpeed);
        dom_range.attr('step',self.stepSpeed);
        dom_range.change( function () {
            self.speed = this.value;
        });
    }

    setCovalentRadiiSelect(dom_select,dom_input) {
        let self = this;
        this.dom_covalent_radii_select = dom_select;
        this.dom_covalent_radii_input = dom_input;
        dom_select.change( function() {
            dom_input.val(self.modified_covalent_radii[this.value]);
        });
    }

    adjustCovalentRadiiSelect() {
        let unique_atom_numbers = this.atom_numbers.filter((v, i, a) => a.indexOf(v) === i);

        this.dom_covalent_radii_select.empty();
        for (let i=0; i<unique_atom_numbers.length; i++) {
            this.dom_covalent_radii_select.append('<option value="' + unique_atom_numbers[i] + '">' + atomic_symbol$1[unique_atom_numbers[i]] + '</option>');
        }
        this.dom_covalent_radii_input.val(this.modified_covalent_radii[this.dom_covalent_radii_select.val()]);
    }

    setCovalentRadiiButton(dom_select,dom_input,dom_button) {
        let self = this;
        dom_button.click( function() {
            self.modified_covalent_radii[dom_select.val()] = parseFloat(dom_input.val());
            self.updatelocal();
        });
    }

    setCovalentRadiiResetButton(dom_select,dom_input,dom_button) {
        let self = this;
        dom_button.click( function() {
            self.modified_covalent_radii = JSON.parse(JSON.stringify(covalent_radii));
            dom_input.val(self.modified_covalent_radii[dom_select.val()]);
            self.updatelocal();
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
        if (this.display == 'vesta') {
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
        this.container0.appendChild( this.renderer.domElement );
        this.canvas = this.renderer.domElement;
        //this.canvas.style.width = this.dimensions.width + "px";
        //this.canvas.style.height = this.dimensions.height + "px";

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
                        workersPath: 'libs/',
                        verbose: true,
                        frameMax: this.fps,
                        end: this.captureend.bind(this,format),
                        framerate: this.fps,
                        onProgress: function( p ) { progress.style.width = ( p * 100 ) + '%'; }
                      };

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
            if (this.display == 'vesta') {
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
        if (this.display != 'vesta') {
            sphereGeometry = new THREE.SphereGeometry( this.sphereRadius, this.sphereLat, this.sphereLon);
        }

        //add a ball for each atom
        for (let i=0; i<atoms.length; i++) {
            if (this.display == 'vesta') {
                sphereGeometry = new THREE.SphereGeometry( covalent_radii[atom_numbers[atoms[i][0]]]/2.3,
                                                           this.sphereLat, this.sphereLon);
            }
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
            length = ad.distanceTo(bd);
            let cra = this.modified_covalent_radii[a.atom_number];
            let crb = this.modified_covalent_radii[b.atom_number];
            if (length < cra + crb || length < this.nndist ) {
                this.bonds.push( [ad,bd,length] );
                if (this.display == 'vesta') {
                    let cr = (vesta_colors[a.atom_number][0] + vesta_colors[b.atom_number][0]) / 2;
                    let cg = (vesta_colors[a.atom_number][1] + vesta_colors[b.atom_number][1]) / 2;
                    let cb = (vesta_colors[a.atom_number][2] + vesta_colors[b.atom_number][2]) / 2;
                    material.color.setRGB( cr, cg, cb );
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
        let scene = this.scene;

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
            this.init(phononweb);
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
        this.adjustCovalentRadiiSelect();
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
        this.time;
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
        let phase = Complex.Polar(this.amplitude,t*2.0*pi$1);
        let v = new THREE.Vector3();

        if (!this.paused) {

            //update positions according to vibrational modes
            for (let i=0; i<this.atomobjects.length; i++) {
                this.atomobjects[i];
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

class PhononHighcharts {

    constructor(container) {

        this.container = container;

        this.phonon = { highsym_qpts: [] };
        this.phonon;

        this.labels_formatter = function(phonon) {
            return function() {
                if ( phonon.highsym_qpts[this.value] ) {
                    let label = phonon.highsym_qpts[this.value];
                    label = label.replace("$","").replace("$","");
                    label = label.replace("\\Gamma","Γ");
                    label = label.replace("GAMMA","Γ");
                    label = label.replace("DELTA","Δ");
                    label = label.replace("\\Sigma","Σ");
                    label = label.replace("_","");
                    return label;
                }
                return ''
            }
        };

        this.HighchartsOptions = {
            chart: { type: 'line',
                     zoomType: 'xy' },
            title: { text: 'Phonon dispersion' },
            xAxis: { plotLines: [],
                     lineWidth: 0,
                     minorGridLineWidth: 0,
                     lineColor: 'transparent',
                     minorTickLength: 0,
                     tickLength: 0,
                     labels: {
                        style: { fontSize:'20px' }
                     }
                   },
            yAxis: { plotLines: [],
                     title: { text: 'Frequency (cm<sup>-1</sup>)' },
                     plotLines: [ {value: 0, color: '#000000', width: 2} ]
                   },
            tooltip: { formatter: function(x) { return Math.round(this.y*100)/100+' cm<sup>-1</sup>' } },
            legend: { enabled: false },
            series: [],
            plotOptions: { line:   { animation: false },
                           series: { allowPointSelect: true,
                                     marker: { states: { select: { fillColor: 'red',
                                                                   radius: 5,
                                                                   lineWidth: 0 }
                                                       }
                                             },
                                     cursor: 'pointer',
                                     point: { events: { } }
                                   }
                         }
        };
    }

    setClickEvent( phononweb ) {
        let click_event = function () {
            phononweb.k = phononweb.phonon.qindex[this.x];
            phononweb.n = this.series.name;
            phononweb.setVibrations();
            phononweb.visualizer.update(phononweb);
        };
        this.HighchartsOptions.plotOptions.series.point.events.click = click_event;
    }

    update(phonon) {
        /*
        update phonon dispersion plot
        */

        this.phonon = phonon;

        //set the minimum of the plot with the smallest phonon frequency
        let minVal = 0;
        for (let i=0; i<phonon.eigenvalues.length; i++) {
            let min = Math.min.apply(null, phonon.eigenvalues[i]);
            if ( minVal > min ) {
                minVal = min;
            }
        }
        if (minVal > -1) minVal = 0;


        //get positions of high symmetry qpoints
        let ticks = [];
        for (let k in phonon.highsym_qpts) {
            ticks.push(k);
        }

        //get the high symmetry qpoints for highcharts
        let plotLines = [];
        for (let i=0; i<ticks.length ; i++ ) {
            plotLines.push({ value: ticks[i],
                             color: '#000000',
                             width: 1 });
        }

        //actually set the eigenvalues
        this.getGraph(phonon);

        this.HighchartsOptions.series = this.highcharts;
        this.HighchartsOptions.xAxis.tickPositions = ticks;
        this.HighchartsOptions.xAxis.plotLines = plotLines;
        this.HighchartsOptions.xAxis.labels.formatter = this.labels_formatter(phonon);
        this.HighchartsOptions.yAxis.min = minVal;
        this.container.highcharts(this.HighchartsOptions);
    }

    getGraph(phonon) {
        /*
        From a phonon object containing:
            distances : distance between the k-points
            eigenvalues : eigenvalues
        put the data in the highcharts format
        */

        let eival = phonon.eigenvalues;
        let dists = phonon.distances;
        let line_breaks = phonon.line_breaks;

        let nbands = eival[0].length;
        this.highcharts = [];

        //go through the eigenvalues and create eival list
        for (let n=0; n<nbands; n++) {
            //iterate over the line breaks
            for (let i=0; i<line_breaks.length; i++) {
                let startk = line_breaks[i][0];
                let endk = line_breaks[i][1];

                let eig = [];

                //iterate over the q-points
                for (let k=startk; k<endk; k++) {
                    eig.push([dists[k],eival[k][n]]);
                }

                //add data
                this.highcharts.push({
                    name:  n+"",
                    color: "#0066FF",
                    marker: { radius: 1, symbol: "circle"},
                    data: eig
                   });
            }
        }
    }
}

class LocalDB {
    /*
    Interact with the local database of phonons
    Hosted on Github
    */

    constructor() {
        this.name = "localdb";
        this.year = 2015;
        this.author = "H. Miranda";
        this.url = "http://henriquemiranda.github.io/";
    }

    isAvailable() {
        return false;
    }

    get_materials(callback) {
        /*
        this function load the materials from a certain source and returns then to the callback
        Some pre-processing of the data might be required and can be implemented here
        */
        let reference = this.author+", "+"<a href="+this.url+">"+this.name+"</a> ("+this.year+")";
        let name = this.name;

        function dothings(materials) {

            for (let i=0; i<materials.length; i++) {
                let m = materials[i];
                m.source = name;
                m.type = "json";
                m.reference = reference;

                //create the url
                let folder = m.folder;
                m.url = folder+"/data.json";
            }
            callback(materials);
        }

        $.get('localdb/models.json', dothings);
    }

}

class ContribDB {
    /*
    Interact with the local database of phonons contributed by users
    Hosted on Github
    */

    constructor() {
        this.name = "contribdb";
    }

    get_materials(callback) {
        /*
        this function load the materials from a certain source and returns then to the callback
        Some pre-processing of the data might be required and can be implemented here
        */
        let name = this.name;

        function dothings(materials) {

            for (let i=0; i<materials.length; i++) {
                let m = materials[i];
                m.source = name;
                m.type = "json";

                m.reference = m.author+", "+"<a href="+m.url+">"+m.journal+"</a> ("+m.year+")";


                //create the url
                m.url = m.folder+"/data.json";
            }
            callback(materials);
        }

        $.get('contribdb/models.json', dothings);
    }

}

class MaterialsProjectDB {
    /*
    Interact with the local database of phonons
    Hosted on Github
    */

    constructor() {
        this.name = "mpdb";
        this.year = 2017;
        this.author = "G. Petretto et al.";
        this.url = "";
        this.apikey = "fAGQ0aT2TsXeidxU";
    }

    isAvailable() {
        return false;
    }

    get_materials(callback) {
        /*
        this function load the materials from a certain source and returns then to the callback
        Some pre-processing of the data might be required and can be implemented here
        */
        let reference = this.author+", "+"<a href="+this.url+">"+this.name+"</a> ("+this.year+")";
        let name = this.name;
        let apikey = this.apikey;

        function dothings(materials) {

            for (let i=0; i<materials.length; i++) {
                let m = materials[i];
                m.source = name;
                m.type = "rest";
                m.reference = reference;
                m.url = "https://materialsproject.org/rest/v2/materials/mp-"+m.id+"/phononbs?web=true";
                m.name = m.name;
                m.link = "https://materialsproject.org/materials/mp-"+m.id;
                m.apikey = apikey;
            }
            callback(materials);
        }

        $.get('mpdb/models.json', dothings);
    }

}

class LocalMaterialsProjectDB {
    /*
    Interact with the local database of phonons
    Hosted on Github
    */

    constructor() {
        this.name = "mpdb";
        this.year = 2017;
        this.author = "G. Petretto et al.";
        this.url = "";
        this.list = 'localmpdb/models.json';
    }

    isAvailable() {
        return false;
    }

    get_materials(callback) {
        /*
        this function load the materials from a certain source and returns then to the callback
        Some pre-processing of the data might be required and can be implemented here
        */
        let reference = this.author+", "+"<a href="+this.url+">"+this.name+"</a> ("+this.year+")";
        let name = this.name;

        function dothings(materials) {

            for (let i=0; i<materials.length; i++) {
                let m = materials[i];
                m.source = name;
                m.type = "json";
                m.reference = reference;
                m.url = "localmpdb/mp-"+m.id+".json";
                m.name = m.name;
                m.link = "https://materialsproject.org/materials/mp-"+m.id;
            }
            callback(materials);
        }

        $.get(this.list, dothings);
    }

}

var thz2cm1 = 33.35641;

class PhononJson {

    getFromURL(url,callback) {
        /*
        load a file from url
        */

        function onLoadEndHandler(text) {
            this.getFromJson(text,callback);
        }
        $.getJSON(url,onLoadEndHandler.bind(this));

    }

    getFromFile(file,callback) {
        /*
        file is a javasccript file object with the ".json" file in data
        */

        let json_reader = new FileReader();

        function onLoadEndHandler() {
            this.getFromString(json_reader.result,callback);
        }
        //read the files
        json_reader.onloadend = onLoadEndHandler.bind(this);
        json_reader.readAsText(file);

    }

    getFromString(string,callback) {
        /*
        string is the content of the ".json" file as a string
        */

        let json = JSON.parse(string);
        this.getFromJson(json,callback);
    }

    getFromREST(url,apikey,callback) {

        let xhr = new XMLHttpRequest();
        console.log(url);
        let urld = decodeURIComponent(url);
        console.log(urld);
        let params = new URLSearchParams(urld.split("?")[1]);
        let field;
        if (params.has("_fields")) {
          field = params.get("_fields").split(",")[0];
        }
        console.log(field);
        if (field) {
          xhr.open('GET', urld, true);
          if (apikey) { xhr.setRequestHeader('x-api-key', apikey); }          xhr.onload = function () {
            let json = JSON.parse(xhr.responseText);
            this.getFromJson(json,callback,field);
          }.bind(this);
          xhr.send(null);
        }
    }

    getFromJson(json,callback,field="ph_bs") {
        if (json.hasOwnProperty('@class')) {
            this.getFromPMGJson(json,callback);
        } else if (
            field &&
            json.hasOwnProperty('data') &&
            Array.isArray(json['data']) &&
            json['data'].length === 1 &&
            json['data'][0].hasOwnProperty(field)
        ) {
            this.getFromPMGJson(json['data'][0][field],callback);
        } else { this.getFromInternalJson(json,callback); }
    }

    getFromInternalJson(data,callback) {
        /*
        It was determined the json dictionary is the internal format
        */

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
        for (let i=0; i<this.distances.length; i++) {
            this.qindex[this.distances[i]] = i;
        }

        //get high symmetry qpoints
        this.highsym_qpts = {};
        for (let i=0; i<data["highsym_qpts"].length; i++) {
            let dist = this.distances[data["highsym_qpts"][i][0]-1];
            this.highsym_qpts[dist] = data["highsym_qpts"][i][1];
        }

        //get line breaks
        this.getLineBreaks(data);

        callback();
    }

    getFromPMGJson(data,callback) {
        /*
        It was determined that the json dictionary is the pymatgen format
        */

        this.addatomphase = false;

        //system information (not needed for now)
        let structure = data["structure"];

        //lattice
        this.lat = structure["lattice"]["matrix"];
        let rlat = rec_lat(this.lat);
        this.repetitions = [3,3,3];

        this.atom_pos_car = [];
        this.atom_pos_red = [];
        this.atom_types = [];
        this.atom_numbers = [];

        let sites = structure["sites"];
        for (let i=0; i<sites.length; i++) {
            let site = sites[i];

            let atom_type = site['label'];
            this.atom_types.push(atom_type);
            this.atom_numbers.push(atomic_number[atom_type]);
            this.atom_pos_car.push(site['xyz']);
            this.atom_pos_red.push(site['abc']);
        }

        this.natoms = sites.length;
        this.name = get_formula(this.atom_types);

        //dispersion
        let qpoints_red = data['qpoints'];
        this.kpoints = qpoints_red;

        /*
        get high symmetry qpoints
        Where we have to match the qpoint with a certain label with the
        high-symmetry point
        */
        let labels_dict = data["labels_dict"];
        let high_symmetry_points_red = [];
        let high_symmetry_labels = [];
        for (let label in labels_dict) {
            let qpoint = labels_dict[label];
            high_symmetry_points_red.push(qpoint);
            high_symmetry_labels.push(label);
        }

        let high_symmetry_points_car = red_car_list(high_symmetry_points_red,rlat);
        let highsym_qpts_index = {};
        for (let nq=0; nq<qpoints_red.length; nq++) {
            let result = point_in_list(qpoints_red[nq],high_symmetry_points_car);
            if (result["found"]) {
                let label = high_symmetry_labels[result["index"]];
                highsym_qpts_index[nq] = label;
            }
        }

        //calculate the distances between the qpoints
        this.distances = [0];
        this.line_breaks = [];
        let nqstart = 0;
        let dist = 0;
        for (let nq=1; nq<this.kpoints.length; nq++) {
            //handle jumps
            if ((nq in highsym_qpts_index) && (nq-1 in highsym_qpts_index) &&
                (highsym_qpts_index[nq] != highsym_qpts_index[nq-1])) {
                highsym_qpts_index[nq] += "|"+highsym_qpts_index[nq-1];
                delete highsym_qpts_index[nq-1];
                this.line_breaks.push([nqstart,nq]);
                nqstart = nq;
            }
            else
            {
                dist = dist + distance(this.kpoints[nq-1],this.kpoints[nq]);
            }
            this.distances.push(dist);
        }
        this.line_breaks.push([nqstart,this.kpoints.length]);

        this.highsym_qpts = {};
        for (let nq in highsym_qpts_index) {
            let dist = this.distances[nq];
            let label = highsym_qpts_index[nq];
            this.highsym_qpts[dist] = label;
        }

        //get qindex
        this.qindex = {};
        for (let i=0; i<this.distances.length; i++) {
            this.qindex[this.distances[i]] = i;
        }

        /*
        fill in the list of eigenvalues and eigenvectors
        I will transpose to keep compatibility between the old interfaces
        even though this is super ugly
        */
        let eig = data["bands"];
        let eiv = data["eigendisplacements"];
        let nbands = eig.length;
        let nqpoints = eig[0].length;

        /*
        the eigenvectors have to be scaled.
        We should detemrine the scale with respect to the other conventions.
        For now we use a large value that visually looks ok
        */
        let scale = 200;

        this.vec = [];
        this.eigenvalues = [];
        for (let nq=0; nq<nqpoints; nq++) {
            let eig_qpoint = [];
            let eiv_qpoint = [];

            for (let n=0; n<nbands; n++) {
                eig_qpoint.push(eig[n][nq]*thz2cm1);

                let eiv_qpoint_atoms = [];

                for (let a=0; a<this.natoms; a++) {
                    let real = eiv["real"][n][nq][a];
                    let imag = eiv["imag"][n][nq][a];

                    let x = [real[0]*scale,imag[0]*scale];
                    let y = [real[1]*scale,imag[1]*scale];
                    let z = [real[2]*scale,imag[2]*scale];

                    eiv_qpoint_atoms.push([x,y,z]);
                }
                eiv_qpoint.push(eiv_qpoint_atoms);
            }
            this.eigenvalues.push(eig_qpoint);
            this.vec.push(eiv_qpoint);
        }

        callback();
    }

    getLineBreaks(data) {
        //get line breaks
        if ("line_breaks" in data) {
            this.line_breaks = data["line_breaks"];
        }
        else {
            //no line breaks
            this.line_breaks = [[0,this.kpoints.length]];
        }
    }

}

var thz2ev = 33.35641;

class PhononYaml {

    getFromURL(url,callback) {
        /*
        load a file from url
        */

        function onLoadEndHandler(text) {
            this.getFromString(text,callback);
        }
        $.get(url,onLoadEndHandler.bind(this));

    }

    static getYaml(tags,object,noerror=false) {
        /*
        check if the tags are present and if so return their value
        */

        let ntags = tags.length;
        for (let i = 0; i < ntags; i++) {
            let tag = tags[i];
            if (tag in object) {
                return object[tag];
            }
        }
        if (noerror) {return}
        alert(tags + " not found in the file."+
              "Please generate the file again with the lastest version of phonopy.");
        throw new Error(tags + " not found in the file.");
    }

    getFromFile(file,callback) {
        /*
        file is a javascript file object with the "band.yaml" file
        */

        let yaml_reader = new FileReader();

        function onLoadEndHandler() {
            this.getFromString(yaml_reader.result,callback);
        }

        //read the files
        yaml_reader.onloadend = onLoadEndHandler.bind(this);
        yaml_reader.readAsText(file);

    }

    getFromString(string,callback) {
        /*
        yaml is the content of "band.yaml" file as a string
        */

        let phononyaml = jsyaml.load(string);
        this.getFromYaml(phononyaml);
        callback();
    }

    static getUnits(interface_mode) {
        let PlanckConstant = 4.13566733e-15; // [eV s]
        let Hbar = PlanckConstant/(2*pi$1); // [eV s]
        let SpeedOfLight = 299792458;  // [m/s]
        let EV = 1.60217733e-19;  // [J]
        let Mu0 = 4.0e-7 * pi$1;    // [Hartree/m]
        let Epsilon0 = 1.0 / Mu0 / SpeedOfLight**2;  // [C^2 / N m^2]
        let Me = 9.10938215e-31;

        let Bohr = 4e10 * pi$1 * Epsilon0 * Hbar**2 / Me;   // Bohr radius [A] 0.5291772
        let Hartree = Me * EV / 16 / pi$1**2 / Epsilon0**2 / Hbar**2;  // Hartree [eV] 27.211398

        let units = {};
        if (interface_mode == 'abinit') {
            units['nac_factor'] = Hartree / Bohr;
            units['distance_to_A'] = Bohr;
            units['force_constants_unit'] = 'eV/Angstrom.au';
            units['length_unit'] = 'au';
        }
        else if (interface_mode == 'qe' || interface_mode == 'pwscf') {
            units['nac_factor'] = 2.0;
            units['distance_to_A'] = Bohr;
            units['force_constants_unit'] = 'Ry/au^2';
            units['length_unit'] = 'au';
        }
        else if (interface_mode == 'wien2k') {
            units['nac_factor'] = 2000.0;
            units['distance_to_A'] = Bohr;
            units['force_constants_unit'] = 'mRy/au^2';
            units['length_unit'] = 'au';
        }
        else if (interface_mode == 'elk') {
            units['nac_factor'] = 1.0;
            units['distance_to_A'] = Bohr;
            units['force_constants_unit'] = 'hartree/au^2';
            units['length_unit'] = 'au';
        }
        else if (interface_mode == 'siesta') {
            units['nac_factor'] = Hartree / Bohr;
            units['distance_to_A'] = Bohr;
            units['force_constants_unit'] = 'eV/Angstrom.au';
            units['length_unit'] = 'au';
        }
        else if (interface_mode == 'cp2k') {
            units['nac_factor'] = Hartree / Bohr;  // in a.u.
            units['distance_to_A'] = Bohr;
            units['force_constants_unit'] = 'hartree/au^2';
            units['length_unit'] = 'Angstrom';
        }
        else if (interface_mode == 'crystal') {
            units['nac_factor'] = Hartree * Bohr;
            units['distance_to_A'] = 1.0;
            units['force_constants_unit'] = 'eV/Angstrom^2';
            units['length_unit'] = 'Angstrom';
        }
        else if (interface_mode == 'dftbp') {
            units['nac_factor'] = Hartree * Bohr;
            units['distance_to_A'] = Bohr;
            units['force_constants_unit'] = 'hartree/au^2';
            units['length_unit'] = 'au';
        }
        else { // interface_mode == 'vasp' or others
            units['nac_factor'] = Hartree * Bohr;
            units['distance_to_A'] = 1.0;
            units['force_constants_unit'] = 'eV/Angstrom^2';
            units['length_unit'] = 'Angstrom';
        }
        return units
    }

    getFromYaml(phononyaml) {

        //read the yaml files
        let lat      = PhononYaml.getYaml(['lattice'],phononyaml);
        let nqpoint  = PhononYaml.getYaml(['nqpoint'],phononyaml);
        let npath    = PhononYaml.getYaml(['npath'],phononyaml);
        let pc_atoms = PhononYaml.getYaml(['points','atoms'],phononyaml);
        let phonon   = PhononYaml.getYaml(['phonon'],phononyaml);

        // get the units
        let calculator = PhononYaml.getYaml(['calculator'],phononyaml,true);
        let units = PhononYaml.getUnits(calculator);

        //convert the lattice to Angstroem
        lat = matrix_scale(lat,units['distance_to_A']);

        //verify if the eigenvectors tag is prsent
        let has_eigenvectors = phonon[0]['band'][0].hasOwnProperty('eigenvector');
        if (!has_eigenvectors) {
            alert("Eigenvectors not found in band.yaml file."+
                  "Please regenerate with the EIGENVECTORS=.true. tag.");
        }

        let segment_nqpoint;
        if ('segment_nqpoint' in phononyaml) {
            segment_nqpoint = phononyaml['segment_nqpoint'];
        }
        else {
            segment_nqpoint = [];
            for (i=0; i<npath; i++) {
                segment_nqpoint.push(nqpoint/npath);
            }
        }

        //get the atoms inside the unit cell
        this.atom_types = [];
        this.atom_numbers = [];
        this.atom_pos_car = [];
        this.atom_pos_red = [];
        this.natoms = pc_atoms.length;

        for (let i=0; i<this.natoms; i++) {
            let atom = pc_atoms[i];
            let symbol   = PhononYaml.getYaml(['symbol'],atom);
            let position = PhononYaml.getYaml(['position','coordinates'],atom);
            this.atom_numbers.push(atomic_number[symbol]);
            this.atom_types.push(symbol);
            this.atom_pos_red.push(position);
            this.atom_pos_car.push(red_car(position,lat));
        }

        this.formula = get_formula(this.atom_types);
        this.name = this.formula;

        let check_high_sym_qpoint = function(phonon_qpoint,highsym_qpts) {
            let label = phonon_qpoint['label'];
            let dist  = phonon_qpoint['distance'];
            //check if a label is present
            if (label) {  highsym_qpts[dist] = label; }
            else       {  highsym_qpts[dist] = '';    }
        };

        //iterate over the different segments of the path
        this.kpoints     = [];
        this.eigenvalues = [];
        this.vec         = [];
        this.distances   = [];
        this.line_breaks = [0];
        this.highsym_qpts = {};
        this.qindex = {};
        let nmodes = this.natoms*3;
        let qpoint = 0;

        //iterate over number of paths
        for (let p=0; p<npath; p++) {
            //get size of segment
            let size_segment = segment_nqpoint[p];

            //iterate over_qpoints
            for (let i=0; i<size_segment; i++) {
                let phonon_qpoint = phonon[qpoint+i];

                let dist = phonon_qpoint['distance'];
                this.qindex[dist] = this.kpoints.length;
                this.kpoints.push(phonon_qpoint['q-position']);

                //get distances
                this.distances.push( phonon_qpoint['distance'] );

                //create bands
                let eig = [];
                let eiv = [];
                let phonon_qpoint_band = phonon_qpoint['band'];
                for (let n=0; n<nmodes; n++) {
                    let phonon_qpoint_band_mode = phonon_qpoint_band[n];
                    //get eigenvalues
                    eig.push( phonon_qpoint_band_mode['frequency']*thz2ev );
                    //get eigenvectors
                    eiv.push( phonon_qpoint_band_mode['eigenvector'] );
                }
                this.vec.push(eiv);
                this.eigenvalues.push(eig);
            }

            //add line breaks
            this.line_breaks.push([qpoint,qpoint+size_segment]);

            //check if start point and end point are high-symmetry points
            check_high_sym_qpoint(phonon[qpoint],this.highsym_qpts);
            qpoint += size_segment;
            check_high_sym_qpoint(phonon[qpoint-1],this.highsym_qpts);
        }

        //get average mass (for normalization purposes)
        let average_mass = 0;
        let sqrt_atom_masses = [];
        for (let i=0;i<this.natoms;i++) {
            let mass = atomic_mass[this.atom_numbers[i]];
            average_mass += mass;
            sqrt_atom_masses.push(Math.sqrt(mass));
        }
        average_mass /= this.natoms;
        let sqrt_average_mass = Math.sqrt(average_mass);

        //normalize the phonon modes with the masses
        let nqpoints = this.vec.length;
        for (let q=0; q<nqpoints; q++) {
            let eivecq = this.vec[q];
            for (let n=0; n<nmodes; n++) {
                let eivecqn = eivecq[n];
                for (let i=0;i<this.natoms;i++) {
                    let norm = sqrt_average_mass/sqrt_atom_masses[i];
                    //real part
                    eivecqn[i][0][0] *= norm;
                    eivecqn[i][1][0] *= norm;
                    eivecqn[i][2][0] *= norm;
                    //imaginary part
                    eivecqn[i][0][1] *= norm;
                    eivecqn[i][1][1] *= norm;
                    eivecqn[i][2][1] *= norm;
                }
            }
        }

        this.addatomphase = true;
        this.lat = lat;
        this.repetitions = getReasonableRepetitions(this.natoms);
    }
}

function exportXSF() {

    let amplitude = this.visualizer.amplitude;
    let string = "CRYSTAL\n";
    string += "PRIMVEC\n";

    let lat = this.phonon.lat;
    let atoms = this.atoms;
    let atom_numbers = this.phonon.atom_numbers;

    for (i=0; i<lat.length; i++) {
        string += (lat[i][0]*this.nx).toFixed(12) + " " +
                  (lat[i][1]*this.ny).toFixed(12) + " " +
                  (lat[i][2]*this.nz).toFixed(12) + "\n";
    }

    string += "PRIMCOORD 1\n";
    string += atoms.length + " 1\n";

    let phase = Complex.Polar(amplitude,parseFloat($("#phase").val())/360*2.0*pi);

    for (i=0; i<atoms.length; i++) {
        vibrations = this.vibrations[i];
        string += atom_numbers[atoms[i][0]] + " ";
        for (j=1; j<4; j++) {
            string += (atoms[i][j] + phase.mult(vibrations[j-1]).real()).toFixed(12) + " ";
        }
        string += "\n";
    }

    let element = document.createElement('a');
    element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(string));
    element.setAttribute('download', this.k.toString()+'_'+this.n.toString()+'_displacement.xsf');
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);

}

function exportPOSCAR() {

    let amplitude = this.visualizer.amplitude;
    let atoms = jQuery.extend(true, [], this.atoms);
    let counter = {};
    let order = [];

    //set the first element to be the atomic number
    for (i=0; i<atoms.length; i++) {
        var atom = atoms[i];
        atom[0] = this.phonon.atom_numbers[atom[0]];
        atom.push(this.vibrations[i]);
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
    string += "1.0\n";

    let lat = this.phonon.lat;
    for (i=0; i<lat.length; i++) {
        string += (lat[i][0]*this.nx).toFixed(12) + " " +
                  (lat[i][1]*this.ny).toFixed(12) + " " +
                  (lat[i][2]*this.nz).toFixed(12) + "\n";
    }
    for (i=0; i<order.length; i++) {
        string += atomic_symbol[order[i]] + " ";
    }
    string += "\n";
    for (i=0; i<order.length; i++) {
        string += counter[order[i]] + " ";
    }
    string += "\n";

    string += "Cartesian\n";
    this.phase = parseFloat($("#phase").val())/360*2.0*pi;
    let phase = Complex.Polar(amplitude,this.phase);

    for (i=0; i<atoms.length; i++) {
        vibrations = atoms[i][4];
        for (j=1; j<4; j++) {
            string += (atoms[i][j] + phase.mult(vibrations[j-1]).real()).toFixed(12) + " ";
        }
        string += "\n";
    }

    let element = document.createElement('a');
    element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(string));
    element.setAttribute('download', this.k.toString()+'_'+this.n.toString()+'_displacement.POSCAR');
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
}

function SubscriptNumbers(old_string) {
    let string = "";
    for (let a of old_string) {
        if (!isNaN(a)) {
            string += "<sub>"+a+"</sub>";
        }
        else {
            string += a;
        }
    }
    return string;
}

class PhononWebpage {

    constructor(visualizer, dispersion) {
        this.k = 0;
        this.n = 0;
        this.nx = 1;
        this.ny = 1;
        this.nz = 1;

        //select visualization
        this.visualizer = visualizer;

        //select dispersion
        this.dispersion = dispersion;

        //bind some functions (TODO: improve this)
        this.exportXSF    = exportXSF.bind(this);
        this.exportPOSCAR = exportPOSCAR.bind(this);

        //bind click event from highcharts with action
        dispersion.setClickEvent(this);
    }

    //functions to link the DOM buttons with this class
    setMaterialsList(dom_mat)      { this.dom_mat = dom_mat; }
    setReferencesList(dom_ref)     { this.dom_ref = dom_ref; }
    setAtomPositions(dom_atompos)  { this.dom_atompos = dom_atompos; }
    setLattice(dom_lattice)        { this.dom_lattice = dom_lattice; }
    setTitle(dom_title)            { this.dom_title = dom_title; }

    setUpdateButton(dom_button) {
        self = this;
        dom_button.click( function() { self.update(); } );
    }

    setExportXSFButton(dom_button) {
        dom_button.click(this.exportXSF.bind(this));
    }

    setExportPOSCARButton(dom_button) {
        dom_button.click(this.exportPOSCAR.bind(this));
    }

    setRepetitionsInput(dom_nx,dom_ny,dom_nz) {

        this.dom_nx = dom_nx;
        this.dom_ny = dom_ny;
        this.dom_nz = dom_nz;

        function keyup(event) {
            if(event.keyCode == 13) {
                this.update(false);
            }
        }

        dom_nx.keyup( keyup.bind(this) );
        dom_ny.keyup( keyup.bind(this) );
        dom_nz.keyup( keyup.bind(this) );
    }

    setFileInput(dom_input) {
        /* Load a custom file button
        */
        dom_input.change( this.loadCustomFile.bind(this) );
        dom_input.click( function() { this.value = '';} );
    }

    loadCustomFile(event) {
        /*
        find the type of file and call the corresponding function to read it

        two formats available:
            1. band.yaml generated with phonopy with eigenvectors
            2. internal .json format description available in
            http://henriquemiranda.github.io/phononwebsite/
            3. pymatgen phononBS format
        */
        this.k = 0;
        this.n = 0;
        self = this;

        function set_name() {
            delete self.link;
            self.name = self.phonon.name;
            self.loadCallback();
        }

        let file = event.target.files[0];
        if (file.name.indexOf(".yaml") > -1) {
            this.phonon = new PhononYaml();
            this.phonon.getFromFile(file, set_name );
         }
        else if (file.name.indexOf(".json") > -1) {
            this.phonon = new PhononJson();
            this.phonon.getFromFile(file, set_name );
        }
        else {
            alert("Ivalid file");
        }
    }

    loadURL(url_vars,callback) {
        /*
        load file from post request in the url
        */

        this.k = 0;
        this.n = 0;
        delete this.link;
        if (callback == null) {
            callback = this.loadCallback.bind(this);
        }

        if ( "name" in url_vars ) {
            this.name = url_vars.name;
        }
        if ( "link" in url_vars ) {
            this.link = url_vars.link;
        }

        if ("yaml" in url_vars) {
            this.phonon = new PhononYaml();
            this.phonon.getFromURL(url_vars.yaml,callback);
        }
        else if ("json" in url_vars) {
            this.phonon = new PhononJson();
            this.phonon.getFromURL(url_vars.json,callback);
        }
        else if ("rest" in url_vars) {
            this.phonon = new PhononJson();
            this.phonon.getFromREST(url_vars.rest,url_vars.apikey,callback);
        }
        else ;
    }

    getUrlVars(default_vars) {
        /*
        get variables from the url
        from http://stackoverflow.com/questions/4656843/jquery-get-querystring-from-url

        currently the possible options are:
            json : load a json file from location
            yaml : load a yaml file from location
            name : change the display name of the material
        */
        let hash;
        let vars = {};

        if (location.search) {
            let hashes = location.search.slice(1).split('&');
            for(let i = 0; i < hashes.length; i++) {
                hash = hashes[i].split('=');
                vars[hash[0]] = hash[1];
            }
        }

        //if no argument is present use the default vars
        if (Object.keys(vars).length < 1) {
            vars = default_vars;
        }

        this.loadURL(vars);
    }

    loadCallback() {
        /*
        Fuunction to be called once the file is loaded
        */
        this.setRepetitions(this.phonon.repetitions);
        this.update();
    }

    getRepetitions() {
        /*
        read the number of repetitions in each direction and update it
        */
        if (this.dom_nx) { this.nx = this.dom_nx.val(); }
        if (this.dom_ny) { this.ny = this.dom_ny.val(); }
        if (this.dom_nz) { this.nz = this.dom_nz.val(); }
    }

    setRepetitions(repetitions) {
        /*
        set the number of repetitions on the interface
        */

        if (repetitions) {
            this.nx = repetitions[0];
            this.ny = repetitions[1];
            this.nz = repetitions[2];
        }

        if (this.dom_nx) { this.dom_nx.val(this.nx); }
        if (this.dom_ny) { this.dom_ny.val(this.ny); }
        if (this.dom_nz) { this.dom_nz.val(this.nz); }
    }

    getStructure(nx,ny,nz) {
        let lat = this.phonon.lat;
        let apc = this.phonon.atom_pos_car;
        let atoms = [];

        for (let ix=0;ix<nx;ix++) {
            for (let iy=0;iy<ny;iy++) {
                for (let iz=0;iz<nz;iz++) {
                    for (let i=0;i<this.phonon.natoms;i++) {

                        //postions of the atoms
                        let x = apc[i][0] + ix*lat[0][0] + iy*lat[1][0] + iz*lat[2][0];
                        let y = apc[i][1] + ix*lat[0][1] + iy*lat[1][1] + iz*lat[2][1];
                        let z = apc[i][2] + ix*lat[0][2] + iy*lat[1][2] + iz*lat[2][2];

                        atoms.push( [i,x,y,z] );
                    }
                }
            }
        }

        return atoms;
    }

    getBondingDistance() {
        /*
        replicate the unit cell two times in each direction
        and clauclate the minimum bonding distance
        */
        let atoms = this.getStructure(2,2,2);

        let combinations = getCombinations( atoms );
        let min = 1e9;
        for (let i=0; i<combinations.length; i++ ) {
            let a = combinations[i][0];
            let b = combinations[i][1];

            let dist = distance(a.slice(1),b.slice(1));
            if (min > dist) {
                min = dist;
            }
        }
        return min;
    }

    getVibrations(nx,ny,nz) {
        /*
        Calculate the vibration patterns for all the atoms
        */
        let phonon = this.phonon;
        let veckn = phonon.vec[this.k][this.n];
        let vibrations = [];
        let kpt = phonon.kpoints[this.k];

        //additional phase if necessary
        let atom_phase = [];
        if (phonon.addatomphase) {
            for (let i=0; i<phonon.natoms; i++) {
                let phase = vec_dot(kpt,phonon.atom_pos_red[i]);
                atom_phase.push(phase);
            }
        }
        else {
            for (let i=0; i<phonon.natoms; i++) {
                atom_phase.push(0);
            }
        }

        for (let ix=0; ix<nx; ix++) {
            for (let iy=0; iy<ny; iy++) {
                for (let iz=0; iz<nz; iz++) {

                    for (let i=0; i<phonon.natoms; i++) {
                        let sprod = vec_dot(kpt,[ix,iy,iz]) + atom_phase[i];
                        let phase = Complex.Polar(1.0,sprod*2.0*pi$1);

                        //Displacements of the atoms
                        let x = Complex(veckn[i][0][0],veckn[i][0][1]).mult(phase);
                        let y = Complex(veckn[i][1][0],veckn[i][1][1]).mult(phase);
                        let z = Complex(veckn[i][2][0],veckn[i][2][1]).mult(phase);

                        vibrations.push( [x,y,z] );
                    }
                }
            }
        }

        return vibrations;
    }

    setVibrations() {
        this.vibrations = this.getVibrations(this.nx,this.ny,this.nz);
    }

    update(dispersion = true) {
        /*
        Update all the aspects fo the webpage
        */

        //update structure
        this.getRepetitions();
        this.atoms = this.getStructure(this.nx,this.ny,this.nz);
        this.vibrations = this.getVibrations(this.nx,this.ny,this.nz);
        this.phonon.nndist = this.getBondingDistance();

        //update page
        this.updatePage();

        //update dispersion
        if (dispersion) { this.dispersion.update(this.phonon); }

        //update visualizer
        this.visualizer.update(this);
    }

    updatePage() {
        /*
        lattice vectors table
        */

        if (this.dom_lattice)  {
            this.dom_lattice.empty();
            for (let i=0; i<3; i++) {
                let tr = document.createElement("TR");
                for (let j=0; j<3; j++) {
                    let td = document.createElement("TD");
                    let x = document.createTextNode(this.phonon.lat[i][j].toPrecision(4));
                    td.appendChild(x);
                    tr.append(td);
                }
                this.dom_lattice.append(tr);
            }
        }

        //atomic positions table
        if (this.dom_atompos) {
            this.dom_atompos.empty();
            let pos = this.phonon.atom_pos_red;
            for (let i=0; i<pos.length; i++) {
                let tr = document.createElement("TR");

                let td = document.createElement("TD");
                let atom_type = document.createTextNode(this.phonon.atom_types[i]);
                td.class = "ap";
                td.appendChild(atom_type);
                tr.append(td);

                for (let j=0; j<3; j++) {
                    let td = document.createElement("TD");
                    let x = document.createTextNode(pos[i][j].toFixed(4));
                    td.appendChild(x);
                    tr.append(td);
                }
                this.dom_atompos.append(tr);
            }
        }

        //update title
        if (this.dom_title) {
            let title = this.dom_title[0];
            while (title.hasChildNodes()) {
                title.removeChild(title.lastChild);
            }

            //make link
            if ("link" in this) {
                let a = document.createElement("A");
                a.href = this.link;
                a.innerHTML = this.name;
                title.appendChild(a);
            }
            else {
                title.innerHTML = this.name;
            }

        }
    }

    updateMenu() {
        /*
        create menu with:
            1. local files (files distributed with the website)
            2. files from the phonodb database 2015 and 2017
            3. potentially more sources of data can be added
        */

        let self = this;

        let dom_mat = this.dom_mat;
        let dom_ref = this.dom_ref;
        if (dom_mat) { dom_mat.empty(); }
        let unique_references = {};
        let nreferences = 1;

        function addMaterials(materials) {

            if (dom_mat) {
                for (let i=0; i<materials.length; i++) {

                    let m = materials[i];

                    //reference
                    let ref = m["reference"];
                    if (!unique_references.hasOwnProperty(ref)) {
                        unique_references[ref] = nreferences;
                        nreferences+=1;
                    }

                    //name + refenrece
                    let name = SubscriptNumbers(m.name);
                    let name_ref = name + " ["+unique_references[ref]+"]";

                    let li = document.createElement("LI");
                    let a = document.createElement("A");

                    a.onclick = function() {
                        let url_vars = {};
                        url_vars[m.type] = m.url;
                        url_vars.name = name_ref;
                        if ("link" in m) { url_vars.link = m.link; }
                        self.loadURL(url_vars);
                    };

                    a.innerHTML = name;
                    li.appendChild(a);

                    dom_mat.append(li);
                }
            }

            //add references
            if (dom_ref) {
                dom_ref.empty();
                for (let ref in unique_references) {
                    let i = unique_references[ref];
                    let li = document.createElement("LI");
                    li.innerHTML = "["+i+"] "+ref;
                    dom_ref.append(li);
                    i += 1;
                }
            }
        }

        //local database
        let source = new LocalDB();
        source.get_materials(addMaterials);

        //contributions database
        source = new ContribDB();
        source.get_materials(addMaterials);

        /*
        //phonondb2015 database
        for (let sourceclass of [PhononDB2015, LocalPhononDB2015 ]) {
            source = new sourceclass;
            if (source.isAvailable()) {
                source.get_materials(addMaterials);
                break;
            }
        }

        //phonondb2018 database
        for (let sourceclass of [PhononDB2018, LocalPhononDB2018 ]) {
            source = new sourceclass;
            if (source.isAvailable()) {
                source.get_materials(addMaterials);
                break;
            }
        }*/

        //mp databse
        for (let sourceclass of [MaterialsProjectDB, LocalMaterialsProjectDB ]) {
            source = new sourceclass;
            if (source.isAvailable()) {
                source.get_materials(addMaterials);
                break;
            }
        }

    }

}

export { PhononHighcharts, PhononWebpage, VibCrystal };
