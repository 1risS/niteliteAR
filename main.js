var scene, camera, renderer, clock, deltaTime, totalTime;
var arToolkitSource, arToolkitContext;
var markerRoot1;
var mesh1;

const button = document.getElementById("start")
button.addEventListener("click", () => {
  const video = document.getElementById('video')
  video.play();
  console.log("playing")
  initialize();
  animate();
})

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
  // setup arToolkitSource
  ////////////////////////////////////////////////////////////

  arToolkitSource = new THREEx.ArToolkitSource({
    sourceType: 'webcam',
  });

  function onResize() {
    arToolkitSource.onResize()
    arToolkitSource.copySizeTo(renderer.domElement)
    if (arToolkitContext.arController !== null) {
      arToolkitSource.copySizeTo(arToolkitContext.arController.canvas)
    }
  }

  arToolkitSource.init(function onReady() {
    onResize()
  });

  // handle resize event
  window.addEventListener('resize', function () {
    onResize()
  });

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