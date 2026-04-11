import { BandMemberFactory, InstrumentType, BandMemberData } from "./bandMemberFactory";
import { FirstPersonBody } from "./firstPersonBody";
import { startMetronomeAndMusic } from "./musicManager";
import { MarchingAnimationSystem, MarchStyle, STYLE_VELOCITY } from "./marchingAnimationSystem";
import { sfPanners, playStumbleSound, playCrashSound, loadInstruments, updateAudioListener, updateSpatialAudio } from "./audioSystem";
import { 
    StumbleState, createStumbleState, BPM, WHOLE_NOTE_DURATION, FLY_SPEED,
    COLLISION_RADIUS, STUMBLE_RECOVERY, MAX_TILT, DOWN_DURATION,
    OBSTACLE_RADIUS, OBSTACLE_PUSH, MARCHER_COLLISION_RADIUS,
    PLAYER_DRILL_ROW, PLAYER_DRILL_COL, PLAYER_START_X, PLAYER_START_Z, 
    STEP_HIT_PERFECT, STEP_HIT_GOOD,
    BAND_ROWS, BAND_COLS, SPACING_X, SPACING_Z, BAND_START_Z,
    FIELD_MIN_X, FIELD_MAX_X, FIELD_MIN_Z, FIELD_MAX_Z, MAX_DRILL_START_Z
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


// Helper to clamp a position to field bounds
function clampToFieldBounds(x: number, z: number): {x: number, z: number} {
    return {
        x: Math.max(FIELD_MIN_X, Math.min(FIELD_MAX_X, x)),
        z: Math.max(FIELD_MIN_Z, Math.min(FIELD_MAX_Z, z))
    };
}

type DrillShape = (r: number, c: number, cols: number, rows: number, startX: number, startZ: number) => {x: number, z: number};

const drillShapes: DrillShape[] = [
    // 0: Original Block — standard grid
    (_r, _c, _cols, _rows, startX, startZ) => 
        clampToFieldBounds(startX, startZ),
    
    // 1: Expanded Block — wider spacing
    (_r, _c, _cols, _rows, startX, startZ) => 
        clampToFieldBounds(startX * 2.0, startZ),
    
    // 2: Wedge (Arrowhead) — Z shifts based on column distance from center
    (_r, c, cols, _rows, startX, startZ) => {
        const centerCol = (cols - 1) / 2;
        const distFromCenter = Math.abs(c - centerCol);
        return clampToFieldBounds(startX * 1.5, startZ - distFromCenter * 3.0);
    },

    // 3: Diamond Bow — X stretches outward in the middle rows
    (r, _c, _cols, rows, startX, startZ) => {
        const rowPhase = (r / (rows - 1)) * Math.PI;
        const stretch = 1.0 + 1.2 * Math.sin(rowPhase);
        return clampToFieldBounds(startX * stretch, startZ);
    },

    // 4: S-Curve Wave — band slithers left/right down the field
    (_r, _c, _cols, _rows, startX, startZ) => {
        const waveShift = Math.sin(startZ / 5.0) * 3.0;
        return clampToFieldBounds(startX * 1.5 + waveShift, startZ);
    },

    // 5: Company Front — all rows compress into a single wide line
    (_r, c, cols, _rows, _startX, startZ) => {
        const x = (c - (cols - 1) / 2) * 4.0; // wide spacing across field
        return clampToFieldBounds(x, startZ);
    },

    // 6: Column/File — band compresses into a narrow deep column
    (r, _c, _cols, rows, _startX, startZ) => {
        const z = startZ + (r / (rows - 1)) * (rows - 1) * SPACING_Z;
        return clampToFieldBounds(0, z);
    },

    // 7: Echelon (Diagonal) — rows offset diagonally
    (r, _c, _cols, rows, startX, startZ) => {
        const diag = (r / (rows - 1)) * 12.0; // 12m diagonal spread
        return clampToFieldBounds(startX + diag, startZ);
    },

    // 8: Circle — band forms a ring
    (r, c, cols, rows, _startX, _startZ) => {
        const idx = r * cols + c;
        const total = rows * cols;
        const angle = (idx / total) * Math.PI * 2;
        const radius = 14.0;
        const cx = 0, cz = 24; // field center
        return clampToFieldBounds(cx + Math.cos(angle) * radius, cz + Math.sin(angle) * radius);
    },

    // 9: Figure-8 — two connected circles
    (r, c, cols, rows, _startX, _startZ) => {
        const idx = r * cols + c;
        const total = rows * cols;
        const half = total / 2;
        const cx = 0, cz = 24;
        const radius = 8.0;
        if (idx < half) {
            const angle = (idx / half) * Math.PI * 2;
            return clampToFieldBounds(cx + Math.cos(angle) * radius, cz - 9 + Math.sin(angle) * radius);
        } else {
            const angle = ((idx - half) / half) * Math.PI * 2;
            return clampToFieldBounds(cx + Math.cos(angle) * radius, cz + 9 + Math.sin(angle) * radius);
        }
    },

    // 10: Spiral — Archimedean spiral outward from center
    (r, c, cols, rows, _startX, _startZ) => {
        const idx = r * cols + c;
        const total = rows * cols;
        const t = idx / total;
        const maxTurns = 2.5;
        const angle = t * maxTurns * Math.PI * 2;
        const radius = 2.0 + t * 13.0;
        const cx = 0, cz = 24;
        return clampToFieldBounds(cx + Math.cos(angle) * radius, cz + Math.sin(angle) * radius);
    },

    // 11: Starburst — radial lines emanating from center
    (r, c, cols, rows, _startX, _startZ) => {
        const rayAngle = (c / cols) * Math.PI * 2;
        const dist = 3.0 + (r / (rows - 1)) * 12.0;
        const cx = 0, cz = 24;
        return clampToFieldBounds(cx + Math.cos(rayAngle) * dist, cz + Math.sin(rayAngle) * dist);
    },

    // 12: Gate/Fold — band hinges open like double doors from center column
    (r, c, cols, rows, startX, startZ) => {
        const centerCol = (cols - 1) / 2;
        const side = c < centerCol ? -1 : c > centerCol ? 1 : 0;
        const distFromCenter = Math.abs(c - centerCol);
        const foldAngle = distFromCenter * 0.3;
        const foldX = startX + side * Math.sin(foldAngle) * (r / (rows - 1)) * 8.0;
        return clampToFieldBounds(foldX, startZ);
    },

    // 13: Box/Window — hollow rectangle, members on perimeter only
    (r, c, cols, rows, _startX, _startZ) => {
        const idx = r * cols + c;
        const perim = 2 * (cols + rows - 2);
        const slot = idx % perim;
        const hw = (cols - 1) * 2.5; // half-width
        const hh = (rows - 1) * 1.5; // half-height
        const cx = 0, cz = 24;
        let px: number, pz: number;
        if (slot < cols) {
            // top edge
            px = cx - hw + (slot / (cols - 1)) * hw * 2;
            pz = cz - hh;
        } else if (slot < cols + rows - 1) {
            // right edge
            const s = slot - cols;
            px = cx + hw;
            pz = cz - hh + (s / (rows - 1)) * hh * 2;
        } else if (slot < 2 * cols + rows - 2) {
            // bottom edge
            const s = slot - cols - (rows - 1);
            px = cx + hw - (s / (cols - 1)) * hw * 2;
            pz = cz + hh;
        } else {
            // left edge
            const s = slot - 2 * cols - (rows - 2);
            px = cx - hw;
            pz = cz + hh - (s / (rows - 1)) * hh * 2;
        }
        return clampToFieldBounds(px, pz);
    },

    // 14: Pass-through — odd rows shift right, even rows shift left
    (_r, _c, _cols, _rows, startX, startZ) => {
        const shift = (_r % 2 === 0) ? -6.0 : 6.0;
        return clampToFieldBounds(startX + shift, startZ);
    },

    // 15: Scatter — random-looking positions (deterministic from row/col)
    (r, c, cols, _rows, _startX, _startZ) => {
        // Pseudo-random scatter using sine hashing
        const seed = r * 7 + c * 13;
        const px = Math.sin(seed * 1.37) * 20.0;
        const pz = 6.0 + Math.abs(Math.cos(seed * 2.41)) * 34.0;
        // Keep some column ordering so player can find their spot
        const colBias = (c - (cols - 1) / 2) * 3.0;
        return clampToFieldBounds(px + colBias, pz);
    },

    // 16: Goal Post (T-shape) — front row wide, rest in narrow column
    (r, c, cols, _rows, _startX, startZ) => {
        if (r === 0) {
            // Cross-bar: spread wide
            const x = (c - (cols - 1) / 2) * 6.0;
            return clampToFieldBounds(x, startZ);
        }
        // Upright: narrow center column
        const x = (c - (cols - 1) / 2) * 1.0;
        return clampToFieldBounds(x, startZ);
    },

    // 17: Checkerboard — staggered offset every other member
    (_r, _c, _cols, _rows, startX, startZ) => {
        const offset = (_r + _c) % 2 === 0 ? 1.0 : -1.0;
        return clampToFieldBounds(startX + offset, startZ + offset);
    },

    // 18: Pinwheel — rows rotate around center based on row index
    (r, c, cols, rows, _startX, _startZ) => {
        const cx = 0, cz = 24;
        const colOffset = (c - (cols - 1) / 2) * SPACING_X;
        const rowOffset = (r - (rows - 1) / 2) * SPACING_Z;
        const rotAngle = (r / (rows - 1)) * Math.PI * 0.5; // 0–90° rotation
        const rx = colOffset * Math.cos(rotAngle) - rowOffset * Math.sin(rotAngle);
        const rz = colOffset * Math.sin(rotAngle) + rowOffset * Math.cos(rotAngle);
        return clampToFieldBounds(cx + rx, cz + rz);
    },
];

// Drill sequence: shape + facing per phase. Style is auto-selected from distance.
const drillSequence: { beat: number; shape: number; facing: number }[] = [
    // === ACT 1: Opening (beats 0-63) ===
    { beat: 0,   shape: 0,  facing: Math.PI },          // Block, attention
    { beat: 8,   shape: 0,  facing: Math.PI },          // Hold block (mark time)
    { beat: 16,  shape: 0,  facing: Math.PI },          // Step off in block
    { beat: 32,  shape: 1,  facing: Math.PI },          // Expand block
    { beat: 48,  shape: 5,  facing: Math.PI },          // Company front
    { beat: 64,  shape: 5,  facing: Math.PI * 0.5 },    // Turn right

    // === ACT 2: Formations (beats 64-143) ===
    { beat: 80,  shape: 2,  facing: 0 },                // Wedge, face away
    { beat: 96,  shape: 2,  facing: Math.PI },           // Hold wedge, snap to audience
    { beat: 112, shape: 7,  facing: Math.PI * 0.75 },   // Echelon diagonal
    { beat: 128, shape: 12, facing: Math.PI },           // Gate/fold open
    { beat: 144, shape: 14, facing: Math.PI },           // Pass-through

    // === ACT 3: Curves (beats 144-223) ===
    { beat: 160, shape: 8,  facing: Math.PI },           // Circle
    { beat: 176, shape: 9,  facing: Math.PI },           // Figure-8
    { beat: 192, shape: 10, facing: Math.PI * 1.5 },    // Spiral, face left
    { beat: 208, shape: 4,  facing: Math.PI },           // S-Curve wave
    { beat: 224, shape: 11, facing: Math.PI },           // Starburst

    // === ACT 4: Showcase (beats 224-303) ===
    { beat: 240, shape: 18, facing: Math.PI },           // Pinwheel
    { beat: 256, shape: 13, facing: Math.PI },           // Box/window
    { beat: 272, shape: 3,  facing: Math.PI },           // Diamond bow
    { beat: 288, shape: 15, facing: Math.PI },           // Scatter
    { beat: 296, shape: 16, facing: Math.PI },           // Goal post

    // === ACT 5: Finale (beats 304-319) ===
    { beat: 304, shape: 17, facing: Math.PI },           // Checkerboard
    { beat: 312, shape: 6,  facing: Math.PI },           // Column
    { beat: 316, shape: 0,  facing: Math.PI },           // Back to block
    { beat: 320, shape: 0,  facing: Math.PI },           // Final halt
];

/**
 * Compute the worst-case (maximum) distance any single marcher must travel
 * between two drill shapes, sampling every grid position.
 */
function maxShapeDistance(shapeA: number, shapeB: number): number {
    let maxDist = 0;
    for (let r = 0; r < BAND_ROWS; r++) {
        for (let c = 0; c < BAND_COLS; c++) {
            const sx = (c - BAND_COLS / 2 + 0.5) * SPACING_X;
            const sz = BAND_START_Z + r * SPACING_Z;
            const a = drillShapes[shapeA](r, c, BAND_COLS, BAND_ROWS, sx, sz);
            const b = drillShapes[shapeB](r, c, BAND_COLS, BAND_ROWS, sx, sz);
            const dx = b.x - a.x;
            const dz = b.z - a.z;
            const d = Math.sqrt(dx * dx + dz * dz);
            if (d > maxDist) maxDist = d;
        }
    }
    return maxDist;
}

/**
 * Pick the best MarchStyle whose velocity range can cover the required
 * distance in the given number of beats.  Prefers slower, more visually
 * interesting styles when the distance allows.
 */
function pickStyleForDistance(distance: number, beats: number): MarchStyle {
    // Required velocity: meters-per-beat needed
    const needed = beats > 0 ? distance / beats : 0;

    // Stationary — no shape change
    if (distance < 0.5) {
        // Alternate between Halt and MarkTime for variety
        return needed < 0.01 ? MarchStyle.Halt : MarchStyle.MarkTime;
    }

    // Preference order: slowest/most-visual first, fastest last
    const preference: MarchStyle[] = [
        MarchStyle.DragStep,
        MarchStyle.SideStep,
        MarchStyle.CrabWalk,
        MarchStyle.Pivot,
        MarchStyle.BackMarch,
        MarchStyle.Glide,
        MarchStyle.HighStep,
        MarchStyle.JazzRun,
        MarchStyle.Scatter,
    ];

    for (const style of preference) {
        const v = STYLE_VELOCITY[style];
        // Style can handle this transition if needed speed is within its range
        if (needed >= v.min && needed <= v.max) {
            return style;
        }
    }

    // If nothing fits perfectly, use the fastest available
    return needed > 0.8 ? MarchStyle.Scatter : MarchStyle.HighStep;
}

// Build the final timeline by computing distances and selecting styles.
// Each entry's style governs movement FROM this entry TO the next one.
const drillTimeline = drillSequence.map((entry, i) => {
    if (i === drillSequence.length - 1) {
        // Last entry: nowhere to go, halt
        return { ...entry, style: MarchStyle.Halt };
    }
    const next = drillSequence[i + 1];
    const beats = next.beat - entry.beat;
    const dist = maxShapeDistance(entry.shape, next.shape);
    const style = pickStyleForDistance(dist, beats);
    return { ...entry, style };
});

function getDrillPosition(currentBeat: number, r: number, c: number, cols: number, rows: number, startX: number, startZ: number): {x: number, z: number, facing: number, style: MarchStyle} {
    // Loop entirely at 320 beats
    const maxBeat = 320;
    let loopedBeat = currentBeat % maxBeat;
    
    // Find phase
    let currentIndex = 0;
    while(currentIndex < drillTimeline.length - 1 && drillTimeline[currentIndex + 1].beat <= loopedBeat) {
        currentIndex++;
    }
    
    const currentPhase = drillTimeline[currentIndex];
    
    if (currentIndex === drillTimeline.length - 1) {
        const pos = drillShapes[currentPhase.shape](r, c, cols, rows, startX, startZ);
        return { ...pos, facing: currentPhase.facing, style: currentPhase.style };
    }
    
    const nextPhase = drillTimeline[currentIndex + 1];
    
    // Lerp between shapes
    const progress = (loopedBeat - currentPhase.beat) / (nextPhase.beat - currentPhase.beat);
    
    const p1 = drillShapes[currentPhase.shape](r, c, cols, rows, startX, startZ);
    const p2 = drillShapes[nextPhase.shape](r, c, cols, rows, startX, startZ);
    
    // Smooth transition
    const smoothProgress = progress * progress * (3 - 2 * progress); // smoothstep

    // Interpolate facing angle (shortest-arc)
    let facingDelta = nextPhase.facing - currentPhase.facing;
    // Wrap to [-π, π] for shortest rotation
    while (facingDelta > Math.PI) facingDelta -= Math.PI * 2;
    while (facingDelta < -Math.PI) facingDelta += Math.PI * 2;
    const facing = currentPhase.facing + facingDelta * smoothProgress;

    return {
        x: p1.x + (p2.x - p1.x) * smoothProgress,
        z: p1.z + (p2.z - p1.z) * smoothProgress,
        facing,
        style: currentPhase.style
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
    // Start position clamped to keep back row on field: startZ ≤ MAX_DRILL_START_Z (19.8m with 1m safety margin)
    const startZ = Math.min(BAND_START_Z, MAX_DRILL_START_Z); // 15m is well within bounds

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

// Ground shadow discs under each marcher (per-marcher material for error colouring)
const shadowMats: StandardMaterial[] = [];
const shadowDiscs: AbstractMesh[] = [];
const baseShadow = MeshBuilder.CreateDisc("shadow_base", { radius: 0.5, tessellation: 16 }, scene);
baseShadow.rotation.x = Math.PI / 2; // lay flat
baseShadow.isPickable = false;
baseShadow.isVisible = false; // template only
for (let i = 0; i < bandLegs.length; i++) {
    const mat = new StandardMaterial(`shadowMat_${i}`, scene);
    mat.diffuseColor = new Color3(0, 0, 0);
    mat.specularColor = new Color3(0, 0, 0);
    mat.alpha = 0.35;
    shadowMats.push(mat);
    const disc = baseShadow.clone(`shadow_${i}`);
    disc.material = mat;
    disc.isVisible = true;
    disc.position.set(bandLegs[i].anchor.position.x, 0.02, bandLegs[i].anchor.position.z);
    shadowDiscs.push(disc);
}

// === PLAYER TARGET SHADOW ===
// Shows where the first-person player should be positioned
const playerShadowMat = new StandardMaterial("playerShadowMat", scene);
playerShadowMat.diffuseColor = new Color3(0, 0.6, 1);  // blue when on-target
playerShadowMat.specularColor = new Color3(0, 0, 0);
playerShadowMat.alpha = 0.5;
const playerShadow = MeshBuilder.CreateDisc("playerShadow", { radius: 0.6, tessellation: 24 }, scene);
playerShadow.rotation.x = Math.PI / 2;
playerShadow.material = playerShadowMat;
playerShadow.isPickable = false;
playerShadow.position.y = 0.025;
playerShadow.isVisible = false; // hidden until game starts

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
    { file: "assets/battle_hymn.xml", title: "Battle Hymn", subtitle: "Public Domain" },
];
let selectedScoreFile = SONG_LIST[0].file;

// === Setup Desktop HTML Buttons ===
const songButtonsContainer = document.getElementById("songButtons")!;
const desktopUI = document.getElementById("desktopUI")!;
const startBtnHTML = document.getElementById("startBtn") as HTMLButtonElement;
const autoMarchCheckbox = document.getElementById("autoMarchCheck") as HTMLInputElement;

// Auto-march mode: camera follows drill position automatically
let autoMarch = autoMarchCheckbox ? autoMarchCheckbox.checked : true;
if (autoMarchCheckbox) {
    autoMarchCheckbox.addEventListener("change", () => { autoMarch = autoMarchCheckbox.checked; });
}
// Toggle with 'M' key during gameplay
window.addEventListener("keydown", (e) => {
    if (e.code === "KeyM" && !e.ctrlKey && !e.altKey) {
        autoMarch = !autoMarch;
        if (autoMarchCheckbox) autoMarchCheckbox.checked = autoMarch;
    }
});

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
        
        // Initialize settled state tracking for hysteresis (prevent oscillation at settle zone boundary)
        let marchersSettledState: boolean[] = [];

        bandLegs.forEach(({ legL, legR, anchor, plume, bodyParts }, index) => {
            const st = stumbleStates[index];
            const isStumbling = st.tilt > 0.3 || st.downTimer > 0;

            const targetPos = drillPositions[index];
            const targetX = targetPos.x;
            const targetZ = targetPos.z;

            const isHalted = targetPos.style === MarchStyle.Halt;

            if (isStumbling) {
                // Fallen/stumbling: stop legs, freeze in place
                legL.rotation.x = 0;
                legR.rotation.x = 0;
            } else if (isHalted) {
                // Halt: freeze position, play standing pose only
                MarchingAnimationSystem.animateMarcher(marchPhase, bodyParts, true, 0, 0, MarchStyle.Halt);
            } else {
                // Smooth movement toward drill position with intelligent avoidance
                const dx = targetX - anchor.position.x;
                const dz = targetZ - anchor.position.z;
                const gap = Math.sqrt(dx * dx + dz * dz);

                // SETTLE ZONE WITH HYSTERESIS: Prevent oscillation at boundary
                // Once settled, need to be >0.35m away to unsettled; once unsettled, need to be ≤0.25m to settle
                // This prevents rapid flip-flopping around the 0.25m boundary
                const settleThreshold = 0.25;
                const unSettleThreshold = 0.35;
                let isSettled: boolean;
                
                // Check if we stored a previous settled state for this marcher
                const prevSettled = marchersSettledState[index] ?? gap <= settleThreshold;
                
                if (prevSettled) {
                    // Already settled: need larger gap to unsettled (hysteresis)
                    isSettled = gap <= unSettleThreshold;
                } else {
                    // Not settled: need smaller gap to settle
                    isSettled = gap <= settleThreshold;
                }
                marchersSettledState[index] = isSettled;
                
                let moveAmount = 0.04; // default: normal formation marching pace
                let avoidanceX = 0;
                let avoidanceZ = 0;
                
                // === PLAYER AVOIDANCE ===
                // Only push marchers away from player when the player is far from
                // their own drill target (i.e. out of formation / running around).
                // Skip the player's own marcher slot entirely.
                if (scene.activeCamera && index !== playerMarcherIndex) {
                    const playerPos = scene.activeCamera.globalPosition;
                    // Check how far the player is from their own drill target
                    const playerDrill = drillPositions[playerMarcherIndex];
                    const pOffX = playerPos.x - playerDrill.x;
                    const pOffZ = playerPos.z - playerDrill.z;
                    const playerOffFormation = Math.sqrt(pOffX * pOffX + pOffZ * pOffZ);

                    // Only repel if the player is noticeably out of position (>2m)
                    if (playerOffFormation > 2.0) {
                        const playerAvoidRadius = 3.0;
                        const playerDx = anchor.position.x - playerPos.x;
                        const playerDz = anchor.position.z - playerPos.z;
                        const playerDistSq = playerDx * playerDx + playerDz * playerDz;
                    
                        if (playerDistSq < playerAvoidRadius * playerAvoidRadius && playerDistSq > 0.1) {
                            const playerDist = Math.sqrt(playerDistSq);
                            const playerAvoidForce = (1 - playerDist / playerAvoidRadius) * (playerDist < 1.5 ? 1.2 : 0.5);
                        
                            avoidanceX += (playerDx / playerDist) * playerAvoidForce;
                            avoidanceZ += (playerDz / playerDist) * playerAvoidForce;
                        }
                    }
                }
                
                // === MARCHER-TO-MARCHER COLLISION AVOIDANCE ===
                // Hard-body radius is small — only fires when marchers truly overlap.
                // Settled marchers in formation are *supposed* to be close, so the
                // force is heavily dampened to prevent vibration from competing
                // with the formation pull.
                const collisionRadius = 0.5;                       // tighter than before
                const collisionRadius2 = collisionRadius * collisionRadius;
                let collisionX = 0;
                let collisionZ = 0;
                
                for (let j = 0; j < bandLegs.length; j++) {
                    if (j === index) continue;
                    
                    const otherAnchor = bandLegs[j].anchor;
                    const cdx = otherAnchor.position.x - anchor.position.x;
                    const cdz = otherAnchor.position.z - anchor.position.z;
                    const collisionDistSq = cdx * cdx + cdz * cdz;
                    
                    if (collisionDistSq < collisionRadius2 && collisionDistSq > 0.01) {
                        const collisionDist = Math.sqrt(collisionDistSq);
                        const repelStrength = (1 - collisionDist / collisionRadius) * 0.3;
                        collisionX -= (cdx / collisionDist) * repelStrength;
                        collisionZ -= (cdz / collisionDist) * repelStrength;
                    }
                }
                
                // Settled marchers barely react to neighbours (they belong close together)
                const collisionScale = isSettled ? 0.1 : 1.0;
                avoidanceX += collisionX * collisionScale;
                avoidanceZ += collisionZ * collisionScale;
                
                if (isSettled) {
                    // SETTLED IN FORMATION: March smoothly at normal pace
                    moveAmount = 0.04;
                    // Only player & collision avoidance applies - skip other calculations for smooth marching
                } else {
                    // OUT OF FORMATION: Catch up with longer strides and active avoidance
                    const baseRate = 0.04; // base stride length
                    const maxCatchupRate = 0.09; // max stride when far from target
                    moveAmount = gap > 0.05 
                        ? baseRate + (maxCatchupRate - baseRate) * Math.min(1.0, gap / 3.0)
                        : baseRate;
                    
                    // === DETECT OUT-OF-FORMATION MARCHERS & ROUTE AROUND THEM ===
                    const outOfFormationRadius = 2.5;
                    const avoidanceRadius = 1.8;
                    const avoidanceRadius2 = avoidanceRadius * avoidanceRadius;
                    
                    for (let j = 0; j < bandLegs.length; j++) {
                        if (j === index) continue;
                        
                        const otherMember = bandLegs[j];
                        const otherDrill = getDrillPosition(currentBeat, otherMember.row, otherMember.col, 5, 15, otherMember.startX, otherMember.startZ);
                        const otherDrillX = otherDrill.x;
                        const otherDrillZ = otherDrill.z;
                        
                        const markerDistX = otherMember.anchor.position.x - otherDrillX;
                        const markerDistZ = otherMember.anchor.position.z - otherDrillZ;
                        const markerDist = Math.sqrt(markerDistX * markerDistX + markerDistZ * markerDistZ);
                        
                        const isOutOfFormation = markerDist > outOfFormationRadius;
                        const st = stumbleStates[j];
                        const isDown = st.tilt >= MAX_TILT * 0.7;
                        
                        if (!isOutOfFormation && !isDown) continue;
                        
                        const otherAnchor = otherMember.anchor;
                        const odx = otherAnchor.position.x - anchor.position.x;
                        const odz = otherAnchor.position.z - anchor.position.z;
                        const distSq = odx * odx + odz * odz;
                        
                        if (distSq < avoidanceRadius2 && distSq > 0.01) {
                            const dist = Math.sqrt(distSq);
                            const strength = isDown ? 0.6 : 0.4;
                            const pushForce = (1 - dist / avoidanceRadius) * strength;
                            avoidanceX -= (odx / dist) * pushForce;
                            avoidanceZ -= (odz / dist) * pushForce;
                        }
                    }
                }
                
                // Apply movement with avoidance.
                // Settled marchers use a soft lerp toward their target — this kills
                // overshoot/vibration.  Unsettled marchers stride proportionally.
                if (isSettled) {
                    // Lerp 6% per frame toward formation target, plus weak avoidance
                    const lerpFactor = 0.06;
                    anchor.position.x += dx * lerpFactor + avoidanceX * 0.3;
                    anchor.position.z += dz * lerpFactor + avoidanceZ * 0.3;
                } else {
                    const movementScalar = Math.max(0.5, Math.min(1.0, gap / 1.0));
                    anchor.position.x += (dx * moveAmount + avoidanceX) * movementScalar;
                    anchor.position.z += (dz * moveAmount + avoidanceZ) * movementScalar;
                }

                // === ANIMATE ENTIRE MARCHER BODY ===
                // Real marching animation with arm swing, torso bounce, head tilt, etc.
                const catchupFactor = MarchingAnimationSystem.getCatchupFactor(gap, settleThreshold);
                MarchingAnimationSystem.animateMarcher(marchPhase, bodyParts, isSettled, catchupFactor, 0, targetPos.style);
            }

            // Face the drill-specified direction
            // Only turn when not stumbling and not halted
            if (!isStumbling && !isHalted) {
                anchor.rotation.y = targetPos.facing;
            }

            // Update ground shadow to follow marcher and tint by formation error
            const shadow = shadowDiscs[index];
            if (shadow) {
                shadow.position.x = anchor.position.x;
                shadow.position.z = anchor.position.z;
                // Compute distance from correct position (gap already available above)
                const sdx = targetX - anchor.position.x;
                const sdz = targetZ - anchor.position.z;
                const errorDist = Math.sqrt(sdx * sdx + sdz * sdz);
                // 0m error → black (normal shadow), ≥3m error → fully red
                const errorT = Math.min(1, errorDist / 3);
                const sMat = shadowMats[index];
                if (sMat) {
                    sMat.diffuseColor.r = errorT;
                    sMat.diffuseColor.g = 0;
                    sMat.diffuseColor.b = 0;
                    sMat.alpha = 0.35 + errorT * 0.35; // more opaque when red
                }
            }

            // Update plume color based on health (green=100% → red=0%)
            const health = bandLegs[index].health;
            const healthPercent = health / 100;
            let r = 0, g = 0, b = 0;
            
            if (healthPercent >= 0.5) {
                // Green to yellow transition (100% to 50%)
                g = 1;
                r = (1 - healthPercent) * 2; // 0 to 1 as health goes 100% to 50%
            } else {
                // Yellow to red transition (50% to 0%)
                r = 1;
                g = healthPercent * 2; // 1 to 0 as health goes 50% to 0%
            }
            
            (plume.material as StandardMaterial).diffuseColor = new Color3(r, g, b);
        });

        // === FOOTSTEP SCORING (on each new beat) ===
        const thisBeat = Math.floor(currentBeat);
        if (thisBeat > lastScoredBeat && lastScoredBeat >= 0) {
            const drill = getDrillPosition(thisBeat, PLAYER_DRILL_ROW, PLAYER_DRILL_COL,
                5, 15, PLAYER_START_X, PLAYER_START_Z);
            const tgtX = drill.x;
            const tgtZ = drill.z;

            const pPos = scene.activeCamera!.globalPosition;
            const ddx = pPos.x - tgtX;
            const ddz = pPos.z - tgtZ;
            const dist = Math.sqrt(ddx * ddx + ddz * ddz);

            totalStepsScored++;

            if (dist < STEP_HIT_PERFECT) {
                perfectSteps++;
                stepStreak++;
                formationQuality = Math.min(100, formationQuality + 0.8);
            } else if (dist < STEP_HIT_GOOD) {
                goodSteps++;
                stepStreak++;
                formationQuality = Math.min(100, formationQuality + 0.2);
            } else {
                missedSteps++;
                stepStreak = 0;
                formationQuality = Math.max(0, formationQuality - 0.3);
            }
        }
        lastScoredBeat = thisBeat;

    } else {
        // When not marching, keep legs at rest
        bandLegs.forEach(({ legL, legR }) => {
            legL.rotation.x = 0;
            legR.rotation.x = 0;
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
        const secondsPerBeat = 60 / BPM;
        const beatPhase = (currentRenderTime % (secondsPerBeat * 2)) / (secondsPerBeat * 2) * Math.PI * 2; // 0-2π every 2 beats
        const { movement, turnY } = playerBody.update(scene.activeCamera, beatPhase, currentBeat, gameStartTime !== null, dt);

        if (autoMarch && gameStartTime !== null) {
            // Auto-march: snap camera to the player's drill target position
            const playerDrill = getDrillPosition(currentBeat, playerRow, playerCol, 5, 15, playerStartX, playerStartZ);
            scene.activeCamera.position.x = playerDrill.x;
            scene.activeCamera.position.z = playerDrill.z;
            // Snap facing direction
            if ("rotation" in scene.activeCamera) {
                (scene.activeCamera as any).rotation.y = playerDrill.facing;
            }
        } else {
            // Manual control: apply treadmill locomotion to camera position and rotation
            if (movement.lengthSquared() > 0) {
                scene.activeCamera.position.addInPlace(movement);
            }
            if (Math.abs(turnY) > 0.0001 && "rotation" in scene.activeCamera) {
                (scene.activeCamera as any).rotation.y += turnY;
            }
        }
        // Push player away from fallen obstacle marchers (only if player is not stumbling)
        if (!playerIsDown && (Math.abs(obstaclePushX) > 0.001 || Math.abs(obstaclePushZ) > 0.001)) {
            scene.activeCamera.position.x += obstaclePushX;
            scene.activeCamera.position.z += obstaclePushZ;
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
