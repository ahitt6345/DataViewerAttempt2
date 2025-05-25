// public/app.js
import * as THREE from "/three/build/three.module.js"; // Import Three.js core
import { OrbitControls } from "/three/examples/jsm/controls/OrbitControls.js"; // Import OrbitControls for user interaction
import { Water } from "/textures/water/water.js"; // Import Water.js for realistic water effects
// --- Basic Three.js Scene Setup ---
let scene, camera, renderer; // Removed 'cube' as we'll manage objects dynamically
let objectsInScene = []; // To keep track of dynamically added company/district objects
let focusCompanyLight; // To manage the light on the focus company
let groundPlane; // For the ground
// public/app.js (near the top)
// ... other variables
const textureLoader = new THREE.TextureLoader();
let buildingFacadeTexture, rooftopTexture, windowTexture, islandSurfaceTexture; // Added islandSurfaceTexture
let water; // Variable for the water object
// It's good practice to load textures once and reuse them
// You can call this in your initThreeJS or before your first scene update
function loadBuildingTextures() {
	// Replace these paths with your actual texture files
	// Ensure these textures are in your `public/textures` folder
	// Load building facade texture
	try {
		buildingFacadeTexture = textureLoader.load(
			"textures/building_texture.png"
		);
		buildingFacadeTexture.wrapS = THREE.RepeatWrapping;
		buildingFacadeTexture.wrapT = THREE.RepeatWrapping;
	} catch (e) {
		console.error(
			"Failed to load building facade texture. Make sure the path is correct and the file exists.",
			e
		);
		buildingFacadeTexture = null;
	}

	// Load rooftop texture
	try {
		rooftopTexture = textureLoader.load("textures/building_texture.png");
		rooftopTexture.wrapS = THREE.RepeatWrapping;
		rooftopTexture.wrapT = THREE.RepeatWrapping;
	} catch (e) {
		console.error(
			"Failed to load rooftop texture. Make sure the path is correct and the file exists.",
			e
		);
		rooftopTexture = null;
	}

	// Load window texture
	try {
		windowTexture = textureLoader.load("textures/window_texture.png");
		// To make the texture appear more "zoomed in", reduce the repeat values (closer to 1 means less tiling, more zoom)
		windowTexture.wrapS = THREE.RepeatWrapping;
		windowTexture.wrapT = THREE.RepeatWrapping;
		windowTexture.repeat.set(0.8, 1); // Adjust these values as needed for your desired zoom level
	} catch (e) {
		console.error(
			"Failed to load window texture. Make sure the path is correct and the file exists.",
			e
		);
		windowTexture = null;
	}
	try {
		// ... (existing texture loading for buildingFacadeTexture, rooftopTexture, windowTexture)

		islandSurfaceTexture = textureLoader.load(
			"textures/island_texture.png"
		); // Replace with your texture
		islandSurfaceTexture.wrapS = THREE.RepeatWrapping;
		islandSurfaceTexture.wrapT = THREE.RepeatWrapping;
		console.log("Island surface texture loading...");
	} catch (e) {
		console.error(
			"Failed to load island textures. Make sure paths are correct and files exist.",
			e
		);
		// ... (existing fallbacks)
		islandSurfaceTexture = null;
	}
	console.log("Textures loading...");
}
var orbitControls; // Declare globally to avoid re-creating on each frame
function initThreeJS() {
	const container = document.getElementById("sceneContainer");
	scene = new THREE.Scene();
	scene.background = new THREE.Color(0x87ceeb); // Bright blue sky (Sky Blue)
	loadBuildingTextures(); // Load textures before creating objects
	camera = new THREE.PerspectiveCamera(
		75,
		container.clientWidth / container.clientHeight,
		0.1,
		1000
	);
	camera.position.set(0, 15, 20); // Adjusted camera position to look down a bit
	camera.lookAt(0, 0, 0);

	renderer = new THREE.WebGLRenderer({ antialias: true });
	renderer.setSize(container.clientWidth, container.clientHeight);
	// Enable shadows in the renderer
	renderer.shadowMap.enabled = true;
	renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Softer shadows
	container.appendChild(renderer.domElement);

	const ambientLight = new THREE.AmbientLight(0xffffff, 0.4); // Slightly less ambient
	scene.add(ambientLight);
	const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8); // Brighter
	directionalLight.position.set(15, 30, 20); // Higher and further to cast longer shadows
	directionalLight.castShadow = true; // Enable shadow casting for this light
	// Configure shadow properties for directional light
	directionalLight.shadow.mapSize.width = 2048; // Higher resolution for sharper shadows
	directionalLight.shadow.mapSize.height = 2048;
	directionalLight.shadow.camera.near = 0.5;
	directionalLight.shadow.camera.far = 100; // Adjust far plane to cover scene
	directionalLight.shadow.camera.left = -50;
	directionalLight.shadow.camera.right = 50;
	directionalLight.shadow.camera.top = 50;
	directionalLight.shadow.camera.bottom = -50;
	// Optional: Add a shadow camera helper to visualize
	// const shadowHelper = new THREE.CameraHelper(directionalLight.shadow.camera);
	// scene.add(shadowHelper);
	scene.add(directionalLight);
	// --- Create Water ---
	const waterGeometry = new THREE.PlaneGeometry(100, 100); // Adjust size as needed

	if (typeof Water !== "undefined") {
		// Check if Water.js loaded
		water = new Water(waterGeometry, {
			textureWidth: 256, // Quality of reflection/refraction. Lower for better performance.
			textureHeight: 256,
			waterNormals: textureLoader.load(
				"textures/water/waternormal.jpg",
				function (texture) {
					texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
				}
			),
			sunDirection: directionalLight.position.clone().normalize(),
			sunColor: 0xffffff,
			waterColor: 0x003e5f, // Bluish water
			distortionScale: 3.7,
			fog: scene.fog !== undefined, // Use scene fog if available
		});
		water.rotation.x = -Math.PI / 2; // Make it horizontal
		water.position.y = 0.4; // Adjust Y position to be slightly below island bases
		water.receiveShadow = false; // Water can receive shadows (e.g., from islands if they are tall enough)
		scene.add(water);
	} else {
		console.error(
			"THREE.Water is not defined. Make sure Water.js is loaded correctly."
		);
		// Fallback: simple blue plane if Water.js fails to load
		const fallbackWaterMat = new THREE.MeshStandardMaterial({
			color: 0x003e5f,
			transparent: true,
			opacity: 0.8,
			roughness: 0.2,
		});
		water = new THREE.Mesh(waterGeometry, fallbackWaterMat);
		water.rotation.x = -Math.PI / 2;
		water.position.y = 0.5;
		water.receiveShadow = true;
		scene.add(water);
	}
	// Add a ground plane
	// Configure Ground Plane to receive shadows
	const groundGeometry = new THREE.PlaneGeometry(100, 100);
	const groundMaterial = new THREE.MeshStandardMaterial({
		color: 0x22334a, // More blueish ground
		roughness: 0.9,
		metalness: 0.1,
	});
	groundPlane = new THREE.Mesh(groundGeometry, groundMaterial);
	groundPlane.rotation.x = -Math.PI / 2;
	groundPlane.position.y = -0.1;
	groundPlane.receiveShadow = true; // Ground must receive shadows
	scene.add(groundPlane);

	function animate() {
		requestAnimationFrame(animate);

		// Add user interactive controls (OrbitControls)
		if (!orbitControls) {
			orbitControls = new OrbitControls(camera, renderer.domElement);
			orbitControls.enableDamping = true; // Smooth damping
			orbitControls.dampingFactor = 0.1; // Damping factor for smooth movement
			orbitControls.enableZoom = true; // Allow zooming
			orbitControls.minDistance = 5; // Minimum zoom distance
			orbitControls.maxDistance = 50; // Maximum zoom distance
			orbitControls.enablePan = true; // Allow panning
		}
		// Update water time for wave animation
		if (
			water &&
			water.material &&
			water.material.uniforms &&
			water.material.uniforms["time"]
		) {
			water.material.uniforms["time"].value += 0.2 / 60.0; // This line is crucial!
		}

		renderer.render(scene, camera);
	}
	animate();

	window.addEventListener("resize", () => {
		camera.aspect = container.clientWidth / container.clientHeight;
		camera.updateProjectionMatrix();
		renderer.setSize(container.clientWidth, container.clientHeight);
	});
}

// Helper function to clear dynamically added 3D objects from the scene
function clearDynamicSceneObjects() {
	objectsInScene.forEach((obj) => {
		// For groups, recursively remove children
		if (obj.isGroup) {
			obj.traverse((child) => {
				if (child.isMesh) {
					if (child.geometry) child.geometry.dispose();
					if (child.material) {
						if (Array.isArray(child.material)) {
							child.material.forEach((mat) => mat.dispose());
						} else {
							child.material.dispose();
						}
					}
				}
			});
		} else if (obj.isMesh) {
			// For individual meshes not in groups (like old focus building)
			if (obj.geometry) obj.geometry.dispose();
			if (obj.material) {
				if (Array.isArray(obj.material)) {
					obj.material.forEach((mat) => mat.dispose());
				} else {
					obj.material.dispose();
				}
			}
		}
		scene.remove(obj);
	});
	objectsInScene.length = 0; // Reset the array

	// Remove the specific light for the focus company if it exists
	if (focusCompanyLight) {
		scene.remove(focusCompanyLight);
		focusCompanyLight.dispose(); // Dispose of the light resources
		focusCompanyLight = null;
	}
}

async function fetchCompanyData(companyId) {
	try {
		const response = await fetch(`/api/company/${companyId}/graph`);
		if (!response.ok) {
			const errorData = await response.json();
			throw new Error(
				errorData.error || `HTTP error! status: ${response.status}`
			);
		}
		const data = await response.json();
		dataOutput.textContent = JSON.stringify(data, null, 2);
		console.log("Fetched data:", data);
		updateSceneWithObjects(data);
	} catch (error) {
		dataOutput.textContent = `Error loading data: ${error.message}`;
		console.error("Error loading data:", error);
		clearDynamicSceneObjects(); // Clear scene on error too
	}
}

function createProceduralBuilding(width, height, depth, styleHint) {
	const buildingGroup = new THREE.Group();

	// Main building body
	const bodyHeight = height * 0.85;
	const bodyGeometry = new THREE.BoxGeometry(width, bodyHeight, depth);

	// UV unwrapping for facade texture to repeat nicely
	// For BoxGeometry, Three.js does a decent job by default for tiled textures.
	// If using custom geometry, UVs are critical.
	// We can scale texture repeats:
	if (buildingFacadeTexture) {
		buildingFacadeTexture.repeat.set(width / 4, bodyHeight / 4); // Adjust these values
	}

	const bodyMaterial = new THREE.MeshStandardMaterial({
		map:
			buildingFacadeTexture instanceof THREE.Texture
				? buildingFacadeTexture
				: undefined,
		roughness: 0.8,
		metalness: 0.1,
		// color: buildingFacadeTexture ? 0xffffff : 0xcccccc // Use white if texture loads, else gray
	});
	const bodyMesh = new THREE.Mesh(bodyGeometry, bodyMaterial);
	bodyMesh.position.y = bodyHeight / 2;
	buildingGroup.add(bodyMesh);

	// Roof
	const roofHeight = height * 0.15;
	const roofGeometry = new THREE.BoxGeometry(
		width * 1.05,
		roofHeight,
		depth * 1.05
	); // Slightly larger roof

	if (rooftopTexture) {
		rooftopTexture.repeat.set(width / 4, depth / 4); // Adjust
	}

	const roofMaterial = new THREE.MeshStandardMaterial({
		map: rooftopTexture,
		roughness: 0.9,
		metalness: 0.05,
		// color: rooftopTexture ? 0xffffff : 0xaaaaaa
	});
	const roofMesh = new THREE.Mesh(roofGeometry, roofMaterial);
	roofMesh.position.y = bodyHeight + roofHeight / 2;
	buildingGroup.add(roofMesh);

	// --- Windows (Example using a separate mesh with window texture) ---
	// This is one way; another is baking windows into the facade texture.
	// For simplicity, let's assume the windowTexture is good for a plane.
	// We could add planes to each side. Here's one side as an example:
	if (windowTexture) {
		const windowPlaneHeight = bodyHeight * 0.7;
		const windowPlaneWidth = width * 0.8;
		const windowPlaneGeometry = new THREE.PlaneGeometry(
			windowPlaneWidth,
			windowPlaneHeight
		);
		windowTexture.repeat.set(windowPlaneWidth / 2, windowPlaneHeight / 2); // Adjust as needed

		const windowMaterial = new THREE.MeshStandardMaterial({
			map: windowTexture,
			transparent: true, // If your window texture has alpha
			alphaTest: 0.5, // If using simple alpha cutoff
			roughness: 0.2, // Glassier
			metalness: 0.0,
			// emissive: 0x444444, // Make windows slightly glow if desired
			// emissiveMap: windowTexture, // If you have an emissive map for just the lights
		});

		const windowPlaneF = new THREE.Mesh(
			windowPlaneGeometry,
			windowMaterial
		);
		windowPlaneF.position.set(0, bodyHeight / 2, depth / 2 + 0.01); // Front
		buildingGroup.add(windowPlaneF);

		// You would create similar planes for other sides (back, left, right)
		const windowPlaneB = windowPlaneF.clone();
		windowPlaneB.rotation.y = Math.PI;
		windowPlaneB.position.set(0, bodyHeight / 2, -depth / 2 - 0.01); // Back
		buildingGroup.add(windowPlaneB);

		const windowPlaneL = windowPlaneF.clone();
		windowPlaneL.rotation.y = -Math.PI / 2;
		windowPlaneL.position.set(-width / 2 - 0.01, bodyHeight / 2, 0); // Left
		buildingGroup.add(windowPlaneL);

		const windowPlaneR = windowPlaneF.clone();
		windowPlaneR.rotation.y = Math.PI / 2;
		windowPlaneR.position.set(width / 2 + 0.01, bodyHeight / 2, 0); // Right
		buildingGroup.add(windowPlaneR);
	}

	// Shadows for the whole group
	buildingGroup.traverse((child) => {
		if (child.isMesh) {
			child.castShadow = true;
			child.receiveShadow = true; // Buildings can cast shadows on themselves/each other
		}
	});

	return buildingGroup;
}
function updateSceneWithObjects(data) {
	clearDynamicSceneObjects();

	const focusCompany = data.focus_company;
	const relatedEntries = data.related_companies;

	// --- 1. Central Company ---
	const focusBuildingHeight = 3.5; // Taller
	const focusWidth = 2;
	const focusDepth = 2;

	// const focusBuilding = createProceduralBuilding(focusWidth, focusBuildingHeight, focusDepth, focusCompany.city_metaphor_style);
	// For the focus company, let's use a simplified unique style for now, or customize createProceduralBuilding further
	const focusGeo = new THREE.BoxGeometry(
		focusWidth,
		focusBuildingHeight,
		focusDepth
	);
	const focusMat = new THREE.MeshStandardMaterial({
		color:
			focusCompany.city_metaphor_style &&
			focusCompany.city_metaphor_style.includes("alpha")
				? 0xcc3333
				: 0xdaa520, // Gold or Red
		roughness: 0.5,
		metalness: 0.5,
		// envMap: environmentMap, // We'll add this later for reflections
	});
	const focusBuildingMesh = new THREE.Mesh(focusGeo, focusMat);
	focusBuildingMesh.castShadow = true;
	focusBuildingMesh.receiveShadow = true;
	focusBuildingMesh.position.set(0, 0, 0); // Group handles y-offset internally now if using createProceduralBuilding
	// If using simple mesh:
	focusBuildingMesh.position.set(0, focusBuildingHeight / 2, 0);

	scene.add(focusBuildingMesh); // Add the group/mesh to the scene
	objectsInScene.push(focusBuildingMesh);

	if (focusCompanyLight) scene.remove(focusCompanyLight);
	focusCompanyLight = new THREE.PointLight(0xffffff, 1.2, 25);
	focusCompanyLight.castShadow = true; // Focus light should also cast shadow
	focusCompanyLight.shadow.mapSize.width = 1024; // default 512
	focusCompanyLight.shadow.mapSize.height = 1024; // default 512
	focusCompanyLight.position.set(
		focusWidth * 0.7,
		focusBuildingHeight + 2,
		focusDepth * 0.7
	);
	scene.add(focusCompanyLight);

	// Add special lighting for the focus company
	focusCompanyLight = new THREE.PointLight(0xffffff, 0.8, 15); // Color, Intensity, Distance
	focusCompanyLight.position.set(0, focusBuildingHeight + 1, 0); // Position above the building
	scene.add(focusCompanyLight);

	// --- 2. Group related companies by relationship_type ---
	const districts = {};
	relatedEntries.forEach((entry) => {
		// Use relationship_with_focus, as it's from the perspective of the central company
		const type = entry.relationship_with_focus || "Unknown";
		if (!districts[type]) {
			districts[type] = { companies: [], strengths: [] };
		}
		districts[type].companies.push(entry.related_company_details);
		if (typeof entry.strength === "number" && !isNaN(entry.strength)) {
			districts[type].strengths.push(entry.strength);
		}
	});

	// --- 3. Define layout parameters and position districts (with islands) ---
	const districtTypes = Object.keys(districts);
	const angleIncrement =
		districtTypes.length > 0 ? (2 * Math.PI) / districtTypes.length : 0;

	const MAX_PROXIMITY_DISTANCE = 20;
	const MIN_PROXIMITY_DISTANCE = 8; // Increased min slightly to give islands space
	const CLUSTER_SPREAD_RADIUS = 3.0; // Base radius for building cluster, island will be larger
	const ISLAND_HEIGHT = 0.5; // Thickness of the island pedestal
	const ISLAND_Y_OFFSET = 0.1; // How much the base of the island is lifted from y=0

	// Adjust main ground plane to be lower if islands are slightly elevated
	if (groundPlane) groundPlane.position.y = -0.1;

	districtTypes.forEach((type, index) => {
		const districtData = districts[type];
		const districtGroup = new THREE.Group(); // Each district (island + buildings) is a group

		// ... (avgStrength and districtDistance calculation remains the same) ...
		let avgStrength = 0.5;
		if (districtData.strengths.length > 0) {
			let sumStrengths = districtData.strengths.reduce(
				(a, b) => a + b,
				0
			);
			avgStrength = Math.max(
				0,
				Math.min(1, sumStrengths / districtData.strengths.length)
			);
		}
		let districtDistance =
			MAX_PROXIMITY_DISTANCE -
			avgStrength * (MAX_PROXIMITY_DISTANCE - MIN_PROXIMITY_DISTANCE);

		const angle = index * angleIncrement;
		const districtX = districtDistance * Math.cos(angle);
		const districtZ = districtDistance * Math.sin(angle);

		// Position the entire districtGroup (island's base will be at ISLAND_Y_OFFSET)
		districtGroup.position.set(districtX, ISLAND_Y_OFFSET, districtZ);

		// --- Create the Island/Pedestal ---
		const islandVisualRadius = CLUSTER_SPREAD_RADIUS + 1.0; // Island slightly larger than building cluster
		const islandGeometry = new THREE.CylinderGeometry(
			islandVisualRadius,
			islandVisualRadius,
			ISLAND_HEIGHT,
			32
		);
		// Optional: Box island
		// const islandGeometry = new THREE.BoxGeometry(islandVisualRadius * 2, ISLAND_HEIGHT, islandVisualRadius * 2);

		const islandMaterial = new THREE.MeshStandardMaterial({
			map: islandSurfaceTexture,
			color: islandSurfaceTexture ? 0xffffff : 0x228b22, // Use white if texture, else fallback to green (forest green)
			roughness: 0.9,
			metalness: 0.1,
		});
		if (islandSurfaceTexture) {
			// Adjust texture tiling for the island surface
			islandSurfaceTexture.repeat.set(
				islandVisualRadius / 3,
				islandVisualRadius / 3
			); // Tweak as needed
		}

		const islandMesh = new THREE.Mesh(islandGeometry, islandMaterial);
		islandMesh.receiveShadow = true; // Island receives shadows from buildings on it
		islandMesh.castShadow = true; // Island can cast a shadow onto the main ground
		islandMesh.position.y = ISLAND_HEIGHT / 2; // Position island so its base is at y=0 within the group
		districtGroup.add(islandMesh);

		// --- 4. Populate district with company buildings ON THE ISLAND ---
		const BUILDING_BASE_HEIGHT_ON_ISLAND = ISLAND_HEIGHT; // Buildings sit on top of the island

		districtData.companies.forEach((company, compIndex) => {
			const buildingW = 1.2;
			const buildingH = 1.8 + Math.random() * 1.2; // Slightly shorter on average due to island height
			const buildingD = 1.2;

			const companyBuilding = createProceduralBuilding(
				buildingW,
				buildingH,
				buildingD,
				company.city_metaphor_style
			);

			const buildingClusterRadius =
				CLUSTER_SPREAD_RADIUS * (0.4 + Math.random() * 0.6);
			const buildingAngle =
				(compIndex / Math.max(1, districtData.companies.length)) *
					2 *
					Math.PI +
				(Math.random() - 0.5) * 0.7;

			const buildingX = buildingClusterRadius * Math.cos(buildingAngle);
			const buildingZ = buildingClusterRadius * Math.sin(buildingAngle);

			// The companyBuilding group's base is at its local y=0.
			// We want it to sit on top of the island. The island's top surface is at y=ISLAND_HEIGHT within the districtGroup.
			companyBuilding.position.set(
				buildingX,
				BUILDING_BASE_HEIGHT_ON_ISLAND,
				buildingZ
			);

			districtGroup.add(companyBuilding);
		});

		scene.add(districtGroup);
		objectsInScene.push(districtGroup); // Track the district group for easy removal
	});

	console.log("Scene updated with organic cluster layout.");
}

// --- Event Listeners ---
// (Keep existing event listeners for companyIdInput and loadCompanyButton)
const companyIdInput = document.getElementById("companyIdInput");
const loadCompanyButton = document.getElementById("loadCompanyButton");
const dataOutput = document.getElementById("dataOutput");

loadCompanyButton.addEventListener("click", () => {
	const companyId = parseInt(companyIdInput.value);
	if (!isNaN(companyId) && companyId > 0) {
		fetchCompanyData(companyId);
	} else {
		dataOutput.textContent = "Please enter a valid company ID (e.g., 1-5).";
	}
});

// --- Initialize ---
document.addEventListener("DOMContentLoaded", () => {
	initThreeJS();
	// Optionally load data for company ID 1 by default
	fetchCompanyData(1);
});
