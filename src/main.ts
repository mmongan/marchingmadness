import { BandMemberFactory, InstrumentType, BandMemberData } from "./bandMemberFactory";
import { FirstPersonBody } from "./firstPersonBody";
import { startMetronomeAndMusic } from "./musicManager";
import { MarchingAnimationSystem, MarchStyle, STYLE_VELOCITY } from "./marchingAnimationSystem";
import { sfPanners, loadInstruments, updateAudioListener, updateSpatialAudio } from "./audioSystem";
import { 
    BPM, WHOLE_NOTE_DURATION, FLY_SPEED,
    PLAYER_DRILL_ROW, PLAYER_DRILL_COL, PLAYER_START_X, PLAYER_START_Z, 
    STEP_HIT_PERFECT, STEP_HIT_GOOD,
    BAND_ROWS, BAND_COLS, SPACING_X, SPACING_Z, BAND_START_Z,
    FIELD_MIN_X, FIELD_MAX_X, FIELD_MIN_Z, FIELD_MAX_Z, MAX_DRILL_START_Z
} from "./gameConstants";
import { Engine, Scene, FreeCamera, Vector3, HemisphericLight, MeshBuilder, StandardMaterial, DynamicTexture, Color3, Texture, CubeTexture, PointerEventTypes, AbstractMesh, Mesh } from "@babylonjs/core";
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
    (r, c, cols, rows, _startX, _startZ) => {
        const colX = (c - (cols - 1) / 2) * 1.2; // narrow 1.2m column spacing
        const z = 5 + (r / (rows - 1)) * 40;     // rows evenly from z=5 to z=45
        return clampToFieldBounds(colX, z);
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
        const radius = 18.0; // 2π·18/75 ≈ 1.51m spacing
        const cx = 0, cz = 24;
        return clampToFieldBounds(cx + Math.cos(angle) * radius, cz + Math.sin(angle) * radius);
    },

    // 9: Figure-8 — two connected circles
    (r, c, cols, rows, _startX, _startZ) => {
        const idx = r * cols + c;
        const total = rows * cols;
        const half = total / 2;
        const cx = 0, cz = 24;
        const radius = 10.0; // 2π·10/37 ≈ 1.70m spacing
        if (idx < half) {
            const angle = (idx / half) * Math.PI * 2;
            return clampToFieldBounds(cx + Math.cos(angle) * radius, cz - 11 + Math.sin(angle) * radius);
        } else {
            const angle = ((idx - half) / half) * Math.PI * 2;
            return clampToFieldBounds(cx + Math.cos(angle) * radius, cz + 11 + Math.sin(angle) * radius);
        }
    },

    // 10: Spiral — Archimedean spiral outward from center
    (r, c, cols, rows, _startX, _startZ) => {
        const idx = r * cols + c;
        const total = rows * cols;
        const t = idx / total;
        const maxTurns = 1.5;  // fewer turns so inner ring is not cramped
        const angle = t * maxTurns * Math.PI * 2;
        const radius = 9.0 + t * 13.0; // inner arc step ≈ 1.13m
        const cx = 0, cz = 24;
        return clampToFieldBounds(cx + Math.cos(angle) * radius, cz + Math.sin(angle) * radius);
    },

    // 11: Starburst — radial lines emanating from center
    (r, c, cols, rows, _startX, _startZ) => {
        const rayAngle = (c / cols) * Math.PI * 2;
        const dist = 4.0 + (r / (rows - 1)) * 18.0; // radial spacing 18/14 ≈ 1.29m
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

    // 13: Box/Window — hollow rectangle, members evenly spaced along perimeter
    (r, c, cols, rows, _startX, _startZ) => {
        const idx = r * cols + c;
        const total = rows * cols;
        const hw = (cols - 1) * 2.5; // half-width  = 10
        const hh = (rows - 1) * 1.5; // half-height = 21
        const cx = 0, cz = 24;
        const fullPerim = (hw + hh) * 4; // 124m total perimeter
        const walk = (idx / total) * fullPerim; // position along perimeter
        const topLen = hw * 2;
        const rightLen = hh * 2;
        const bottomLen = hw * 2;
        let px: number, pz: number;
        if (walk < topLen) {
            px = cx - hw + walk;
            pz = cz - hh;
        } else if (walk < topLen + rightLen) {
            const s = walk - topLen;
            px = cx + hw;
            pz = cz - hh + s;
        } else if (walk < topLen + rightLen + bottomLen) {
            const s = walk - topLen - rightLen;
            px = cx + hw - s;
            pz = cz + hh;
        } else {
            const s = walk - topLen - rightLen - bottomLen;
            px = cx - hw;
            pz = cz + hh - s;
        }
        return clampToFieldBounds(px, pz);
    },

    // 14: Breathe — alternate rows shift laterally (X, not Z — avoids row overlap)
    (_r, _c, _cols, _rows, startX, startZ) => {
        const xShift = (_r % 2 === 0) ? -2.5 : 2.5;
        return clampToFieldBounds(startX + xShift, startZ);
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
        // Upright: columns spaced ≥ 2m apart
        const x = (c - (cols - 1) / 2) * 2.0;
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
    { beat: 144, shape: 14, facing: Math.PI },           // Breathe

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

// === PRECOMPUTED COLLISION-FREE DRILL POSITIONS ===
const MIN_SPACING = 1.0; // metres — minimum distance between any two marchers
const TOTAL_MARCHERS = BAND_ROWS * BAND_COLS;

/**
 * Iterative relaxation: push positions apart until all pairs are >= minDist.
 * Returns a new array (does not mutate input).
 */
function enforceMinSpacing(
    positions: {x: number, z: number}[],
    minDist: number
): {x: number, z: number}[] {
    const out = positions.map(p => ({x: p.x, z: p.z}));
    const minDist2 = minDist * minDist;
    for (let pass = 0; pass < 30; pass++) {
        let moved = false;
        for (let i = 0; i < out.length; i++) {
            for (let j = i + 1; j < out.length; j++) {
                const dx = out[j].x - out[i].x;
                const dz = out[j].z - out[i].z;
                const d2 = dx * dx + dz * dz;
                if (d2 < minDist2) {
                    if (d2 < 0.0001) {
                        // Coincident — push apart deterministically
                        const angle = i * 2.654 + j * 1.337;
                        const half = minDist * 0.51;
                        out[i].x -= Math.cos(angle) * half;
                        out[i].z -= Math.sin(angle) * half;
                        out[j].x += Math.cos(angle) * half;
                        out[j].z += Math.sin(angle) * half;
                    } else {
                        const d = Math.sqrt(d2);
                        const overlap = (minDist - d) / 2;
                        const nx = dx / d;
                        const nz = dz / d;
                        out[i].x -= nx * overlap;
                        out[i].z -= nz * overlap;
                        out[j].x += nx * overlap;
                        out[j].z += nz * overlap;
                    }
                    moved = true;
                }
            }
        }
        if (!moved) break;
    }
    // Clamp to field bounds
    for (const p of out) {
        p.x = Math.max(FIELD_MIN_X, Math.min(FIELD_MAX_X, p.x));
        p.z = Math.max(FIELD_MIN_Z, Math.min(FIELD_MAX_Z, p.z));
    }
    return out;
}

/** Compute raw (unseparated) positions for all marchers in a given shape */
function computeRawPositions(shapeIdx: number): {x: number, z: number}[] {
    const pts: {x: number, z: number}[] = [];
    for (let r = 0; r < BAND_ROWS; r++) {
        for (let c = 0; c < BAND_COLS; c++) {
            const sx = (c - BAND_COLS / 2 + 0.5) * SPACING_X;
            const sz = BAND_START_Z + r * SPACING_Z;
            pts.push(drillShapes[shapeIdx](r, c, BAND_COLS, BAND_ROWS, sx, sz));
        }
    }
    return pts;
}

// Precompute collision-free positions for every drill shape
const precomputedShapePos: {x: number, z: number}[][] = [];
for (let s = 0; s < drillShapes.length; s++) {
    precomputedShapePos[s] = enforceMinSpacing(computeRawPositions(s), MIN_SPACING);
}

// Precompute collision-free transition waypoints at t = 0.25, 0.5, 0.75
const WAYPOINT_T = [0.25, 0.5, 0.75];
const precomputedWaypoints: ({x: number, z: number}[][] | null)[] = [];
for (let i = 0; i < drillTimeline.length; i++) {
    if (i === drillTimeline.length - 1) {
        precomputedWaypoints.push(null);
        continue;
    }
    const shapeA = drillTimeline[i].shape;
    const shapeB = drillTimeline[i + 1].shape;
    if (shapeA === shapeB) {
        precomputedWaypoints.push(null);
        continue;
    }
    const posA = precomputedShapePos[shapeA];
    const posB = precomputedShapePos[shapeB];
    const wps: {x: number, z: number}[][] = [];
    for (const t of WAYPOINT_T) {
        const smooth = t * t * (3 - 2 * t); // smoothstep
        const midPts: {x: number, z: number}[] = [];
        for (let m = 0; m < TOTAL_MARCHERS; m++) {
            midPts.push({
                x: posA[m].x + (posB[m].x - posA[m].x) * smooth,
                z: posA[m].z + (posB[m].z - posA[m].z) * smooth,
            });
        }
        wps.push(enforceMinSpacing(midPts, MIN_SPACING));
    }
    precomputedWaypoints.push(wps);
}

function getDrillPosition(currentBeat: number, r: number, c: number, cols: number, _rows: number, _startX: number, _startZ: number): {x: number, z: number, facing: number, style: MarchStyle} {
    const maxBeat = 320;
    const loopedBeat = currentBeat % maxBeat;
    const marcherIdx = r * cols + c;

    // Find phase
    let currentIndex = 0;
    while (currentIndex < drillTimeline.length - 1 && drillTimeline[currentIndex + 1].beat <= loopedBeat) {
        currentIndex++;
    }

    const currentPhase = drillTimeline[currentIndex];

    if (currentIndex === drillTimeline.length - 1) {
        const pos = precomputedShapePos[currentPhase.shape][marcherIdx];
        return { x: pos.x, z: pos.z, facing: currentPhase.facing, style: currentPhase.style };
    }

    const nextPhase = drillTimeline[currentIndex + 1];
    const progress = (loopedBeat - currentPhase.beat) / (nextPhase.beat - currentPhase.beat);
    const smoothProgress = progress * progress * (3 - 2 * progress);
    const facing = currentPhase.facing;

    const posA = precomputedShapePos[currentPhase.shape][marcherIdx];
    const posB = precomputedShapePos[nextPhase.shape][marcherIdx];

    const wps = precomputedWaypoints[currentIndex];
    if (!wps) {
        // Same shape or simple transition — linear interpolation (already separated at endpoints)
        return {
            x: posA.x + (posB.x - posA.x) * smoothProgress,
            z: posA.z + (posB.z - posA.z) * smoothProgress,
            facing,
            style: currentPhase.style
        };
    }

    // Piecewise interpolation through precomputed separated waypoints
    // Control points: [posA, wp[0], wp[1], wp[2], posB] at smoothProgress [0, 0.25, 0.5, 0.75, 1.0]
    const sT = [0, 0.25, 0.5, 0.75, 1.0];
    const sP = [posA, wps[0][marcherIdx], wps[1][marcherIdx], wps[2][marcherIdx], posB];

    // Find which segment contains smoothProgress
    let seg = sT.length - 2;
    for (let s = 0; s < sT.length - 1; s++) {
        if (smoothProgress <= sT[s + 1]) {
            seg = s;
            break;
        }
    }

    const localT = (smoothProgress - sT[seg]) / (sT[seg + 1] - sT[seg]);

    return {
        x: sP[seg].x + (sP[seg + 1].x - sP[seg].x) * localT,
        z: sP[seg].z + (sP[seg + 1].z - sP[seg].z) * localT,
        facing,
        style: currentPhase.style
    };
}

const bandLegs: BandMemberData[] = [];



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
let lastScoreText = "";

function updateScoreHUD() {
    const grade = formationQuality >= 90 ? "A" : formationQuality >= 80 ? "B"
        : formationQuality >= 70 ? "C" : formationQuality >= 60 ? "D" : "F";
    const streakTxt = stepStreak > 2 ? ` 🔥${stepStreak}` : "";
    const text = `${Math.round(formationQuality)}% ${grade}${streakTxt}`;
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
// Free-fly mode: detach camera from marcher for bird's eye observation
let freeFly = false;
const flyHUD = document.getElementById("flyHUD");
const savedCameraState = { x: 0, y: 1.8, z: 0, rotX: 0, rotY: 0, speed: 0.5 };

window.addEventListener("keydown", (e) => {
    if (e.code === "KeyM" && !e.ctrlKey && !e.altKey) {
        autoMarch = !autoMarch;
        if (autoMarchCheckbox) autoMarchCheckbox.checked = autoMarch;
    }
    if (e.code === "KeyF" && !e.ctrlKey && !e.altKey) {
        freeFly = !freeFly;
        if (flyHUD) flyHUD.style.display = freeFly ? "block" : "none";
        if (freeFly) {
            // Save current camera state
            savedCameraState.x = camera.position.x;
            savedCameraState.y = camera.position.y;
            savedCameraState.z = camera.position.z;
            savedCameraState.rotX = camera.rotation.x;
            savedCameraState.rotY = camera.rotation.y;
            savedCameraState.speed = camera.speed;
            // Set up fly camera: elevated, fast, vertical keys
            camera.position.y = 40;
            camera.rotation.x = Math.PI / 3; // look down
            camera.speed = 3.0;
            camera.keysUp = [87];    // W
            camera.keysDown = [83];  // S
            camera.keysLeft = [65];  // A
            camera.keysRight = [68]; // D
            camera.keysUpward = [69];   // E (rise)
            camera.keysDownward = [81]; // Q (descend)
        } else {
            // Restore camera to marcher position
            camera.position.x = savedCameraState.x;
            camera.position.y = savedCameraState.y;
            camera.position.z = savedCameraState.z;
            camera.rotation.x = savedCameraState.rotX;
            camera.rotation.y = savedCameraState.rotY;
            camera.speed = savedCameraState.speed;
            camera.keysUp = [];
            camera.keysDown = [];
            camera.keysLeft = [];
            camera.keysRight = [];
            camera.keysUpward = [];
            camera.keysDownward = [];
        }
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
    ctx.fillText(`Steps: ${perfectSteps} perfect / ${goodSteps} good / ${missedSteps} miss (${stepPct}%)`, 384, 280);
    ctx.fillText(`Band Size: ${bandLegs.length}`, 384, 320);
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
    const frameDelta = engine.getDeltaTime() / 1000; // seconds since last frame
    const MAX_TURN_SPEED = 3.0; // rad/s — realistic marcher turn rate (~170°/s)
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

        bandLegs.forEach(({ anchor, plume, bodyParts }, index) => {
            const targetPos = drillPositions[index];
            const targetX = targetPos.x;
            const targetZ = targetPos.z;

            const isHalted = targetPos.style === MarchStyle.Halt;

            if (isHalted) {
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
                
                if (isSettled) {
                    // SETTLED IN FORMATION: March smoothly at normal pace
                    moveAmount = 0.04;
                } else {
                    // OUT OF FORMATION: Catch up with longer strides
                    const baseRate = 0.04; // base stride length
                    const maxCatchupRate = 0.09; // max stride when far from target
                    moveAmount = gap > 0.05 
                        ? baseRate + (maxCatchupRate - baseRate) * Math.min(1.0, gap / 3.0)
                        : baseRate;
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
            if (!isHalted) {
                let facingDelta = targetPos.facing - anchor.rotation.y;
                while (facingDelta > Math.PI) facingDelta -= Math.PI * 2;
                while (facingDelta < -Math.PI) facingDelta += Math.PI * 2;
                const maxStep = MAX_TURN_SPEED * frameDelta;
                if (Math.abs(facingDelta) <= maxStep) {
                    anchor.rotation.y = targetPos.facing;
                } else {
                    anchor.rotation.y += Math.sign(facingDelta) * maxStep;
                }
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

    // Formation bonus: player marching with the band near a drill slot earns points
    // Slowly recover formation quality (0.5% per second)
    if (gameStartTime !== null) {
        const fDt = engine.getDeltaTime() / 1000;
        formationQuality = Math.min(100, formationQuality + 0.5 * fDt);

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

    // Sync Web Audio API listener to camera for correct spatial orientation
    if (scene.activeCamera) {
        const camPos = scene.activeCamera.globalPosition;
        const camFwd = scene.activeCamera.getDirection(Vector3.Forward());
        updateAudioListener(camPos, camFwd);
    }

    // Update spatial audio panners — weighted centroid of nearby marchers per instrument group
    if (scene.activeCamera && sfPanners.size > 0) {
        const listenerPos = scene.activeCamera.globalPosition;
        updateSpatialAudio(listenerPos, bandLegs);
    }

    // Update player body with march animation and treadmill locomotion
    if (scene.activeCamera) {
        const dt = engine.getDeltaTime() / 1000;
        const secondsPerBeat = 60 / BPM;
        const beatPhase = (currentRenderTime % (secondsPerBeat * 2)) / (secondsPerBeat * 2) * Math.PI * 2; // 0-2π every 2 beats
        const { movement, turnY } = playerBody.update(scene.activeCamera, beatPhase, currentBeat, gameStartTime !== null, dt);

        if (freeFly) {
            // Free-fly: let FreeCamera built-in WASD/mouse handle everything
            // No position override, no push, no march snap
        } else if (autoMarch && gameStartTime !== null) {
            // Auto-march: snap position and facing to drill target
            const playerDrill = getDrillPosition(currentBeat, playerRow, playerCol, 5, 15, playerStartX, playerStartZ);
            scene.activeCamera.position.x = playerDrill.x;
            scene.activeCamera.position.z = playerDrill.z;
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
