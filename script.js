'use strict'

// vertex shader for sky material
var sbVertexShader = [
"varying vec3 vWorldPosition;",
"void main() {",
"  vec4 worldPosition = modelMatrix * vec4( position, 1.0 );",
"  vWorldPosition = worldPosition.xyz;",
"  gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );",
"}",
].join("\n");

//fragment shader for sky material
var sbFragmentShader = [
"uniform vec3 topColor;",
"uniform vec3 bottomColor;",
"uniform float offset;",
"uniform float exponent;",
"varying vec3 vWorldPosition;",
"void main() {",
"  float h = normalize( vWorldPosition + offset ).y;",
"  gl_FragColor = vec4( mix( bottomColor, topColor, max( pow( h, exponent ), 0.0 ) ), 1.0 );",
"}",
].join("\n");

//get mouse position on canvas
function getMousePos(evt){
  var rect = document.getElementsByTagName('canvas')[0].getBoundingClientRect();
  return{
      x: evt.clientX - rect.left,
      y: evt.clientY - rect.top
  }
}

//width and height of the canvas
var SCREEN_WIDTH, SCREEN_HEIGHT;

var mvp = {
  scene: null, camera: null, renderer: null,
  container: null, controls: null,
  clock: null, temp:{},
  plane: null, selection: null, offset: new THREE.Vector3(), objects: [],
  raycaster: new THREE.Raycaster(),
  scaleX:null, scaleY:null, scaleZ:null,

  init: function() {

    // Create main scene
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0xcce0ff, 0.0003);

    // Prepare container
    this.container = document.getElementById("screen");

    SCREEN_WIDTH = window.innerWidth, SCREEN_HEIGHT = window.innerHeight;

    // Prepare perspective camera
    var VIEW_ANGLE = 45, ASPECT = SCREEN_WIDTH / SCREEN_HEIGHT, NEAR = 1, FAR = 1000;
    this.camera = new THREE.PerspectiveCamera(VIEW_ANGLE, ASPECT, NEAR, FAR);
    this.scene.add(this.camera);
    this.camera.position.set(100, 0, 0);
    this.camera.lookAt(new THREE.Vector3(0,0,0));

    // Prepare webgl renderer
    this.renderer = new THREE.WebGLRenderer({ antialias:true });
    this.renderer.setSize(SCREEN_WIDTH, SCREEN_HEIGHT);
    this.renderer.setClearColor(this.scene.fog.color);

    this.container.appendChild(this.renderer.domElement);

    //add mouse event for moving small boxes inside
    this.container.addEventListener('mousedown', this.onDocumentMouseDown, false);
    this.container.addEventListener('mousemove', this.onDocumentMouseMove, false);
    this.container.addEventListener('mouseup', this.onDocumentMouseUp, false);

    // Prepare Orbit controls
    this.controls = new THREE.OrbitControls(this.camera, this.container);
    this.controls.enablePan = true; //enable outer box with right click
    this.controls.target = new THREE.Vector3(0, 0, 0);
    this.controls.maxDistance = 150; // maximum camera distance from (0, 0, 0) to control rotate, zoom and pan

    // Prepare clock
    this.clock = new THREE.Clock();

    // Add lights
    this.scene.add( new THREE.AmbientLight(0x444444)); // add ambient light

    var dirLight = new THREE.DirectionalLight(0xffffff); // add directional light
    dirLight.position.set(200, 200, 1000).normalize();
    this.camera.add(dirLight);
    this.camera.add(dirLight.target);

    // Display skybox
    this.addSkybox();

    // Plane, that helps to determinate an intersection position
    this.plane = new THREE.Mesh(new THREE.PlaneBufferGeometry(500, 500, 8, 8), new THREE.MeshBasicMaterial({color: 0xffffff}));
    this.plane.visible = false;
    this.scene.add(this.plane);

    // Add container box
    this.scaleX = 50;
    this.scaleY = 25;
    this.scaleZ = 50;
    var geometry = new THREE.BoxGeometry( this.scaleX, this.scaleY, this.scaleZ );

    // material
    var material1 = new THREE.MeshPhongMaterial( {
        color: 0xffffff,
        transparent: true,
        opacity: 0.1
    } );

    // mesh
    var mesh = new THREE.Mesh( geometry, material1 );
    this.scene.add( mesh );

		var front_mesh = mesh; //if you are outside the box you can see inside the box

    // material
    var material2 = new THREE.MeshPhongMaterial( {
        color: 0xffffff,
        transparent: false,
        side: THREE.BackSide
    } );

    // mesh
    mesh = new THREE.Mesh( geometry, material2 );
    this.scene.add( mesh );

		var back_mesh = mesh; // if you are inside the box you can not see outside the box

		//outer-box-geometry
		var outer_box_geometry = geometry;

    // display depth, width and height of the big box
    document.getElementById('outer-box-length').value = outer_box_geometry.parameters.depth;
    document.getElementById('outer-box-width').value = outer_box_geometry.parameters.width;
    document.getElementById('outer-box-height').value = outer_box_geometry.parameters.height;

    // increase or decrease scale of outer box so that box increases or decreases
    document.getElementById('outer-box-length').onkeyup = function(event){
      front_mesh.scale.z = parseInt(document.getElementById('outer-box-length').value) / mvp.scaleZ;
      back_mesh.scale.z = parseInt(document.getElementById('outer-box-length').value) / mvp.scaleZ;
    };

    document.getElementById('outer-box-width').onkeyup = function(event){
      front_mesh.scale.x = parseInt(document.getElementById('outer-box-width').value) / mvp.scaleX;
      back_mesh.scale.x = parseInt(document.getElementById('outer-box-width').value) / mvp.scaleX;
    };

    document.getElementById('outer-box-height').onkeyup = function(event){
      front_mesh.scale.y = parseInt(document.getElementById('outer-box-height').value) / mvp.scaleY;
      back_mesh.scale.y = parseInt(document.getElementById('outer-box-height').value) / mvp.scaleY;
    };
  },
  addSkybox: function() { // add sky to scene
    var iSBrsize = 500;
    var uniforms = {
      topColor: {type: "c", value: new THREE.Color(0xffffff)}, bottomColor: {type: "c", value: new THREE.Color(0x0077ff)},
      offset: {type: "f", value: iSBrsize}, exponent: {type: "f", value: 1.5}
    }

    var skyGeo = new THREE.SphereGeometry(iSBrsize, 32, 32); // sky is implemented with sphere
    var skyMat = new THREE.ShaderMaterial({vertexShader: sbVertexShader, fragmentShader: sbFragmentShader, uniforms: uniforms, side: THREE.DoubleSide, fog: false});
    var skyMesh = new THREE.Mesh(skyGeo, skyMat);
    this.scene.add(skyMesh);
  },
  onDocumentMouseDown: function (event) {
    // Get mouse position
    var mouseX = (getMousePos(event).x / SCREEN_WIDTH) * 2 - 1;
    var mouseY = -(getMousePos(event).y / SCREEN_HEIGHT) * 2 + 1;

    // Get 3D vector from 3D mouse position using 'unproject' function
    var vector = new THREE.Vector3(mouseX, mouseY, 1);
    vector.unproject(mvp.camera);

    // Set the raycaster position
    mvp.raycaster.set( mvp.camera.position, vector.sub( mvp.camera.position ).normalize() );

    // Find all intersected objects
    var intersects = mvp.raycaster.intersectObjects(mvp.objects);

    if (intersects.length > 0) {
      // Disable the controls
      mvp.controls.enabled = false;

      // Set the selection - first intersected object
      mvp.selection = intersects[0].object;

      mvp.temp.position = {};
      mvp.temp.position.x = mvp.selection.position.x;
      mvp.temp.position.y = mvp.selection.position.y;
      mvp.temp.position.z = mvp.selection.position.z;

      // Calculate the offset
      var intersects = mvp.raycaster.intersectObject(mvp.plane);
      mvp.offset.copy(intersects[0].point).sub(mvp.plane.position);
    }
  },
  onDocumentMouseMove: function (event) {
    event.preventDefault();

    // Get mouse position
    var mouseX = (getMousePos(event).x / SCREEN_WIDTH) * 2 - 1;
    var mouseY = -(getMousePos(event).y / SCREEN_HEIGHT) * 2 + 1;

    // Get 3D vector from 3D mouse position using 'unproject' function
    var vector = new THREE.Vector3(mouseX, mouseY, 1);
    vector.unproject(mvp.camera);

    // Set the raycaster position
    mvp.raycaster.set( mvp.camera.position, vector.sub( mvp.camera.position ).normalize() );

    if (mvp.selection) {
      // Check the position where the plane is intersected
      var intersects = mvp.raycaster.intersectObject(mvp.plane);
      // Reposition the object based on the intersection point with the plane
      mvp.selection.position.copy(intersects[0].point.sub(mvp.offset));

      if( mvp.selection.position.x < -mvp.scaleX / 2 + mvp.selection.geometry.parameters.width / 2 ){
          mvp.selection.position.x = -mvp.scaleX / 2 + mvp.selection.geometry.parameters.width / 2;//prevent small boxes not to get out of big box
      }
      if( mvp.selection.position.x > mvp.scaleX / 2 - mvp.selection.geometry.parameters.width / 2 ){
          mvp.selection.position.x = mvp.scaleX / 2 - mvp.selection.geometry.parameters.width / 2;//prevent small boxes not to get out of big box
      }
      if( mvp.selection.position.y < -mvp.scaleY / 2 + mvp.selection.geometry.parameters.height / 2 ){
          mvp.selection.position.y = -mvp.scaleY / 2 + mvp.selection.geometry.parameters.height / 2;//prevent small boxes not to get out of big box
      }
      if( mvp.selection.position.y > mvp.scaleY / 2 - mvp.selection.geometry.parameters.height / 2 ){
          mvp.selection.position.y = mvp.scaleY / 2 - mvp.selection.geometry.parameters.height / 2;//prevent small boxes not to get out of big box
      }
      if( mvp.selection.position.z < -mvp.scaleX / 2 + mvp.selection.geometry.parameters.depth / 2 ){
          mvp.selection.position.z = -mvp.scaleX / 2 + mvp.selection.geometry.parameters.depth / 2;//prevent small boxes not to get out of big box
      }
      if( mvp.selection.position.z > mvp.scaleX / 2 - mvp.selection.geometry.parameters.depth / 2 ){
          mvp.selection.position.z = mvp.scaleX / 2 - mvp.selection.geometry.parameters.depth / 2;//prevent small boxes not to get out of big box
      }
      var flag = 0;
      mvp.objects.forEach(function(item, index){ // prevent seleected box not to get into other boxes (check 8 vertices of selected box)

          if ( item != mvp.selection && flag == 0 ){
              if((mvp.selection.position.x + mvp.selection.geometry.parameters.width / 2 <= item.position.x + item.geometry.parameters.width / 2)&&
              (mvp.selection.position.x + mvp.selection.geometry.parameters.width / 2 >= item.position.x - item.geometry.parameters.width / 2)&&
              (mvp.selection.position.y + mvp.selection.geometry.parameters.height / 2 <= item.position.y + item.geometry.parameters.height / 2)&&
              (mvp.selection.position.y + mvp.selection.geometry.parameters.height / 2 >= item.position.y - item.geometry.parameters.height / 2)&&
              (mvp.selection.position.z + mvp.selection.geometry.parameters.depth / 2 <= item.position.z + item.geometry.parameters.depth / 2)&&
              (mvp.selection.position.z + mvp.selection.geometry.parameters.depth / 2 >= item.position.z - item.geometry.parameters.depth / 2)){
                  mvp.selection.position.x = mvp.temp.position.x;
                  mvp.selection.position.y = mvp.temp.position.y;
                  mvp.selection.position.z = mvp.temp.position.z;flag = 1;
              }
              else if((mvp.selection.position.x + mvp.selection.geometry.parameters.width / 2 <= item.position.x + item.geometry.parameters.width / 2)&&
              (mvp.selection.position.x + mvp.selection.geometry.parameters.width / 2 >= item.position.x - item.geometry.parameters.width / 2)&&
              (mvp.selection.position.y + mvp.selection.geometry.parameters.height / 2 <= item.position.y + item.geometry.parameters.height / 2)&&
              (mvp.selection.position.y + mvp.selection.geometry.parameters.height / 2 >= item.position.y - item.geometry.parameters.height / 2)&&
              (mvp.selection.position.z - mvp.selection.geometry.parameters.depth / 2 <= item.position.z + item.geometry.parameters.depth / 2)&&
              (mvp.selection.position.z - mvp.selection.geometry.parameters.depth / 2 >= item.position.z - item.geometry.parameters.depth / 2)){
                  mvp.selection.position.x = mvp.temp.position.x;
                  mvp.selection.position.y = mvp.temp.position.y;
                  mvp.selection.position.z = mvp.temp.position.z;flag = 1;
              }
              else if((mvp.selection.position.x + mvp.selection.geometry.parameters.width / 2 <= item.position.x + item.geometry.parameters.width / 2)&&
              (mvp.selection.position.x + mvp.selection.geometry.parameters.width / 2 >= item.position.x - item.geometry.parameters.width / 2)&&
              (mvp.selection.position.y - mvp.selection.geometry.parameters.height / 2 <= item.position.y + item.geometry.parameters.height / 2)&&
              (mvp.selection.position.y - mvp.selection.geometry.parameters.height / 2 >= item.position.y - item.geometry.parameters.height / 2)&&
              (mvp.selection.position.z + mvp.selection.geometry.parameters.depth / 2 <= item.position.z + item.geometry.parameters.depth / 2)&&
              (mvp.selection.position.z + mvp.selection.geometry.parameters.depth / 2 >= item.position.z - item.geometry.parameters.depth / 2)){
                  mvp.selection.position.x = mvp.temp.position.x;
                  mvp.selection.position.y = mvp.temp.position.y;
                  mvp.selection.position.z = mvp.temp.position.z;flag = 1;
              }
              else if((mvp.selection.position.x + mvp.selection.geometry.parameters.width / 2 <= item.position.x + item.geometry.parameters.width / 2)&&
              (mvp.selection.position.x + mvp.selection.geometry.parameters.width / 2 >= item.position.x - item.geometry.parameters.width / 2)&&
              (mvp.selection.position.y - mvp.selection.geometry.parameters.height / 2 <= item.position.y + item.geometry.parameters.height / 2)&&
              (mvp.selection.position.y - mvp.selection.geometry.parameters.height / 2 >= item.position.y - item.geometry.parameters.height / 2)&&
              (mvp.selection.position.z - mvp.selection.geometry.parameters.depth / 2 <= item.position.z + item.geometry.parameters.depth / 2)&&
              (mvp.selection.position.z - mvp.selection.geometry.parameters.depth / 2 >= item.position.z - item.geometry.parameters.depth / 2)){
                  mvp.selection.position.x = mvp.temp.position.x;
                  mvp.selection.position.y = mvp.temp.position.y;
                  mvp.selection.position.z = mvp.temp.position.z;flag = 1;
              }
              else if((mvp.selection.position.x - mvp.selection.geometry.parameters.width / 2 <= item.position.x + item.geometry.parameters.width / 2)&&
              (mvp.selection.position.x - mvp.selection.geometry.parameters.width / 2 >= item.position.x - item.geometry.parameters.width / 2)&&
              (mvp.selection.position.y + mvp.selection.geometry.parameters.height / 2 <= item.position.y + item.geometry.parameters.height / 2)&&
              (mvp.selection.position.y + mvp.selection.geometry.parameters.height / 2 >= item.position.y - item.geometry.parameters.height / 2)&&
              (mvp.selection.position.z + mvp.selection.geometry.parameters.depth / 2 <= item.position.z + item.geometry.parameters.depth / 2)&&
              (mvp.selection.position.z + mvp.selection.geometry.parameters.depth / 2 >= item.position.z - item.geometry.parameters.depth / 2)){
                  mvp.selection.position.x = mvp.temp.position.x;
                  mvp.selection.position.y = mvp.temp.position.y;
                  mvp.selection.position.z = mvp.temp.position.z;flag = 1;
              }
              else if((mvp.selection.position.x - mvp.selection.geometry.parameters.width / 2 <= item.position.x + item.geometry.parameters.width / 2)&&
              (mvp.selection.position.x - mvp.selection.geometry.parameters.width / 2 >= item.position.x - item.geometry.parameters.width / 2)&&
              (mvp.selection.position.y + mvp.selection.geometry.parameters.height / 2 <= item.position.y + item.geometry.parameters.height / 2)&&
              (mvp.selection.position.y + mvp.selection.geometry.parameters.height / 2 >= item.position.y - item.geometry.parameters.height / 2)&&
              (mvp.selection.position.z - mvp.selection.geometry.parameters.depth / 2 <= item.position.z + item.geometry.parameters.depth / 2)&&
              (mvp.selection.position.z - mvp.selection.geometry.parameters.depth / 2 >= item.position.z - item.geometry.parameters.depth / 2)){
                  mvp.selection.position.x = mvp.temp.position.x;
                  mvp.selection.position.y = mvp.temp.position.y;
                  mvp.selection.position.z = mvp.temp.position.z;flag = 1;
              }
              else if((mvp.selection.position.x - mvp.selection.geometry.parameters.width / 2 <= item.position.x + item.geometry.parameters.width / 2)&&
              (mvp.selection.position.x - mvp.selection.geometry.parameters.width / 2 >= item.position.x - item.geometry.parameters.width / 2)&&
              (mvp.selection.position.y - mvp.selection.geometry.parameters.height / 2 <= item.position.y + item.geometry.parameters.height / 2)&&
              (mvp.selection.position.y - mvp.selection.geometry.parameters.height / 2 >= item.position.y - item.geometry.parameters.height / 2)&&
              (mvp.selection.position.z + mvp.selection.geometry.parameters.depth / 2 <= item.position.z + item.geometry.parameters.depth / 2)&&
              (mvp.selection.position.z + mvp.selection.geometry.parameters.depth / 2 >= item.position.z - item.geometry.parameters.depth / 2)){
                  mvp.selection.position.x = mvp.temp.position.x;
                  mvp.selection.position.y = mvp.temp.position.y;
                  mvp.selection.position.z = mvp.temp.position.z;flag = 1;
              }
              else if((mvp.selection.position.x - mvp.selection.geometry.parameters.width / 2 <= item.position.x + item.geometry.parameters.width / 2)&&
              (mvp.selection.position.x - mvp.selection.geometry.parameters.width / 2 >= item.position.x - item.geometry.parameters.width / 2)&&
              (mvp.selection.position.y - mvp.selection.geometry.parameters.height / 2 <= item.position.y + item.geometry.parameters.height / 2)&&
              (mvp.selection.position.y - mvp.selection.geometry.parameters.height / 2 >= item.position.y - item.geometry.parameters.height / 2)&&
              (mvp.selection.position.z - mvp.selection.geometry.parameters.depth / 2 <= item.position.z + item.geometry.parameters.depth / 2)&&
              (mvp.selection.position.z - mvp.selection.geometry.parameters.depth / 2 >= item.position.z - item.geometry.parameters.depth / 2)){
                  mvp.selection.position.x = mvp.temp.position.x;
                  mvp.selection.position.y = mvp.temp.position.y;
                  mvp.selection.position.z = mvp.temp.position.z;flag = 1;
              }
          }
      });
      if( flag == 0 ){ // if collision is not detected move selected box
          mvp.temp.position.x = mvp.selection.position.x;
          mvp.temp.position.y = mvp.selection.position.y;
          mvp.temp.position.z = mvp.selection.position.z;
      }

    } else {
      // Update position of the plane if need
      var intersects = mvp.raycaster.intersectObjects(mvp.objects);
      if (intersects.length > 0) {
        mvp.plane.position.copy(intersects[0].object.position);
        mvp.plane.lookAt(mvp.camera.position);
      }
    }
  },
  onDocumentMouseUp: function (event) {
    // Enable the controls
    mvp.controls.enabled = true;
    mvp.selection = null;
  }
};

// Animate the scene
function animate() {
  requestAnimationFrame(animate);
  render();
  update();
}

// Update controls
function update() {

  var delta = mvp.clock.getDelta();
  mvp.controls.update(delta);
}

// Render the scene
function render() {
  if (mvp.renderer) {
    mvp.renderer.render(mvp.scene, mvp.camera);
  }
}

// Initialize lesson on page load
function initialize() {
  mvp.init();

  document.getElementById('zoomin').onclick = function(event){ // zoom in by 1.05
    mvp.controls.dollyIn(1.05);
    mvp.controls.update();
  };

  document.getElementById('zoomout').onclick = function(event){ // zoom out by 1.05
    mvp.controls.dollyOut(1.05);
    mvp.controls.update();
  };

  document.getElementById('rotateup').onclick = function(event){ // rotate up by 0.1 rad
    mvp.controls.rotateUp(0.1);
    mvp.controls.update();
  };

  document.getElementById('rotatedown').onclick = function(event){ // rotate down by 0.1 rad
    mvp.controls.rotateUp(-0.1);
    mvp.controls.update();
  };

  document.getElementById('rotateleft').onclick = function(event){ // rotate left by 0.1 rad
    mvp.controls.rotateLeft(0.1);
    mvp.controls.update();
  };

  document.getElementById('rotateright').onclick = function(event){ // rotate right by 0.1 rad
    mvp.controls.rotateLeft(-0.1);
    mvp.controls.update();
  };

  document.getElementById('addBox').onclick = function(event){ // add smal box inside outer box

    var sBlen = parseInt(document.getElementById('subBox-length').value);
    var sBwid = parseInt(document.getElementById('subBox-width').value);
    var sBhei = parseInt(document.getElementById('subBox-height').value);

    // if any of length, width and height is 0 or bigger than outer box size, small box is not generated
    if( sBlen != 0 && sBwid != 0 && sBhei != 0 && sBlen < mvp.scaleZ && sBwid < mvp.scaleX && sBhei < mvp.scaleY ){

      var flag = 0;

      // if there is any other small box in ther space where new box should appear, new box is not generated
      mvp.objects.forEach(function(item, index){

          if ( flag == 0 ){
              if(( sBwid / 2 <= item.position.x + item.geometry.parameters.width / 2)&&
              ( sBwid / 2 >= item.position.x - item.geometry.parameters.width / 2)&&
              ( sBhei / 2 <= item.position.y + item.geometry.parameters.height / 2)&&
              ( sBhei / 2 >= item.position.y - item.geometry.parameters.height / 2)&&
              ( sBlen / 2 <= item.position.z + item.geometry.parameters.depth / 2)&&
              ( sBlen / 2 >= item.position.z - item.geometry.parameters.depth / 2)){
                  flag = 1;
              }
              else if(( sBwid / 2 <= item.position.x + item.geometry.parameters.width / 2)&&
              ( sBwid / 2 >= item.position.x - item.geometry.parameters.width / 2)&&
              ( sBhei / 2 <= item.position.y + item.geometry.parameters.height / 2)&&
              ( sBhei / 2 >= item.position.y - item.geometry.parameters.height / 2)&&
              ( -sBlen / 2 <= item.position.z + item.geometry.parameters.depth / 2)&&
              ( -sBlen / 2 >= item.position.z - item.geometry.parameters.depth / 2)){
                  flag = 1;
              }
              else if(( sBwid / 2 <= item.position.x + item.geometry.parameters.width / 2)&&
              ( sBwid / 2 >= item.position.x - item.geometry.parameters.width / 2)&&
              ( -sBhei / 2 <= item.position.y + item.geometry.parameters.height / 2)&&
              ( -sBhei / 2 >= item.position.y - item.geometry.parameters.height / 2)&&
              ( sBlen / 2 <= item.position.z + item.geometry.parameters.depth / 2)&&
              ( sBlen / 2 >= item.position.z - item.geometry.parameters.depth / 2)){
                  flag = 1;
              }
              else if(( sBwid / 2 <= item.position.x + item.geometry.parameters.width / 2)&&
              ( sBwid / 2 >= item.position.x - item.geometry.parameters.width / 2)&&
              ( -sBhei / 2 <= item.position.y + item.geometry.parameters.height / 2)&&
              ( -sBhei / 2 >= item.position.y - item.geometry.parameters.height / 2)&&
              ( -sBlen / 2 <= item.position.z + item.geometry.parameters.depth / 2)&&
              ( -sBlen / 2 >= item.position.z - item.geometry.parameters.depth / 2)){
                  flag = 1;
              }
              else if(( -sBwid / 2 <= item.position.x + item.geometry.parameters.width / 2)&&
              ( -sBwid / 2 >= item.position.x - item.geometry.parameters.width / 2)&&
              ( sBhei / 2 <= item.position.y + item.geometry.parameters.height / 2)&&
              ( sBhei / 2 >= item.position.y - item.geometry.parameters.height / 2)&&
              ( sBlen / 2 <= item.position.z + item.geometry.parameters.depth / 2)&&
              ( sBlen / 2 >= item.position.z - item.geometry.parameters.depth / 2)){
                  flag = 1;
              }
              else if(( -sBwid / 2 <= item.position.x + item.geometry.parameters.width / 2)&&
              ( -sBwid / 2 <= item.position.y + item.geometry.parameters.height / 2)&&
              ( sBhei / 2 >= item.position.x - item.geometry.parameters.width / 2)&&
              ( sBhei / 2 >= item.position.y - item.geometry.parameters.height / 2)&&
              ( -sBlen / 2 <= item.position.z + item.geometry.parameters.depth / 2)&&
              ( -sBlen / 2 >= item.position.z - item.geometry.parameters.depth / 2)){
                  flag = 1;
              }
              else if(( -sBwid / 2 <= item.position.x + item.geometry.parameters.width / 2)&&
              ( -sBwid / 2 >= item.position.x - item.geometry.parameters.width / 2)&&
              ( -sBhei / 2 <= item.position.y + item.geometry.parameters.height / 2)&&
              ( -sBhei / 2 >= item.position.y - item.geometry.parameters.height / 2)&&
              ( sBlen / 2 <= item.position.z + item.geometry.parameters.depth / 2)&&
              ( sBlen / 2 >= item.position.z - item.geometry.parameters.depth / 2)){
                  flag = 1;
              }
              else if(( -sBwid / 2 <= item.position.x + item.geometry.parameters.width / 2)&&
              ( -sBwid / 2 >= item.position.x - item.geometry.parameters.width / 2)&&
              ( -sBhei / 2 <= item.position.y + item.geometry.parameters.height / 2)&&
              ( -sBhei / 2 >= item.position.y - item.geometry.parameters.height / 2)&&
              ( -sBlen / 2 <= item.position.z + item.geometry.parameters.depth / 2)&&
              ( -sBlen / 2 >= item.position.z - item.geometry.parameters.depth / 2)){
                  flag = 1;
              }
          }
      });

      if( flag == 0){
        // geometry
        var geometry = new THREE.BoxGeometry( sBwid, sBhei, sBlen );

        // material
        var material1 = new THREE.MeshPhongMaterial( {
            color: document.getElementById('subBox-color').value
        } );

        // mesh
        var mesh = new THREE.Mesh( geometry, material1 );
        mesh.position.set( 0, 0, 0 );
        mvp.scene.add( mesh );
        mvp.objects.push( mesh );
      }
    }
  };
  animate();
}

if (window.addEventListener)
  window.addEventListener('load', initialize, false);
else if (window.attachEvent)
  window.attachEvent('onload', initialize);
else window.onload = initialize;
