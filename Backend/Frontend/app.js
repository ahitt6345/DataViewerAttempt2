// public/app.js
import * as THREE from "/three/build/three.module.js"; // Import Three.js core
import { OrbitControls } from "/three/examples/jsm/controls/OrbitControls.js"; // Import OrbitControls for user interaction
import { Water } from "/textures/water/water.js"; // Import Water.js for realistic water effects
import { FontLoader } from "/three/examples/jsm/loaders/FontLoader.js"; // Import FontLoader for text rendering
import { TextGeometry } from "/three/examples/jsm/geometries/TextGeometry.js"; // Import TextGeometry for 3D text

// Ensure the necessary Three.js modules are loaded
// load helvetiker font for text rendering
const fontLoader = new FontLoader();
var helvetikerFont; // Declare globally to use in createProceduralBuilding
fontLoader.load(
	"fonts/helvetiker_regular.typeface.json",
	(font) => {
		console.log("Font loaded successfully:", font);
		helvetikerFont = font; // Assign loaded font to global variable
	},
	undefined, // onProgress callback (optional)
	(error) => {
		console.error("Error loading font:", error);
	}
);
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
	const hudLeft = document.getElementById("hudLeft");
	const hudRight = document.getElementById("hudRight");
	container.onclick = (event) => {
		console.log("Container clicked!");
		// You can add custom logic here, e.g., picking objects or UI actions
		const mouse = new THREE.Vector2();
		const raycaster = new THREE.Raycaster();

		const rect = container.getBoundingClientRect();
		mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
		mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

		raycaster.setFromCamera(mouse, camera);

		const intersects = raycaster.intersectObjects(objectsInScene, true);

		if (intersects.length > 0) {
			let mesh = intersects[0].object;
			// Traverse up to find the building group if needed
			while (mesh && !mesh.userData.companyDetails && mesh.parent) {
				mesh = mesh.parent;
			}
			if (mesh && mesh.userData.companyDetails) {
				console.log("Company details:", mesh.userData.companyDetails);
				var details = mesh.userData.companyDetails;
				// Clear previous content
				hudLeft.innerHTML = "";
				hudRight.innerHTML = "";
				for (const key in details) {
					if (details.hasOwnProperty(key)) {
						// Fill hudLeft first, then hudRight if hudLeft is full
						if (!hudLeft.innerHTML) hudLeft.innerHTML = "";
						if (!hudRight.innerHTML) hudRight.innerHTML = "";

						const line = `${key}: ${details[key]}<br>`;

						// Create a temporary span to measure text height
						const tempSpan = document.createElement("span");
						tempSpan.style.visibility = "hidden";
						tempSpan.style.position = "absolute";
						tempSpan.style.whiteSpace = "pre-wrap";
						tempSpan.style.width = hudLeft.clientWidth + "px";
						tempSpan.innerHTML = hudLeft.innerHTML + line;
						document.body.appendChild(tempSpan);

						const fitsInLeft =
							tempSpan.offsetHeight <= hudLeft.clientHeight;
						document.body.removeChild(tempSpan);

						if (fitsInLeft) {
							hudLeft.innerHTML += line;
						} else {
							hudRight.innerHTML += line;
						}
					}
				}
				//hudLeft.textContent = text;
			}
		}
	};
	scene = new THREE.Scene();
	scene.background = new THREE.Color(0x87ceeb); // Bright blue sky (Sky Blue)
	loadBuildingTextures(); // Load textures before creating objects
	camera = new THREE.PerspectiveCamera(
		75,
		container.clientWidth / container.clientHeight,
		0.1,
		10000
	);
	camera.position.set(0, 15 * 10, 20 * 10); // Adjusted camera position to look down a bit
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
	const waterGeometry = new THREE.PlaneGeometry(100 * 10, 100 * 10); // Adjust size as needed

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
			orbitControls.minDistance = 5 * 10; // Minimum zoom distance
			orbitControls.maxDistance = 50 * 10; // Maximum zoom distance
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
		// scene.traverse((obj) => {
		// 	if (
		// 		obj.isMesh &&
		// 		obj.geometry &&
		// 		obj.geometry.type === "TextGeometry"
		// 	) {
		// 		obj.lookAt(camera.position);
		// 	}
		// });
		// In your animate function, after scene.traverse for TextGeometry (or replacing it)
		scene.traverse((obj) => {
			if (obj.userData && obj.userData.type === "spriteLabel") {
				// Option 1: Simple lookAt (might cause flipping if camera goes directly above/below)
				// obj.lookAt(camera.position);

				// Option 2: Copy camera quaternion (more stable for billboarding)
				// This keeps the billboard upright relative to its own local Y-axis.
				const camWorldPos = new THREE.Vector3();
				camera.getWorldPosition(camWorldPos);
				obj.lookAt(camWorldPos); // Make it look at the camera's world position
			}
		});
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
function createSpriteLabel(
	text,
	companyId,
	textColor = "white",
	backgroundColor = "rgba(0,0,0,0.7)"
) {
	function abbreviateCompanyName(name) {
		const abbreviations = [
			{ regex: /\bCorporation\b/gi, abbr: "Corp." },
			{ regex: /\bIncorporated\b/gi, abbr: "Inc." },
			{ regex: /\bLimited\b/gi, abbr: "Ltd." },
			{ regex: /\bCompany\b/gi, abbr: "Co." },
			{ regex: /\bInternational\b/gi, abbr: "Int'l" },
			{ regex: /\bGroup\b/gi, abbr: "Grp." },
			{ regex: /\bHoldings?\b/gi, abbr: "Hldgs." },
			{ regex: /\bPartners?\b/gi, abbr: "Ptnrs." },
			{ regex: /\bAssociates?\b/gi, abbr: "Assoc." },
			{ regex: /\bIndustries\b/gi, abbr: "Inds." },
			{ regex: /\bManagement\b/gi, abbr: "Mgmt." },
			{ regex: /\bServices\b/gi, abbr: "Svcs." },
			{ regex: /\bTechnologies\b/gi, abbr: "Tech." },
			{ regex: /\bSystems\b/gi, abbr: "Sys." },
			{ regex: /\bSolutions\b/gi, abbr: "Sol." },
			{ regex: /\bResearch\b/gi, abbr: "R&D" },
			{ regex: /\bDevelopment\b/gi, abbr: "Dev." },
			{ regex: /\bLogistics\b/gi, abbr: "Log." },
			{ regex: /\bConsulting\b/gi, abbr: "Consult." },
			{ regex: /\bFinancial\b/gi, abbr: "Fin." },
			{ regex: /\bMarketing\b/gi, abbr: "Mktg." },
			{ regex: /\bSales\b/gi, abbr: "Sls." },
			{ regex: /\bRetail\b/gi, abbr: "Rtl." },
			{ regex: /\bWholesale\b/gi, abbr: "Wsl." },
			{ regex: /\bManufacturing\b/gi, abbr: "Mfg." },
			{ regex: /\bDistribution\b/gi, abbr: "Dist." },
			{ regex: /\bConstruction\b/gi, abbr: "Constr." },
			{ regex: /\bEngineering\b/gi, abbr: "Eng." },
			{ regex: /\bArchitecture\b/gi, abbr: "Arch." },
			{ regex: /\bEntertainment\b/gi, abbr: "Entmt." },
			{ regex: /\bPublishing\b/gi, abbr: "Pub." },
			{ regex: /\bEducation\b/gi, abbr: "Edu." },
			{ regex: /\bHealthcare\b/gi, abbr: "Hlth." },
			{ regex: /\bPharmaceuticals?\b/gi, abbr: "Pharma" },
		];
		let result = name;
		abbreviations.forEach(({ regex, abbr }) => {
			result = result.replace(regex, abbr);
		});
		return result;
	}
	text = abbreviateCompanyName(text); // Abbreviate company name if needed
	const canvas = document.createElement("canvas");
	// ... (setup canvas and draw text as in createBillboardLabel) ...
	// For sprite, a good canvas size might be 256x64 or 512x128 depending on aspect
	canvas.width = (text.length * 24) | 0; // Width of the canvas
	canvas.height = 64; // Height of the canvas
	const texture = new THREE.CanvasTexture(canvas);
	texture.minFilter = THREE.LinearMipMapLinearFilter; // Prevents mipmapping artifacts
	texture.magFilter = THREE.LinearFilter; // Prevents mipmapping artifacts
	texture.needsUpdate = true; // Ensure the texture is updated
	const ctx = canvas.getContext("2d");
	ctx.fillStyle = backgroundColor; // Background color
	ctx.fillRect(0, 0, canvas.width, canvas.height); // Fill background
	ctx.font = "bold 40px Arial"; // Font size and family
	ctx.fillStyle = textColor; // Text color
	ctx.textAlign = "center"; // Center text horizontally
	ctx.textBaseline = "middle"; // Center text vertically
	ctx.fillText(text, canvas.width / 2, canvas.height / 2); // Draw the text in the center
	// Create a sprite material with the texture
	const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
	const sprite = new THREE.Sprite(spriteMaterial);

	// Scale the sprite to an appropriate size in your 3D scene
	// The scale depends on your desired billboard size relative to buildings
	var ratio = canvas.width / canvas.height; // Maintain aspect ratio
	sprite.scale.set(ratio, 1, 1);

	sprite.userData = {
		companyId: companyId,
		type: "spriteLabel",
		companyName: text,
	};
	return sprite;
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
		// dataOutput.textContent = JSON.stringify(data, null, 2);
		console.log("Fetched data:", data);
		updateSceneWithObjects(data);
	} catch (error) {
		// dataOutput.textContent = `Error loading data: ${error.message}`;
		console.error("Error loading data:", error);
		clearDynamicSceneObjects(); // Clear scene on error too
	}
}
// Helper to create a material with the text texture
function createTexturedMaterialForRoofSide(
	text,
	companyId,
	sideWidth,
	sideHeight
) {
	const canvas = document.createElement("canvas");
	const context = canvas.getContext("2d");
	// Make canvas resolution proportional to the 3D dimensions for clarity
	canvas.width = sideWidth * 100; // e.g., 100 pixels per 3D unit
	canvas.height = sideHeight * 100;

	// Try to use the rooftopTexture image as the background for the roof side label
	if (rooftopTexture && rooftopTexture.image) {
		const img = rooftopTexture.image;
		// Draw the texture image to fill the canvas
		context.drawImage(img, 0, 0, canvas.width, canvas.height);
	} else {
		// Fallback: solid color if texture not loaded
		context.fillStyle = "rgba(80, 80, 80, 1)"; // Roof side background color
		context.fillRect(0, 0, canvas.width, canvas.height);
	}

	// Add a semi-transparent black overlay to darken the background for better text contrast
	context.fillStyle = "rgba(0,0,0,0.5)";
	context.fillRect(0, 0, canvas.width, canvas.height);
	const fontSize = Math.min(
		canvas.height * 0.6,
		canvas.width / (text.length * 0.55)
	);
	context.font = `Bold ${fontSize}px Arial`;
	context.fillStyle = "white";
	context.textAlign = "center";
	context.textBaseline = "middle";
	context.fillText(text, canvas.width / 2, canvas.height / 2);

	const texture = new THREE.CanvasTexture(canvas);
	texture.needsUpdate = true;
	// texture.repeat.set(1,1); // May not need repeat if canvas is sized for the face

	return new THREE.MeshStandardMaterial({
		map: texture,
		roughness: 0.8,
		metalness: 0.1,
	});
}
function createProceduralBuilding(width, height, depth, companyDetails) {
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
	bodyMesh.userData.companyDetails = companyDetails; // Store company details in the mesh for later reference
	buildingGroup.add(bodyMesh);

	// Roof
	const roofHeight = height * 0.15;
	const roofGeometry = new THREE.BoxGeometry(
		width * 1.05,
		roofHeight,
		depth * 1.05
	); // Slightly larger roof

	// if (rooftopTexture) {
	// 	rooftopTexture.repeat.set(width / 4, depth / 4); // Adjust
	// }
	// Materials for the roof
	const roofTopBottomMaterial = new THREE.MeshStandardMaterial({
		map: rooftopTexture, // Your existing rooftop texture
		roughness: 0.9,
		metalness: 0.05,
		// color: rooftopTexture ? 0xffffff : 0xaaaaaa
	});
	var actualRoofWidth = width * 1.05; // Use the same width as roofGeometry
	var actualRoofDepth = depth * 1.05; // Use the same depth as roofGeometry

	// Create unique text materials for each side (or reuse if text is same/generic)
	// Roof side dimensions are: (actualRoofDepth x roofHeight) for X-sides, (actualRoofWidth x roofHeight) for Z-sides.
	const textMaterialSide_PX = createTexturedMaterialForRoofSide(
		companyDetails.company_name,
		companyDetails.company_id,
		actualRoofDepth,
		roofHeight
	); // Side facing +X
	const textMaterialSide_NX = createTexturedMaterialForRoofSide(
		companyDetails.company_name,
		companyDetails.company_id,
		actualRoofDepth,
		roofHeight
	); // Side facing -X
	const textMaterialSide_PZ = createTexturedMaterialForRoofSide(
		companyDetails.company_name,
		companyDetails.company_id,
		actualRoofWidth,
		roofHeight
	); // Side facing +Z
	const textMaterialSide_NZ = createTexturedMaterialForRoofSide(
		companyDetails.company_name,
		companyDetails.company_id,
		actualRoofWidth,
		roofHeight
	); // Side facing -Z

	const roofMaterials = [
		textMaterialSide_PX, // Right side (+X)
		textMaterialSide_NX, // Left side (-X)
		roofTopBottomMaterial, // Top side (+Y)
		roofTopBottomMaterial, // Bottom side (-Y) - often not seen, can be simpler
		textMaterialSide_PZ, // Front side (+Z)
		textMaterialSide_NZ, // Back side (-Z)
	];
	const roofMaterial = new THREE.MeshStandardMaterial({
		map: rooftopTexture, // Use rooftop texture for top and bottom
		roughness: 0.9,
		metalness: 0.05,
		// color: rooftopTexture ? 0xffffff : 0xaaaaaa
	});
	const roofMesh = new THREE.Mesh(roofGeometry, roofMaterials);
	roofMesh.position.y = bodyHeight + roofHeight / 2;
	roofMesh.userData.companyDetails = companyDetails; // Store company details in the mesh for later reference
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
		windowPlaneF.userData.companyDetails = companyDetails; // Store company details in the mesh for later reference
		buildingGroup.add(windowPlaneF);

		// You would create similar planes for other sides (back, left, right)
		const windowPlaneB = windowPlaneF.clone();
		windowPlaneB.rotation.y = Math.PI;
		windowPlaneB.position.set(0, bodyHeight / 2, -depth / 2 - 0.01); // Back
		windowPlaneB.userData.companyDetails = companyDetails; // Store company details in the mesh for later reference
		buildingGroup.add(windowPlaneB);

		const windowPlaneL = windowPlaneF.clone();
		windowPlaneL.rotation.y = -Math.PI / 2;
		windowPlaneL.position.set(-width / 2 - 0.01, bodyHeight / 2, 0); // Left
		windowPlaneL.userData.companyDetails = companyDetails; // Store company details in the mesh for later reference
		buildingGroup.add(windowPlaneL);

		const windowPlaneR = windowPlaneF.clone();
		windowPlaneR.rotation.y = Math.PI / 2;
		windowPlaneR.position.set(width / 2 + 0.01, bodyHeight / 2, 0); // Right
		windowPlaneR.userData.companyDetails = companyDetails; // Store company details in the mesh for later reference
		buildingGroup.add(windowPlaneR);
	}
	// --- Add Billboard Label ---
	const labelText = companyDetails.company_name || "Unknown Company";
	const labelSprite = createSpriteLabel(
		labelText,
		companyDetails.company_id,
		"white",
		"rgba(0,0,0,255)"
	);
	labelSprite.position.set(0, roofHeight + bodyHeight + 0.5, 0); // Position above the building

	buildingGroup.add(labelSprite);

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
	var scaleFactor = 5;
	const focusBuildingHeight = 3.5 * scaleFactor; // Taller
	const focusWidth = 2 * scaleFactor;
	const focusDepth = 2 * scaleFactor;

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
	// Store company details in the mesh for later reference
	focusBuildingMesh.userData.companyDetails = focusCompany;
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

	const MAX_PROXIMITY_DISTANCE = 20 * scaleFactor;
	const MIN_PROXIMITY_DISTANCE = 8 * scaleFactor; // Increased min slightly to give islands space
	const CLUSTER_SPREAD_RADIUS = 3.0 * scaleFactor; // Base radius for building cluster, island will be larger
	const ISLAND_HEIGHT = 0.5 * scaleFactor; // Thickness of the island pedestal
	const ISLAND_Y_OFFSET = 0.1 * scaleFactor; // How much the base of the island is lifted from y=0

	// Adjust main ground plane to be lower if islands are slightly elevated
	if (groundPlane) groundPlane.position.y = -0.1 * scaleFactor;

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
			const buildingW = 1.2 * scaleFactor;
			const buildingH = (1.8 + Math.random() * 1.2) * scaleFactor; // Slightly shorter on average due to island height
			const buildingD = 1.2 * scaleFactor;

			const companyBuilding = createProceduralBuilding(
				buildingW,
				buildingH,
				buildingD,
				company
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

			// let's add a text label just above the building

			// const textGeometry = new TextGeometry(company.company_name, {
			// 	font: helvetikerFont, // Use the loaded helvetiker font
			// 	size: 0.2,
			// 	height: 0.1,
			// 	depth: 0.01,
			// });
			// const textMaterial = new THREE.MeshStandardMaterial({
			// 	color: 0xff0000,
			// });
			// const textMesh = new THREE.Mesh(textGeometry, textMaterial);
			// textMesh.position.set(
			// 	buildingX - buildingW / 2,
			// 	BUILDING_BASE_HEIGHT_ON_ISLAND + buildingH + 0.1,
			// 	buildingZ
			// );
			// districtGroup.add(textMesh);
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
// const dataOutput = document.getElementById("dataOutput");

loadCompanyButton.addEventListener("click", () => {
	const companyId = parseInt(companyIdInput.value);
	if (!isNaN(companyId) && companyId > 0) {
		fetchCompanyData(companyId);
	} else {
		// dataOutput.textContent = "Please enter a valid company ID (e.g., 1-5).";
		console.error("Please enter a valid company ID (e.g., 1-5).");
	}
});

// --- Initialize ---
document.addEventListener("DOMContentLoaded", () => {
	initThreeJS();
	// Optionally load data for company ID 1 by default
	fetchCompanyData(1);
});
