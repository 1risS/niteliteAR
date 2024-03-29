var scene, camera, renderer, clock, deltaTime, totalTime;
var arToolkitSource, arToolkitContext;
var markerRoot1, markerRoot2;
var mesh1, mesh2;
var videoChunks = [];
var mediaRecorder;
var capabilitiesByDeviceId = {};
var noFlip = false;

const RECORD_START_TIME = 500;

class AlphaVideoMaterial extends THREE.ShaderMaterial {
  constructor(videoElement) {
    super();

    this.video = videoElement;

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
  renderer.domElement.style.display = 'none'
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
  markerControls1.addEventListener("markerFound", () => {
    hideHelp();
  });

  // let geometry1 = new THREE.PlaneBufferGeometry(2, 2, 4, 4);
  let geometry1 = new THREE.PlaneGeometry(5, 3);
  geometry1.scale(1.5, 1.5, 1.5);

  let uvs = geometry1.faceVertexUvs[0];
  uvs[0][1].y = 0.5;
  uvs[1][0].y = 0.5;
  uvs[1][1].y = 0.5;

  const animationVideo = document.getElementById('nitelito')
  const alphaVideoMaterial = new AlphaVideoMaterial(animationVideo);

  mesh1 = new THREE.Mesh(geometry1, alphaVideoMaterial);
  mesh1.rotation.x = -Math.PI / 2;

  markerRoot1.add(mesh1);

  /// nitelito2 

  // build markerControls
  markerRoot2 = new THREE.Group();
  scene.add(markerRoot2);
  let markerControls2 = new THREEx.ArMarkerControls(arToolkitContext, markerRoot2, {
    type: 'pattern', patternUrl: "data/kanji.patt",
  })
  markerControls2.addEventListener("markerFound", () => {
    hideHelp();
  });

  // let geometry1 = new THREE.PlaneBufferGeometry(2, 2, 4, 4);
  let geometry2 = new THREE.PlaneGeometry(5, 3);
  geometry2.scale(1.5, 1.5, 1.5);

  let uvs2 = geometry2.faceVertexUvs[0];
  uvs2[0][1].y = 0.5;
  uvs2[1][0].y = 0.5;
  uvs2[1][1].y = 0.5;

  const animationVideo2 = document.getElementById('nitelito2')
  const alphaVideoMaterial2 = new AlphaVideoMaterial(animationVideo2);

  mesh2 = new THREE.Mesh(geometry2, alphaVideoMaterial2);
  mesh2.rotation.x = -Math.PI / 2;

  markerRoot2.add(mesh2);
}

function update() {
  // update artoolkit on every frame
  if (arToolkitSource && arToolkitSource.ready !== false)
    arToolkitContext.update(arToolkitSource.domElement);
}

function render() {
  const mainCanvas = document.getElementById("main-canvas");

  const width = arToolkitContext.arController.videoWidth;
  const height = arToolkitContext.arController.videoHeight;

  // TODO: If on portrait, recalculate widhtRecalculate wiodth height to remove
  // black borders if on portrait.

  if (width && height) {
    // Setup a canvas with the same dimensions as the video.
    mainCanvas.width = width;
    mainCanvas.height = height;
  }

  renderer.render(scene, camera);

  // Copy AR and Threejs canvas onto main canvas
  const ctx = mainCanvas.getContext('2d');
  ctx.clearRect(0, 0, width, height);
  if (noFlip) {
    ctx.drawImage(arToolkitContext.arController.canvas, 0, 0, width, height);
    ctx.drawImage(renderer.domElement, 0, 0, width, height);
  } else {
    // horizontal-flip
    ctx.scale(-1, 1);
    ctx.translate(-width, 0);
    ctx.drawImage(arToolkitContext.arController.canvas, 0, 0, width, height);
    ctx.drawImage(renderer.domElement, 0, 0, width, height);
    // reset the transform-matrix
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }
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
  // const capabilities = capabilitiesByDeviceId[deviceId];

  arToolkitSource = new THREEx.ArToolkitSource({
    sourceType: 'webcam',
    deviceId: deviceId,
  });

  arToolkitSource.init(function onReady() {
    arToolkitSource.domElement.style.display = 'none';

    const capabilities = capabilitiesByDeviceId[deviceId];
    // console.clear();
    // console.log(JSON.stringify(capabilities, null, 2));
    noFlip = capabilities.facingMode.includes("environment");

    onResize()
  });
}

function listCameras() {
  navigator.mediaDevices.getUserMedia({ video: true, audio: false })
    .then(() => navigator.mediaDevices.enumerateDevices())
    .then(devices => {
      const cameraSelect = document.getElementById("camera")
      devices.filter(device => device.kind === "videoinput").forEach((device, n) => {
        // console.log(JSON.stringify(device, null, 2))
        cameraSelect.options.add(new Option(device.label, device.deviceId));
        try {
          capabilitiesByDeviceId[device.deviceId] = device.getCapabilities()
        } catch (err) {
          // console.error(err)
          capabilitiesByDeviceId[device.deviceId] = { facingMode: ["environment"] }
        }
      })
      if (cameraSelect.options.length <= 1) {
        document.getElementById("change-button").classList.add("hidden");
      }
      setCameraSource(cameraSelect.options[cameraSelect.selectedIndex].value)
    })
    .catch(e => console.error(e));
}

function onResize() {
  const mainCanvas = document.getElementById("main-canvas");
  arToolkitSource.onResizeElement()
  arToolkitSource.copyElementSizeTo(renderer.domElement)
  if (arToolkitContext.arController !== null) {
    arToolkitSource.copyElementSizeTo(arToolkitContext.arController.canvas)
    arToolkitSource.copyElementSizeTo(mainCanvas)
  }
}

function hideHelp() {
  const helpDiv = document.getElementById("help");
  helpDiv.classList.add("hidden");
}

function showHelp() {
  const helpDiv = document.getElementById("help");
  helpDiv.classList.remove("hidden");
}

function recordImage() {
  const mainCanvas = document.getElementById('main-canvas');
  const mimetype = 'image/jpeg'
  const dataUrl = mainCanvas.toDataURL(mimetype);

  // Share image (if possible), otherwise download as file
  if (typeof navigator.share === "function") {
    shareCanvas(dataUrl, "nitelito.jpg", mimetype);
  } else {
    downloadCanvas(dataUrl, "nitelite.jpg")
  }
}

function startRecordingVideo() {
  const mainCanvas = document.getElementById('main-canvas');
  const canvasStream = mainCanvas.captureStream(60); // fps

  // Create media recorder from canvas stream
  mediaRecorder = new MediaRecorder(canvasStream, {
    // mimeType: "video/webm; codecs=vp9"
    videoBitsPerSecond: 2500000,
    mimeType: "video/webm",
  });
  // Record data in chunks array when data is available
  mediaRecorder.ondataavailable = (evt) => { videoChunks.push(evt.data); };
  // Provide recorded data when recording stops
  mediaRecorder.onstop = recordVideo;
  // Start recording using a 1s timeslice [ie data is made available every 1s)
  mediaRecorder.start(1000);
}

function endRecordingVideo() {
  setTimeout(() => {
    mediaRecorder.stop();
  }, 500);
}

function cancelRecordingVideo() {

}

function recordVideo() {
  const mimetype = "video/webm";
  const blob = new Blob(videoChunks, { type: mimetype });
  const dataUrl = URL.createObjectURL(blob);

  // Share image (if possible), otherwise download as file
  if (typeof navigator.share === "function") {
    shareCanvas(dataUrl, "nitelito.webm", mimetype);
  } else {
    downloadCanvas(dataUrl, "nitelite.webm")
  }
}

async function shareCanvas(dataUrl, filename, mimetype) {
  const blob = await (await fetch(dataUrl)).blob();
  const filesArray = [
    new File([blob], filename, { type: mimetype, lastModified: new Date().getTime() })
  ];
  const shareData = {
    files: filesArray,
  };
  try {
    await navigator.share(shareData);
  } catch (err) {
    // console.error(err)
  }
}

function downloadCanvas(dataUrl, filename) {
  let a = document.createElement("a");
  a.href = dataUrl
  a.download = filename;
  a.dispatchEvent(new MouseEvent("click"));
  a.remove();
}

// UI

initialize();
listCameras();

const button = document.getElementById("start")
button.addEventListener("click", () => {
  document.getElementById("start-overlay").style = 'display: none';
  document.getElementById("help").classList.remove("hidden");
  document.getElementById('nitelito').play();
  document.getElementById('nitelito2').play();
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

const recordButton = document.getElementById("record-button");
let startsAt, endsAt, recordingTimeout;

const buttonDownHandler = () => {
  startsAt = new Date()
  clearTimeout(recordingTimeout);
  recordingTimeout = setTimeout(() => {
    recordButton.classList.add("recording")
    startRecordingVideo()
  }, RECORD_START_TIME)
};

const buttonCancelHandler = () => {
  clearTimeout(recordingTimeout);
  recordButton.classList.remove("recording");
};

const buttonUpHandler = async () => {
  endsAt = new Date()
  // console.log(`diff ${endsAt - startsAt}`);

  clearTimeout(recordingTimeout);
  recordButton.classList.remove("recording");

  if (endsAt - startsAt >= RECORD_START_TIME) {
    endRecordingVideo();
  } else {
    cancelRecordingVideo();
    recordImage();
  }
};

recordButton.addEventListener("mousedown", buttonDownHandler);
recordButton.addEventListener("mouseout", buttonCancelHandler);
recordButton.addEventListener("mouseup", buttonUpHandler);

recordButton.addEventListener("touchstart", buttonDownHandler);
recordButton.addEventListener("touchcancel", buttonCancelHandler);
recordButton.addEventListener("touchend", buttonUpHandler);

// handle resize event
window.addEventListener('resize', function () {
  onResize()
});

const debugDiv = document.getElementById("debug");
const console = {
  log: msg => debugDiv.innerHTML += `<pre>${msg}${'\n'}</pre>`,
  error: msg => debugDiv.innerHTML += `<pre class="error">${msg}${'\n'}</pre>`,
  clear: () => debugDiv.innerHTML = ""
};
