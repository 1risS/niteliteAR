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
      if (cameraSelect.options.length <= 1) {
        document.getElementById("change-button").classList.add("hidden");
      }
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

function downloadCanvasAsImage(canvas, filename) {
  let a = document.createElement("a");
  a.href = canvas.toDataURL();
  a.download = filename;
  a.dispatchEvent(new MouseEvent("click"));
  a.remove();
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

const recordButton = document.getElementById("record-button");
recordButton.addEventListener("click", async () => {
  console.log("record")
  const hiddenCanvas = document.querySelector('canvas.hidden');

  const threejsCanvas = renderer.domElement;
  const arCanvas = arToolkitContext.arController.canvas;

  const width = threejsCanvas.width;
  const height = threejsCanvas.height;

  if (width && height) {
    // Setup a canvas with the same dimensions as the video.
    hiddenCanvas.width = width;
    hiddenCanvas.height = height;
  }

  // Copy AR and Threejs canvas onto hidden canvas
  const ctx = hiddenCanvas.getContext('2d');
  ctx.drawImage(arCanvas, 0, 0, width, height);
  ctx.drawImage(threejsCanvas, 0, 0, width, height);


  if (typeof navigator.share === "function") {
    // Share image (if possible)
    const dataUrl = hiddenCanvas.toDataURL('image/jpeg');
    const blob = await (await fetch(dataUrl)).blob();
    const filesArray = [
      new File([blob], 'image.jpg', { type: "image/jpeg", lastModified: new Date().getTime() })
    ];
    const shareData = {
      files: filesArray,
    };
    try {
      await navigator.share(shareData);
    } catch (err) {
      console.error(err)
    }
  } else {
    // Otherwise, download file
    downloadCanvasAsImage(hiddenCanvas, "nitelite.jpg")
  }

});

// handle resize event
window.addEventListener('resize', function () {
  onResize()
});

// const debugDiv = document.getElementById("debug");
// const console = {
//   log: msg => debugDiv.innerHTML += `<pre>${msg}${'\n'}</pre>`,
//   error: msg => debugDiv.innerHTML += `<pre class="error">${msg}${'\n'}</pre>`
// };
