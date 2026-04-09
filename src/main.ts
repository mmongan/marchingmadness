import { BandMemberFactory, InstrumentType, BandMemberData } from "./bandMemberFactory";
import { FirstPersonBody } from "./firstPersonBody";
import { startMetronomeAndMusic } from "./musicManager";
import { sfPanners, playStumbleSound, playCrashSound, loadInstruments, updateAudioListener, updateSpatialAudio } from "./audioSystem";
import { 
    StumbleState, createStumbleState, BPM, WHOLE_NOTE_DURATION, FLY_SPEED,
    COLLISION_RADIUS, STUMBLE_RECOVERY, MAX_TILT, DOWN_DURATION,
    OBSTACLE_RADIUS, OBSTACLE_PUSH, MARCHER_COLLISION_RADIUS,
    PLAYER_DRILL_ROW, PLAYER_DRILL_COL, PLAYER_START_X, PLAYER_START_Z, 
    STEP_LOOK_AHEAD, STEP_HIT_PERFECT, STEP_HIT_GOOD, FOOT_LATERAL,
    BAND_ROWS, BAND_COLS, SPACING_X, SPACING_Z, BAND_START_Z
} from "./gameConstants";
import { Engine, Scene, FreeCamera, Vector3, HemisphericLight, MeshBuilder, StandardMaterial, DynamicTexture, Color3, Texture, CubeTexture, PointerEventTypes, ParticleSystem, Color4, AbstractMesh, Mesh } from "@babylonjs/core";
import "@babylonjs/loaders/glTF";
import { OpenSheetMusicDisplay } from "opensheetmusicdisplay";
import * as Tone from "tone";

// Real sampled instrument voices - definitions now in gameConstants.ts
const canvas = document.getElementById("renderCanvas") as HTMLCanvasElement;
const engine = new Engine(canvas, true, { audioEngine: false });

// Create the scene
const scene = new Scene(engine);
scene.clearColor = new Color3(0.9, 0.9, 0.9).toColor4();

const camera = new FreeCamera("camera1", new Vector3(0, 1.8, 0), scene);
camera.setTarget(new Vector3(0, 1.8, 1));
camera.attachControl(canvas, true);

const light = new HemisphericLight("light", new Vector3(0, 1, 0), scene);
light.intensity = 0.8;

// Track XR controllers for arm tracking
const playerBody = new FirstPersonBody(scene);

// Enable WebXR/VR with graceful device detection
scene.createDefaultXRExperienceAsync({
    inputOptions: {
        // Don't force a profile — let the browser report the real controller
    }
}).then((xr) => {
    // If the device doesn't supply a real-world vertical tracking offset (3DoF/Emulators),
    // this ensures the player eyes sit exactly at 1.8 meters from the floor.
    xr.baseExperience.onInitialXRPoseSetObservable.add((xrCamera) => {
        xrCamera.position.y = 1.8;
    });

    // Track physical controllers for arm positioning (skip hand-tracking inputs)
    xr.input.onControllerAddedObservable.add((controller) => {
        const profiles = controller.inputSource.profiles;
        const isHandTracking = profiles.some(p => p.includes("hand"));
        if (isHandTracking) return; // hand-tracking has no grip useful for arm-swing
        console.log(`XR controller connected: ${controller.inputSource.handedness}, profile: ${profiles.join(", ")}`);
        if (controller.inputSource.handedness === "left") playerBody.setController("left", controller);
        if (controller.inputSource.handedness === "right") playerBody.setController("right", controller);
    });
    xr.input.onControllerRemovedObservable.add((controller) => {
        const profiles = controller.inputSource.profiles;
        const isHandTracking = profiles.some(p => p.includes("hand"));
        if (isHandTracking) return;
        if (controller.inputSource.handedness === "left") playerBody.setController("left", null);
        if (controller.inputSource.handedness === "right") playerBody.setController("right", null);
    });
}).catch((err) => {
    console.warn("WebXR not available, falling back to desktop controls:", err);
});

// Add a standard majestic skybox
function buildSkybox(scene: Scene) {
    const skybox = MeshBuilder.CreateBox("skyBox", { size: 1000.0 }, scene);
    const skyboxMaterial = new StandardMaterial("skyBox", scene);
    skyboxMaterial.backFaceCulling = false;
    skyboxMaterial.reflectionTexture = new CubeTexture("https://playground.babylonjs.com/textures/skybox", scene);
    skyboxMaterial.reflectionTexture.coordinatesMode = Texture.SKYBOX_MODE;
    skyboxMaterial.diffuseColor = new Color3(0, 0, 0);
    skyboxMaterial.specularColor = new Color3(0, 0, 0);
    
    // Ensure skybox renders behind everything else
    skybox.infiniteDistance = true; 
    skybox.material = skyboxMaterial;
}
buildSkybox(scene);

// Create an American Football Field (Player sitting on 50 yard line looking across)
function buildFootballField(scene: Scene) {
    const lengthX = 109.7; // 120 yards long mathematically
    const depthZ = 48.8; // 53.3 yards depth
    
    const ground = MeshBuilder.CreateGround("footballField", { width: lengthX, height: depthZ }, scene);
    // Position field so camera (at X=0, Z=0) drops right into the middle of the field on the 50-yard line
    ground.position = new Vector3(0, -0.01, 0); 
    
    const texWidth = 2048;
    const texHeight = 1024;
    const fieldTex = new DynamicTexture("fieldTex", { width: texWidth, height: texHeight }, scene, true);
    const ctx = fieldTex.getContext() as CanvasRenderingContext2D;
    
    // Fill grass
    ctx.fillStyle = "#2e7d32";
    ctx.fillRect(0, 0, texWidth, texHeight);
    
    // Draw lines
    ctx.strokeStyle = "white";
    ctx.fillStyle = "white";
    
    const yardsX = 120;
    const pixelsPerYardX = texWidth / yardsX;
    
    // Draw Endzone backgrounds First
    ctx.fillStyle = "#1b5e20";
    ctx.fillRect(0, 0, 10 * pixelsPerYardX, texHeight); // Left endzone
    ctx.fillRect(110 * pixelsPerYardX, 0, 10 * pixelsPerYardX, texHeight); // Right endzone
    
    ctx.fillStyle = "white";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    for (let yard = 0; yard <= yardsX; yard += 1) {
        const x = yard * pixelsPerYardX;
        
        ctx.beginPath();
        if (yard >= 10 && yard <= 110) {
            if (yard % 5 === 0) {
                // Line all the way across
                ctx.moveTo(x, 0);
                ctx.lineTo(x, texHeight);
                ctx.lineWidth = (yard % 10 === 0 || yard === 10 || yard === 110) ? 8 : 4;
                ctx.stroke();
                
                if (yard > 10 && yard < 110 && yard % 10 === 0) {
                    let dispYard = yard - 10;
                    if (dispYard > 50) dispYard = 100 - dispYard;
                    
                    ctx.font = "bold 60px Arial";
                    // Bottom numbers (closest to player on sideline)
                    ctx.save();
                    ctx.translate(x, texHeight * 0.85); // 1024 height, player is at bottom
                    ctx.fillText(dispYard.toString(), 0, 0);
                    ctx.restore();
                    
                    // Top numbers (far sideline)
                    ctx.save();
                    ctx.translate(x, texHeight * 0.15);
                    ctx.rotate(Math.PI);
                    ctx.fillText(dispYard.toString(), 0, 0);
                    ctx.restore();
                }
            } else {
                // Short Hash marks every 1 yard
                ctx.lineWidth = 2;
                ctx.moveTo(x, 0); ctx.lineTo(x, 15); ctx.stroke();
                ctx.moveTo(x, texHeight); ctx.lineTo(x, texHeight - 15); ctx.stroke();
                // inner hashes (College/HS spacing usually ~1/3rd from sidelines, close enough)
                ctx.moveTo(x, texHeight * 0.35); ctx.lineTo(x, texHeight * 0.35 + 15); ctx.stroke();
                ctx.moveTo(x, texHeight * 0.65); ctx.lineTo(x, texHeight * 0.65 - 15); ctx.stroke();
            }
        }
    }
    
    // Draw boundary line around playable 100 yards
    ctx.lineWidth = 8;
    ctx.strokeRect(10 * pixelsPerYardX, 0, 100 * pixelsPerYardX, texHeight); 
    
    // Endzone text
    ctx.font = "bold 100px Arial";
    ctx.save();
    ctx.translate(5 * pixelsPerYardX, texHeight / 2);
    ctx.rotate(Math.PI / 2);
    ctx.fillText("MARCHING", 0, 0);
    ctx.restore();
    
    ctx.save();
    ctx.translate(115 * pixelsPerYardX, texHeight / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText("MADNESS", 0, 0);
    ctx.restore();
    
    fieldTex.update();
    
    const mat = new StandardMaterial("fieldMat", scene);
    mat.diffuseTexture = fieldTex;
    mat.specularColor = new Color3(0.05, 0.05, 0.05); // low shine grass
    ground.material = mat;
    
    // Rotate the field 90 degrees so the user looks down the length of the field
    ground.rotation.y = Math.PI / 2;

    // Create a surrounding dark turf base to fix seeing "under" the field edges
    const surroundBase = MeshBuilder.CreateGround("surroundBase", { width: 400, height: 400 }, scene);
    surroundBase.position = new Vector3(0, -0.05, 0); // Just beneath the main field
    const surroundMat = new StandardMaterial("surroundMat", scene);
    surroundMat.diffuseColor = new Color3(0.05, 0.15, 0.05); // Very dark green turf
    surroundMat.specularColor = new Color3(0.01, 0.01, 0.01);
    surroundBase.material = surroundMat;
}
buildFootballField(scene);


type DrillShape = (r: number, c: number, cols: number, rows: number, startX: number, startZ: number) => {x: number, z: number};

const drillShapes: DrillShape[] = [
    // 0: Original Block
    (_r, _c, _cols, _rows, startX, startZ) => ({ x: startX, z: startZ }),
    
    // 1: Expanded Block
    (_r, _c, _cols, _rows, startX, startZ) => ({ x: startX * 2.0, z: startZ }),
    
    // 2: Wedge (Arrowhead) - Z shifts based on column distance from center
    (_r, c, cols, _rows, startX, startZ) => {
        const centerCol = (cols - 1) / 2;
        const distFromCenter = Math.abs(c - centerCol);
        return { x: startX * 1.5, z: startZ - distFromCenter * 3.0 };
    },

    // 3: Diamond Bow - X stretches outward in the middle rows
    (r, _c, _cols, rows, startX, startZ) => {
        const rowPhase = (r / (rows - 1)) * Math.PI;
        // Multiplier ranges from 1.0 at ends to 2.2 in the middle
        const stretch = 1.0 + 1.2 * Math.sin(rowPhase);
        return { x: startX * stretch, z: startZ };
    },

    // 4: S-Curve Wave - Entire band slithers left and right down the field
    (_r, _c, _cols, _rows, startX, startZ) => {
        const waveShift = Math.sin(startZ / 5.0) * 3.0;
        return { x: startX * 1.5 + waveShift, z: startZ };
    }
];

const drillTimeline = [
    { beat: 0, shape: 0 },
    { beat: 16, shape: 0 },
    // Expand transition
    { beat: 32, shape: 1 },
    { beat: 48, shape: 1 },
    // Wedge transition
    { beat: 64, shape: 2 },
    { beat: 80, shape: 2 },
    // Diamond transition
    { beat: 96, shape: 4 },
    { beat: 112, shape: 4 },
    // Rings transition
    { beat: 128, shape: 3 },
    { beat: 144, shape: 3 },
    // Back to block transition
    { beat: 160, shape: 0 }, 
];

function getDrillPosition(currentBeat: number, r: number, c: number, cols: number, rows: number, startX: number, startZ: number): {x: number, z: number} {
    // Loop entirely at 160 beats
    const maxBeat = 160;
    let loopedBeat = currentBeat % maxBeat;
    
    // Find phase
    let currentIndex = 0;
    while(currentIndex < drillTimeline.length - 1 && drillTimeline[currentIndex + 1].beat <= loopedBeat) {
        currentIndex++;
    }
    
    const currentPhase = drillTimeline[currentIndex];
    
    if (currentIndex === drillTimeline.length - 1) {
        return drillShapes[currentPhase.shape](r, c, cols, rows, startX, startZ);
    }
    
    const nextPhase = drillTimeline[currentIndex + 1];
    
    // Lerp between shapes
    const progress = (loopedBeat - currentPhase.beat) / (nextPhase.beat - currentPhase.beat);
    
    const p1 = drillShapes[currentPhase.shape](r, c, cols, rows, startX, startZ);
    const p2 = drillShapes[nextPhase.shape](r, c, cols, rows, startX, startZ);
    
    // Smooth transition
    const smoothProgress = progress * progress * (3 - 2 * progress); // smoothstep

    return {
        x: p1.x + (p2.x - p1.x) * smoothProgress,
        z: p1.z + (p2.z - p1.z) * smoothProgress
    };
}

const bandLegs: BandMemberData[] = [];

// Stumble state per band member (imported from gameConstants)
const stumbleStates: StumbleState[] = [];

// Physics and collision constants (imported from gameConstants)

// Scattered hat tracking
interface ScatteredHat {
    mesh: AbstractMesh;
    velX: number; velY: number; velZ: number;
    rotVelX: number; rotVelZ: number;
    timer: number; // seconds remaining before disposal
}
const scatteredHats: ScatteredHat[] = [];

function scatterHat(anchor: AbstractMesh, pushDirX: number, pushDirZ: number) {
    // Find the hat mesh among anchor's children
    const children = anchor.getChildMeshes(true);
    const hat = children.find(c => c.name.startsWith("hat") || c.name.startsWith("baseHat"));
    const plume = children.find(c => c.name.startsWith("plume") || c.name.startsWith("basePlume"));
    if (!hat) return;

    // Detach hat from anchor and place at its world position
    const worldPos = hat.getAbsolutePosition().clone();
    hat.parent = null;
    hat.position.copyFrom(worldPos);
    
    // Also detach plume (moves with hat)
    if (plume) {
        plume.parent = hat;
        plume.position.set(0, 0.2, 0);
    }

    // Launch velocity: mostly upward + outward in push direction
    const speed = 2 + Math.random() * 2;
    scatteredHats.push({
        mesh: hat,
        velX: pushDirX * speed + (Math.random() - 0.5) * 1.5,
        velY: 3 + Math.random() * 2,
        velZ: pushDirZ * speed + (Math.random() - 0.5) * 1.5,
        rotVelX: (Math.random() - 0.5) * 8,
        rotVelZ: (Math.random() - 0.5) * 8,
        timer: 6 // seconds before cleanup
    });
}

function updateScatteredHats(dt: number) {
    for (let i = scatteredHats.length - 1; i >= 0; i--) {
        const h = scatteredHats[i];
        h.velY -= 9.8 * dt; // gravity
        h.mesh.position.x += h.velX * dt;
        h.mesh.position.y += h.velY * dt;
        h.mesh.position.z += h.velZ * dt;
        h.mesh.rotation.x += h.rotVelX * dt;
        h.mesh.rotation.z += h.rotVelZ * dt;

        // Bounce off ground
        if (h.mesh.position.y < 0.1) {
            h.mesh.position.y = 0.1;
            h.velY = Math.abs(h.velY) * 0.3;
            h.velX *= 0.7;
            h.velZ *= 0.7;
            h.rotVelX *= 0.5;
            h.rotVelZ *= 0.5;
        }
        h.timer -= dt;
        if (h.timer <= 0) {
            h.mesh.dispose();
            scatteredHats.splice(i, 1);
        }
    }
}

// Dust particle burst when a marcher hits the ground
function emitDustBurst(position: Vector3) {
    const ps = new ParticleSystem("dust", 30, scene);
    ps.createPointEmitter(new Vector3(-0.5, 0, -0.5), new Vector3(0.5, 0.3, 0.5));
    ps.emitter = position.clone();
    ps.emitter.y = 0.05;
    ps.minSize = 0.05;
    ps.maxSize = 0.2;
    ps.minLifeTime = 0.3;
    ps.maxLifeTime = 0.8;
    ps.emitRate = 0; // manual burst only
    ps.color1 = new Color4(0.6, 0.5, 0.35, 0.8);
    ps.color2 = new Color4(0.5, 0.4, 0.3, 0.6);
    ps.colorDead = new Color4(0.4, 0.35, 0.25, 0);
    ps.gravity = new Vector3(0, -1, 0);
    ps.blendMode = ParticleSystem.BLENDMODE_STANDARD;
    ps.manualEmitCount = 30;
    ps.targetStopDuration = 1.0;
    ps.disposeOnStop = true;
    ps.start();
}

// === Player Starting Position in Drill Formation ===
// Assign player to replace a random band member position
const randomMemberIndex = Math.floor(Math.random() * (BAND_ROWS * BAND_COLS));
const playerRow = Math.floor(randomMemberIndex / BAND_COLS);
const playerCol = randomMemberIndex % BAND_COLS;
const playerStartX = (playerCol - BAND_COLS / 2 + 0.5) * SPACING_X;
const playerStartZ = BAND_START_Z + playerRow * SPACING_Z;

// Create a 100-member marching band in a 10x10 formation
function buildMarchingBand(scene: Scene) {
    const factory = new BandMemberFactory(scene);

    const rows = 15;
    const cols = 5;
    const spacingX = 2.0; // 2 meters between columns
    const spacingZ = 2.0; // 2 meters between rows
    const startZ = 15; // Start near midfield so all 15 rows (28m deep) stay on the field

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const isFlute = (r === 1);
            const isClarinet = (r === 2);
            const isSaxophone = (r === 3);
            const isMellophone = (r === 4);
            const isTrumpet = (r === 5 || r === 6);
            const isTrombone = (r === 7);
            const isEuphonium = (r === 8);
            const isSousaphone = (r === 9);
            const isGlockenspiel = (r === 10);
            const isSnareDrum = (r === 11);
            const isTomTom = (r === 12);
            const isBassDrum = (r === 13);
            const isCymbals = (r === 14);

            let type: InstrumentType = "DrumMajor";
            if (isFlute) type = "Flute";
            else if (isClarinet) type = "Clarinet";
            else if (isSaxophone) type = "Saxophone";
            else if (isTomTom) type = "TomTom";
            else if (isSnareDrum) type = "SnareDrum";
            else if (isBassDrum) type = "BassDrum";
            else if (isCymbals) type = "Cymbals";
            else if (isTrumpet) type = "Trumpet";
            else if (isMellophone) type = "Mellophone";
            else if (isEuphonium) type = "Euphonium";
            else if (isTrombone) type = "Trombone";
            else if (isSousaphone) type = "Sousaphone";
            else if (isGlockenspiel) type = "Glockenspiel";

            const xPos = (c - cols / 2 + 0.5) * spacingX;
            const zPos = startZ + r * spacingZ;

            const memberData = factory.createMember(r, c, type, xPos, zPos);
            bandLegs.push(memberData);
        }
    }
}
buildMarchingBand(scene);

// Create player marcher at the assigned position and replace the standard marcher there
const factory = new BandMemberFactory(scene);
const playerMarcherIndex = playerRow * BAND_COLS + playerCol;

// Get the instrument type for this row
let playerInstrument: InstrumentType = "DrumMajor";
if (playerRow === 1) playerInstrument = "Flute";
else if (playerRow === 2) playerInstrument = "Clarinet";
else if (playerRow === 3) playerInstrument = "Saxophone";
else if (playerRow === 4) playerInstrument = "Mellophone";
else if (playerRow === 5 || playerRow === 6) playerInstrument = "Trumpet";
else if (playerRow === 7) playerInstrument = "Trombone";
else if (playerRow === 8) playerInstrument = "Euphonium";
else if (playerRow === 9) playerInstrument = "Sousaphone";
else if (playerRow === 10) playerInstrument = "Glockenspiel";
else if (playerRow === 11) playerInstrument = "SnareDrum";
else if (playerRow === 12) playerInstrument = "TomTom";
else if (playerRow === 13) playerInstrument = "BassDrum";
else if (playerRow === 14) playerInstrument = "Cymbals";

// Dispose the standard marcher at this position
const existingMarcher = bandLegs[playerMarcherIndex];
const existingChildren = existingMarcher.anchor.getChildMeshes(true);
for (const child of existingChildren) {
    // Only dispose unique materials (like label textures), not shared materials
    if (child.name.includes("label")) {
        if (child.material) {
            if (child.material instanceof StandardMaterial) {
                if (child.material.diffuseTexture) child.material.diffuseTexture.dispose();
            }
            child.material.dispose();
        }
    }
    child.dispose();
}
existingMarcher.anchor.dispose();

// Create player marcher with distinct appearance (lighter color to stand out)
const playerMarcher = factory.createMember(playerRow, playerCol, playerInstrument, playerStartX, playerStartZ);

// Replace the standard marcher with the player marcher
bandLegs[playerMarcherIndex] = playerMarcher;

// Initialize camera to player's starting drill position
camera.position = new Vector3(playerStartX, 1.8, playerStartZ);
camera.setTarget(new Vector3(playerStartX, 1.8, playerStartZ - 5));

// Position the player's VR body at the marcher location
playerBody.setBodyPosition(new Vector3(playerStartX, 0, playerStartZ));

// Initialize stumble state for each band member
for (let i = 0; i < bandLegs.length; i++) {
    stumbleStates.push(createStumbleState());
}

// Ground shadow discs under each marcher
const shadowMat = new StandardMaterial("shadowMat", scene);
shadowMat.diffuseColor = new Color3(0, 0, 0);
shadowMat.specularColor = new Color3(0, 0, 0);
shadowMat.alpha = 0.35;
const shadowDiscs: AbstractMesh[] = [];
const baseShadow = MeshBuilder.CreateDisc("shadow_base", { radius: 0.5, tessellation: 16 }, scene);
baseShadow.rotation.x = Math.PI / 2; // lay flat
baseShadow.material = shadowMat;
baseShadow.isPickable = false;
for (let i = 0; i < bandLegs.length; i++) {
    const disc = i === 0 ? baseShadow : baseShadow.createInstance(`shadow_${i}`);
    disc.position.set(bandLegs[i].anchor.position.x, 0.02, bandLegs[i].anchor.position.z);
    shadowDiscs.push(disc as any);
}
// === PLAYER DRILL FOOTSTEP TARGETS ===
// Constants imported from gameConstants

interface StepMarker {
    mesh: AbstractMesh;
    mat: StandardMaterial;
    beatNum: number;
    flashTimer: number;
}
const stepMarkers: StepMarker[] = [];

for (let i = 0; i < STEP_LOOK_AHEAD; i++) {
    const mesh = MeshBuilder.CreateTorus(`step_${i}`, { diameter: 0.7, thickness: 0.05, tessellation: 24 }, scene);
    mesh.rotation.x = Math.PI / 2;
    mesh.position.y = 0.04;
    mesh.isPickable = false;
    mesh.isVisible = false;
    const mat = new StandardMaterial(`stepMat_${i}`, scene);
    mat.emissiveColor = new Color3(0, 0.5, 1);
    mat.disableLighting = true;
    mat.alpha = 0.6;
    mesh.material = mat;
    stepMarkers.push({ mesh, mat, beatNum: -1, flashTimer: 0 });
}

let lastScoredBeat = -1;
let stepStreak = 0;
let totalStepsScored = 0;
let perfectSteps = 0;
let goodSteps = 0;
let missedSteps = 0;

// Keep reference to blocks
const measureBlocks: any[] = [];
const gameBlocks: { mesh: any, arrivalTime: number, startX: number, startY: number, boxHeight: number, noteFractions: number[], firstT: number }[] = [];
let gameStartTime: number | null = null;

// Visual beat indicator - a glowing sphere that flashes on each beat
const beatIndicator = MeshBuilder.CreateSphere("beatIndicator", { diameter: 0.15 }, scene);
beatIndicator.position = new Vector3(0, 2.5, 3);
const beatMat = new StandardMaterial("beatMat", scene);
beatMat.emissiveColor = new Color3(1, 0.8, 0);
beatMat.disableLighting = true;
beatIndicator.material = beatMat;
beatIndicator.isVisible = false;

// Formation Quality HUD — wrist-mounted display on right arm
const scoreHUD = MeshBuilder.CreatePlane("scoreHUD", { width: 0.18, height: 0.06 }, scene);
scoreHUD.parent = playerBody.getRightArm();
// Position on the wrist: far down the arm (+Y = toward hand)
// and outward (-Z = face away from buttons side so you can glance down at it)
scoreHUD.position.set(0, 0.45, -0.08);
scoreHUD.rotation.set(Math.PI / 2, 0, 0); // face outward from the arm
scoreHUD.isPickable = false;
const scoreTex = new DynamicTexture("scoreTex", { width: 512, height: 128 }, scene, false);
const scoreMat = new StandardMaterial("scoreMat", scene);
scoreMat.diffuseTexture = scoreTex;
scoreMat.emissiveColor = new Color3(1, 1, 1);
scoreMat.backFaceCulling = false;
scoreHUD.material = scoreMat;
scoreHUD.isVisible = false;
let formationQuality = 100;   // 0-100 percentage
let marchersKnockedDown = 0;
let lastScoreText = "";

function updateScoreHUD() {
    const grade = formationQuality >= 90 ? "A" : formationQuality >= 80 ? "B"
        : formationQuality >= 70 ? "C" : formationQuality >= 60 ? "D" : "F";
    const streakTxt = stepStreak > 2 ? ` 🔥${stepStreak}` : "";
    const text = `${Math.round(formationQuality)}% ${grade}  KO:${marchersKnockedDown}${streakTxt}`;
    if (text === lastScoreText) return; // avoid redrawing every frame
    lastScoreText = text;
    const ctx = scoreTex.getContext() as CanvasRenderingContext2D;
    ctx.clearRect(0, 0, 512, 128);
    ctx.fillStyle = "rgba(0,0,0,0.7)";
    ctx.roundRect(4, 4, 504, 120, 12);
    ctx.fill();
    const color = formationQuality >= 80 ? "#44ff44" : formationQuality >= 60 ? "#ffcc00" : "#ff4444";
    ctx.fillStyle = color;
    ctx.font = "bold 44px Arial";
    ctx.textAlign = "center";
    ctx.fillText(text, 256, 82);
    scoreTex.update();
}

// Song selection
const SONG_LIST = [
    { file: "assets/fight_song.xml", title: "Fight Song", subtitle: "Public Domain" },
    { file: "assets/saints.xml", title: "When the Saints", subtitle: "Full Band" },
    { file: "assets/stars_and_stripes.xml", title: "Stars & Stripes", subtitle: "Full Band" },
    { file: "assets/battle_hymn.xml", title: "Battle Hymn", subtitle: "Full Band" },
];
let selectedScoreFile = SONG_LIST[0].file;

// === Setup Desktop HTML Buttons ===
const songButtonsContainer = document.getElementById("songButtons")!;
const desktopUI = document.getElementById("desktopUI")!;
const startBtnHTML = document.getElementById("startBtn") as HTMLButtonElement;

const desktopSongButtons: HTMLButtonElement[] = [];
for (let i = 0; i < SONG_LIST.length; i++) {
    const btn = document.createElement("button");
    btn.className = "songBtn";
    if (i === 0) btn.classList.add("selected");
    btn.innerHTML = `<strong>${SONG_LIST[i].title}</strong><br><small>${SONG_LIST[i].subtitle}</small>`;
    btn.addEventListener("click", () => {
        // Update HTML button selection UI
        for (const b of desktopSongButtons) b.classList.remove("selected");
        btn.classList.add("selected");
        // Update 3D button selection (will redraw when clicked)
        selectedScoreFile = SONG_LIST[i].file;
    });
    songButtonsContainer.appendChild(btn);
    desktopSongButtons.push(btn);
}

// Add event listener for HTML start button
startBtnHTML.addEventListener("click", async () => {
    if (!gameStarting) {
        gameStarting = true;
        desktopUI.classList.add("hidden");
        await startGameplay();
    }
});

// === UI Button Meshes and Materials (organized in arrays for easier disposal) ===
const buttonMeshes: Mesh[] = [];
const buttonMaterials: StandardMaterial[] = [];
const buttonTextures: DynamicTexture[] = [];

// Title text
const titleMesh = MeshBuilder.CreatePlane("titleMesh", { width: 3, height: 0.6 }, scene);
titleMesh.position = new Vector3(playerStartX, 2.6, playerStartZ + 2);
const titleTex = new DynamicTexture("titleTex", { width: 768, height: 128 }, scene, false);
const titleCtx = titleTex.getContext() as CanvasRenderingContext2D;
titleCtx.fillStyle = "rgba(0,0,0,0)";
titleCtx.clearRect(0, 0, 768, 128);
titleCtx.fillStyle = "#FFD700";
titleCtx.font = "bold 64px Arial";
titleCtx.textAlign = "center";
titleCtx.fillText("MARCHING MADNESS", 384, 80);
titleTex.update();
titleTex.hasAlpha = true;
const titleMat = new StandardMaterial("titleMat", scene);
titleMat.diffuseTexture = titleTex;
titleMat.emissiveColor = new Color3(1, 1, 1);
titleMat.backFaceCulling = false;
titleMesh.material = titleMat;

// Song selection buttons
const songBtns: ReturnType<typeof MeshBuilder.CreatePlane>[] = [];
function drawSongBtn(tex: DynamicTexture, title: string, subtitle: string, selected: boolean) {
    const ctx = tex.getContext() as CanvasRenderingContext2D;
    ctx.clearRect(0, 0, 512, 256);
    ctx.fillStyle = selected ? "#1155aa" : "#333366";
    ctx.roundRect(4, 4, 504, 248, 16);
    ctx.fill();
    if (selected) {
        ctx.strokeStyle = "#FFD700";
        ctx.lineWidth = 4;
        ctx.roundRect(4, 4, 504, 248, 16);
        ctx.stroke();
    }
    ctx.fillStyle = "white";
    ctx.font = "bold 44px Arial";
    ctx.textAlign = "center";
    ctx.fillText(title, 256, 110);
    ctx.fillStyle = "#aaaaaa";
    ctx.font = "28px Arial";
    ctx.fillText(subtitle, 256, 170);
    tex.update();
}

const songMaterials: StandardMaterial[] = [];
for (let i = 0; i < SONG_LIST.length; i++) {
    const btn = MeshBuilder.CreatePlane(`songBtn_${i}`, { width: 1.2, height: 0.5 }, scene);
    const xOffset = (i - (SONG_LIST.length - 1) / 2) * 1.4;
    btn.position = new Vector3(playerStartX + xOffset, 1.8, playerStartZ + 2);
    const tex = new DynamicTexture(`songTex_${i}`, { width: 512, height: 256 }, scene, false);
    tex.hasAlpha = true;
    drawSongBtn(tex, SONG_LIST[i].title, SONG_LIST[i].subtitle, i === 0);
    buttonTextures.push(tex);
    const mat = new StandardMaterial(`songMat_${i}`, scene);
    mat.diffuseTexture = tex;
    mat.emissiveColor = new Color3(1, 1, 1);
    mat.backFaceCulling = false;
    btn.material = mat;
    songMaterials.push(mat);
    buttonMeshes.push(btn);
    buttonMaterials.push(mat);
    songBtns.push(btn);
}

// 3D VR Start Button
const startBtnMesh = MeshBuilder.CreatePlane("startBtnMesh", { width: 2, height: 0.7 }, scene);
startBtnMesh.position = new Vector3(playerStartX, 1.1, playerStartZ + 2);

const btnTex = new DynamicTexture("btnTex", { width: 512, height: 256 }, scene, false);
buttonTextures.push(btnTex);
const btnCtx = btnTex.getContext() as CanvasRenderingContext2D;
btnCtx.fillStyle = "#228822";
btnCtx.fillRect(0, 0, 512, 256);
btnCtx.fillStyle = "white";
btnCtx.font = "bold 60px Arial";
btnCtx.textAlign = "center";
btnCtx.fillText("START GAME", 256, 150);
btnTex.update();

const btnMat = new StandardMaterial("btnMat", scene);
btnMat.diffuseTexture = btnTex;
btnMat.emissiveColor = new Color3(1, 1, 1);
startBtnMesh.material = btnMat;
buttonMaterials.push(btnMat);
buttonMeshes.push(startBtnMesh);

// === Attach UI buttons to right arm sleeve ===
const rightArm = playerBody.getRightArm();
for (const buttonMesh of buttonMeshes) {
    buttonMesh.parent = rightArm;
    // Offset relative to arm: position on the sleeve
    // Right arm: 0.3 offset on right side, buttons positioned in front and up from arm
    buttonMesh.position.x += 0.3;
    buttonMesh.position.y += 0.5;
    buttonMesh.position.z += 0.4;
}

// Shared game startup function (called by both HTML and 3D buttons)
async function startGameplay() {
    // Lock camera to player position (disable mouse/keyboard controls for desktop)
    camera.detachControl();
    
    await Tone.start();
    // Load real sampled instruments via SoundFont, routing through spatial PannerNodes
    await loadInstruments();

    // Load the selected song's sheet music
    await initSheetMusic();

    // Sync Tone.Transport to our 80 BPM and schedule all parts with correct transposition
    // The musicManager handles PlaybackTranspose for all instruments (e.g., -2 for Bb, -7 for Horn in F)
    Tone.Transport.bpm.value = BPM;
    gameStartTime = Tone.now();
    
    if (osmd && osmd.Sheet) {
        startMetronomeAndMusic(osmd.Sheet, gameStartTime);
    } else {
        console.error("OSMD or Sheet not initialized");
        return;
    }

    beatIndicator.isVisible = true;
    scoreHUD.isVisible = true;
    formationQuality = 100;
    marchersKnockedDown = 0;
    // Reset footstep scoring state
    lastScoredBeat = -1;
    stepStreak = 0;
    totalStepsScored = 0;
    perfectSteps = 0;
    goodSteps = 0;
    missedSteps = 0;
    updateScoreHUD();
    // Start the metronome and music specifically delayed by 2 whole notes
    Tone.Transport.start(gameStartTime + 2 * WHOLE_NOTE_DURATION);
    
    // Dispose all UI buttons, materials, and textures
    for (const buttonMesh of buttonMeshes) buttonMesh.dispose();
    for (const mat of buttonMaterials) mat.dispose();
    for (const tex of buttonTextures) tex.dispose();
    titleMesh.dispose();
}

let gameStarting = false;
scene.onPointerObservable.add(async (pointerInfo) => {
    if (pointerInfo.type !== PointerEventTypes.POINTERDOWN || !pointerInfo.pickInfo?.hit) return;
    const picked = pointerInfo.pickInfo.pickedMesh;

    // Song selection: check if a song button was clicked
    for (let i = 0; i < songBtns.length; i++) {
        if (picked === songBtns[i]) {
            selectedScoreFile = SONG_LIST[i].file;
            // Redraw all buttons to reflect selection
            for (let j = 0; j < songBtns.length; j++) {
                drawSongBtn(buttonTextures[j], SONG_LIST[j].title, SONG_LIST[j].subtitle, j === i);
            }
            return;
        }
    }

    if (picked === startBtnMesh && !gameStarting) {
        gameStarting = true;
        await startGameplay();
    }
});

// Results screen — shown when the song finishes
let gameOver = false;
let totalSongDuration = 0; // seconds, computed after OSMD loads
const resultsMesh = MeshBuilder.CreatePlane("resultsMesh", { width: 3, height: 2 }, scene);
resultsMesh.position = new Vector3(0, 1.6, 2.5);
resultsMesh.isVisible = false;
resultsMesh.isPickable = false;
const resultsTex = new DynamicTexture("resultsTex", { width: 768, height: 512 }, scene, false);
const resultsMat = new StandardMaterial("resultsMat", scene);
resultsMat.diffuseTexture = resultsTex;
resultsMat.emissiveColor = new Color3(1, 1, 1);
resultsMat.backFaceCulling = false;
resultsMesh.material = resultsMat;

function showResults() {
    if (gameOver) return;
    gameOver = true;
    Tone.Transport.stop();
    beatIndicator.isVisible = false;
    scoreHUD.isVisible = false;
    // Hide footstep markers
    for (const m of stepMarkers) m.mesh.isVisible = false;
    resultsMesh.isVisible = true;

    const grade = formationQuality >= 90 ? "A" : formationQuality >= 80 ? "B"
        : formationQuality >= 70 ? "C" : formationQuality >= 60 ? "D" : "F";
    const stepPct = totalStepsScored > 0 ? Math.round(((perfectSteps + goodSteps) / totalStepsScored) * 100) : 0;
    const ctx = resultsTex.getContext() as CanvasRenderingContext2D;
    ctx.clearRect(0, 0, 768, 512);
    // Background
    ctx.fillStyle = "rgba(0,0,0,0.85)";
    ctx.roundRect(8, 8, 752, 496, 20);
    ctx.fill();
    // Title
    ctx.fillStyle = "#FFD700";
    ctx.font = "bold 56px Arial";
    ctx.textAlign = "center";
    ctx.fillText("PERFORMANCE REVIEW", 384, 65);
    // Grade
    const gradeColor = formationQuality >= 80 ? "#44ff44" : formationQuality >= 60 ? "#ffcc00" : "#ff4444";
    ctx.fillStyle = gradeColor;
    ctx.font = "bold 100px Arial";
    ctx.fillText(grade, 384, 180);
    // Stats
    ctx.fillStyle = "#ffffff";
    ctx.font = "32px Arial";
    ctx.fillText(`Formation: ${Math.round(formationQuality)}%`, 384, 240);
    ctx.fillText(`Marchers Down: ${marchersKnockedDown}`, 384, 280);
    ctx.fillText(`Steps: ${perfectSteps} perfect / ${goodSteps} good / ${missedSteps} miss (${stepPct}%)`, 384, 320);
    const survived = bandLegs.length - marchersKnockedDown;
    ctx.fillText(`Still Standing: ${survived} / ${bandLegs.length}`, 384, 360);
    // Footer
    ctx.fillStyle = "#aaaaaa";
    ctx.font = "28px Arial";
    ctx.fillText("Reload to play again", 384, 470);
    resultsTex.update();
}

let osmdContainer: HTMLDivElement | null = null;
let osmd: OpenSheetMusicDisplay | null = null;
let measureCount = 0;
let nextMeasureToGenerate = 1;
let isGenerating = false;

async function initSheetMusic() {
    osmdContainer = document.createElement("div");
    osmdContainer.style.width = "4000px";
    osmdContainer.style.position = "absolute";
    osmdContainer.style.top = "-9999px";
    document.body.appendChild(osmdContainer);

    osmd = new OpenSheetMusicDisplay(osmdContainer, {
        backend: "canvas",
        drawTitle: false,
        drawSubtitle: false,
        drawComposer: false,
        drawLyricist: false,
        drawCredits: false,
        drawPartNames: false,
        drawFromMeasureNumber: 1,
        drawUpToMeasureNumber: 1
    });

    try {
        await osmd.load(selectedScoreFile);

        // Only show the 1st instrument (Trumpet 1) part
        if (osmd.Sheet && osmd.Sheet.Instruments) {
            osmd.Sheet.Instruments.forEach((instrument, index) => {
                instrument.Visible = (index === 0);
            });
        }

        measureCount = osmd.Sheet?.SourceMeasures.length || 10;
        totalSongDuration = measureCount * WHOLE_NOTE_DURATION;
        console.log(`Found ${measureCount} measures (${totalSongDuration.toFixed(1)}s). Starting dynamic generation...`);
        checkAndGenerateMeasures();
    } catch (err) {
        console.error("Failed to load and render Music XML:", err);
    }
}

async function generateSingleMeasure(i: number) {
    if (!osmd || !osmdContainer || !osmd.Sheet) return;

    // Set OSMD to only render this specific measure
    osmd.setOptions({
        drawFromMeasureNumber: i,
        drawUpToMeasureNumber: i
    });
    osmd.render();
    
    // Get the resulting canvas created by OSMD
    const generatedCanvas = osmdContainer.querySelector('canvas') as HTMLCanvasElement;
    if (!generatedCanvas) return;

    const tmpCtx = generatedCanvas.getContext("2d", { willReadFrequently: true });
    let minX = generatedCanvas.width, minY = generatedCanvas.height, maxX = 0, maxY = 0;
    if (tmpCtx) {
        const imgData = tmpCtx.getImageData(0, 0, generatedCanvas.width, generatedCanvas.height);
        const data = imgData.data;
        for (let y = 0; y < generatedCanvas.height; y++) {
            for (let x = 0; x < generatedCanvas.width; x++) {
                const idx = (y * generatedCanvas.width + x) * 4;
                if (data[idx + 3] > 0 && (data[idx] < 250 || data[idx+1] < 250 || data[idx+2] < 250)) {
                    if (x < minX) minX = x;
                    if (x > maxX) maxX = x;
                    if (y < minY) minY = y;
                    if (y > maxY) maxY = y;
                }
            }
        }
    }

    // Defaults if canvas was blank
    if (maxX < minX || maxY < minY) {
        minX = 0; minY = 0; maxX = generatedCanvas.width; maxY = generatedCanvas.height;
    }

    const padding = 20;
    minX = Math.max(0, minX - padding);
    minY = Math.max(0, minY - padding);
    maxX = Math.min(generatedCanvas.width, maxX + padding);
    maxY = Math.min(generatedCanvas.height, maxY + padding);
    
    const cropWidth = Math.max(1, maxX - minX);
    const cropHeight = Math.max(1, maxY - minY);

    const dynamicTexture = new DynamicTexture(`texture_m${i}`, { width: cropWidth, height: cropHeight }, scene, true, Texture.TRILINEAR_SAMPLINGMODE);
    
    const context = dynamicTexture.getContext() as CanvasRenderingContext2D;
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.fillStyle = "white"; // Add a white background for the score
    context.fillRect(0, 0, cropWidth, cropHeight);
    context.drawImage(generatedCanvas, minX, minY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
    dynamicTexture.update(true);

    // Calculate height proportional to width
    const boxHeight = 4 * (cropHeight / cropWidth);
    
    // Extract note fractions for exact temporal and visual alignment
    const sourceMeasure = osmd.Sheet.SourceMeasures[i - 1];
    
    // Always use the first container's timestamp as the true zero-point for this measure
    let firstT = 0;
    if (sourceMeasure.VerticalSourceStaffEntryContainers.length > 0 && sourceMeasure.VerticalSourceStaffEntryContainers[0].Timestamp) {
        firstT = sourceMeasure.VerticalSourceStaffEntryContainers[0].Timestamp.RealValue;
    }
    const measureDuration = sourceMeasure.Duration ? sourceMeasure.Duration.RealValue : 1;
    
    const fractionsSet = new Set<number>();
    sourceMeasure.VerticalSourceStaffEntryContainers.forEach(container => {
        let isTrumpet = false;
        container.StaffEntries.forEach(entry => {
            if (entry.ParentStaff.ParentInstrument.Id === osmd!.Sheet!.Instruments[0].Id) {
                // Ensure it's not just a rest placeholder if possible
                let isRest = false;
                if (entry.VoiceEntries.length > 0 && entry.VoiceEntries[0].Notes.length > 0) {
                    isRest = entry.VoiceEntries[0].Notes[0].isRest();
                }
                if (!isRest) isTrumpet = true;
            }
        });
        if (isTrumpet && container.Timestamp) {
            let frac = (container.Timestamp.RealValue - firstT) / measureDuration;
            if (frac < 0) frac = 0;
            if (frac > 1) frac = 1;
            fractionsSet.add(frac);
        }
    });
    
    let noteFractions = Array.from(fractionsSet).sort((a, b) => a - b);
    if (noteFractions.length === 0) noteFractions = [0, 1];
    else {
        if (noteFractions[0] > 0.05) noteFractions.unshift(0);
        if (noteFractions[noteFractions.length - 1] < 0.95) noteFractions.push(1);
    }

    // Create the block mesh
    const box = MeshBuilder.CreateBox(`measure_${i}`, {
        width: 4,
        height: boxHeight,
        depth: 0.2
    }, scene);
    
    // Create a predictable alternating spread from high up for a curving Guitar Hero style track
    const laneIndex = (i % 5) - 2; // Returns -2, -1, 0, 1, 2 sequentially
    const startX = laneIndex * 20; // Spread extremely wide horizontally: -40, -20, 0, 20, 40
    const startY = 25; // Start high up so they drop down a curved track

    // Start the box far away
    box.position = new Vector3(startX, startY, 150);
    box.isVisible = false; // Hide until it enters the game area

    gameBlocks.push({
        mesh: box,
        arrivalTime: (i + 1) * WHOLE_NOTE_DURATION, // i is 1-indexed. Delay by 2 measures for a smooth fly-in
        startX: startX,
        startY: startY,
        boxHeight: boxHeight,
        noteFractions: noteFractions,
        firstT: firstT
    });

    // Apply material
    const material = new StandardMaterial(`mat_m${i}`, scene);
    material.diffuseTexture = dynamicTexture;
    
    // To prevent blank textures from negative UV scales clamping, we keep scale positive
    // and instead correctly rotate the 3D block to present the texture correctly to the camera
    box.rotation.z = Math.PI; // Flip upright
    box.rotation.y = Math.PI; // Flip horizontally (fixes mirroring)
    
    material.diffuseTexture.hasAlpha = true;
    material.emissiveColor = new Color3(1, 1, 1); 
    material.disableLighting = true; // So it looks like clear sheet music
    
    box.material = material;
    measureBlocks.push(box);
}

async function checkAndGenerateMeasures() {
    if (isGenerating || nextMeasureToGenerate > measureCount) return;
    
    let currentMeasureIndex = 0;
    if (gameStartTime !== null) {
        const currentTime = Tone.now() - gameStartTime;
        currentMeasureIndex = Math.floor(currentTime / WHOLE_NOTE_DURATION);
    }

    // Keep up to 30 measures ahead queued up
    if (nextMeasureToGenerate <= currentMeasureIndex + 30) {
        isGenerating = true;
        try {
            await generateSingleMeasure(nextMeasureToGenerate);
            nextMeasureToGenerate++;
            // Yield a tiny bit to avoid blocking the main thread
            await new Promise(resolve => setTimeout(resolve, 10));
        } catch(e) { 
            console.error(e); 
        } finally {
            isGenerating = false;
        }
        
        // Immediately check if we need to generate more
        checkAndGenerateMeasures();
    }
}

// Sheet music will be loaded when the game starts (after song selection)
// initSheetMusic() is called from the start button handler

engine.runRenderLoop(() => {
    // Prevent the actively driven camera from clipping under the ground plane or crouching too low
    if (scene.activeCamera && scene.activeCamera.globalPosition.y < 1.5) {
        scene.activeCamera.position.y = 1.5; // Always bounce them back up to a standing height
    }

    // Marching Band Animation
    const currentRenderTime = gameStartTime !== null ? Tone.now() - gameStartTime : performance.now() / 1000;
    const secondsPerBeat = 60 / BPM;
    // Calculate a phase angle where one full stride occurs every 2 beats
    const marchPhase = (currentRenderTime * Math.PI * 2) / (secondsPerBeat * 2);
    const currentBeat = currentRenderTime * (BPM / 60);

    // Animate the beat indicator - flash bright on each beat, then fade
    if (gameStartTime !== null && beatIndicator.isVisible) {
        const beatFrac = currentBeat % 1.0;
        const flashIntensity = Math.max(0, 1.0 - beatFrac * 4.0); // fast fade-out
        beatMat.emissiveColor = new Color3(flashIntensity, flashIntensity * 0.8, 0);
        beatIndicator.scaling.setAll(0.5 + flashIntensity * 0.5);
    }

    if (gameStartTime !== null) {
        // Pre-calculate positions and apply collision avoidance
        const drillPositions = bandLegs.map(member => {
            return getDrillPosition(currentBeat, member.row, member.col, 5, 15, member.startX, member.startZ);
        });

        // Player position is controlled by firstPersonBody input, not drill position
        // Update player body position based on camera
        playerBody.setBodyPosition(new Vector3(camera.position.x, 0, camera.position.z));

        bandLegs.forEach(({ legL, legR, anchor }, index) => {
            const st = stumbleStates[index];
            const isStumbling = st.tilt > 0.3 || st.downTimer > 0;

            const targetPos = drillPositions[index];
            const targetX = targetPos.x;
            const targetZ = targetPos.z - (currentRenderTime * FLY_SPEED);

            if (isStumbling) {
                // Fallen/stumbling: stop legs, freeze in place
                legL.rotation.x = 0;
                legR.rotation.x = 0;
            } else {
                // Normal marching legs
                legL.rotation.x = Math.sin(marchPhase) * 0.6;
                legR.rotation.x = -Math.sin(marchPhase) * 0.6;

                // Calculate avoidance of fallen marchers
                let avoidanceX = 0;
                let avoidanceZ = 0;
                const avoidanceRadius = 1.5; // Look ahead for fallen marchers
                const avoidanceRadius2 = avoidanceRadius * avoidanceRadius;
                
                for (let j = 0; j < bandLegs.length; j++) {
                    if (j === index) continue;
                    const st = stumbleStates[j];
                    if (st.tilt < MAX_TILT * 0.8) continue; // Only avoid significantly fallen marchers
                    
                    const otherAnchor = bandLegs[j].anchor;
                    const odx = otherAnchor.position.x - anchor.position.x;
                    const odz = otherAnchor.position.z - anchor.position.z;
                    const distSq = odx * odx + odz * odz;
                    
                    if (distSq < avoidanceRadius2 && distSq > 0.01) {
                        // Push away from fallen marcher
                        const dist = Math.sqrt(distSq);
                        const pushForce = (1 - dist / avoidanceRadius) * 0.5;
                        avoidanceX -= (odx / dist) * pushForce;
                        avoidanceZ -= (odz / dist) * pushForce;
                    }
                }

                // Smooth movement toward drill position with avoidance
                const dx = targetX - anchor.position.x;
                const dz = targetZ - anchor.position.z;
                const gap = Math.sqrt(dx * dx + dz * dz);

                // Constant smooth lerp: always move toward target
                // Base lerp rate with hustle boost for catch-up
                const baseRate = 0.04; // smooth base rate (down from 0.05)
                const hustleFactor = gap > 0.05 ? Math.min(2.5, 1.0 + gap * 0.3) : 1.0;
                const lerpRate = Math.min(0.2, baseRate * hustleFactor);
                
                // Apply movement with avoidance integrated
                anchor.position.x += dx * lerpRate + avoidanceX;
                anchor.position.z += dz * lerpRate + avoidanceZ;

                // Faster leg swing when hustling
                if (gap > 0.1) {
                    const hustleSwing = Math.min(1.0, gap * 0.2) * 0.3;
                    legL.rotation.x = Math.sin(marchPhase * hustleFactor) * (0.6 + hustleSwing);
                    legR.rotation.x = -Math.sin(marchPhase * hustleFactor) * (0.6 + hustleSwing);
                }
            }

            // Face direction of movement / drill target
            const dx = targetX - anchor.position.x;
            const dz = targetZ - anchor.position.z;

            if (Math.abs(dx) > 0.05 || Math.abs(dz) > 0.05) {
                const lateralAngle = Math.atan2(dx, dz);
                const targetRotationY = Math.PI - lateralAngle;

                if (Math.abs(dx) < 0.1) {
                    anchor.rotation.y = Math.PI;
                } else {
                    anchor.rotation.y += (targetRotationY - anchor.rotation.y) * 0.1;
                }
            } else if (!isStumbling) {
                anchor.rotation.y = Math.PI;
            }

            // Update ground shadow to follow marcher
            const shadow = shadowDiscs[index];
            if (shadow) {
                shadow.position.x = anchor.position.x;
                shadow.position.z = anchor.position.z;
            }
        });

        // === FOOTSTEP MARKER POSITIONING ===
        const baseBeat = Math.floor(currentBeat);
        const dt = engine.getDeltaTime() / 1000;
        for (let i = 0; i < STEP_LOOK_AHEAD; i++) {
            const marker = stepMarkers[i];
            const targetBeat = baseBeat + i + 1;
            marker.beatNum = targetBeat;

            const drill = getDrillPosition(targetBeat, playerRow, playerCol,
                BAND_COLS, BAND_ROWS, playerStartX, playerStartZ);
            const beatTimeSec = targetBeat * secondsPerBeat;
            const isLeftFoot = targetBeat % 2 === 0;
            const footX = drill.x + (isLeftFoot ? -FOOT_LATERAL : FOOT_LATERAL);
            const footZ = drill.z - beatTimeSec * FLY_SPEED;

            marker.mesh.position.x = footX;
            marker.mesh.position.z = footZ;
            marker.mesh.isVisible = true;

            // Flash countdown (from hit/miss feedback)
            if (marker.flashTimer > 0) {
                marker.flashTimer -= dt;
            } else {
                // Color: left = blue, right = orange; brightness by proximity in time
                const beatsAhead = targetBeat - currentBeat;
                const nearness = Math.max(0, 1 - beatsAhead / STEP_LOOK_AHEAD);
                if (isLeftFoot) {
                    marker.mat.emissiveColor.set(0.1 + 0.2 * nearness, 0.3 + 0.4 * nearness, 0.7 + 0.3 * nearness);
                } else {
                    marker.mat.emissiveColor.set(0.7 + 0.3 * nearness, 0.3 + 0.2 * nearness, 0.1 + 0.1 * nearness);
                }
                marker.mat.alpha = 0.25 + 0.55 * nearness;
            }
        }

        // === FOOTSTEP SCORING (on each new beat) ===
        const thisBeat = Math.floor(currentBeat);
        if (thisBeat > lastScoredBeat && lastScoredBeat >= 0) {
            const drill = getDrillPosition(thisBeat, PLAYER_DRILL_ROW, PLAYER_DRILL_COL,
                5, 15, PLAYER_START_X, PLAYER_START_Z);
            const beatTimeSec2 = thisBeat * secondsPerBeat;
            const tgtX = drill.x;
            const tgtZ = drill.z - beatTimeSec2 * FLY_SPEED;

            const pPos = scene.activeCamera!.globalPosition;
            const ddx = pPos.x - tgtX;
            const ddz = pPos.z - tgtZ;
            const dist = Math.sqrt(ddx * ddx + ddz * ddz);

            const hitMarker = stepMarkers.find(m => m.beatNum === thisBeat);
            totalStepsScored++;

            if (dist < STEP_HIT_PERFECT) {
                perfectSteps++;
                stepStreak++;
                formationQuality = Math.min(100, formationQuality + 0.8);
                if (hitMarker) { hitMarker.mat.emissiveColor.set(0, 1, 0); hitMarker.flashTimer = 0.3; }
            } else if (dist < STEP_HIT_GOOD) {
                goodSteps++;
                stepStreak++;
                formationQuality = Math.min(100, formationQuality + 0.2);
                if (hitMarker) { hitMarker.mat.emissiveColor.set(1, 1, 0); hitMarker.flashTimer = 0.3; }
            } else {
                missedSteps++;
                stepStreak = 0;
                formationQuality = Math.max(0, formationQuality - 0.3);
                if (hitMarker) { hitMarker.mat.emissiveColor.set(1, 0, 0); hitMarker.flashTimer = 0.3; }
            }
        }
        lastScoredBeat = thisBeat;

    } else {
        bandLegs.forEach(({ legL, legR }) => {
            // Swing legs back and forth like pendulums
            legL.rotation.x = Math.sin(marchPhase) * 0.6;
            legR.rotation.x = -Math.sin(marchPhase) * 0.6;
        });
    }

    // --- Player-to-marcher collision: stumble / fall ---
    let obstaclePushX = 0;
    let obstaclePushZ = 0;
    let playerIsDown = false; // Track if player is stumbling/falling
    
    if (scene.activeCamera) {
        const playerPos = scene.activeCamera.globalPosition;
        const frameDt = engine.getDeltaTime() / 1000;
        const BROAD_RADIUS = 5.0;
        const broadRadiusSq = BROAD_RADIUS * BROAD_RADIUS;

        // Get player's stumble state to check if they're down
        const playerStumbleState = stumbleStates[playerMarcherIndex];
        playerIsDown = playerStumbleState.tilt >= MAX_TILT * 0.8; // down when significantly tilted

        bandLegs.forEach(({ anchor }, index) => {
            const st = stumbleStates[index];
            const isDown = st.tilt >= MAX_TILT * 0.95;

            // Skip collision checks when player is stumbling/falling
            if (playerIsDown && index !== playerMarcherIndex) {
                return;
            }

            // Broad-phase: skip marchers far from player
            const bx = playerPos.x - anchor.position.x;
            const bz = playerPos.z - anchor.position.z;
            const bDistSq = bx * bx + bz * bz;
            if (bDistSq > broadRadiusSq) {
                // Tick down timer and recover if far away
                if (st.downTimer > 0) {
                    st.downTimer = Math.max(0, st.downTimer - frameDt);
                } else if (st.tilt > 0) {
                    st.recovering = true;
                    st.tilt = Math.max(0, st.tilt - STUMBLE_RECOVERY * frameDt);
                }
                if (st.tilt <= 0.001) {
                    anchor.rotation.x = 0;
                    anchor.rotation.z = 0;
                }
                return;
            }

            // Fallen marcher acts as obstacle: push player away
            if (isDown && st.downTimer > 0) {
                const obstDistSq = bx * bx + bz * bz;
                if (obstDistSq < OBSTACLE_RADIUS * OBSTACLE_RADIUS && obstDistSq > 0.001) {
                    const obstDist = Math.sqrt(obstDistSq);
                    const pushStrength = (1 - obstDist / OBSTACLE_RADIUS) * OBSTACLE_PUSH * frameDt;
                    obstaclePushX += (bx / obstDist) * pushStrength;
                    obstaclePushZ += (bz / obstDist) * pushStrength;
                }
            }

            // Narrow-phase: find closest body part to this marcher
            const bodyParts = playerBody.getBodyPartPositions();
            const ax = anchor.position.x;
            const az = anchor.position.z;
            let closestDistSq = Infinity;
            let closestDx = 0;
            let closestDz = 0;
            for (const partPos of bodyParts) {
                const dx = partPos.x - ax;
                const dz = partPos.z - az;
                const dSq = dx * dx + dz * dz;
                if (dSq < closestDistSq) {
                    closestDistSq = dSq;
                    closestDx = dx;
                    closestDz = dz;
                }
            }

            if (closestDistSq < COLLISION_RADIUS * COLLISION_RADIUS && closestDistSq > 0.001) {
                const dist = Math.sqrt(closestDistSq);
                st.tiltDirX = -closestDx / dist;
                st.tiltDirZ = -closestDz / dist;

                const overlap = 1 - dist / COLLISION_RADIUS;
                const impact = overlap * 3.0;
                st.tilt = Math.min(MAX_TILT, st.tilt + impact * frameDt * 8);
                st.recovering = false;
                st.downTimer = 0; // reset while still being hit

                // Out-of-tune sound on first stumble contact
                if (!st.playedStumble && st.tilt > 0.3) {
                    st.playedStumble = true;
                    const row = bandLegs[index].row;
                    playStumbleSound(row);
                    formationQuality = Math.max(0, formationQuality - 2); // stumble penalty
                    playerBody.pulseHaptics(0.4, 100); // light haptic bump
                }

                // Crash sound when fully fallen
                if (st.tilt >= MAX_TILT * 0.95) {
                    st.downTimer = DOWN_DURATION;
                    if (!st.playedFall) {
                        st.playedFall = true;
                        playCrashSound(bandLegs[index].row);
                        formationQuality = Math.max(0, formationQuality - 5); // fall penalty
                        marchersKnockedDown++;
                        emitDustBurst(anchor.position);
                        playerBody.pulseHaptics(0.8, 200); // strong haptic crash
                        scatterHat(anchor, st.tiltDirX, st.tiltDirZ);
                    }
                }
            } else if (st.downTimer > 0) {
                // Stay on the ground, count down
                st.downTimer = Math.max(0, st.downTimer - frameDt);
            } else if (st.tilt > 0) {
                st.recovering = true;
                st.tilt = Math.max(0, st.tilt - STUMBLE_RECOVERY * frameDt);
                if (st.tilt <= 0.001) {
                    // Fully recovered — allow sounds to play again on next collision
                    st.playedStumble = false;
                    st.playedFall = false;
                }
            }

            if (st.tilt > 0.001) {
                anchor.rotation.x = st.tilt * st.tiltDirZ;
                anchor.rotation.z = -st.tilt * st.tiltDirX;
            } else {
                anchor.rotation.x = 0;
                anchor.rotation.z = 0;
            }
        });

        // Marcher-to-marcher domino collisions via spatial grid (O(n) instead of O(n²))
        const MARCHER_COL_SQ = MARCHER_COLLISION_RADIUS * MARCHER_COLLISION_RADIUS;
        const GRID_CELL = 2.0; // cell size >= MARCHER_COLLISION_RADIUS
        const INV_CELL = 1 / GRID_CELL;
        const grid = new Map<number, number[]>();

        // Build grid — hash each marcher into a cell
        for (let j = 0; j < bandLegs.length; j++) {
            const p = bandLegs[j].anchor.position;
            const cx = (p.x * INV_CELL) | 0;
            const cz = (p.z * INV_CELL) | 0;
            const key = cx * 73856093 + cz * 19349663; // spatial hash
            const bucket = grid.get(key);
            if (bucket) bucket.push(j); else grid.set(key, [j]);
        }

        // Only check stumbling/fallen marchers against their neighboring cells
        for (let i = 0; i < bandLegs.length; i++) {
            const si = stumbleStates[i];
            if (si.tilt < 0.4 && si.downTimer <= 0) continue;

            const ai = bandLegs[i].anchor.position;
            const cx = (ai.x * INV_CELL) | 0;
            const cz = (ai.z * INV_CELL) | 0;

            // Check 3×3 neighborhood
            for (let ox = -1; ox <= 1; ox++) {
                for (let oz = -1; oz <= 1; oz++) {
                    const key = (cx + ox) * 73856093 + (cz + oz) * 19349663;
                    const bucket = grid.get(key);
                    if (!bucket) continue;

                    for (const j of bucket) {
                        if (i === j) continue;
                        const sj = stumbleStates[j];
                        if (sj.tilt > 0.3 || sj.downTimer > 0) continue;

                        const aj = bandLegs[j].anchor.position;
                        const dx = aj.x - ai.x;
                        const dz = aj.z - ai.z;
                        const distSq = dx * dx + dz * dz;
                        if (distSq >= MARCHER_COL_SQ || distSq < 0.001) continue;

                        const dist = Math.sqrt(distSq);
                        const overlap = 1 - dist / MARCHER_COLLISION_RADIUS;
                        const transferFactor = (si.tilt / MAX_TILT) * overlap * 1.5;
                        sj.tilt = Math.min(MAX_TILT, sj.tilt + transferFactor * frameDt * 6);
                        sj.tiltDirX = dx / dist;
                        sj.tiltDirZ = dz / dist;
                        sj.recovering = false;

                        if (!sj.playedStumble && sj.tilt > 0.3) {
                            sj.playedStumble = true;
                            playStumbleSound(bandLegs[j].row);
                            formationQuality = Math.max(0, formationQuality - 2);
                        }
                        if (sj.tilt >= MAX_TILT * 0.95) {
                            sj.downTimer = DOWN_DURATION;
                            if (!sj.playedFall) {
                                sj.playedFall = true;
                                playCrashSound(bandLegs[j].row);
                                formationQuality = Math.max(0, formationQuality - 5);
                                marchersKnockedDown++;
                                emitDustBurst(bandLegs[j].anchor.position);
                                scatterHat(bandLegs[j].anchor, sj.tiltDirX, sj.tiltDirZ);
                            }
                        }
                    }
                }
            }
        }
    }

    // Formation bonus: player marching with the band near a drill slot earns points
    // Slowly recover formation quality when nobody is stumbling (0.5% per second)
    if (gameStartTime !== null) {
        const fDt = engine.getDeltaTime() / 1000;
        const anyStumbling = stumbleStates.some(s => s.tilt > 0.1 || s.downTimer > 0);
        if (!anyStumbling) {
            formationQuality = Math.min(100, formationQuality + 0.5 * fDt);
        }

        // Award formation bonus: if player is within 2m of any open drill slot
        // and roughly moving with the band, grant +1%/s
        if (scene.activeCamera) {
            const pp = scene.activeCamera.globalPosition;
            let nearSlot = false;
            for (let m = 0; m < bandLegs.length; m++) {
                const a = bandLegs[m].anchor.position;
                const dx = pp.x - a.x;
                const dz = pp.z - a.z;
                if (dx * dx + dz * dz < 4) { // within 2m
                    nearSlot = true;
                    break;
                }
            }
            if (nearSlot) {
                formationQuality = Math.min(100, formationQuality + 1.0 * fDt);
            }
        }
        updateScoreHUD();

        // Check if the song has ended
        if (totalSongDuration > 0 && !gameOver) {
            const elapsed = Tone.now() - gameStartTime;
            // Song end: all scheduled measures played + 2-beat grace period
            if (elapsed > totalSongDuration + 2 * WHOLE_NOTE_DURATION + 2) {
                showResults();
            }
        }
    }

    // Update scattered hats (physics simulation)
    if (scatteredHats.length > 0) {
        updateScatteredHats(engine.getDeltaTime() / 1000);
    }

    // Sync Web Audio API listener to camera for correct spatial orientation
    if (scene.activeCamera) {
        const camPos = scene.activeCamera.globalPosition;
        const camFwd = scene.activeCamera.getDirection(Vector3.Forward());
        updateAudioListener(camPos, camFwd);
    }

    // Update spatial audio panners — weighted centroid of nearby marchers per instrument group
    // Also count stumbling/down members per group for dynamic volume dropout
    if (scene.activeCamera && sfPanners.size > 0) {
        const listenerPos = scene.activeCamera.globalPosition;
        updateSpatialAudio(listenerPos, bandLegs, stumbleStates);
    }

    // Update player body with march animation and treadmill locomotion
    if (scene.activeCamera) {
        const dt = engine.getDeltaTime() / 1000;
        const { movement, turnY } = playerBody.update(scene.activeCamera, marchPhase, gameStartTime !== null, dt);
        // Apply treadmill locomotion to camera position and rotation
        if (movement.lengthSquared() > 0) {
            scene.activeCamera.position.addInPlace(movement);
        }
        // Push player away from fallen obstacle marchers (only if player is not stumbling)
        if (!playerIsDown && (Math.abs(obstaclePushX) > 0.001 || Math.abs(obstaclePushZ) > 0.001)) {
            scene.activeCamera.position.x += obstaclePushX;
            scene.activeCamera.position.z += obstaclePushZ;
        }
        if (Math.abs(turnY) > 0.0001 && "rotation" in scene.activeCamera) {
            (scene.activeCamera as any).rotation.y += turnY;
        }
    }

    // Continuously poll to ensure the queue processes upcoming measures during gameplay
    checkAndGenerateMeasures();

    if (gameStartTime !== null) {
        const currentTime = Tone.now() - gameStartTime;
        
        gameBlocks.forEach(block => {
            // How long until it's supposed to arrive at Z=0?
            const timeUntilArrival = block.arrivalTime - currentTime;
            
            // Calculate current Z so that it arrives slightly in front of the camera (Z = 3) at timeUntilArrival = 0
            const arrivalZ = 3;
            const currentZ = arrivalZ + (timeUntilArrival * FLY_SPEED);

            // Interpolate X and Y to converge to a hit-zone that is lower and wider, so you can see over/around it
            // Assume the block originated from Z = 150
            const totalDistanceZ = 150 - arrivalZ;
            const distanceFraction = (currentZ - arrivalZ) / totalDistanceZ;
            
            // Use distanceFraction squared for Y to create a curved Guitar Hero style waterfall path
            // If it passes the player (distanceFraction < 0), let it continue down smoothly
            const curveY = distanceFraction > 0 ? Math.pow(distanceFraction, 2) : distanceFraction;

            // Arrive exactly at eye-level and keep a bit of X-spread so measures form visible lanes instead of a single overlapping stack
            const arrivalX = block.startX * 0.15; // 0.15 * 40 = 6 spread to either side
            const arrivalY = scene.activeCamera ? scene.activeCamera.globalPosition.y : 1.6;  

            block.mesh.position.x = arrivalX + (block.startX - arrivalX) * distanceFraction;
            block.mesh.position.y = arrivalY + (block.startY - arrivalY) * curveY;
            block.mesh.position.z = currentZ;
            
            // Tilt blocks backwards like a music stand as they arrive, and more drastically when far away
            block.mesh.rotation.x = (Math.PI / 8) + (Math.PI / 4) * distanceFraction;

            // Show it when it's coming from the horizon, vanish it after its duration has fully passed
            // FLYING MUSIC HIDDEN
            block.mesh.isVisible = false;
        });
    }

    scene.render();
});

window.addEventListener("resize", () => {
    engine.resize();
});
