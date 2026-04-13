import { INSTRUMENT_PLUGINS } from "./instrumentFactory";
import { createInstrumentPoseAnimations } from "./utils/instrumentPoseAnimations";
import { FirstPersonBody } from "./firstPersonBody";
import { startMetronomeAndMusic, getActiveInstrumentsAtBeat } from "./musicManager";
import { MarchingAnimationSystem, MarchStyle, MoonwalkPlugin, AnimationService } from "./marchingAnimationSystem";
import { DRILL_SHAPE_PLUGINS } from "./drillShapes";





/**
 * Registers all built-in plugins for the Marching Madness simulation.
 *
 * This function ensures that all core plugin types are initialized and available:
 *   - Instrument plugins (INSTRUMENT_PLUGINS)
 *   - Drill shape plugins (DRILL_SHAPE_PLUGINS)
 *   - Drill transition plugins (DRILL_TRANSITION_PLUGINS)
 *   - Marching animation plugins (MarchingAnimationPlugin)
 *   - Band generator plugins (BandGeneratorPlugin)
 *
 * Most plugin arrays are imported and used directly by consumers, but animation plugins
 * must be registered with the AnimationService. This function should be called once at startup.
 */
function registerAllBuiltInPlugins() {
    // Register all instrument plugins (if registration is needed)
    // INSTRUMENT_PLUGINS is imported and used directly by consumers.

    // Register all drill shape plugins (if registration is needed)
    // DRILL_SHAPE_PLUGINS is imported and used directly by consumers.

    // Register all drill transition plugins (if registration is needed)
    // DRILL_TRANSITION_PLUGINS is imported and used directly by consumers.

    // Register all marching animation plugins
    // Register built-in march cycle animations for all standard styles
    // These are not plugins, but core animation logic for each style
    AnimationService.registerLegAnimations(
        MarchStyle.HighStep,
        (t: number, hipMax: number) => ({
            hipX: Math.sin(t * Math.PI * 2) * hipMax,
            hipZ: 0,
            knee: 1.2 * Math.abs(Math.sin(t * Math.PI * 2)),
            ankle: -0.1 * Math.cos(t * Math.PI * 2)
        }),
        (t: number, hipMax: number) => {
            const tp = (t + 0.5) % 1;
            return {
                hipX: Math.sin(tp * Math.PI * 2) * hipMax,
                hipZ: 0,
                knee: 1.2 * Math.abs(Math.sin(tp * Math.PI * 2)),
                ankle: -0.1 * Math.cos(tp * Math.PI * 2)
            };
        }
    );
    AnimationService.registerLegAnimations(
        MarchStyle.Glide,
        (t: number, hipMax: number) => ({
            hipX: Math.sin(t * Math.PI * 2) * hipMax * 0.7,
            hipZ: 0,
            knee: 0.5 + 0.3 * Math.abs(Math.sin(t * Math.PI * 2)),
            ankle: -0.05 * Math.cos(t * Math.PI * 2)
        }),
        (t: number, hipMax: number) => {
            const tp = (t + 0.5) % 1;
            return {
                hipX: Math.sin(tp * Math.PI * 2) * hipMax * 0.7,
                hipZ: 0,
                knee: 0.5 + 0.3 * Math.abs(Math.sin(tp * Math.PI * 2)),
                ankle: -0.05 * Math.cos(tp * Math.PI * 2)
            };
        }
    );
    AnimationService.registerLegAnimations(
        MarchStyle.MarkTime,
        (t: number) => ({
            hipX: 0,
            hipZ: 0,
            knee: 1.0 * Math.abs(Math.sin(t * Math.PI * 2)),
            ankle: 0
        }),
        (t: number) => {
            const tp = (t + 0.5) % 1;
            return {
                hipX: 0,
                hipZ: 0,
                knee: 1.0 * Math.abs(Math.sin(tp * Math.PI * 2)),
                ankle: 0
            };
        }
    );
    AnimationService.registerLegAnimations(
        MarchStyle.BackMarch,
        (t: number, hipMax: number) => ({
            hipX: -Math.sin(t * Math.PI * 2) * hipMax * 0.7,
            hipZ: 0,
            knee: 0.7 + 0.2 * Math.abs(Math.sin(t * Math.PI * 2)),
            ankle: 0.05 * Math.cos(t * Math.PI * 2)
        }),
        (t: number, hipMax: number) => {
            const tp = (t + 0.5) % 1;
            return {
                hipX: -Math.sin(tp * Math.PI * 2) * hipMax * 0.7,
                hipZ: 0,
                knee: 0.7 + 0.2 * Math.abs(Math.sin(tp * Math.PI * 2)),
                ankle: 0.05 * Math.cos(tp * Math.PI * 2)
            };
        }
    );
    AnimationService.registerLegAnimations(
        MarchStyle.JazzRun,
        (t: number, hipMax: number) => ({
            hipX: Math.sin(t * Math.PI * 2) * hipMax * 1.2,
            hipZ: 0,
            knee: 0.7 + 0.3 * Math.abs(Math.sin(t * Math.PI * 2)),
            ankle: -0.15 * Math.cos(t * Math.PI * 2)
        }),
        (t: number, hipMax: number) => {
            const tp = (t + 0.5) % 1;
            return {
                hipX: Math.sin(tp * Math.PI * 2) * hipMax * 1.2,
                hipZ: 0,
                knee: 0.7 + 0.3 * Math.abs(Math.sin(tp * Math.PI * 2)),
                ankle: -0.15 * Math.cos(tp * Math.PI * 2)
            };
        }
    );
    AnimationService.registerLegAnimations(
        MarchStyle.SideStep,
        (t: number, hipMax: number) => ({
            hipX: 0,
            hipZ: Math.sin(t * Math.PI * 2) * hipMax * 0.7,
            knee: 0.7 + 0.2 * Math.abs(Math.sin(t * Math.PI * 2)),
            ankle: 0
        }),
        (t: number, hipMax: number) => {
            const tp = (t + 0.5) % 1;
            return {
                hipX: 0,
                hipZ: Math.sin(tp * Math.PI * 2) * hipMax * 0.7,
                knee: 0.7 + 0.2 * Math.abs(Math.sin(tp * Math.PI * 2)),
                ankle: 0
            };
        }
    );
    AnimationService.registerLegAnimations(
        MarchStyle.CrabWalk,
        (t: number, hipMax: number) => ({
            hipX: 0,
            hipZ: Math.sin(t * Math.PI * 2) * hipMax * 0.7,
            knee: 0.7 + 0.2 * Math.abs(Math.sin(t * Math.PI * 2)),
            ankle: 0
        }),
        (t: number, hipMax: number) => {
            const tp = (t + 0.5) % 1;
            return {
                hipX: 0,
                hipZ: Math.sin(tp * Math.PI * 2) * hipMax * 0.7,
                knee: 0.7 + 0.2 * Math.abs(Math.sin(tp * Math.PI * 2)),
                ankle: 0
            };
        }
    );
    AnimationService.registerLegAnimations(
        MarchStyle.Halt,
        () => ({ hipX: 0, hipZ: 0, knee: 0, ankle: 0 }),
        () => ({ hipX: 0, hipZ: 0, knee: 0, ankle: 0 })
    );
    AnimationService.registerLegAnimations(
        MarchStyle.DragStep,
        (t: number, hipMax: number) => ({
            hipX: Math.sin(t * Math.PI * 2) * hipMax * 0.5,
            hipZ: 0,
            knee: 0.6 + 0.2 * Math.abs(Math.sin(t * Math.PI * 2)),
            ankle: -0.2 * Math.abs(Math.sin(t * Math.PI * 2))
        }),
        (t: number, hipMax: number) => {
            const tp = (t + 0.5) % 1;
            return {
                hipX: Math.sin(tp * Math.PI * 2) * hipMax * 0.5,
                hipZ: 0,
                knee: 0.6 + 0.2 * Math.abs(Math.sin(tp * Math.PI * 2)),
                ankle: -0.2 * Math.abs(Math.sin(tp * Math.PI * 2))
            };
        }
    );
    AnimationService.registerLegAnimations(
        MarchStyle.Scatter,
        (t: number, hipMax: number) => ({
            hipX: Math.sin(t * Math.PI * 2 + Math.random()) * hipMax,
            hipZ: Math.cos(t * Math.PI * 2 + Math.random()) * hipMax * 0.5,
            knee: 0.7 + 0.5 * Math.abs(Math.sin(t * Math.PI * 2)),
            ankle: 0
        }),
        (t: number, hipMax: number) => {
            const tp = (t + 0.5) % 1;
            return {
                hipX: Math.sin(tp * Math.PI * 2 + Math.random()) * hipMax,
                hipZ: Math.cos(tp * Math.PI * 2 + Math.random()) * hipMax * 0.5,
                knee: 0.7 + 0.5 * Math.abs(Math.sin(tp * Math.PI * 2)),
                ankle: 0
            };
        }
    );
    AnimationService.registerLegAnimations(
        MarchStyle.Pivot,
        (t: number, hipMax: number) => ({
            hipX: Math.sin(t * Math.PI * 2) * hipMax * 0.3,
            hipZ: 0,
            knee: 0.5 + 0.2 * Math.abs(Math.sin(t * Math.PI * 2)),
            ankle: 0
        }),
        (t: number, hipMax: number) => {
            const tp = (t + 0.5) % 1;
            return {
                hipX: Math.sin(tp * Math.PI * 2) * hipMax * 0.3,
                hipZ: 0,
                knee: 0.5 + 0.2 * Math.abs(Math.sin(tp * Math.PI * 2)),
                ankle: 0
            };
        }
    );
    AnimationService.registerLegAnimations(
        MarchStyle.RollStep,
        (t: number, hipMax: number) => ({
            hipX: Math.sin(t * Math.PI * 2) * hipMax * 0.8,
            hipZ: 0,
            knee: 0.8 + 0.2 * Math.abs(Math.sin(t * Math.PI * 2)),
            ankle: -0.1 * Math.cos(t * Math.PI * 2)
        }),
        (t: number, hipMax: number) => {
            const tp = (t + 0.5) % 1;
            return {
                hipX: Math.sin(tp * Math.PI * 2) * hipMax * 0.8,
                hipZ: 0,
                knee: 0.8 + 0.2 * Math.abs(Math.sin(tp * Math.PI * 2)),
                ankle: -0.1 * Math.cos(tp * Math.PI * 2)
            };
        }
    );
    AnimationService.registerLegAnimations(
        MarchStyle.Chasse,
        (t: number, hipMax: number) => ({
            hipX: 0,
            hipZ: Math.sin(t * Math.PI * 2) * hipMax * 0.5,
            knee: 0.7 + 0.2 * Math.abs(Math.sin(t * Math.PI * 2)),
            ankle: 0
        }),
        (t: number, hipMax: number) => {
            const tp = (t + 0.5) % 1;
            return {
                hipX: 0,
                hipZ: Math.sin(tp * Math.PI * 2) * hipMax * 0.5,
                knee: 0.7 + 0.2 * Math.abs(Math.sin(tp * Math.PI * 2)),
                ankle: 0
            };
        }
    );
    AnimationService.registerLegAnimations(
        MarchStyle.BoxStep,
        (t: number, hipMax: number) => ({
            hipX: Math.sin(t * Math.PI * 2) * hipMax * 0.3,
            hipZ: Math.cos(t * Math.PI * 2) * hipMax * 0.3,
            knee: 0.6 + 0.2 * Math.abs(Math.sin(t * Math.PI * 2)),
            ankle: 0
        }),
        (t: number, hipMax: number) => {
            const tp = (t + 0.5) % 1;
            return {
                hipX: Math.sin(tp * Math.PI * 2) * hipMax * 0.3,
                hipZ: Math.cos(tp * Math.PI * 2) * hipMax * 0.3,
                knee: 0.6 + 0.2 * Math.abs(Math.sin(tp * Math.PI * 2)),
                ankle: 0
            };
        }
    );
    AnimationService.registerLegAnimations(
        MarchStyle.Flank,
        (t: number, hipMax: number) => ({
            hipX: Math.sin(t * Math.PI * 2) * hipMax * 0.7,
            hipZ: 0,
            knee: 0.7 + 0.2 * Math.abs(Math.sin(t * Math.PI * 2)),
            ankle: 0
        }),
        (t: number, hipMax: number) => {
            const tp = (t + 0.5) % 1;
            return {
                hipX: Math.sin(tp * Math.PI * 2) * hipMax * 0.7,
                hipZ: 0,
                knee: 0.7 + 0.2 * Math.abs(Math.sin(tp * Math.PI * 2)),
                ankle: 0
            };
        }
    );
    AnimationService.registerLegAnimations(
        MarchStyle.SkipPrance,
        (t: number, hipMax: number) => ({
            hipX: Math.sin(t * Math.PI * 2) * hipMax * 1.1,
            hipZ: 0,
            knee: 1.0 + 0.3 * Math.abs(Math.sin(t * Math.PI * 2)),
            ankle: 0
        }),
        (t: number, hipMax: number) => {
            const tp = (t + 0.5) % 1;
            return {
                hipX: Math.sin(tp * Math.PI * 2) * hipMax * 1.1,
                hipZ: 0,
                knee: 1.0 + 0.3 * Math.abs(Math.sin(tp * Math.PI * 2)),
                ankle: 0
            };
        }
    );
    AnimationService.registerLegAnimations(
        MarchStyle.DragTurn,
        (t: number, hipMax: number) => ({
            hipX: Math.sin(t * Math.PI * 2) * hipMax * 0.3,
            hipZ: 0,
            knee: 0.5 + 0.2 * Math.abs(Math.sin(t * Math.PI * 2)),
            ankle: 0
        }),
        (t: number, hipMax: number) => {
            const tp = (t + 0.5) % 1;
            return {
                hipX: Math.sin(tp * Math.PI * 2) * hipMax * 0.3,
                hipZ: 0,
                knee: 0.5 + 0.2 * Math.abs(Math.sin(tp * Math.PI * 2)),
                ankle: 0
            };
        }
    );
    AnimationService.registerLegAnimations(
        MarchStyle.StopHit,
        (t: number, hipMax: number) => ({
            hipX: Math.sin(t * Math.PI * 2) * hipMax * 0.5,
            hipZ: 0,
            knee: 0.7 + 0.2 * Math.abs(Math.sin(t * Math.PI * 2)),
            ankle: 0
        }),
        (t: number, hipMax: number) => {
            const tp = (t + 0.5) % 1;
            return {
                hipX: Math.sin(tp * Math.PI * 2) * hipMax * 0.5,
                hipZ: 0,
                knee: 0.7 + 0.2 * Math.abs(Math.sin(tp * Math.PI * 2)),
                ankle: 0
            };
        }
    );
    AnimationService.registerLegAnimations(
        MarchStyle.TrueCrab,
        (t: number, hipMax: number) => ({
            hipX: 0,
            hipZ: Math.sin(t * Math.PI * 2) * hipMax * 0.7,
            knee: 0.7 + 0.2 * Math.abs(Math.sin(t * Math.PI * 2)),
            ankle: 0
        }),
        (t: number, hipMax: number) => {
            const tp = (t + 0.5) % 1;
            return {
                hipX: 0,
                hipZ: Math.sin(tp * Math.PI * 2) * hipMax * 0.7,
                knee: 0.7 + 0.2 * Math.abs(Math.sin(tp * Math.PI * 2)),
                ankle: 0
            };
        }
    );
    AnimationService.registerLegAnimations(
        MarchStyle.ObliqueLeft,
        (t: number, hipMax: number) => ({
            hipX: Math.sin(t * Math.PI * 2) * hipMax * 0.5,
            hipZ: Math.sin(t * Math.PI * 2) * hipMax * 0.2,
            knee: 0.7 + 0.2 * Math.abs(Math.sin(t * Math.PI * 2)),
            ankle: 0
        }),
        (t: number, hipMax: number) => {
            const tp = (t + 0.5) % 1;
            return {
                hipX: Math.sin(tp * Math.PI * 2) * hipMax * 0.5,
                hipZ: Math.sin(tp * Math.PI * 2) * hipMax * 0.2,
                knee: 0.7 + 0.2 * Math.abs(Math.sin(tp * Math.PI * 2)),
                ankle: 0
            };
        }
    );
    AnimationService.registerLegAnimations(
        MarchStyle.ObliqueRight,
        (t: number, hipMax: number) => ({
            hipX: Math.sin(t * Math.PI * 2) * hipMax * 0.5,
            hipZ: -Math.sin(t * Math.PI * 2) * hipMax * 0.2,
            knee: 0.7 + 0.2 * Math.abs(Math.sin(t * Math.PI * 2)),
            ankle: 0
        }),
        (t: number, hipMax: number) => {
            const tp = (t + 0.5) % 1;
            return {
                hipX: Math.sin(tp * Math.PI * 2) * hipMax * 0.5,
                hipZ: -Math.sin(tp * Math.PI * 2) * hipMax * 0.2,
                knee: 0.7 + 0.2 * Math.abs(Math.sin(tp * Math.PI * 2)),
                ankle: 0
            };
        }
    );

    // Register plugin-based animation(s)
    const animationPlugins = [
        new MoonwalkPlugin(),
        // Add other MarchingAnimationPlugin instances here as needed
    ];
    for (const plugin of animationPlugins) {
        plugin.register(AnimationService);
    }
    // Ensure static animations for all MarchStyle values
    AnimationService.ensureDefaultAnimations();
}

// Call the initialization function at startup
registerAllBuiltInPlugins();
import { sfPanners, loadInstruments, updateAudioListener, updateSpatialAudio } from "./audioSystem";
import { pickStyleForDistance, enforceMinSpacing, composePerms, computeSlotAssignment } from "./drillHelpers";
import { 
    BPM, WHOLE_NOTE_DURATION, FLY_SPEED,
    PLAYER_DRILL_ROW, PLAYER_DRILL_COL, PLAYER_START_X, PLAYER_START_Z, 
    STEP_HIT_PERFECT, STEP_HIT_GOOD,
    BAND_ROWS, BAND_COLS, SPACING_X, SPACING_Z, BAND_START_Z,
} from "./marchConstants";

import { computeRawPositions, maxShapeDistance } from "./drillGenerator";
import { buildBand, replaceWithPlayerMarcher } from "./bandGenerator";
import { Engine, Scene, FreeCamera, Vector3, HemisphericLight, MeshBuilder, StandardMaterial, DynamicTexture, Color3, Texture, CubeTexture, PointerEventTypes, AbstractMesh, Mesh } from "@babylonjs/core";
import "@babylonjs/loaders/glTF";
import { OpenSheetMusicDisplay } from "opensheetmusicdisplay";
import * as Tone from "tone";

// Drill shapes, transitions, and generation are imported from extracted modules
const canvas = document.getElementById("renderCanvas") as HTMLCanvasElement;
const engine = new Engine(canvas, true, { audioEngine: false });

// Create the scene

const scene = new Scene(engine);
scene.clearColor = new Color3(0.9, 0.9, 0.9).toColor4();

// === Initialize reusable instrument pose animations ===
const instrumentPoseAnimations = createInstrumentPoseAnimations(scene);

// Helper to assign AnimationGroups to a band member's instrument joint
import type { BandMemberData } from "./bandMemberFactory";
import type { AnimationGroup, TargetedAnimation } from "@babylonjs/core";

function assignInstrumentPoseAnimationsToMember(member: BandMemberData) {
    if (!member.instrumentType || !member.bodyParts.instrumentJoint) return;
    const anims = instrumentPoseAnimations[member.instrumentType];
    if (!anims) return;
    // Clone AnimationGroups and retarget to this member's instrumentJoint
    const restToPlay: AnimationGroup = anims.restToPlay.clone(`${member.instrumentType}_restToPlay_${member.row}_${member.col}`);
    const playToRest: AnimationGroup = anims.playToRest.clone(`${member.instrumentType}_playToRest_${member.row}_${member.col}`);
    // Retarget all animations to the actual instrumentJoint
    restToPlay.targetedAnimations.forEach((ta: TargetedAnimation) => { ta.target = member.bodyParts.instrumentJoint; });
    playToRest.targetedAnimations.forEach((ta: TargetedAnimation) => { ta.target = member.bodyParts.instrumentJoint; });
    member.instrumentRestToPlayAnim = restToPlay;
    member.instrumentPlayToRestAnim = playToRest;
}

const camera = new FreeCamera("camera1", new Vector3(0, 1.8, 0), scene);
camera.setTarget(new Vector3(0, 1.8, 1));
camera.attachControl(canvas, true);
// Disable FreeCamera's built-in WASD/arrow keys â€” our firstPersonBody handles movement.
// Keep mouse input so click-drag look works on desktop.
camera.keysUp = [];
camera.keysDown = [];
camera.keysLeft = [];
camera.keysRight = [];

const light = new HemisphericLight("light", new Vector3(0, 1, 0), scene);
light.intensity = 0.8;

// Track XR controllers for arm tracking
const playerBody = new FirstPersonBody(scene);

// Enable WebXR/VR with graceful device detection
scene.createDefaultXRExperienceAsync({
    inputOptions: {
        // Don't force a profile â€” let the browser report the real controller
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

// Drill sequence: shape + facing per phase. Optional style for explicit step type.
const drillSequence: { beat: number; shape: number; facing: number; style?: MarchStyle }[] = [
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

// Build the final timeline by computing distances and selecting styles.
// Each entry's style governs movement FROM this entry TO the next one.
const drillTimeline = drillSequence.map((entry, i) => {
    if (i === drillSequence.length - 1) {
        // Last entry: nowhere to go, halt
        return { ...entry, style: entry.style ?? MarchStyle.Halt };
    }
    const next = drillSequence[i + 1];
    const beats = next.beat - entry.beat;
    const dist = maxShapeDistance(entry.shape, next.shape);
    // Use explicit style if provided, otherwise pick automatically
    const style = entry.style ?? pickStyleForDistance(dist, beats);
    return { ...entry, style };
});

// === PRECOMPUTED COLLISION-FREE DRILL POSITIONS ===
const MIN_SPACING = 1.0; // metres â€” minimum distance between any two marchers
const TOTAL_MARCHERS = BAND_ROWS * BAND_COLS;

const precomputedShapePos: {x: number, z: number}[][] = [];
for (let s = 0; s < DRILL_SHAPE_PLUGINS.length; s++) {
    precomputedShapePos[s] = enforceMinSpacing(computeRawPositions(s), MIN_SPACING);
}

// === Build per-transition slot assignments ===
// cumulativePerm[i] maps original marcher index â†’ slot in shape i's precomputedShapePos.
// This ensures each marcher follows a short, non-crossing path between shapes.
const cumulativePerm: number[][] = [];
{
    // Start with identity for the first shape
    const identity = Array.from({ length: TOTAL_MARCHERS }, (_, i) => i);
    cumulativePerm.push(identity);

    for (let i = 0; i < drillTimeline.length - 1; i++) {
        const shapeA = drillTimeline[i].shape;
        const shapeB = drillTimeline[i + 1].shape;
        const prevPerm = cumulativePerm[i];

        if (shapeA === shapeB) {
            // No transition â€” keep same slot assignment
            cumulativePerm.push([...prevPerm]);
        } else {
            // Get actual positions of marchers in shape A (after previous permutation)
            const srcPos = prevPerm.map(slot => precomputedShapePos[shapeA][slot]);
            const dstPos = precomputedShapePos[shapeB];

            // Find optimal assignment from current positions to next shape slots
            const localPerm = computeSlotAssignment(srcPos, dstPos);
            // Compose: new cumulative perm maps marcher â†’ slot in shape B
            cumulativePerm.push(composePerms(prevPerm, localPerm));
        }
    }
}

// === PRECOMPUTED PER-BEAT FOOTSTEP POSITIONS WITH TRANSITION SCHEDULING ===
const MAX_BEAT = 320;
const precomputedBeatPos: {x: number, z: number}[][] = new Array(MAX_BEAT);
// For each transition, store a per-marcher offset (delay in beats)
const transitionOffsets: number[][] = [];
for (let i = 0; i < drillTimeline.length - 1; i++) {
    const phase = drillTimeline[i];
    const nextPhase = drillTimeline[i + 1];
    const permA = cumulativePerm[i];
    const permB = cumulativePerm[i + 1];
    const posAArr = permA.map(slot => ({
        x: precomputedShapePos[phase.shape][slot].x,
        z: precomputedShapePos[phase.shape][slot].z,
    }));
    const posBArr = permB.map(slot => ({
        x: precomputedShapePos[nextPhase.shape][slot].x,
        z: precomputedShapePos[nextPhase.shape][slot].z,
    }));
    const startBeat = phase.beat;
    const endBeat = nextPhase.beat;
    const numBeats = endBeat - startBeat;

    // --- Transition scheduling: stagger start times to avoid path crossing ---
    // For each marcher, assign a delay (in beats) if their path crosses another's
    const offsets = new Array(TOTAL_MARCHERS).fill(0);
    // Naive O(n^2) check: if two marchers' straight-line paths cross, stagger one
    for (let m1 = 0; m1 < TOTAL_MARCHERS; m1++) {
        for (let m2 = m1 + 1; m2 < TOTAL_MARCHERS; m2++) {
            // Check if line segments (A->B for m1 and m2) cross
            const a1 = posAArr[m1], a2 = posBArr[m1];
            const b1 = posAArr[m2], b2 = posBArr[m2];
            // Helper: cross product sign
            function ccw(p1: {x: number, z: number}, p2: {x: number, z: number}, p3: {x: number, z: number}) {
                return (p3.z - p1.z) * (p2.x - p1.x) > (p2.z - p1.z) * (p3.x - p1.x);
            }
            const cross = (ccw(a1, b1, b2) !== ccw(a2, b1, b2)) && (ccw(a1, a2, b1) !== ccw(a1, a2, b2));
            // Also check if paths come within MIN_SPACING/2 at any midpoint
            let close = false;
            for (let t = 0.1; t < 1.0; t += 0.2) {
                const p1 = { x: a1.x + (a2.x - a1.x) * t, z: a1.z + (a2.z - a1.z) * t };
                const p2 = { x: b1.x + (b2.x - b1.x) * t, z: b1.z + (b2.z - b1.z) * t };
                const dx = p1.x - p2.x, dz = p1.z - p2.z;
                if (dx * dx + dz * dz < (MIN_SPACING * 0.5) ** 2) close = true;
            }
            if (cross || close) {
                // Stagger m2 by 1 beat after m1 (if not already staggered more)
                if (offsets[m2] <= offsets[m1]) offsets[m2] = offsets[m1] + 1;
            }
        }
    }
    transitionOffsets.push(offsets);

    // --- Per-beat position calculation with offsets ---
    for (let b = startBeat; b < endBeat; b++) {
        const beatPos: {x: number, z: number}[] = [];
        for (let m = 0; m < TOTAL_MARCHERS; m++) {
            const offset = offsets[m];
            const localBeat = b - startBeat;
            let pos;
            if (localBeat < offset) {
                // Wait at start
                pos = posAArr[m];
            } else if (localBeat >= numBeats - offset) {
                // Arrived at end
                pos = posBArr[m];
            } else {
                // Interpolate between start and end
                const t = (localBeat - offset) / (numBeats - 2 * offset);
                pos = {
                    x: posAArr[m].x + (posBArr[m].x - posAArr[m].x) * t,
                    z: posAArr[m].z + (posBArr[m].z - posAArr[m].z) * t,
                };
            }
            beatPos.push(pos);
        }
        precomputedBeatPos[b] = beatPos;
    }
}
// Last phase: static for remaining beats
const lastPhase = drillTimeline[drillTimeline.length - 1];
const lastPerm = cumulativePerm[cumulativePerm.length - 1];
const lastPosArr = lastPerm.map(slot => ({
    x: precomputedShapePos[lastPhase.shape][slot].x,
    z: precomputedShapePos[lastPhase.shape][slot].z,
}));
for (let b = lastPhase.beat; b < MAX_BEAT; b++) {
    precomputedBeatPos[b] = lastPosArr;
}

// Compute per-marcher animation style based on actual movement direction, facing, and distance.
// Each marcher gets a context-aware style per beat.
import { pickStyleForMovement } from "./drillHelpers";
// Store all drill chart info for each marcher at each beat
import { getSlotInstrument, getSlotPartName, getSlotSfIndex, getSlotTranspose } from "./bandGenerator";
type BeatStepInfo = {
    style: MarchStyle,
    phaseIdx: number,
    instrument: string,
    partName: string,
    section: string,
    label: string,
    sfIndex: number | null,
    transpose: number,
    // Add more fields as needed (e.g., specialInstructions)
};
const precomputedBeatStep: BeatStepInfo[][] = new Array(MAX_BEAT);
for (let beat = 0; beat < MAX_BEAT; beat++) {
    const nextBeat = (beat + 1) % MAX_BEAT;
    // Find phase for facing and beats
    let phaseIdx = 0;
    while (phaseIdx < drillTimeline.length - 1 && drillTimeline[phaseIdx + 1].beat <= beat) phaseIdx++;
    const phase = drillTimeline[phaseIdx];
    const facing = phase.facing;

    const stepInfos: BeatStepInfo[] = [];
    for (let m = 0; m < TOTAL_MARCHERS; m++) {
        const curr = precomputedBeatPos[beat][m];
        const next = precomputedBeatPos[nextBeat][m];
        const dx = next.x - curr.x;
        const dz = next.z - curr.z;
        const dist = Math.sqrt(dx * dx + dz * dz);

        // Row/col for marcher m
        const row = Math.floor(m / BAND_COLS);
        const col = m % BAND_COLS;
        const instrument = getSlotInstrument(row, col);
        const partName = getSlotPartName(row, col);
        // Section is the instrument name without trailing numbers (e.g., "Trumpet I" → "Trumpet")
        const section = instrument.replace(/\d+$/, "");
        const label = String.fromCharCode(65 + row) + (col + 1);
        const sfIndex = getSlotSfIndex(row, col);
        const transpose = getSlotTranspose(row, col);

        // Use pickStyleForMovement for each marcher, factoring facing and movement direction
        let style: MarchStyle;
        if (dist < 0.03) {
            style = MarchStyle.Halt;
        } else {
            style = pickStyleForMovement(dx, dz, facing, dist, 1);
        }
        stepInfos.push({
            style,
            phaseIdx,
            instrument,
            partName,
            section,
            label,
            sfIndex,
            transpose
        });
    }
    precomputedBeatStep[beat] = stepInfos;
}

function getDrillPosition(currentBeat: number, r: number, c: number, cols: number, _rows: number, _startX: number, _startZ: number): {x: number, z: number, facing: number, style: MarchStyle, phaseIdx: number} {
    const loopedBeat = currentBeat % MAX_BEAT;
    const marcherIdx = r * cols + c;

    const beatFloor = Math.floor(loopedBeat) % MAX_BEAT;
    const beatCeil = (beatFloor + 1) % MAX_BEAT;
    const frac = loopedBeat - Math.floor(loopedBeat);

    // Smoothstep sub-beat interpolation: natural decel at footstep landing, accel at push-off
    const t = frac * frac * (3 - 2 * frac);

    const posA = precomputedBeatPos[beatFloor][marcherIdx];
    const posB = precomputedBeatPos[beatCeil][marcherIdx];

    // Use precomputed phaseIdx and style
    const { style, phaseIdx } = precomputedBeatStep[beatFloor][marcherIdx];

    return {
        x: posA.x + (posB.x - posA.x) * t,
        z: posA.z + (posB.z - posA.z) * t,
        facing: drillTimeline[phaseIdx].facing,
        style,
        phaseIdx
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

// Build the full marching band via the band generator
bandLegs.push(...buildBand(scene));

// Assign instrument pose AnimationGroups to each band member
for (const member of bandLegs) {
    assignInstrumentPoseAnimationsToMember(member);
}

// Create player marcher at the assigned position and replace the standard marcher there
const playerMarcher = replaceWithPlayerMarcher(scene, bandLegs, playerRow, playerCol, playerStartX, playerStartZ);

// Hide the simple FirstPersonBody visuals
playerBody.hideVisuals();

// Initialize camera to player's starting drill position
camera.position = new Vector3(playerStartX, 1.8, playerStartZ);
camera.setTarget(new Vector3(playerStartX, 1.8, playerStartZ - 5));

// Position the player's VR body at the marcher location
playerBody.setBodyPosition(new Vector3(playerStartX, 0, playerStartZ));

// Ground shadow discs under each marcher
const shadowDiscs: AbstractMesh[] = [];
const baseShadow = MeshBuilder.CreateDisc("shadow_base", { radius: 0.5, tessellation: 16 }, scene);
baseShadow.rotation.x = Math.PI / 2; // lay flat
baseShadow.isPickable = false;
baseShadow.isVisible = false; // template only
const shadowMat = new StandardMaterial("shadowMat", scene);
shadowMat.diffuseColor = new Color3(0, 0, 0);
shadowMat.specularColor = new Color3(0, 0, 0);
shadowMat.alpha = 0.35;
for (let i = 0; i < bandLegs.length; i++) {
    const disc = baseShadow.clone(`shadow_${i}`);
    disc.material = shadowMat;
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

// Formation Quality HUD â€” wrist-mounted display on right arm of player marcher
const scoreHUD = MeshBuilder.CreatePlane("scoreHUD", { width: 0.18, height: 0.06 }, scene);
const playerForearmR = playerMarcher.bodyParts.forearmR;
scoreHUD.parent = playerForearmR ?? playerBody.getRightArm();
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
    const streakTxt = stepStreak > 2 ? ` ðŸ”¥${stepStreak}` : "";
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
let lastDrillFacing = 0;   // track drill facing so we can detect phase changes
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
const rightArm = playerMarcher.bodyParts.forearmR ?? playerBody.getRightArm();
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
const pointerObserver = scene.onPointerObservable.add(async (pointerInfo) => {
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
        // Remove this observer so pointer events go purely to the camera
        if (pointerObserver) scene.onPointerObservable.remove(pointerObserver);
    }
});

let gameOver = false;
let totalSongDuration = 0; // seconds, computed after OSMD loads
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
    const MAX_TURN_SPEED = 3.0; // rad/s â€” realistic marcher turn rate (~170Â°/s)
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
        // In free-fly, keep the body marching with the band at its drill slot
        if (freeFly && gameStartTime !== null) {
            const playerDrill = getDrillPosition(currentBeat, playerRow, playerCol, 5, 15, playerStartX, playerStartZ);
            playerBody.setBodyPosition(new Vector3(playerDrill.x, 0, playerDrill.z));
        } else {
            playerBody.setBodyPosition(new Vector3(camera.position.x, 0, camera.position.z));
        }

        bandLegs.forEach(({ anchor, plume, bodyParts }, index) => {
            const targetPos = drillPositions[index];
            const targetX = targetPos.x;
            const targetZ = targetPos.z;

            const isHalted = targetPos.style === MarchStyle.Halt;

            // Snap directly to precomputed collision-free position
            anchor.position.x = targetX;
            anchor.position.z = targetZ;

            // Stagger each marcher by a unique phase offset in radians
            const marcherPhase = (marchPhase + (index / bandLegs.length) * Math.PI * 2) % (Math.PI * 2);
            if (isHalted) {
                MarchingAnimationSystem.animateMarcher(marcherPhase, bodyParts, true, 0, 0, MarchStyle.Halt);
            } else {
                MarchingAnimationSystem.animateMarcher(marcherPhase, bodyParts, false, 0, 0, targetPos.style);
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

            // Update ground shadow to follow marcher
            const shadow = shadowDiscs[index];
            if (shadow) {
                shadow.position.x = anchor.position.x;
                shadow.position.z = anchor.position.z;
            }

            // Update plume color based on health (green=100% â†’ red=0%)
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

        // Visual feedback: pulse instrument meshes for sections currently playing
        const activeSfIndices = getActiveInstrumentsAtBeat(currentBeat);
        for (let m = 0; m < bandLegs.length; m++) {
            const member = bandLegs[m];
            if (!member.instrumentMesh) continue;
            const sfIdx = getSlotSfIndex(member.row, member.col);
            const isPlaying = sfIdx != null && activeSfIndices.has(sfIdx);
            // Animate instrument mesh scaling for visual feedback
            if (isPlaying) {
                const pulse = 1.0 + 0.08 * Math.sin(marchPhase * 4);
                member.instrumentMesh.scaling.setAll(pulse);
            } else {
                member.instrumentMesh.scaling.setAll(1.0);
            }

            // === Synchronized instrument pose animation ===
            // Use a shared t parameter for both arms and instrument
            if (!member._poseTransition) member._poseTransition = { t: isPlaying ? 1 : 0, target: isPlaying ? 1 : 0, speed: 3.0 };
            // If play/rest state changed, set new target
            if (isPlaying !== member._prevIsPlaying) {
                member._poseTransition.target = isPlaying ? 1 : 0;
            }
            // Smoothly animate t toward target
            const poseSpeed = member._poseTransition.speed; // units per second
            if (member._poseTransition.t !== member._poseTransition.target) {
                const delta = poseSpeed * frameDelta;
                if (Math.abs(member._poseTransition.t - member._poseTransition.target) <= delta) {
                    member._poseTransition.t = member._poseTransition.target;
                } else {
                    member._poseTransition.t += (member._poseTransition.target > member._poseTransition.t ? delta : -delta);
                }
            }
            // Clamp t
            member._poseTransition.t = Math.max(0, Math.min(1, member._poseTransition.t));
            // Set instrument AnimationGroup to correct frame
            if (member.bodyParts && member.bodyParts.instrumentJoint && member.instrumentRestToPlayAnim && member.instrumentPlayToRestAnim) {
                const t = member._poseTransition.t;
                // Pick which AnimationGroup to use based on direction
                const animGroup = (member._poseTransition.target === 1) ? member.instrumentRestToPlayAnim : member.instrumentPlayToRestAnim;
                animGroup.stop(); // Ensure not playing
                animGroup.goToFrame(t * 30); // 30 = total frames in animation
            }
            member._prevIsPlaying = isPlaying;

            // --- Apply instrument-specific arm pose if available (still direct for now) ---
            const plugin = INSTRUMENT_PLUGINS.find(p => p.type === member.instrumentType);
            if (plugin) {
                const armPose = isPlaying ? plugin.playArmPose : plugin.restArmPose;
                if (typeof armPose.shoulderLx === "number") {
                    if (member.bodyParts.shoulderJointL) {
                        member.bodyParts.shoulderJointL.rotation.x = armPose.shoulderLx;
                        member.bodyParts.shoulderJointL.rotation.z = armPose.shoulderLz;
                    }
                    if (member.bodyParts.elbowJointL) {
                        member.bodyParts.elbowJointL.rotation.x = armPose.elbowLx;
                    }
                    if (member.bodyParts.wristJointL) {
                        member.bodyParts.wristJointL.rotation.x = armPose.wristLx;
                    }
                    if (member.bodyParts.shoulderJointR) {
                        member.bodyParts.shoulderJointR.rotation.x = armPose.shoulderRx;
                        member.bodyParts.shoulderJointR.rotation.z = armPose.shoulderRz;
                    }
                    if (member.bodyParts.elbowJointR) {
                        member.bodyParts.elbowJointR.rotation.x = armPose.elbowRx;
                    }
                    if (member.bodyParts.wristJointR) {
                        member.bodyParts.wristJointR.rotation.x = armPose.wristRx;
                    }
                }
            }
        }

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
                gameOver = true;
                Tone.Transport.stop();
                beatIndicator.isVisible = false;
                scoreHUD.isVisible = false;
            }
        }
    }

    // Sync Web Audio API listener to camera for correct spatial orientation
    if (scene.activeCamera) {
        const camPos = scene.activeCamera.globalPosition;
        const camFwd = scene.activeCamera.getDirection(Vector3.Forward());
        updateAudioListener(camPos, camFwd);
    }

    // Update spatial audio panners â€” weighted centroid of nearby marchers per instrument group
    if (scene.activeCamera && sfPanners.size > 0) {
        const listenerPos = scene.activeCamera.globalPosition;
        updateSpatialAudio(listenerPos, bandLegs);
    }

    // Update player body with march animation and treadmill locomotion
    if (scene.activeCamera) {
        const dt = engine.getDeltaTime() / 1000;
        const secondsPerBeat = 60 / BPM;
        const beatPhase = (currentRenderTime % (secondsPerBeat * 2)) / (secondsPerBeat * 2) * Math.PI * 2; // 0-2Ï€ every 2 beats
        const { movement, turnY } = playerBody.update(scene.activeCamera, beatPhase, currentBeat, gameStartTime !== null, dt);

        if (freeFly) {
            // Free-fly: let FreeCamera built-in WASD/mouse handle everything
            // Keep the body marching at its drill slot (position set above),
            // override facing to match drill direction instead of camera
            if (gameStartTime !== null) {
                const playerDrill = getDrillPosition(currentBeat, playerRow, playerCol, 5, 15, playerStartX, playerStartZ);
                playerBody.setBodyRotationY(playerDrill.facing);
            }
        } else if (autoMarch && gameStartTime !== null) {
            // Auto-march: snap position to drill target, let FreeCamera handle mouse look
            const playerDrill = getDrillPosition(currentBeat, playerRow, playerCol, 5, 15, playerStartX, playerStartZ);
            scene.activeCamera.position.x = playerDrill.x;
            scene.activeCamera.position.z = playerDrill.z;
            // Only snap facing on drill phase transitions so mouse look isn't overridden each frame
            if ("rotation" in scene.activeCamera && Math.abs(playerDrill.facing - lastDrillFacing) > 0.001) {
                (scene.activeCamera as any).rotation.y = playerDrill.facing;
                lastDrillFacing = playerDrill.facing;
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
    // checkAndGenerateMeasures(); // Removed: OSMD render+getImageData per frame caused 82ms violations

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
