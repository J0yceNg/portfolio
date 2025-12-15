import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import * as TWEEN from 'three/addons/libs/tween.module.js';

// --- Scene Setup ---
const scene = new THREE.Scene();

scene.background = new THREE.Color(0xc2e5f0);

// 1. Camera: Perspective camera (most common)
const camera = new THREE.PerspectiveCamera(
  75, // Field of view (FOV)
  window.innerWidth / window.innerHeight, // Aspect ratio
  0.1, // Near clipping plane
  1000 // Far clipping plane
);
camera.position.set(0, 35, 60);

// 2. Renderer: Renders the scene onto a canvas
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.shadowMap.enabled = true; // Enables shadow mapping globally
renderer.outputColorSpace = THREE.SRGBColorSpace; 
renderer.toneMapping = THREE.ACESFilmicToneMapping;

// Add the renderer's DOM element (the <canvas>) to the HTML body
document.body.appendChild(renderer.domElement);

// 3. Lighting: Models need light to be visible!
// Ambient light provides uniform, non-directional illumination.
const ambientLight = new THREE.AmbientLight(0xffffff, 0.4); 
scene.add(ambientLight);

// Directional light mimics the sun and creates shadows/highlights.
const directionalLight = new THREE.DirectionalLight(0xffffff, 2); 
directionalLight.castShadow = true;

// --- Shadow Quality Settings (Essential for large model shadows) ---

// 1. Increase Shadow Map Resolution (Less pixelated shadows)
directionalLight.shadow.mapSize.width = 4096;
directionalLight.shadow.mapSize.height = 4096;

// 2. Adjust Shadow Camera Frustum (Crucial to make sure the large shadow isn't cut off)
// Defines the box the light "sees" to calculate shadows. Must cover your scaled cafe (size 10).
const shadowCameraSize = 25; 
directionalLight.shadow.camera.left = -shadowCameraSize;
directionalLight.shadow.camera.right = shadowCameraSize;
directionalLight.shadow.camera.top = shadowCameraSize;
directionalLight.shadow.camera.bottom = -shadowCameraSize;
directionalLight.shadow.camera.near = 0.5; // Closest point to check for shadows
directionalLight.shadow.camera.far = 50;  // Farthest point to cast shadows

// 3. Soften the Shadow Edges 
directionalLight.shadow.radius = 3; 

// --- End Shadow Quality Settings ---

directionalLight.position.set(5, 10, 7.5);
scene.add(directionalLight);
scene.add(directionalLight.target);

// 4. Controls: Allows you to move the camera with the mouse
const controls = new OrbitControls(camera, renderer.domElement);

controls.target.set(0, 10, 0); // Focus the camera on the center-mass of the cafe (approx. 4 units up)
controls.maxPolarAngle = Math.PI / 2 + 0.1; // 90 degrees + a slight downward tilt
controls.update();

// --- Ground Plane Setup (Grass and Flowers) ---

// 1. Create a texture loader
const textureLoader = new THREE.TextureLoader();

// 2. Load the grass/flower texture
const grassTexture = textureLoader.load('/grass.jpg'); 
grassTexture.colorSpace = THREE.SRGBColorSpace;

// Tiling the texture: This makes the texture repeat over the large plane
grassTexture.wrapS = THREE.RepeatWrapping;
grassTexture.wrapT = THREE.RepeatWrapping;
grassTexture.repeat.set(250, 250);

// 3. Create a Material
const groundMaterial = new THREE.MeshStandardMaterial({
    map: grassTexture, // Use the loaded texture
    side: THREE.DoubleSide, // Ensure it's visible from both sides (if needed)
});

// 4. Create Geometry (A large, flat plane)
const groundGeometry = new THREE.PlaneGeometry(1000, 1000);

// 5. Create the Mesh
const groundMesh = new THREE.Mesh(groundGeometry, groundMaterial);
groundMesh.receiveShadow = true;

// 6. Position the Ground
// Rotate it so it's flat on the XZ plane (instead of standing up)
groundMesh.rotation.x = -Math.PI / 2; // -90 degrees
// Move it down slightly so the cafe sits on top (assuming the cafe is at y=0)
groundMesh.position.y = -0.1; 

scene.add(groundMesh);

// --- Environmental Lighting Setup ---

// Instantiate a generator to process the environment map
const pmremGenerator = new THREE.PMREMGenerator(renderer);
pmremGenerator.compileEquirectangularShader();

// Load a default subtle HDRI map from a CDN (or place one in public/)
 new RGBELoader()
  .setPath('https://threejs.org/examples/textures/equirectangular/')
  .load('royal_esplanade_1k.hdr', function (texture) {
    const envMap = pmremGenerator.fromEquirectangular(texture).texture;

    // Use the environment map for global illumination and reflections
    scene.environment = envMap;

    texture.dispose();
    pmremGenerator.dispose();
  });

// --- Model Loading ---
const loader = new GLTFLoader();

loader.load(
  '/models/cafe_no_door.glb',
  function (gltf) {
    const pusheenCafe = gltf.scene;
    pusheenCafe.scale.set(10, 10, 10);
    pusheenCafe.position.set(0, 0, 0);

    pusheenCafe.traverse((obj) => {
      if (obj.isMesh) obj.castShadow = true;
    });

    scene.add(pusheenCafe);
    console.log('Pusheen Cafe loaded successfully!');

    // --- Load Door after cafe is added ---
    loader.load(
      '/models/door_only.glb',
      function (gltf2) {
        const door = gltf2.scene;

        door.scale.set(10, 10, 10);
        door.position.set(9.1, 8.3, 0);

        door.traverse(o => console.log(o.name, o.type));

        // root for raycasting (whole door, knob included)
        window.doorRoot = door;

        // rotate THIS — the group that contains slab + knob
        window.doorMesh = door.getObjectByName('door001');


        door.traverse((node) => {
          if (node.isMesh) {
            node.castShadow = true;
            node.receiveShadow = true;
          }
        });

        scene.add(door);
        console.log('Standalone door loaded and positioned!');
      },
      undefined,
      (err) => console.error('Error loading door:', err)
    );
  },
  function (xhr) {
    console.log((xhr.loaded / xhr.total) * 100 + '% loaded');
  },
  function (error) {
    console.error('An error occurred loading the cafe model', error);
  }
);

// --- Interactivity: Raycasting Setup ---
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let isDoorOpen = false; // State variable for the door

function onPointerClick(event) {
    if (!window.doorMesh) return;

    pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
    pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(pointer, camera);

    // The second 'true' parameter allows raycasting to check all meshes inside the door group
    const intersects = raycaster.intersectObject(window.doorRoot, true);
    if (intersects.length > 0) {
    isDoorOpen = !isDoorOpen;

    const targetRotation = isDoorOpen ? Math.PI / 2 : 0; // flip sign if needed

    new TWEEN.Tween(window.doorMesh.rotation)
        .to({ y: targetRotation }, 500)
        .easing(TWEEN.Easing.Quadratic.Out)
        .start();
    }
}

// Attach the event listener to the renderer's canvas
renderer.domElement.addEventListener( 'click', onPointerClick );

// --- Animation Loop ---
function animate() {
  requestAnimationFrame(animate); // Keep looping at screen refresh rate
  controls.update(); // Only required if controls.enableDamping is set to true
  TWEEN.update();
  renderer.render(scene, camera); // Draw the frame
}

// 5. Handle Window Resize
window.addEventListener('resize', () => {
  // Update camera aspect ratio
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  // Update renderer size
  renderer.setSize(window.innerWidth, window.innerHeight);
});

animate(); // Start the animation loop