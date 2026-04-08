import { BandMemberFactory, InstrumentType, BandMemberData } from "./bandMemberFactory";
import { FirstPersonBody } from "./firstPersonBody";
import { Engine, Scene, FreeCamera, Vector3, HemisphericLight, MeshBuilder, StandardMaterial, DynamicTexture, Color3, Texture, CubeTexture, PointerEventTypes, ParticleSystem, Color4, AbstractMesh } from "@babylonjs/core";
import "@babylonjs/loaders/glTF";
import { OpenSheetMusicDisplay } from "opensheetmusicdisplay";
import * as Tone from "tone";
import { Soundfont } from "smplr";

// Real sampled instrument voices via General MIDI SoundFont
// Index: 0=trumpet, 1=trumpet2, 2=french_horn, 3=trombone, 4=tuba, 5=flute, 6=clarinet, 7=alto_sax, 8=glockenspiel
const GM_INSTRUMENT_NAMES = ["trumpet", "trumpet", "french_horn", "trombone", "tuba", "flute", "clarinet", "alto_sax", "glockenspiel"];
const GM_INSTRUMENT_VOLUMES = [100, 90, 85, 95, 100, 80, 85, 85, 75]; // MIDI velocity 0-127
const sfInstruments: Map<number, Soundfont> = new Map();
const sfPanners: Map<number, PannerNode> = new Map();
const SPATIAL_RADIUS = 20; // only consider marchers within 20m
const SPATIAL_RADIUS_SQ = SPATIAL_RADIUS * SPATIAL_RADIUS;

let metronomeSynth: Tone.MembraneSynth | null = null;
function getMetronomeSynth() {
    if (!metronomeSynth) {
        metronomeSynth = new Tone.MembraneSynth({
            pitchDecay: 0.01,
            octaves: 2,
            envelope: { attack: 0.001, decay: 0.1, sustain: 0, release: 0.1 }
        }).toDestination();
        metronomeSynth.volume.value = -10;
    }
    return metronomeSynth;
}

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

// Stumble state per band member: tilt angle (radians) and tilt direction (x,z)
interface StumbleState {
    tilt: number;       // current tilt angle in radians (0 = upright, ~π/2 = fallen)
    tiltDirX: number;   // world-space push direction X
    tiltDirZ: number;   // world-space push direction Z
    recovering: boolean;
    downTimer: number;  // seconds remaining on the ground before recovery starts
    playedStumble: boolean;  // already played stumble sound this collision
    playedFall: boolean;     // already played crash sound this fall
}
const stumbleStates: StumbleState[] = [];
const COLLISION_RADIUS = 1.0;   // metres – how close player must be to collide
const STUMBLE_RECOVERY = 0.5;   // rad/s – how fast members stand back up (slower)
const MAX_TILT = Math.PI / 2;   // fully fallen over
const DOWN_DURATION = 4.0;      // seconds a fully-fallen marcher stays down
const OBSTACLE_RADIUS = 1.2;    // metres – fallen marcher blocks the player
const OBSTACLE_PUSH = 3.0;      // m/s push-back strength
const MARCHER_COLLISION_RADIUS = 1.5; // metres – stumbling/fallen marcher knocks neighbors

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

// Map marcher row to sfInstruments index (null = no melodic instrument)
const ROW_TO_SF_INDEX: (number | null)[] = [
    null, // 0  DrumMajor
    5,    // 1  Flute       → flute
    6,    // 2  Clarinet    → clarinet
    7,    // 3  Saxophone   → alto_sax
    2,    // 4  Mellophone  → french_horn
    0,    // 5  Trumpet     → trumpet
    1,    // 6  Trumpet     → trumpet2
    3,    // 7  Trombone    → trombone
    3,    // 8  Euphonium   → trombone
    4,    // 9  Sousaphone  → tuba
    8,    // 10 Glockenspiel→ glockenspiel
    null, // 11 SnareDrum
    null, // 12 TomTom
    null, // 13 BassDrum
    null, // 14 Cymbals
];

// Crash/noise synth for falling
let crashSynth: Tone.NoiseSynth | null = null;
function getCrashSynth() {
    if (!crashSynth) {
        crashSynth = new Tone.NoiseSynth({
            noise: { type: "white" },
            envelope: { attack: 0.01, decay: 0.4, sustain: 0, release: 0.1 },
            volume: -12,
        }).toDestination();
    }
    return crashSynth;
}

function playStumbleSound(row: number) {
    const sfIdx = ROW_TO_SF_INDEX[row];
    if (sfIdx == null) {
        // Percussion rows: play crash synth instead
        getCrashSynth().triggerAttackRelease("16n");
        return;
    }
    const sf = sfInstruments.get(sfIdx);
    if (!sf) return;
    // Out-of-tune: random detuned note near middle range
    // Higher instruments get higher base notes
    const baseNote = sfIdx === 4 ? 40 : sfIdx === 3 ? 48 : sfIdx === 5 ? 72 : sfIdx === 8 ? 76 : 60;
    const detune = Math.floor(Math.random() * 5) - 2; // -2 to +2 semitones off
    sf.start({ note: baseNote + detune, duration: 0.25 });
}

function playCrashSound(row: number) {
    const sfIdx = ROW_TO_SF_INDEX[row];
    if (sfIdx == null) {
        // Percussion: play big noise crash
        getCrashSynth().triggerAttackRelease("4n");
        return;
    }
    const sf = sfInstruments.get(sfIdx);
    if (!sf) return;
    
    // Crash: play a cluster of dissonant notes for that instrument
    const baseNote = sfIdx === 4 ? 40 : sfIdx === 3 ? 48 : sfIdx === 5 ? 72 : sfIdx === 8 ? 76 : 60;
    sf.start({ note: baseNote - 1, duration: 0.1 });
    sf.start({ note: baseNote + 1, duration: 0.1 });
    sf.start({ note: baseNote + 6, duration: 0.1 });
}

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
// Initialize stumble state for each band member
for (let i = 0; i < bandLegs.length; i++) {
    stumbleStates.push({ tilt: 0, tiltDirX: 0, tiltDirZ: 0, recovering: false, downTimer: 0, playedStumble: false, playedFall: false });
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
// Keep reference to blocks
const measureBlocks: any[] = [];
const gameBlocks: { mesh: any, arrivalTime: number, startX: number, startY: number, boxHeight: number, noteFractions: number[], firstT: number }[] = [];
let gameStartTime: number | null = null;
const BPM = 80;
const WHOLE_NOTE_DURATION = (60 / BPM) * 4;

// 8 steps per 5 yards: 5 yards = 5 * (109.7/120) meters = 4.5708m. 8 beats = 4.5708m.
// 1 beat = 4.5708 / 8 = 0.57135m. At BPM, speed = 0.57135 * (BPM / 60) m/s.
const FLY_SPEED = 0.57135 * (BPM / 60);

// Visual beat indicator - a glowing sphere that flashes on each beat
const beatIndicator = MeshBuilder.CreateSphere("beatIndicator", { diameter: 0.15 }, scene);
beatIndicator.position = new Vector3(0, 2.5, 3);
const beatMat = new StandardMaterial("beatMat", scene);
beatMat.emissiveColor = new Color3(1, 0.8, 0);
beatMat.disableLighting = true;
beatIndicator.material = beatMat;
beatIndicator.isVisible = false;

// Formation Quality HUD — wrist-mounted display on left arm
const scoreHUD = MeshBuilder.CreatePlane("scoreHUD", { width: 0.18, height: 0.06 }, scene);
scoreHUD.parent = playerBody.getLeftArm();
// Position on the inner forearm: offset slightly forward along arm (+Y = toward hand)
// and outward (+Z = face up/outward so you can glance down at it)
scoreHUD.position.set(0, -0.25, 0.08);
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
    const text = `${Math.round(formationQuality)}% ${grade}  KO:${marchersKnockedDown}`;
    if (text === lastScoreText) return; // avoid redrawing every frame
    lastScoreText = text;
    const ctx = scoreTex.getContext() as CanvasRenderingContext2D;
    ctx.clearRect(0, 0, 512, 128);
    ctx.fillStyle = "rgba(0,0,0,0.7)";
    ctx.roundRect(4, 4, 504, 120, 12);
    ctx.fill();
    const color = formationQuality >= 80 ? "#44ff44" : formationQuality >= 60 ? "#ffcc00" : "#ff4444";
    ctx.fillStyle = color;
    ctx.font = "bold 48px Arial";
    ctx.textAlign = "center";
    ctx.fillText(text, 256, 82);
    scoreTex.update();
}

// Song selection
const SONG_LIST = [
    { file: "assets/score.xml", title: "MacArthur Park", subtitle: "Brass Quintet" },
    { file: "assets/saints.xml", title: "When the Saints", subtitle: "Full Band" },
    { file: "assets/stars_and_stripes.xml", title: "Stars & Stripes", subtitle: "Full Band" },
    { file: "assets/battle_hymn.xml", title: "Battle Hymn", subtitle: "Full Band" },
];
let selectedScoreFile = SONG_LIST[0].file;

// Title text
const titleMesh = MeshBuilder.CreatePlane("titleMesh", { width: 3, height: 0.6 }, scene);
titleMesh.position = new Vector3(0, 2.6, 2);
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

const songTextures: DynamicTexture[] = [];
for (let i = 0; i < SONG_LIST.length; i++) {
    const btn = MeshBuilder.CreatePlane(`songBtn_${i}`, { width: 1.2, height: 0.5 }, scene);
    const xOffset = (i - (SONG_LIST.length - 1) / 2) * 1.4;
    btn.position = new Vector3(xOffset, 1.8, 2);
    const tex = new DynamicTexture(`songTex_${i}`, { width: 512, height: 256 }, scene, false);
    tex.hasAlpha = true;
    drawSongBtn(tex, SONG_LIST[i].title, SONG_LIST[i].subtitle, i === 0);
    songTextures.push(tex);
    const mat = new StandardMaterial(`songMat_${i}`, scene);
    mat.diffuseTexture = tex;
    mat.emissiveColor = new Color3(1, 1, 1);
    mat.backFaceCulling = false;
    btn.material = mat;
    songBtns.push(btn);
}

// 3D VR Start Button
const startBtnMesh = MeshBuilder.CreatePlane("startBtnMesh", { width: 2, height: 0.7 }, scene);
startBtnMesh.position = new Vector3(0, 1.1, 2);

const btnTex = new DynamicTexture("btnTex", { width: 512, height: 256 }, scene, false);
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
                drawSongBtn(songTextures[j], SONG_LIST[j].title, SONG_LIST[j].subtitle, j === i);
            }
            return;
        }
    }

    if (picked === startBtnMesh && !gameStarting) {
        gameStarting = true;
            await Tone.start();
            // Load real sampled instruments via SoundFont, routing through spatial PannerNodes
            const rawCtx = Tone.getContext().rawContext as AudioContext;
            for (let i = 0; i < GM_INSTRUMENT_NAMES.length; i++) {
                // Create a PannerNode per instrument group for spatial positioning
                const panner = rawCtx.createPanner();
                panner.panningModel = "HRTF";
                panner.distanceModel = "inverse";
                panner.refDistance = 2;
                panner.maxDistance = 50;
                panner.rolloffFactor = 1;
                panner.coneOuterGain = 0.4;
                panner.connect(rawCtx.destination);
                sfPanners.set(i, panner);

                const sf = new Soundfont(rawCtx, {
                    instrument: GM_INSTRUMENT_NAMES[i] as any,
                    destination: panner,
                });
                await sf.load;
                sf.output.setVolume(GM_INSTRUMENT_VOLUMES[i]);
                sfInstruments.set(i, sf);
            }
            getMetronomeSynth();

            // Load the selected song's sheet music
            await initSheetMusic();
        
            // Sync Tone.Transport to our 80 BPM and start a repeating metronome click
            Tone.Transport.bpm.value = BPM;
            Tone.Transport.scheduleRepeat((time) => {
                getMetronomeSynth().triggerAttackRelease("C5", "32n", time);
            }, "4n");
        
            // Schedule ALL instrument parts onto the Transport timeline
            if (osmd && osmd.Sheet) {
                const instruments = osmd.Sheet.Instruments;
                osmd.Sheet.SourceMeasures.forEach((sourceMeasure, mIndex) => {
                    let measureFirstT = 0;
                    if (sourceMeasure.VerticalSourceStaffEntryContainers.length > 0 && sourceMeasure.VerticalSourceStaffEntryContainers[0].Timestamp) {
                        measureFirstT = sourceMeasure.VerticalSourceStaffEntryContainers[0].Timestamp.RealValue;
                    }

                    sourceMeasure.VerticalSourceStaffEntryContainers.forEach(container => {
                        if (!container.Timestamp) return;
                        const timeInMeasure = (container.Timestamp.RealValue - measureFirstT) * WHOLE_NOTE_DURATION;
                    
                        container.StaffEntries.forEach(entry => {
                            // Find which instrument index this entry belongs to
                            const instrIndex = instruments.findIndex(inst => inst.Id === entry.ParentStaff.ParentInstrument.Id);
                            if (instrIndex < 0) return;

                            const sf = sfInstruments.get(instrIndex);
                            entry.VoiceEntries.forEach(ve => {
                                ve.Notes.forEach(note => {
                                    if (note.halfTone) {
                                        // halfTone is the WRITTEN pitch as MIDI number.
                                        // PlaybackTranspose is the MusicXML <chromatic> value
                                        // (e.g. -2 for Bb instruments, -7 for Horn in F)
                                        const transpose = (instruments[instrIndex] as any).PlaybackTranspose || 0;
                                        const midiNote = note.halfTone + transpose;
                                        const duration = note.Length.RealValue * WHOLE_NOTE_DURATION;
                                        const scheduleTime = (mIndex * WHOLE_NOTE_DURATION) + timeInMeasure;
                                        Tone.Transport.schedule((time) => {
                                            sf?.start({ note: midiNote, time, duration });
                                        }, scheduleTime);
                                    }
                                });
                            });
                        });
                    });
                });
            }
    
            gameStartTime = Tone.now();
            beatIndicator.isVisible = true;
            scoreHUD.isVisible = true;
            formationQuality = 100;
            marchersKnockedDown = 0;
            updateScoreHUD();
            // Start the metronome and music specifically delayed by 2 whole notes
            Tone.Transport.start(gameStartTime + 2 * WHOLE_NOTE_DURATION);
            startBtnMesh.dispose();
            titleMesh.dispose();
            for (const btn of songBtns) btn.dispose();
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
    resultsMesh.isVisible = true;

    const grade = formationQuality >= 90 ? "A" : formationQuality >= 80 ? "B"
        : formationQuality >= 70 ? "C" : formationQuality >= 60 ? "D" : "F";
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
    ctx.fillText("PERFORMANCE REVIEW", 384, 70);
    // Grade
    const gradeColor = formationQuality >= 80 ? "#44ff44" : formationQuality >= 60 ? "#ffcc00" : "#ff4444";
    ctx.fillStyle = gradeColor;
    ctx.font = "bold 120px Arial";
    ctx.fillText(grade, 384, 210);
    // Stats
    ctx.fillStyle = "#ffffff";
    ctx.font = "36px Arial";
    ctx.fillText(`Formation: ${Math.round(formationQuality)}%`, 384, 290);
    ctx.fillText(`Marchers Down: ${marchersKnockedDown}`, 384, 340);
    const survived = bandLegs.length - marchersKnockedDown;
    ctx.fillText(`Still Standing: ${survived} / ${bandLegs.length}`, 384, 390);
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

                // Catch-up: lerp toward drill position
                // Distance to target determines hustle speed
                const dx = targetX - anchor.position.x;
                const dz = targetZ - anchor.position.z;
                const gap = Math.sqrt(dx * dx + dz * dz);

                if (gap > 0.05) {
                    // Hustle factor: farther behind = faster catch-up (up to 3x normal lerp)
                    const hustleFactor = Math.min(3.0, 1.0 + gap * 0.5);
                    const lerpRate = Math.min(1, 0.05 * hustleFactor);
                    anchor.position.x += dx * lerpRate;
                    anchor.position.z += dz * lerpRate;

                    // Faster leg swing when hustling
                    const hustleSwing = Math.min(1.0, gap * 0.3) * 0.4;
                    legL.rotation.x = Math.sin(marchPhase * hustleFactor) * (0.6 + hustleSwing);
                    legR.rotation.x = -Math.sin(marchPhase * hustleFactor) * (0.6 + hustleSwing);
                } else {
                    // Close enough: snap to position
                    anchor.position.x = targetX;
                    anchor.position.z = targetZ;
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
    if (scene.activeCamera) {
        const playerPos = scene.activeCamera.globalPosition;
        const frameDt = engine.getDeltaTime() / 1000;
        const BROAD_RADIUS = 5.0;
        const broadRadiusSq = BROAD_RADIUS * BROAD_RADIUS;

        bandLegs.forEach(({ anchor }, index) => {
            const st = stumbleStates[index];
            const isDown = st.tilt >= MAX_TILT * 0.95;

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
    if (scene.activeCamera && sfPanners.size > 0) {
        const rawCtx = Tone.getContext().rawContext as AudioContext;
        const listener = rawCtx.listener;
        const camPos = scene.activeCamera.globalPosition;
        const camFwd = scene.activeCamera.getDirection(Vector3.Forward());
        if (listener.positionX !== undefined) {
            listener.positionX.value = camPos.x;
            listener.positionY.value = camPos.y;
            listener.positionZ.value = camPos.z;
            listener.forwardX.value = camFwd.x;
            listener.forwardY.value = camFwd.y;
            listener.forwardZ.value = camFwd.z;
            listener.upX.value = 0;
            listener.upY.value = 1;
            listener.upZ.value = 0;
        }
    }

    // Update spatial audio panners — weighted centroid of nearby marchers per instrument group
    // Also count stumbling/down members per group for dynamic volume dropout
    if (scene.activeCamera && sfPanners.size > 0) {
        const listenerPos = scene.activeCamera.globalPosition;
        // Accumulate weighted position per instrument group index
        const groupSumX: number[] = new Array(GM_INSTRUMENT_NAMES.length).fill(0);
        const groupSumZ: number[] = new Array(GM_INSTRUMENT_NAMES.length).fill(0);
        const groupWeight: number[] = new Array(GM_INSTRUMENT_NAMES.length).fill(0);
        const groupTotal: number[] = new Array(GM_INSTRUMENT_NAMES.length).fill(0);
        const groupDown: number[] = new Array(GM_INSTRUMENT_NAMES.length).fill(0);

        for (let m = 0; m < bandLegs.length; m++) {
            const sfIdx = ROW_TO_SF_INDEX[bandLegs[m].row];
            if (sfIdx == null) continue;
            groupTotal[sfIdx]++;
            const st = stumbleStates[m];
            if (st.tilt > 0.3 || st.downTimer > 0) groupDown[sfIdx]++;

            const ax = bandLegs[m].anchor.position.x;
            const az = bandLegs[m].anchor.position.z;
            const dx = ax - listenerPos.x;
            const dz = az - listenerPos.z;
            const distSq = dx * dx + dz * dz;
            if (distSq > SPATIAL_RADIUS_SQ) continue;
            const w = 1 / (1 + distSq); // inverse-distance-squared weight
            groupSumX[sfIdx] += ax * w;
            groupSumZ[sfIdx] += az * w;
            groupWeight[sfIdx] += w;
        }

        for (let g = 0; g < GM_INSTRUMENT_NAMES.length; g++) {
            const panner = sfPanners.get(g);
            if (!panner) continue;

            // Dynamic volume: fade instrument group as members go down
            const sf = sfInstruments.get(g);
            if (sf && groupTotal[g] > 0) {
                const activeRatio = 1 - (groupDown[g] / groupTotal[g]);
                // Scale from full volume down to 15% when entire section is down
                const vol = Math.round(GM_INSTRUMENT_VOLUMES[g] * (0.15 + 0.85 * activeRatio));
                sf.output.setVolume(vol);
            }
            if (groupWeight[g] > 0) {
                const cx = groupSumX[g] / groupWeight[g];
                const cz = groupSumZ[g] / groupWeight[g];
                panner.positionX.value = cx;
                panner.positionY.value = 1.5;
                panner.positionZ.value = cz;
            } else {
                // No nearby marchers — place at listener so sound is centered
                panner.positionX.value = scene.activeCamera!.globalPosition.x;
                panner.positionY.value = 1.5;
                panner.positionZ.value = scene.activeCamera!.globalPosition.z + 1;
            }
        }
    }

    // Update player body with march animation and treadmill locomotion
    if (scene.activeCamera) {
        const dt = engine.getDeltaTime() / 1000;
        const { movement, turnY } = playerBody.update(scene.activeCamera, marchPhase, gameStartTime !== null, dt);
        // Apply treadmill locomotion to camera position and rotation
        if (movement.lengthSquared() > 0) {
            scene.activeCamera.position.addInPlace(movement);
        }
        // Push player away from fallen obstacle marchers
        if (Math.abs(obstaclePushX) > 0.001 || Math.abs(obstaclePushZ) > 0.001) {
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
            const vanishDistance = arrivalZ - (WHOLE_NOTE_DURATION * FLY_SPEED);
            if (currentZ < 150 && currentZ > vanishDistance) {
                block.mesh.isVisible = true;
            } else {
                block.mesh.isVisible = false;
            }
        });
    }

    scene.render();
});

window.addEventListener("resize", () => {
    engine.resize();
});
