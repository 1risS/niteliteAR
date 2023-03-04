var scene, camera, renderer, clock, deltaTime, totalTime;
var arToolkitSource, arToolkitContext;
var markerRoot1;
var mesh1;
var videoChunks = [];
var mediaRecorder;
// var capabilitiesByDeviceId = {}

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

  const animationVideo = document.getElementById('animation')
  const alphaVideoMaterial = new AlphaVideoMaterial(animationVideo);

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
  // const capabilities = capabilitiesByDeviceId[deviceId];
  // console.clear();
  // console.log(`capabilities: ${JSON.stringify(capabilities, null, 2)}`)
  arToolkitSource = new THREEx.ArToolkitSource({
    sourceType: 'webcam',
    deviceId: deviceId,
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
        // capabilitiesByDeviceId[device.deviceId] = device.getCapabilities()
      })
      if (cameraSelect.options.length <= 1) {
        document.getElementById("change-button").classList.add("hidden");
      }
      setCameraSource(cameraSelect.options[cameraSelect.selectedIndex].value)
    })
    .catch(e => console.error(e));
}

function onResize() {
  arToolkitSource.onResizeElement()
  arToolkitSource.copyElementSizeTo(renderer.domElement)
  if (arToolkitContext.arController !== null) {
    arToolkitSource.copyElementSizeTo(arToolkitContext.arController.canvas)
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
  const hiddenCanvas = document.querySelector('canvas.hidden');

  const threejsCanvas = renderer.domElement;
  const arCanvas = arToolkitContext.arController.canvas;

  renderer.render(scene, camera);

  const width = arToolkitContext.arController.videoWidth;
  const height = arToolkitContext.arController.videoHeight;

  // TODO: If on portrait, recalculate widhtRecalculate wiodth height to remove
  // black borders if on portrait.

  if (width && height) {
    // Setup a canvas with the same dimensions as the video.
    hiddenCanvas.width = width;
    hiddenCanvas.height = height;
  }

  // Copy AR and Threejs canvas onto hidden canvas
  const ctx = hiddenCanvas.getContext('2d');
  ctx.drawImage(arCanvas, 0, 0, width, height);
  ctx.drawImage(threejsCanvas, 0, 0, width, height);

  const mimetype = 'image/jpeg'
  const dataUrl = hiddenCanvas.toDataURL(mimetype);

  // Share image (if possible), otherwise download as file
  if (typeof navigator.share === "function") {
    shareCanvas(dataUrl, "nitelito.jpg", mimetype);
  } else {
    downloadCanvas(dataUrl, "nitelite.jpg")
  }
}

function startRecordingVideo() {
  // FIXME: How can we record both canvases??
  const canvas = arToolkitContext.arController.canvas;
  const canvasStream = canvas.captureStream(60); // fps

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
  const animationVideo = document.getElementById('animation')
  animationVideo.play();
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
