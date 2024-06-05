var VSHADER_SOURCE = `
  precision mediump float;
  
  attribute vec4 a_Pos;
  attribute vec2 a_UV;
  attribute vec3 a_Normal;

  uniform mat4 u_ModelMatrix;
  uniform mat4 u_NormalMatrix;
  uniform mat4 u_GlobalRotateMatrix;
  uniform mat4 u_ViewMatrix;
  uniform mat4 u_ProjectionMatrix;
  
  varying vec2 v_UV;
  varying vec3 v_Normal;
  varying vec4 v_VertPos;
  
  void main() {
    v_UV = a_UV;
    v_Normal = normalize(vec3(u_NormalMatrix * vec4(a_Normal, 1)));
    v_VertPos = u_ModelMatrix * a_Pos;
    gl_Position = u_ProjectionMatrix * u_ViewMatrix * u_GlobalRotateMatrix * u_ModelMatrix * a_Pos;
  }`;


  var FSHADER_SOURCE = `
  precision mediump float;

  varying vec2 v_UV;
  varying vec3 v_Normal;
  varying vec4 v_VertPos;

  uniform vec4 u_FragColor;
  uniform sampler2D u_Sampler0;
  uniform sampler2D u_Sampler1;
  uniform sampler2D u_Sampler2;
  uniform sampler2D u_Sampler3;
  uniform int u_whichTexture;
  uniform bool u_lightsOn;
  uniform vec3 u_cameraPos;
  uniform vec3 u_normalLightPos;
  uniform vec3 u_normalLightColor;
  uniform bool u_normalLightOn;
  uniform vec3 u_spotlightPos;
  uniform vec3 u_spotlightDir;
  uniform vec3 u_spotlightColor;
  uniform float u_spotlightCutoffAngle;
  uniform bool u_spotlightOn;

  vec4 calculateTextureColor() {
    if (u_whichTexture == -3) {
      return vec4((v_Normal + 1.0) / 2.0, 1.0); 
    } else if (u_whichTexture == -2) {             
      return u_FragColor;
    } else if (u_whichTexture == -1) {      
      return vec4(v_UV, 1.0, 1.0);
    } else if (u_whichTexture == 0) {       
      return texture2D(u_Sampler0, v_UV);
    } else if (u_whichTexture == 1) {       
      return texture2D(u_Sampler1, v_UV);
    } else if (u_whichTexture == 2) {
      return texture2D(u_Sampler2, v_UV);
    } else if (u_whichTexture == 3) {
      return texture2D(u_Sampler3, v_UV);
    } else {                                
      return vec4(1.0, 0.2, 0.2, 1.0);
    }
  }

  vec3 calculateLighting(vec3 lightVector, vec3 lightColor) {
    float r = length(lightVector);
    vec3 L = normalize(lightVector);
    vec3 N = normalize(v_Normal);
    float nDotL = max(dot(N, L), 0.0);
    vec3 R = reflect(-L, N);
    vec3 E = normalize(u_cameraPos - vec3(v_VertPos));
    float specular = pow(max(dot(E, R), 0.0), 64.0) * 0.8;
    vec3 diffuse = vec3(1.0, 1.0, 0.9) * vec3(gl_FragColor) * nDotL * 0.7;
    vec3 ambient = vec3(gl_FragColor) * 0.2;
    return (specular + diffuse + ambient) * lightColor;
  }

  void main() {
    gl_FragColor = calculateTextureColor();

    if (u_lightsOn) {
      if (u_spotlightOn) {
        vec3 spotlightVector = u_spotlightPos - vec3(v_VertPos);
        float delta = dot(normalize(-u_spotlightDir), spotlightVector);
        if (delta > u_spotlightCutoffAngle) {
          vec3 spotColor = calculateLighting(spotlightVector, u_spotlightColor);
          gl_FragColor = vec4(spotColor, 1.0);
        }
      }

      if (u_normalLightOn) {
        vec3 normalLightVector = u_normalLightPos - vec3(v_VertPos);
        vec3 normalLightColor = calculateLighting(normalLightVector, u_normalLightColor);
        gl_FragColor = vec4(normalLightColor, 1.0);
      }
    }
  }`;



let canvas;
let gl;
let a_Pos;
let a_UV;
let a_Normal; 
let u_FragColor
let u_Size;

let u_whichTexture;
let u_lightsOn;
let u_cameraPos;
let u_normalLightOn;
let u_normalLightPos;
let u_normalLightColor;
let u_spotlightOn;

let u_ModelMatrix;
let u_NormalMatrix;
let u_ProjectionMatrix;
let u_ViewMatrix;
let u_GlobalRotateMatrix;

let u_Sampler0; 
let u_Sampler1;
let u_Sampler2;
let u_Sampler3;

let u_spotlightPos;
let u_spotlightDir;
let u_spotlightColor;
let u_spotlightCutoffAngle;

let g_globalAngle = 0;

var g_startTime = performance.now() / 1000.0;
var g_seconds = performance.now() / 1000.0 - g_startTime;
var previous = performance.now();
var start;

var view = new Camera();
var g_eye = new Vector3([0, 0, 3]);
var g_at = new Vector3([-0.25, -0.15, 0.0]); 
var g_up = new Vector3([0, 1, 0]);


var g_shapesList = [];
var projMat = new Matrix4();

g_normalOn = false;

let g_lightsOn = true; 

let g_normalLightOn = true; 
let g_normalLightPos = [1, 1, -1];
let g_normalLightColor = [2, 2, 2];
let g_normalLightAnimationOn = true;

let spot_on = true; 
let spot_pos = [2, 1.2, -2];
let spot_dir = [0, -1, 0];
let spotColor = [1, 1, 1];

function setupWebGL() {

  canvas = document.getElementById('webgl');

  gl = canvas.getContext("webgl", { preserveDrawingBuffer: true });
  if (!gl) {
    console.log('Failed to get the rendering context for WebGL');
    return;
  }

  gl.enable(gl.DEPTH_TEST);
}

function main() {

  setupWebGL(); 
  connectVariablesToGLSL();
  addActionsForHTMLUI();

  let mouse_clicked = false;
  let cam_delay = Math.PI / 2; 


  let xcoord = -1;
  let ycoord = -1;
  let delta = 0;

  canvas.addEventListener('mousedown', (event) => {
    mouse_clicked = true;
    xcoord = event.clientX;
    ycoord = event.clientY;
  });

  canvas.addEventListener('mouseup', () => {
    mouse_clicked = false;
  })

  canvas.addEventListener('mousemove', (event) => {
    if (mouse_clicked) {
      const deltaX = event.clientX - xcoord;
      const deltaY = event.clientY - ycoord;
      delta -= deltaX * 0.005; 
      cam_delay -= deltaY * 0.005; 

      view.updateCamera(delta, cam_delay);
      gl.uniformMatrix4fv(u_ViewMatrix, false, view.viewMatrix.elements);
    }
    xcoord = event.clientX;
    ycoord = event.clientY;
  });

  initTextures(gl, 0);

  gl.clearColor(0.0, 0.0, 0.0, 1.0);

  start = previous;
  renderScene();
  requestAnimationFrame(tick);
}

function connectVariablesToGLSL() {

  if (!initShaders(gl, VSHADER_SOURCE, FSHADER_SOURCE)) {
    console.log('Failed to initialize shaders.');
    return;
  }

  a_Pos = gl.getAttribLocation(gl.program, 'a_Pos');
  if (a_Pos < 0) {
    console.log('Failed to get the storage location of a_Pos');
    return;
  }

  a_UV = gl.getAttribLocation(gl.program, 'a_UV');
  if (a_UV < 0) {
    console.log('Failed to get the storage location of a_UV');
    return;
  }

  a_Normal = gl.getAttribLocation(gl.program, 'a_Normal');
  if (a_Normal < 0) {
    console.log('Failed to get the storage location of a_Normal');
    return;
  }

  u_FragColor = gl.getUniformLocation(gl.program, 'u_FragColor');
  if (!u_FragColor) {
    console.log('Failed to get the storage location of u_FragColor');
    return;
  }

  u_ModelMatrix = gl.getUniformLocation(gl.program, 'u_ModelMatrix');
  if (!u_ModelMatrix) {
    console.log('Failed to get the storage location of u_ModelMatrix');
    return;
  }

  u_NormalMatrix = gl.getUniformLocation(gl.program, 'u_NormalMatrix');
  if (!u_NormalMatrix) {
    console.log('Failed to get the storage location of u_NormalMatrix');
    return;
  }

  u_ViewMatrix = gl.getUniformLocation(gl.program, 'u_ViewMatrix');
  if (!u_ViewMatrix) {
    console.log('Failed to get the storage location of u_ViewMatrix');
    return;
  }

  u_ProjectionMatrix = gl.getUniformLocation(gl.program, 'u_ProjectionMatrix');
  if (!u_ProjectionMatrix) {
    console.log('Failed to get the storage location of u_ProjectionMatrix');
    return;
  }

  u_GlobalRotateMatrix = gl.getUniformLocation(gl.program, 'u_GlobalRotateMatrix');
  if (!u_GlobalRotateMatrix) {
    console.log('Failed to get the storage location of u_GlobalRotateMatrix');
    return;
  }

  u_Sampler0 = gl.getUniformLocation(gl.program, 'u_Sampler0');
  if (!u_Sampler0) {
    console.log('Failed to get the storage location of u_Sampler0');
    return false;
  }

  u_Sampler1 = gl.getUniformLocation(gl.program, 'u_Sampler1');
  if (!u_Sampler1) {
    console.log('Failed to get the storage location of u_Sampler1');
    return false;
  }

  u_Sampler2 = gl.getUniformLocation(gl.program, 'u_Sampler2');
  if (!u_Sampler2) {
    console.log('Failed to get the storage location of u_Sampler2');
    return false;
  }

  u_Sampler3 = gl.getUniformLocation(gl.program, 'u_Sampler3');
  if(!u_Sampler3) {
    console.log('Failed to get the storage location of u_Sampler3');
    return false;
  }
  
  u_whichTexture = gl.getUniformLocation(gl.program, 'u_whichTexture');
  if (!u_whichTexture) {
    console.log('Failed to get the storage location of u_whichTexture');
    return false;
  }

  u_lightsOn = gl.getUniformLocation(gl.program, 'u_lightsOn');
  if (!u_lightsOn) {
    console.log('Failed to get the storage location of u_lightsOn');
    return false;
  }

  u_cameraPos = gl.getUniformLocation(gl.program, 'u_cameraPos');
  if (!u_cameraPos) {
    console.log('Failed to get the storage location of u_cameraPos');
    return false;
  }

  u_normalLightOn = gl.getUniformLocation(gl.program, 'u_normalLightOn');
  if (!u_normalLightOn) {
    console.log('Failed to get the storage location of u_normalLightOn');
    return false;
  }

  u_normalLightPos = gl.getUniformLocation(gl.program, 'u_normalLightPos');
  if (!u_normalLightPos) {
    console.log('Failed to get the storage location of u_normalLightPos');
    return false;
  }

  u_normalLightColor = gl.getUniformLocation(gl.program, 'u_normalLightColor');
  if (!u_normalLightColor) {
    console.log('Failed to get the storage location of u_normalLightColor');
    return false;
  }

  u_spotlightOn = gl.getUniformLocation(gl.program, 'u_spotlightOn');
  if (!u_spotlightOn) {
    console.log('Failed to get the storage location of u_spotlightOn');
    return false;
  }

  u_spotlightPos = gl.getUniformLocation(gl.program, 'u_spotlightPos');
  if (!u_spotlightPos) {
    console.log('Failed to get the storage location of u_spotlightPos');
    return false;
  }

  u_spotlightDir = gl.getUniformLocation(gl.program, 'u_spotlightDir');
  if (!u_spotlightDir) {
    console.log('Failed to get the storage location of u_spotlightDir');
    return false;
  }

  u_spotlightColor = gl.getUniformLocation(gl.program, 'u_spotlightColor');
  if (!u_spotlightColor) {
    console.log('Failed to get the storage location of u_spotlightColor');
    return false;
  }

  var identityM = new Matrix4();
  gl.uniformMatrix4fv(u_ModelMatrix, false, identityM.elements);
  gl.uniformMatrix4fv(u_NormalMatrix, false, identityM.elements);
}

function addActionsForHTMLUI() {

  

  document.getElementById('normOn').onclick = function () { g_lightsOn = true; }
  document.getElementById('normOff').onclick = function () { g_lightsOn = false; }
  document.getElementById('normAnimateOn').onclick = function () { g_normalLightAnimationOn = true; }
  document.getElementById('normAnimateOff').onclick = function () { g_normalLightAnimationOn = false; }

  document.getElementById('spotlightOn').onclick = function () { spot_on = true; }
  document.getElementById('spotlightOff').onclick = function () { spot_on = false; }

  

  document.getElementById('camAngle').addEventListener('mousemove', function () { g_globalAngle = this.value; renderScene(); });

  document.getElementById('normposX').addEventListener('mousemove', function () { g_normalLightPos[0] = this.value / 100; renderScene(); });
  document.getElementById('normposY').addEventListener('mousemove', function () { g_normalLightPos[1] = this.value / 100; renderScene(); });
  document.getElementById('normposZ').addEventListener('mousemove', function () { g_normalLightPos[2] = this.value / 100; renderScene(); });

  document.getElementById('normalOn').onclick = function () { g_normalOn = true; }
  document.getElementById('normalOff').onclick = function () { g_normalOn = false; }

  document.getElementById('lightsOn').onclick = function () { g_lightsOn = true; }
  document.getElementById('lightsOff').onclick = function () { g_lightsOn = false; }

  document.getElementById('spotPosX').addEventListener('mousemove', function () { spot_pos[0] = this.value / 100; renderScene(); });
  document.getElementById('spotPosY').addEventListener('mousemove', function () { spot_pos[1] = this.value / 100; renderScene(); });
  document.getElementById('spotPosZ').addEventListener('mousemove', function () { spot_pos[2] = this.value / 100; renderScene(); });
  
  document.getElementById('spotdirX').addEventListener('mousemove', function () { spot_dir[0] = this.value / 100; renderScene(); });
  document.getElementById('spotdirY').addEventListener('mousemove', function () { spot_dir[1] = this.value / 100; renderScene(); });
  document.getElementById('spotdirZ').addEventListener('mousemove', function () { spot_dir[2] = this.value / 100; renderScene(); });
  
}

function initTextures(gl, n) {

  var image0 = new Image();  
  if (!image0) {
    console.log('Failed to create the image0 object');
    return false;
  }
  var image1 = new Image();  
  if (!image1) {
    console.log('Failed to create the image1 object');
    return false;
  }
  var image2 = new Image();
  if (!image2) {
    console.log('Failed to create the image2 object');
    return false;
  }
  var image3 = new Image();
  if(!image3) {
    console.log('Failed to create the image3 object');
    return false;
  }

  image0.onload = function () {
    sendImageToTEXTURE0(image0);
    image1.onload = function () {
      sendImageToTEXTURE1(image1);
    };
    image1.src = '../lib/gold_block.jpeg';
  };
  image0.src = '../lib/sky.jpg';

  image2.onload = function () { sendImageToTEXTURE2(image2); };
  image2.src = '../lib/floor.jpg';

  image3.onload = function () { sendImageToTEXTURE3(image3); };
  image3.src = '../lib/obsidian.jpg';


  return true;
}

function sendImageToTEXTURE0(image) {
  var texture = gl.createTexture();   
  if (!texture) {
    console.log('Failed to create the texture object');
    return false;
  }

  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1); 
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, texture);

  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, image);

  gl.uniform1i(u_Sampler0, 0);
}

function sendImageToTEXTURE1(image) {
  var texture = gl.createTexture();   
  if (!texture) {
    console.log('Failed to create the texture object');
    return false;
  }

  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1); 
  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, texture);

  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, image);

  gl.uniform1i(u_Sampler1, 1);

}

function sendImageToTEXTURE2(image) {
  var texture = gl.createTexture();   
  if (!texture) {
    console.log('Failed to create the texture object');
    return false;
  }

  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1); 
  gl.activeTexture(gl.TEXTURE2);
  gl.bindTexture(gl.TEXTURE_2D, texture);

  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, image);

  gl.uniform1i(u_Sampler2, 2);

}

function sendImageToTEXTURE3(image) {
  var texture = gl.createTexture();
  if (!texture) {
    console.log('Failed to create the texture object');
    return false;
  }
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
  gl.activeTexture(gl.TEXTURE3);
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, image);
  gl.uniform1i(u_Sampler3, 3);
}



function tick() {
  g_seconds = performance.now() / 1000.0 - g_startTime;
  updateAnimationAngles();
  requestAnimationFrame(tick);
  var current = performance.now();
  renderScene();
}

function updateAnimationAngles() {

  if (g_normalLightAnimationOn === true) { 
    g_normalLightPos[0] = Math.cos(g_seconds) * 5;
    g_normalLightPos[2] = Math.cos(g_seconds) * 5;
  }
}

function renderScene() {

  var startTime = performance.now();

  projMat.setIdentity();
  projMat.setPerspective(50, 1 * canvas.width / canvas.height, 1, 200);
  gl.uniformMatrix4fv(u_ProjectionMatrix, false, projMat.elements);

  var viewMat = new Matrix4();
  viewMat.setLookAt(
    view.eye.elements[0], view.eye.elements[1], view.eye.elements[2],
    view.at.elements[0], view.at.elements[1], view.at.elements[2],
    view.up.elements[0], view.up.elements[1], view.up.elements[2],
  ); 
  gl.uniformMatrix4fv(u_ViewMatrix, false, viewMat.elements);

  var cameraRotMat = new Matrix4().rotate(-0.3, 0, 1, 0);
  gl.uniformMatrix4fv(u_ModelMatrix, false, cameraRotMat.elements);

  var normalMat = new Matrix4();
  normalMat.setInverseOf(cameraRotMat);
  normalMat.transpose();
  gl.uniformMatrix4fv(u_NormalMatrix, false, normalMat.elements);

  var globalRotMat = new Matrix4().rotate(g_globalAngle, 0, 1, 0);
  gl.uniformMatrix4fv(u_GlobalRotateMatrix, false, globalRotMat.elements);

  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  gl.clear(gl.COLOR_BUFFER_BIT);

  gl.uniform1i(u_lightsOn, g_lightsOn);
  gl.uniform3f(u_cameraPos, view.eye.elements[0], view.eye.elements[1], view.eye.elements[2]);

  gl.uniform1i(u_normalLightOn, g_normalLightOn);
  gl.uniform3f(u_normalLightPos, g_normalLightPos[0], g_normalLightPos[1], g_normalLightPos[2]);
  gl.uniform3f(u_normalLightColor, g_normalLightColor[0], g_normalLightColor[1], g_normalLightColor[2]);

  gl.uniform1i(u_spotlightOn, spot_on);
  gl.uniform3f(u_spotlightPos, spot_pos[0], spot_pos[1], spot_pos[2]);
  gl.uniform3f(u_spotlightDir, spot_dir[0], spot_dir[1], spot_dir[2]);
  gl.uniform3f(u_spotlightColor, spotColor[0], spotColor[1], spotColor[2]);

  var normalLight = new Cube(); 
  normalLight.textureNum = 2;
  if (g_normalOn === true) {
    normalLight.textureNum = -3; 
  } else {
    normalLight.textureNum = -2; 
  }
  normalLight.matrix.translate(-g_normalLightPos[0], g_normalLightPos[1], g_normalLightPos[2]); 
  normalLight.matrix.scale(-0.1, -0.1, -0.1); 
  normalLight.matrix.translate(-0.5, -0.5, -0.5);
  normalLight.normalMatrix.setInverseOf(normalLight.matrix).transpose(); 
  normalLight.render(); 

  var spotlight = new Cylinder(); 
  spotlight.color = [1, 1, 1, 1]; 
  if (g_normalOn === true) {
    spotlight.textureNum = -3; 
  } else {
    spotlight.textureNum = -2; 
  }
  spotlight.matrix.translate(spot_pos[0], spot_pos[1], spot_pos[2]); 
  spotlight.matrix.scale(0.5, 0.5, 0.5); 
  spotlight.matrix.translate(-0.5, -0.5, -0.5);  
  spotlight.render(); 

  var sphere = new Sphere();
  if (g_normalOn === true) {
    sphere.textureNum = -3; 
  } else {
    sphere.textureNum = 1; 
  }
  sphere.matrix.translate(0, 0.25, 0); 
  sphere.matrix.scale(0.5, 0.5, 0.5);
  sphere.render();

  var controlcube = new Cube();
  controlcube.textureNum = 3;
  if(g_normalOn === true){
    controlcube.textureNum = -3;
  }
  controlcube.matrix.translate(-1.5, -0.2, 0);
  controlcube.matrix.scale(0.7, 0.7, 0.7);
  controlcube.render();

  var grass = new Cube(); 
  grass.textureNum = 2;
  if (g_normalOn === true) {
    grass.textureNum = -3; 
  }
  grass.matrix.translate(0, -0.75, 0.0); 
  grass.matrix.scale(32, 0.0001, 32); 
  grass.matrix.translate(-0.5, -0.001, -0.5); 
  grass.render(); 

  var sky = new Cube(); 
  sky.color = [0, 0, 1, 1]; 
  if (g_normalOn === true) {
    sky.textureNum = -3; 
  } else {
    sky.textureNum = 0; 
  }
  sky.matrix.scale(100, 100, 100); 
  sky.matrix.translate(-0.5, -0.5, -0.5); 
  sky.render(); 


  var duration = performance.now() - startTime;
  sendTextToHTML(" ms: " + Math.floor(duration) + " fps: " + Math.floor(10000 / duration), "numdot");
}

function sendTextToHTML(text, htmlID) {
  var htmlElm = document.getElementById(htmlID);
  if (!htmlElm) {
    console.log("Failed to get: " + htmlID + " from HTML");
    return;
  }
  htmlElm.innerHTML = text;
}