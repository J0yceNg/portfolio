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

// 4. Controls
const controls = new OrbitControls(camera, renderer.domElement);

controls.target.set(0, 10, 0); 

controls.maxPolarAngle = Math.PI / 2 - 0.01;

controls.update();

// --- PLAYER / CHARACTER ---
const player = new THREE.Object3D();
player.position.set(0, 0, 20);
scene.add(player);

// --- VISUAL DEBUG: Pink Orb & Direction Arrow ---
// 1. The Orb (Player Body)
const orbGeometry = new THREE.SphereGeometry(1.5, 16, 16);
const orbMaterial = new THREE.MeshBasicMaterial({ 
    color: 0xff00ff, // Pink
    wireframe: true  // Wireframe lets you see through it slightly
});
const playerOrb = new THREE.Mesh(orbGeometry, orbMaterial);
playerOrb.position.y = 1.5; // Raise slightly so it sits ON the grass, not inside it
player.add(playerOrb);

// 2. The Arrow (Facing Direction)
// We point it towards negative Z (which is "Forward" in Three.js local space)
const arrowDir = new THREE.Vector3(0, 0, -1); 
const arrowOrigin = new THREE.Vector3(0, 1.5, 0); // Start arrow from center of orb
const arrowLength = 6;
const arrowColor = 0xffff00; // Yellow stands out well against pink/green
const playerArrow = new THREE.ArrowHelper(arrowDir, arrowOrigin, arrowLength, arrowColor);
player.add(playerArrow);

// Camera height relative to character (Eyes are above the orb)
const headOffset = new THREE.Vector3(0, 12, 0);

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
  '/models/joyce_cafe_no_door.glb',
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


// --- CAMERA POSITIONS (Restored from your snippet) ---
const outsidePos = new THREE.Vector3(0, 35, 60);
const doorwayThreshold = new THREE.Vector3(-10, 12, 15); // Directly in front of door
const insidePos = new THREE.Vector3(-4.16, 11.15, 8.91);          // Deep inside cafe

const outsideLookAt = new THREE.Vector3(0, 10, 0);
const insideLookAt = new THREE.Vector3(9.1, 10, -40);

// --- CONTROL VARIABLES ---
let mode = 'ORBIT'; // 'ORBIT' or 'FPS'
let isCameraSequencing = false; // Flag to pause controls during door animation

const keyState = {};
const moveSpeed = 0.5;
const lookSpeed = 0.005;

// yaw = character turning, pitch = looking up/down
let yaw = 0;
let pitch = 0;
const maxPitch = Math.PI / 2 - 0.05;

// mouse drag state
let pointerDown = false;
let draggingLook = false;
let dragDist = 0;
let last = { x: 0, y: 0 };

// --- INTERACTIVITY: Raycasting & Door Logic ---
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let isDoorOpen = false; 

// --- UNIFIED CLICK HANDLER (Door + Pastries) ---
function onPointerClick(event) {
    // 1. Basic Checks
    if (draggingLook && mode === 'FPS') return; // Don't click if dragging mouse
    
    // 2. Setup Raycaster
    pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
    pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);

    // --- CHECK 1: IS IT THE DOOR? ---
    if (window.doorRoot) {
        const doorIntersects = raycaster.intersectObject(window.doorRoot, true);
        if (doorIntersects.length > 0) {
            handleDoorInteraction();
            return; // Stop here, don't check for pastries if we clicked the door
        }
    }

    // --- CHECK 2: IS IT A PASTRY? ---
    // Check everything in the scene
    const sceneIntersects = raycaster.intersectObjects(scene.children, true);
    
    if (sceneIntersects.length > 0) {
        
      // --- NEW LOGIC: IGNORE GLASS ---
      // Instead of taking intersects[0] (which is the glass),
      // we find the first object in the list that is NOT the glass.
      const hit = sceneIntersects.find(hit => !hit.object.name.includes('Vidro_balcao'));
      
      // If we found a valid object behind the glass
      if (hit) {
          const object = hit.object;
          console.log("Clicked Object:", object.name); // Debug log

          let title = "";
          let desc = "";

          // UPDATE THESE NAMES based on your console logs!
          if (object.name.includes('croissant')) {
              title = "Butter Croissant";
              desc = "Layers of flaky pastry made with 100% French butter.";
          } else if (object.name.includes('donut')) {
              title = "Classic Glazed Donut";
              desc = "A timeless classic. Fluffy, sweet, and melted to perfection.";
          } else if (object.name.includes('cupcake')) {
              title = "Vanilla Cupcake";
              desc = "Light vanilla sponge topped with creamy buttercream frosting and fruit.";
          } else if (object.name.includes('tart')) {
              title = "Cream Tart";
              desc = "A crisp pastry shell filled with custard and topped with fresh cream.";
          } else if (object.name.includes('cake')) {
              title = "Tiered Cake";
              desc = "Fresh fruit filling and cream between airy sponge layers.";
          } else if (object.name.includes('bun')) {
              title = "Sweet Bun";
              desc = "Soft bun filled with fresh fruit and cream.";
          }
          // If it was a known pastry, trigger menu
          if (title !== "") {
              focusOnMenu(title, desc);
          }
      }
    }
}

// Helper: The Door Animation Logic (Moved here for cleanliness)
function handleDoorInteraction() {
    isDoorOpen = !isDoorOpen;
    const targetRotation = isDoorOpen ? Math.PI / 2 : 0; 

    new TWEEN.Tween(window.doorMesh.rotation)
        .to({ y: targetRotation }, 1000)
        .easing(TWEEN.Easing.Quadratic.InOut)
        .onComplete(() => {
            if (isDoorOpen) {
                isCameraSequencing = true; 
                
                // Door Sequence Timing
                const toDoorwayDuration = 1350; 
                const waitAtDoor = 50;         
                const moveInsideDuration = 1500; 

                const toDoorway = new TWEEN.Tween(camera.position)
                    .to({ x: doorwayThreshold.x, y: doorwayThreshold.y, z: doorwayThreshold.z }, toDoorwayDuration)
                    .easing(TWEEN.Easing.Quadratic.Out);

                const goInside = new TWEEN.Tween(camera.position)
                    .to({ x: insidePos.x, y: insidePos.y, z: insidePos.z }, moveInsideDuration)
                    .delay(waitAtDoor) 
                    .easing(TWEEN.Easing.Quadratic.InOut)
                    .onComplete(() => {
                        isCameraSequencing = false; 
                        player.position.set(camera.position.x, 0, camera.position.z);
                        controls.target.copy(insideLookAt); 
                    });

                new TWEEN.Tween(controls.target)
                    .to({ x: insideLookAt.x, y: insideLookAt.y, z: insideLookAt.z }, toDoorwayDuration + waitAtDoor + moveInsideDuration)
                    .easing(TWEEN.Easing.Quadratic.Out)
                    .start();

                toDoorway.chain(goInside);
                toDoorway.start();
            } else {
                // Exit Logic
                new TWEEN.Tween(camera.position).to(outsidePos, 1500).start();
                new TWEEN.Tween(controls.target).to(outsideLookAt, 1500).start();
                player.position.set(outsidePos.x, 0, outsidePos.z);
            }
        })
        .start();
}

// Helper: The Menu Animation Logic
function focusOnMenu(title, description) {
    menuContent.innerHTML = `<h1>${title}</h1><p>${description}</p>`;
    
    // --- SAVE CURRENT LOCATION (For Orbit Mode Return) ---
    savedReturnPos.copy(camera.position);
    savedReturnTarget.copy(controls.target);

    // 1. Pause Controls
    isCameraSequencing = true; 
    controls.enabled = false; 

    // FPS Fix: Ensure start point is correct
    if (mode === 'FPS') {
        const forward = new THREE.Vector3();
        camera.getWorldDirection(forward);
        controls.target.copy(camera.position).add(forward.multiplyScalar(10));
    }

    // 2. Move Camera Position
    new TWEEN.Tween(camera.position)
        .to(menuViewPos, 1500)
        .easing(TWEEN.Easing.Cubic.Out)
        .start();

    // 3. Move Camera Target
    new TWEEN.Tween(controls.target)
        .to(menuViewTarget, 1500)
        .easing(TWEEN.Easing.Cubic.Out)
        .onUpdate(() => {
            camera.lookAt(controls.target);
        })
        .onComplete(() => {
            menuPopup.style.display = 'block';
        })
        .start();
}

// Attach the click listener
renderer.domElement.addEventListener( 'click', onPointerClick );


// --- MODE SWITCHING & INPUTS ---
function setMode(newMode) {
  mode = newMode;

  if (mode === 'FPS') {
    controls.enabled = false;
    
    // 1. Snap Camera to Player
    camera.position.copy(player.position).add(headOffset);
    
    // 2. CRITICAL FIX: Reset Rotation Order and FORCE Z (Roll) to 0
    // This prevents the "Upside Down" glitch
    camera.rotation.order = "YXZ";
    camera.rotation.x = pitch;
    camera.rotation.y = yaw;
    camera.rotation.z = 0; // Ensure we are level
    
    // 3. Reset the Up Vector (Just in case OrbitControls flipped it)
    camera.up.set(0, 1, 0);

  } else {
    // Switch to ORBIT
    controls.enabled = true;
    
    // Set target in front of camera
    const fwd = new THREE.Vector3();
    camera.getWorldDirection(fwd);
    controls.target.copy(camera.position).add(fwd.multiplyScalar(20));
    
    controls.update();
  }
}

window.addEventListener('keydown', (e) => {
  keyState[e.code] = true;
  if (e.code === 'KeyM') setMode(mode === 'ORBIT' ? 'FPS' : 'ORBIT');
  if (["ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].includes(e.code)) e.preventDefault();
}, { passive: false });

window.addEventListener('keyup', (e) => keyState[e.code] = false);

// FPS Look Logic
renderer.domElement.addEventListener('pointerdown', (e) => {
  if (mode !== 'FPS') return;
  pointerDown = true;
  draggingLook = false;
  dragDist = 0;
  last.x = e.clientX;
  last.y = e.clientY;
  renderer.domElement.setPointerCapture(e.pointerId);
});

renderer.domElement.addEventListener('pointermove', (e) => {
  if (!pointerDown || mode !== 'FPS') return;
  const dx = e.clientX - last.x;
  const dy = e.clientY - last.y;
  dragDist += Math.abs(dx) + Math.abs(dy);
  if (dragDist > 3) draggingLook = true;
  if (draggingLook) {
    yaw -= dx * lookSpeed;
    pitch -= dy * lookSpeed;
    pitch = Math.max(-maxPitch, Math.min(maxPitch, pitch));
  }
  last.x = e.clientX;
  last.y = e.clientY;
});

renderer.domElement.addEventListener('pointerup', () => pointerDown = false);


// --- MAIN UPDATE LOOP ---
function updatePlayerAndCamera() {
  if (isCameraSequencing) return;

  const move = new THREE.Vector3();

  // --- MODE A: ORBIT (Flying Camera) ---
  if (mode === 'ORBIT') {
    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    forward.y = 0; 
    forward.normalize();
    const right = new THREE.Vector3();
    right.crossVectors(forward, camera.up).normalize();

    // WASD Movement
    if (keyState['KeyW'] || keyState['ArrowUp']) move.add(forward);
    if (keyState['KeyS'] || keyState['ArrowDown']) move.sub(forward);
    if (keyState['KeyD'] || keyState['ArrowRight']) move.add(right);
    if (keyState['KeyA'] || keyState['ArrowLeft']) move.sub(right);
    
    // Q/E Movement
    if (keyState['KeyE']) move.y += 1;
    if (keyState['KeyQ']) {
        // Only add downward force if we are safely above ground
        if (camera.position.y > 0.5) {
            move.y -= 1;
        }
    }

    // Apply Movement
    if (move.lengthSq() > 0) {
        move.normalize().multiplyScalar(moveSpeed);
        camera.position.add(move);
        controls.target.add(move);
    }

    // --- CRITICAL FIX: UNCONDITIONAL FLOOR CLAMP ---
    // This is now OUTSIDE the movement block, so it runs constantly.
    // It prevents mouse zooming/rotating from pushing you underground.
    if (camera.position.y < 0.5) {
        camera.position.y = 0.5;
    }
  } 

  // --- MODE B: FPS (First Person) ---
  else if (mode === 'FPS') {
    const forward = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw)).normalize();
    const right = new THREE.Vector3(forward.z, 0, -forward.x).normalize();

    if (keyState['KeyW'] || keyState['ArrowUp']) move.add(forward);
    if (keyState['KeyS'] || keyState['ArrowDown']) move.sub(forward);
    if (keyState['KeyD'] || keyState['ArrowRight']) move.sub(right); 
    if (keyState['KeyA'] || keyState['ArrowLeft']) move.add(right);  
    
    if (keyState['KeyE']) move.y += 1;
    if (keyState['KeyQ']) move.y -= 1;

    if (move.lengthSq() > 0) {
        move.normalize().multiplyScalar(moveSpeed);
        player.position.add(move);

        // FPS Clamp (Feet on ground)
        if (player.position.y < 0) {
            player.position.y = 0;
        }
    }
    
    // Sync Camera
    player.rotation.y = yaw;
    camera.position.copy(player.position).add(headOffset);
    
    // Force Upright
    camera.rotation.order = "YXZ";
    camera.rotation.y = yaw;
    camera.rotation.x = pitch;
    camera.rotation.z = 0; 
  }
}

// --- DEV TOOLS UI ---
const infoDiv = document.createElement('div');
infoDiv.style.position = 'absolute';
infoDiv.style.top = '10px';
infoDiv.style.left = '10px';
infoDiv.style.color = 'white';
infoDiv.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
infoDiv.style.padding = '10px';
infoDiv.style.fontFamily = 'monospace';
infoDiv.style.pointerEvents = 'none'; 
document.body.appendChild(infoDiv);

function updateDevUI() {
    const px = camera.position.x.toFixed(2);
    const py = camera.position.y.toFixed(2);
    const pz = camera.position.z.toFixed(2);

    let tx, ty, tz;

    if (mode === 'ORBIT') {
        tx = controls.target.x.toFixed(2);
        ty = controls.target.y.toFixed(2);
        tz = controls.target.z.toFixed(2);
    } else {
        const fwd = new THREE.Vector3();
        camera.getWorldDirection(fwd);
        const target = camera.position.clone().add(fwd.multiplyScalar(20));
        tx = target.x.toFixed(2);
        ty = target.y.toFixed(2);
        tz = target.z.toFixed(2);
    }

    const modeColor = mode === 'ORBIT' ? '#ffff00' : '#00ff00';

    infoDiv.innerHTML = `
        <strong>Mode:</strong> <span style="color:${modeColor}">${mode}</span> <br>
        <small>(Press 'M' to toggle)</small><br>
        <hr style="opacity:0.3">
        <strong>Camera:</strong> ${px}, ${py}, ${pz} <br>
        <strong>Target:</strong> ${tx}, ${ty}, ${tz} <br>
        <small>Press 'P' to log to console</small>
    `;

    if (keyState['KeyP']) {
        console.log(`// ${mode} Snapshot`);
        console.log(`const pos = new THREE.Vector3(${px}, ${py}, ${pz});`);
        console.log(`const target = new THREE.Vector3(${tx}, ${ty}, ${tz});`);
        keyState['KeyP'] = false; 
    }
}

// --- MENU INFO UI ---
const menuPopup = document.createElement('div');
menuPopup.style.position = 'absolute';
menuPopup.style.top = '50%';
menuPopup.style.left = '51.6%';
menuPopup.style.transform = 'translate(-50%, -50%)';
menuPopup.style.width = '783px';
menuPopup.style.height = '510px';
menuPopup.style.padding = '30px';
menuPopup.style.backgroundColor = '#433524'; // Solid color you requested
menuPopup.style.color = '#ffffff'; // White text for contrast

menuPopup.style.fontFamily = 'serif';
menuPopup.style.textAlign = 'center';
menuPopup.style.display = 'none'; 
menuPopup.style.zIndex = '100';
document.body.appendChild(menuPopup);

// Close Button for the menu
const closeBtn = document.createElement('button');
closeBtn.innerText = "Close Menu";
closeBtn.style.marginTop = '20px';
closeBtn.style.padding = '10px 20px';
closeBtn.style.cursor = 'pointer';

closeBtn.onclick = () => {
    // Hide menu
    menuPopup.style.display = 'none';

    // --- CHECK MODE TO DECIDE RETURN BEHAVIOR ---
    if (mode === 'ORBIT') {
        // ANIMATE BACK to where we were
        new TWEEN.Tween(camera.position)
            .to(savedReturnPos, 1000) // 1 second return
            .easing(TWEEN.Easing.Cubic.Out)
            .start();

        new TWEEN.Tween(controls.target)
            .to(savedReturnTarget, 1000)
            .easing(TWEEN.Easing.Cubic.Out)
            .onComplete(() => {
                // Only give control back after arriving
                isCameraSequencing = false;
                controls.enabled = true;
            })
            .start();
    } else {
        // FPS MODE: Just release the lock
        // The update loop will automatically snap camera to player body instantly
        isCameraSequencing = false;
        controls.enabled = true; 
    }
};
menuPopup.appendChild(closeBtn);

const menuContent = document.createElement('div');
menuPopup.appendChild(menuContent);

// --- MENU CAMERA POSITIONS ---
// UPDATE THESE after using 'P' to find the perfect spot
const menuViewPos = new THREE.Vector3(0.01, 15.7, -16.29); 
const menuViewTarget = new THREE.Vector3(0.00, 15.7, -20.00);

const savedReturnPos = new THREE.Vector3();
const savedReturnTarget = new THREE.Vector3();

function animate() {
  requestAnimationFrame(animate);
  TWEEN.update();
  
  updatePlayerAndCamera();
  updateDevUI(); 
  
  if (mode === 'ORBIT') controls.update();
  renderer.render(scene, camera);
}

// 5. Handle Window Resize
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

animate();