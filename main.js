var scene, camera, renderer, clock, deltaTime, totalTime;
var arToolkitSource, arToolkitContext;
var markerRoot1;
var mesh1;

class AlphaVideoMaterial extends THREE.ShaderMaterial {
  constructor() {
    super();

    this.video = document.getElementById('video');

    this.videoTexture = new THREE.VideoTexture(this.video);
    this.videoTexture.minFilter = THREE.LinearFilter;
    this.videoTexture.magFilter = THREE.LinearFilter;

    this.setValues({
      uniforms: {
        texture: {
          type: "t",
          value: this.videoTexture
        }
      },
      vertexShader: `
        varying vec2 vUv;

        void main(void) {
          vUv = uv;
          vec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform sampler2D texture;
        varying vec2 vUv;

        void main(void) {
          vec3 tColor = texture2D( texture, vUv).rgb;
          vec3 aColor = texture2D( texture, (vUv + vec2(0, -0.5))).rgb;
          gl_FragColor = vec4(tColor, aColor[1]);
        }
      `,
      transparent: true
    });
  }

  update() {
    if (this.video.readyState === this.video.HAVE_ENOUGH_DATA && this.videoTexture) {
      this.videoTexture.needsUpdate = true;
    }
  }
}

function initialize() {
  scene = new THREE.Scene();

  let ambientLight = new THREE.AmbientLight(0xcccccc, 0.5);
  scene.add(ambientLight);

  camera = new THREE.Camera();
  scene.add(camera);

  renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true
  });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setClearColor(new THREE.Color('lightgrey'), 0)
  renderer.setSize(640, 480);
  renderer.domElement.style.position = 'absolute'
  renderer.domElement.style.top = '0px'
  renderer.domElement.style.left = '0px'
  document.body.appendChild(renderer.domElement);

  clock = new THREE.Clock();
  deltaTime = 0;
  totalTime = 0;

  ////////////////////////////////////////////////////////////
  // setup arToolkitContext
  ////////////////////////////////////////////////////////////	

  // create atToolkitContext
  arToolkitContext = new THREEx.ArToolkitContext({
    cameraParametersUrl: 'data/camera_para.dat',
    detectionMode: 'mono'
  });

  // copy projection matrix to camera when initialization complete
  arToolkitContext.init(function onCompleted() {
    camera.projectionMatrix.copy(arToolkitContext.getProjectionMatrix());
  });

  ////////////////////////////////////////////////////////////
  // setup markerRoots
  ////////////////////////////////////////////////////////////

  // build markerControls
  markerRoot1 = new THREE.Group();
  scene.add(markerRoot1);
  let markerControls1 = new THREEx.ArMarkerControls(arToolkitContext, markerRoot1, {
    type: 'pattern', patternUrl: "data/hiro.patt",
  })
  let markerLostTimeout;
  markerControls1.addEventListener("markerFound", () => {
    clearTimeout(markerLostTimeout);
    hideHelp();
  });
  markerControls1.addEventListener('markerLost', () => {
    console.log("markerLost")
    // clearTimeout(markerLostTimeout);
    markerLostTimeout = setTimeout(() => {
      showHelp();
    }, 3000);
  })

  // let geometry1 = new THREE.PlaneBufferGeometry(2, 2, 4, 4);
  let geometry1 = new THREE.PlaneGeometry(5, 5);

  let uvs = geometry1.faceVertexUvs[0];
  uvs[0][1].y = 0.5;
  uvs[1][0].y = 0.5;
  uvs[1][1].y = 0.5;

  // let video = document.getElementById('video');
  // let texture = new THREE.VideoTexture(video);
  // texture.minFilter = THREE.LinearFilter;
  // texture.magFilter = THREE.LinearFilter;
  // texture.format = THREE.RGBAFormat;
  // let material1 = new THREE.MeshBasicMaterial({ map: texture });
  let alphaVideoMaterial = new AlphaVideoMaterial();

  mesh1 = new THREE.Mesh(geometry1, alphaVideoMaterial);
  mesh1.rotation.x = -Math.PI / 2;

  markerRoot1.add(mesh1);
}

function update() {
  // update artoolkit on every frame
  if (arToolkitSource.ready !== false)
    arToolkitContext.update(arToolkitSource.domElement);
}

function render() {
  renderer.render(scene, camera);
}

function animate() {
  requestAnimationFrame(animate);
  deltaTime = clock.getDelta();
  totalTime += deltaTime;
  update();
  render();
}

// Cameras

function setCameraSource(deviceId) {
  // if (arToolkitSource) arToolkitSource.dispose();
  arToolkitSource = new THREEx.ArToolkitSource({
    sourceType: 'webcam',
    deviceId: deviceId
  });

  arToolkitSource.init(function onReady() {
    onResize()
  });
}

function listCameras() {
  navigator.mediaDevices.getUserMedia({ video: true, audio: false })
    .then(() => navigator.mediaDevices.enumerateDevices())
    .then(devices => {
      const cameraSelect = document.getElementById("camera")
      devices.filter(device => device.kind === "videoinput").forEach((device, n) => {
        cameraSelect.options.add(new Option(device.label, device.deviceId));
      })
      // Show camera select now
      // cameraSelect.className = "";
      // Set camera source
      setCameraSource(cameraSelect.options[cameraSelect.selectedIndex].value)
    })
    .catch(e => console.error(e));
}

function onResize() {
  arToolkitSource.onResize()
  arToolkitSource.copyElementSizeTo(renderer.domElement)
  if (arToolkitContext.arController !== null) {
    arToolkitSource.copyElementSizeTo(arToolkitContext.arController.canvas)
  }
}

function hideHelp() {
  const helpDiv = document.getElementById("help");
  helpDiv.className = "hidden";
}

function showHelp() {
  const helpDiv = document.getElementById("help");
  helpDiv.className = "";
}

// UI

initialize();
listCameras();

const button = document.getElementById("start")
button.addEventListener("click", () => {
  document.getElementById("start-overlay").className = "hidden";
  document.getElementById("help").className = "";
  const video = document.getElementById('video')
  video.play();
  animate();
})

const cameraSelect = document.getElementById("camera")
cameraSelect.addEventListener("change", (e) => {
  setCameraSource(e.target.value)
})

const changeButton = document.getElementById("change-button")
changeButton.addEventListener("click", () => {
  cameraSelect.selectedIndex = (cameraSelect.selectedIndex + 1) % cameraSelect.options.length
  setCameraSource(cameraSelect.options[cameraSelect.selectedIndex].value)
})

// handle resize event
window.addEventListener('resize', function () {
  onResize()
});


const debugDiv = document.getElementById("debug");
const console = {
  log: msg => debugDiv.innerHTML += `<pre>${msg}${'\n'}</pre>`,
  error: msg => debugDiv.innerHTML += `<pre class="error">${msg}${'\n'}</pre>`
};
