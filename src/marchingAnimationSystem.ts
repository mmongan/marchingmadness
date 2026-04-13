// === Plugin Interfaces ===
/**
 * MarchingAnimationPlugin: Interface for animation and body part drawing plugins.
 * Plugins can register new march styles, override animation, or customize body part visuals.
 */
export interface MarchingAnimationPlugin {
    /**
     * Called to register animation and drawing logic for new or existing styles.
     * @param service The AnimationService instance
     */
    register(service: typeof AnimationService): void;
}

/**
 * InstrumentDrawingPlugin: Interface for instrument mesh/visual plugins.
 * Plugins can register new instrument types or override instrument visuals.
 */
export interface InstrumentDrawingPlugin {
    /**
     * Called to register instrument drawing logic.
     * @param registry The instrument registry (user-defined, see example)
     */
    register(registry: InstrumentRegistry): void;
}

// === Example Plugin Usage ===
// Example: Add a new "Moonwalk" march style with custom animation and body draw
import { Scene, MeshBuilder, Color3, StandardMaterial } from "@babylonjs/core";

// 1. Define the new style (add to MarchStyle enum in your project)
// export enum MarchStyle { ... Moonwalk = "Moonwalk" }

// 2. Implement the plugin
export class MoonwalkPlugin implements MarchingAnimationPlugin {
    register(service: typeof AnimationService) {
        // Register custom leg animation
        service.registerLegAnimation("Moonwalk" as MarchStyle, (t, hipMax) => {
            // Example: reverse glide, feet slide backward
            return { hipX: -hipMax * Math.sin(t * Math.PI * 2), hipZ: 0, knee: 0.1, ankle: 0 };
        });
        // Register custom body draw (e.g., glowing shoes)
        service.registerBodyDraw("Moonwalk" as MarchStyle, (bodyParts) => {
            if (bodyParts.footL && bodyParts.footR) {
                const mat = new StandardMaterial("moonwalkGlow");
                mat.emissiveColor = new Color3(0.2, 0.8, 1);
                bodyParts.footL.material = mat;
                bodyParts.footR.material = mat;
            }
        });
    }
}

// Example: Instrument drawing plugin interface and usage
export interface InstrumentRegistry {
    registerInstrument(name: string, drawFn: (scene: Scene, parent: any) => any): void;
}

export class SaxophonePlugin implements InstrumentDrawingPlugin {
    register(registry: InstrumentRegistry) {
        registry.registerInstrument("Saxophone", (scene, parent) => {
            // Example: create a simple saxophone mesh
            const sax = MeshBuilder.CreateCylinder("sax", { height: 1, diameter: 0.1 }, scene);
            sax.parent = parent;
            const mat = new StandardMaterial("saxMat", scene);
            mat.diffuseColor = new Color3(1, 0.8, 0.2);
            sax.material = mat;
            return sax;
        });
    }
}
// AnimationService: Extensible registry for animation and body part drawing logic
export type MarchLegAnimation = (t: number, hipMax: number, kneeMax?: number) => LegResult;

export type MarchBodyDraw = (bodyParts: BodyParts, style: MarchStyle, ...args: any[]) => void;

export class AnimationService {
    private static legAnimations: Map<MarchStyle, { left: MarchLegAnimation; right: MarchLegAnimation }> = new Map();
    private static bodyDraws: Map<MarchStyle, MarchBodyDraw> = new Map();

    /**
     * Register separate left and right leg animation functions for a style.
     * If only one function is provided, both legs use the same function.
     */
    static registerLegAnimations(style: MarchStyle, leftFn: MarchLegAnimation, rightFn?: MarchLegAnimation) {
        AnimationService.legAnimations.set(style, { left: leftFn, right: rightFn ?? leftFn });
    }
    /**
     * Backward compatible: register a single function for both legs.
     */
    static registerLegAnimation(style: MarchStyle, fn: MarchLegAnimation) {
        AnimationService.registerLegAnimations(style, fn, fn);
    }

    // Register a body drawing function for a style
    static registerBodyDraw(style: MarchStyle, fn: MarchBodyDraw) {
        AnimationService.bodyDraws.set(style, fn);
    }

    // Ensure Halt style always has a static animation
    static ensureDefaultAnimations() {
        // Register a static animation for every MarchStyle if not present
        for (const style of Object.values(MarchStyle)) {
            if (!AnimationService.legAnimations.has(style)) {
                AnimationService.registerLegAnimations(style,
                    () => ({ hipX: 0, hipZ: 0, knee: 0, ankle: 0 }),
                    () => ({ hipX: 0, hipZ: 0, knee: 0, ankle: 0 })
                );
            }
        }
    }

    /**
     * Get the leg animation function for a style and leg side.
     * @param style MarchStyle
     * @param isLeft true for left leg, false for right leg
     */
    static getLegAnimation(style: MarchStyle, isLeft: boolean): MarchLegAnimation {
        AnimationService.ensureDefaultAnimations();
        const entry = AnimationService.legAnimations.get(style);
        if (!entry) throw new Error(`No leg animation registered for style: ${style}`);
        return isLeft ? entry.left : entry.right;
    }

    // Get the body draw function for a style, fallback to default (no-op)
    static getBodyDraw(style: MarchStyle): MarchBodyDraw {
        return AnimationService.bodyDraws.get(style) ?? (() => {});
    }
}

import { Mesh, InstancedMesh, TransformNode } from "@babylonjs/core";
import { STEP_SIZE } from "./marchConstants";

/** Upper leg (0.52m) + lower leg (0.45m). */
const LEG_LENGTH = 0.97;

/** Available march-step styles. */
export enum MarchStyle {
    /** Traditional marching-band high-step with sharp knee lift. */
    HighStep = "HighStep",
    /** Smooth gliding step — feet stay low, body floats forward. */
    Glide = "Glide",
    /** Lateral side-step — legs cross/uncross while body moves sideways. */
    SideStep = "SideStep",
    /** Marching in place — knees pump up/down, no forward travel. */
    MarkTime = "MarkTime",
    /** Walking backward — shorter stride, heel-toe roll. */
    BackMarch = "BackMarch",
    /** Exaggerated long strides with pointed toes for fast traversal. */
    JazzRun = "JazzRun",
    /** Grapevine crossover — body faces one way, legs cross over laterally. */
    CrabWalk = "CrabWalk",
    /** Attention/halt — legs together, no movement. */
    Halt = "Halt",
    /** Corps-style drag step — toe drags along ground before planting. */
    DragStep = "DragStep",
    /** Free-form scatter run — loose, asymmetric stride. */
    Scatter = "Scatter",
    /** Pivot/pinwheel — one foot planted, other steps in arc. */
    Pivot = "Pivot",
    /** Heel-to-toe roll — the default corps-style forward march. */
    RollStep = "RollStep",
    /** Galloping lateral chassé — quick side-together-side. */
    Chasse = "Chasse",
    /** Square-pattern box step — used in dance features. */
    BoxStep = "BoxStep",
    /** 90° snap turn while maintaining stride tempo. */
    Flank = "Flank",
    /** Bouncy exaggerated step — parade prance. */
    SkipPrance = "SkipPrance",
    /** Pivot with dragging arc foot. */
    DragTurn = "DragTurn",
    /** Abrupt halt on a specific count mid-stride. */
    StopHit = "StopHit",
    /** Both feet point forward while body moves laterally. */
    TrueCrab = "TrueCrab",
    /** Diagonal march angled left (~30-60° off facing). */
    ObliqueLeft = "ObliqueLeft",
    /** Diagonal march angled right (~30-60° off facing). */
    ObliqueRight = "ObliqueRight",
}

/**
 * Velocity range per style in meters-per-beat.
 * Based on 8-to-5 standard: 1 step = 0.5715m (5 yards / 8 steps).
 * Common paces: 8-to-5 = 0.57m, 6-to-5 = 0.76m, 12-to-5 = 0.38m, 16-to-5 = 0.29m.
 */
const S = 5 * 0.9144 / 8; // 0.5715m — one 8-to-5 step
export const STYLE_VELOCITY: Record<MarchStyle, { min: number; max: number }> = {
    [MarchStyle.Halt]:      { min: 0,       max: 0 },            // no movement
    [MarchStyle.MarkTime]:  { min: 0,       max: 0 },            // in-place only
    [MarchStyle.HighStep]:  { min: S * 0.5,  max: S * 1.0 },   // 16-to-5 → 8-to-5
    [MarchStyle.Glide]:     { min: S * 0.33, max: S * 0.8 },    // 24-to-5 → 10-to-5
    [MarchStyle.DragStep]:  { min: S * 0.33, max: S * 0.67 },   // 24-to-5 → 12-to-5
    [MarchStyle.BackMarch]: { min: S * 0.33, max: S * 0.67 },   // 24-to-5 → 12-to-5
    [MarchStyle.SideStep]:  { min: S * 0.25, max: S * 0.5 },    // 32-to-5 → 16-to-5
    [MarchStyle.CrabWalk]:  { min: S * 0.25, max: S * 0.5 },    // 32-to-5 → 16-to-5
    [MarchStyle.Pivot]:     { min: S * 0.1,  max: S * 0.33 },   // creep → 24-to-5
    [MarchStyle.JazzRun]:   { min: S * 0.8,  max: S * 1.0 },    // 10-to-5 → 8-to-5
    [MarchStyle.Scatter]:   { min: S * 0.8,  max: S * 1.0 },    // 10-to-5 → 8-to-5
    [MarchStyle.RollStep]:  { min: S * 0.5,  max: S * 1.0 },    // 16-to-5 → 8-to-5
    [MarchStyle.Chasse]:    { min: S * 0.33, max: S * 0.8 },    // 24-to-5 → 10-to-5
    [MarchStyle.BoxStep]:   { min: S * 0.25, max: S * 0.5 },    // 32-to-5 → 16-to-5
    [MarchStyle.Flank]:     { min: S * 0.5,  max: S * 0.8 },    // 16-to-5 → 10-to-5
    [MarchStyle.SkipPrance]:{ min: S * 0.5,  max: S * 1.0 },    // 16-to-5 → 8-to-5
    [MarchStyle.DragTurn]:  { min: S * 0.1,  max: S * 0.33 },   // creep → 24-to-5
    [MarchStyle.StopHit]:   { min: S * 0.33, max: S * 0.8 },    // 24-to-5 → 10-to-5
    [MarchStyle.TrueCrab]:  { min: S * 0.25, max: S * 0.5 },    // 32-to-5 → 16-to-5
    [MarchStyle.ObliqueLeft]:  { min: S * 0.33, max: S * 0.8 },  // 24-to-5 → 10-to-5
    [MarchStyle.ObliqueRight]: { min: S * 0.33, max: S * 0.8 },  // 24-to-5 → 10-to-5
};

/**
 * Body part references for joint-based skeletal animation.
 *
 * HIERARCHY (each joint is a TransformNode; rotating a joint pivots
 * everything below it around that joint's position):
 *
 *   anchor
 *   └─ torsoJoint (at hip level)
 *       ├─ pelvis mesh
 *       ├─ spineJoint (at torso bottom)
 *       │   ├─ torso mesh
 *       │   ├─ neckJoint → neck mesh → headJoint → head mesh
 *       │   ├─ shoulderJointL → upperArmL → elbowJointL → forearmL → wristJointL → handL
 *       │   └─ shoulderJointR → upperArmR → elbowJointR → forearmR → wristJointR → handR
 *       ├─ hipJointL → upperLegL → kneeJointL → lowerLegL → ankleJointL → footL
 *       └─ hipJointR → upperLegR → kneeJointR → lowerLegR → ankleJointR → footR
 */
export interface BodyParts {
    // Bone meshes (positioned as children of joints, NOT animated directly)
    head?: InstancedMesh | Mesh;
    neck?: InstancedMesh | Mesh;
    torso?: InstancedMesh | Mesh;
    pelvis?: InstancedMesh | Mesh;
    upperArmL?: InstancedMesh | Mesh;
    upperArmR?: InstancedMesh | Mesh;
    forearmL?: InstancedMesh | Mesh;
    forearmR?: InstancedMesh | Mesh;
    handL?: InstancedMesh | Mesh;
    handR?: InstancedMesh | Mesh;
    upperLegL?: InstancedMesh | Mesh;
    upperLegR?: InstancedMesh | Mesh;
    lowerLegL?: InstancedMesh | Mesh;
    lowerLegR?: InstancedMesh | Mesh;
    footL?: InstancedMesh | Mesh;
    footR?: InstancedMesh | Mesh;

    // JOINT NODES — these are rotated by the animation system
    torsoJoint?: TransformNode;   // root body joint at hip level
    spineJoint?: TransformNode;   // spine base (torso bottom)
    neckJoint?: TransformNode;
    headJoint?: TransformNode;
    shoulderJointL?: TransformNode;
    shoulderJointR?: TransformNode;
    elbowJointL?: TransformNode;
    elbowJointR?: TransformNode;
    wristJointL?: TransformNode;
    wristJointR?: TransformNode;
    hipJointL?: TransformNode;    // independent left hip pivot
    hipJointR?: TransformNode;    // independent right hip pivot
    kneeJointL?: TransformNode;
    kneeJointR?: TransformNode;
    ankleJointL?: TransformNode;
    ankleJointR?: TransformNode;

    // Instrument pose switching (optional)
    instrumentJoint?: TransformNode;
    instrumentPlayPose?: import("./instrumentFactory").InstrumentPose;
    instrumentRestPose?: import("./instrumentFactory").InstrumentPose;
}

/** Unified leg-animation result: hip forward/back (x), hip lateral (z), knee bend, ankle flex. */
interface LegResult {
    hipX: number;
    hipZ: number;
    knee: number;
    ankle: number;
}

/**
 * Marching-band animation system with multiple step styles.
 *
 * KEY PRINCIPLE: only TransformNode joints are rotated.
 * - hipJointL / hipJointR  → swing the ENTIRE leg forward / back
 * - kneeJointL / kneeJointR → bend the lower leg only
 * - ankleJointL / ankleJointR → flex the foot
 * - shoulderJoint → swing the arm; elbowJoint → bend forearm
 */
export class MarchingAnimationSystem {
    /**
     * Compute leg angles for one leg given its normalised phase (0-1).
     *
     * Phase breakdown (physics-correct ground contact):
     *   0.00 – 0.50  STANCE  foot planted, hip sweeps linearly back→front
     *                         matching body displacement exactly
     *   0.50 – 0.70  LIFT    toe leaves ground, knee bends, thigh returns to vertical
     *   0.70 – 0.85  PEAK    knee held high (parade "show" moment)
     *   0.85 – 1.00  PLANT   leg straightens, foot reaches forward for next stance
     *
     * Returns { hipX, hipZ, knee, ankle } rotation values (radians).
     */
    public static legPhase(t: number, hipMax: number, kneeMax: number): LegResult {
        const ss = MarchingAnimationSystem.ss;
        let hipX = 0;
        let knee = 0;
        let ankle = 0;

        if (t < 0.50) {
            // STANCE — foot planted, hip sweeps linearly so foot speed = body speed
            const s = t / 0.50; // 0→1
            hipX = hipMax * (1 - 2 * s);      // +hipMax → −hipMax
            knee = 0.04 * Math.sin(s * Math.PI); // minimal mid-stance flex
            ankle = 0;
        } else if (t < 0.70) {
            // LIFT — toe leaves ground, knee bends, thigh returns toward vertical
            const s = ss(0.50, 0.70, t);
            hipX = -hipMax * (1 - s);         // −hipMax → 0
            knee = s * kneeMax;
            ankle = -s * 0.12;
        } else if (t < 0.85) {
            // PEAK — high knee, thigh near vertical
            hipX = 0;
            knee = kneeMax;
            ankle = -0.12;
        } else {
            // PLANT — thigh swings forward, knee straightens, foot reaches for ground
            const s = ss(0.85, 1.0, t);
            hipX = s * hipMax;                 // 0 → +hipMax
            knee = kneeMax * (1 - s);
            ankle = -0.12 * (1 - s);
        }

        return { hipX, hipZ: 0, knee, ankle };
    }

    /** Unified leg result: forward/back hip (x), lateral hip (z), knee, ankle. */
    public static readonly ZERO_LEG: LegResult = { hipX: 0, hipZ: 0, knee: 0, ankle: 0 };

    public static ss(a: number, b: number, x: number): number {
        const s = Math.max(0, Math.min(1, (x - a) / (b - a)));
        return s * s * (3 - 2 * s);
    }

    /** Glide — smooth low step, feet stay close to ground but don't slide. */
    public static glideLeg(t: number, hipMax: number): LegResult {
        const ss = MarchingAnimationSystem.ss;
        let hipX = 0, knee = 0, ankle = 0;
        if (t < 0.55) {
            // STANCE — foot planted, linear sweep, low knee
            const s = t / 0.55;
            hipX = hipMax * (1 - 2 * s);      // +hipMax → −hipMax
            knee = 0.03 * Math.sin(s * Math.PI);
            ankle = 0;
        } else if (t < 0.80) {
            // SWING — foot barely lifts, glides forward
            const s = ss(0.55, 0.80, t);
            hipX = -hipMax * (1 - s);          // −hipMax → 0
            knee = s * 0.12;                   // very low lift
            ankle = -s * 0.04;
        } else {
            // PLANT — foot reaches forward just above ground
            const s = ss(0.80, 1.0, t);
            hipX = s * hipMax;                 // 0 → +hipMax
            knee = 0.12 * (1 - s);
            ankle = -0.04 * (1 - s);
        }
        return { hipX, hipZ: 0, knee, ankle };
    }

    /** SideStep — lateral step with proper ground contact. */
    public static sideStepLeg(t: number, hipMax: number): LegResult {
        const ss = MarchingAnimationSystem.ss;
        let hipX = 0, hipZ = 0, knee = 0, ankle = 0;
        if (t < 0.50) {
            // STANCE — foot planted, hipZ sweeps linearly to match lateral body speed
            const s = t / 0.50;
            hipZ = hipMax * (1 - 2 * s);       // +hipMax → −hipMax (lateral)
            hipX = -0.04 * Math.sin(s * Math.PI); // tiny sagittal stabilisation
            knee = 0.03 * Math.sin(s * Math.PI);
            ankle = 0;
        } else if (t < 0.75) {
            // LIFT — foot lifts laterally, crosses back
            const s = ss(0.50, 0.75, t);
            hipZ = -hipMax * (1 - s);          // −hipMax → 0
            hipX = -s * hipMax * 0.12;
            knee = s * 0.25;
            ankle = -s * 0.06;
        } else {
            // PLANT — foot reaches laterally for next stance
            const s = ss(0.75, 1.0, t);
            hipZ = s * hipMax;                  // 0 → +hipMax
            knee = 0.25 * (1 - s);
            ankle = -0.06 * (1 - s);
        }
        return { hipX, hipZ, knee, ankle };
    }

    /** MarkTime — marching in place, knees pump vertically. */
    public static markTimeLeg(t: number, hipMax: number, kneeMax: number): LegResult {
        const ss = MarchingAnimationSystem.ss;
        let hipX = 0, knee = 0, ankle = 0;
        if (t < 0.4) {
            // LIFT — knee comes up (positive hipX = forward in our convention,
            // negated at application to match Babylon.js)
            const l = ss(0, 0.4, t);
            hipX = l * hipMax * 0.3;
            knee = l * kneeMax * 0.35;
            ankle = -l * 0.1;
        } else if (t < 0.6) {
            // HOLD — knee stays up
            hipX = hipMax * 0.3;
            knee = kneeMax * 0.35;
            ankle = -0.1;
        } else {
            // DOWN — foot returns to ground
            const d = ss(0.6, 1.0, t);
            hipX = hipMax * 0.3 * (1 - d);
            knee = kneeMax * 0.35 * (1 - d);
            ankle = -0.1 * (1 - d);
        }
        return { hipX, hipZ: 0, knee, ankle };
    }

    /** BackMarch — reversed stride with proper ground contact. */
    public static backMarchLeg(t: number, hipMax: number): LegResult {
        const ss = MarchingAnimationSystem.ss;
        let hipX = 0, knee = 0, ankle = 0;
        if (t < 0.50) {
            // STANCE — foot planted, hip sweeps front→back (reverse of forward march)
            const s = t / 0.50;
            hipX = -hipMax * (1 - 2 * s);     // −hipMax → +hipMax
            knee = 0.03 * Math.sin(s * Math.PI);
            ankle = 0;
        } else if (t < 0.75) {
            // SWING BACK — foot lifts, swings backward
            const s = ss(0.50, 0.75, t);
            hipX = hipMax * (1 - s);           // +hipMax → 0
            knee = s * 0.25;
            ankle = s * 0.12;
        } else {
            // PLANT — foot reaches back and sets down
            const s = ss(0.75, 1.0, t);
            hipX = -s * hipMax;                // 0 → −hipMax
            knee = 0.25 * (1 - s);
            ankle = 0.12 * (1 - s);
        }
        return { hipX, hipZ: 0, knee, ankle };
    }

    /** JazzRun — exaggerated long strides with proper ground contact. */
    public static jazzRunLeg(t: number, hipMax: number, kneeMax: number): LegResult {
        const ss = MarchingAnimationSystem.ss;
        let hipX = 0, knee = 0, ankle = 0;
        if (t < 0.45) {
            // STANCE — foot planted, hip sweeps linearly back→front
            const s = t / 0.45;
            hipX = hipMax * (1 - 2 * s);      // +hipMax → −hipMax
            knee = 0.03 * Math.sin(s * Math.PI);
            ankle = s * 0.10;                 // toe pushes off at end
        } else if (t < 0.65) {
            // LIFT — fast forward swing with knee drive
            const s = ss(0.45, 0.65, t);
            hipX = -hipMax * (1 - s * 0.5);   // −hipMax → −0.5*hipMax
            knee = s * kneeMax * 0.6;
            ankle = 0.10 * (1 - s) - s * 0.15;
        } else if (t < 0.80) {
            // REACH — leg extends forward for next ground strike
            const s = ss(0.65, 0.80, t);
            hipX = -hipMax * 0.5 + s * hipMax * 1.0; // −0.5*hipMax → +0.5*hipMax
            knee = kneeMax * 0.6 * (1 - s * 0.8);
            ankle = -0.15 * (1 - s);
        } else {
            // PLANT — foot reaches ground
            const s = ss(0.80, 1.0, t);
            hipX = hipMax * (0.5 + 0.5 * s);  // +0.5*hipMax → +hipMax
            knee = kneeMax * 0.12 * (1 - s);
            ankle = 0;
        }
        return { hipX, hipZ: 0, knee, ankle };
    }

    /**
     * CrabWalk — grapevine crossover with legs passing around each other.
     * isLeft: true for the left leg, false for the right.
     * The swinging leg crosses IN FRONT (positive hipX) while the stance leg
     * tucks slightly BEHIND (negative hipX), so they never intersect.
     */
    public static crabWalkLeg(t: number, hipMax: number, _isLeft: boolean): LegResult {
        const ss = MarchingAnimationSystem.ss;
        let hipX = 0, hipZ = 0, knee = 0, ankle = 0;
        if (t < 0.50) {
            // STANCE — foot planted, hipZ sweeps linearly for lateral contact.
            // Tuck the stance leg slightly backward so the crossing leg can pass in front.
            const s = t / 0.50;
            hipZ = hipMax * (1 - 2 * s);       // +hipMax → −hipMax
            hipX = -0.12 * Math.sin(s * Math.PI); // tuck behind during mid-stance
            knee = 0.04 * Math.sin(s * Math.PI);
            ankle = 0;
        } else if (t < 0.75) {
            // CROSS — foot lifts, crosses IN FRONT of the other leg.
            // Positive hipX = forward, high knee = leg arcs over.
            const s = ss(0.50, 0.75, t);
            hipZ = -hipMax * (1 - s);          // −hipMax → 0
            hipX = s * hipMax * 0.25;          // swing forward to pass in front
            knee = s * 0.45;                   // high knee to clear
            ankle = -s * 0.10;
        } else {
            // OPEN — foot reaches laterally for next stance, returns to neutral depth
            const s = ss(0.75, 1.0, t);
            hipZ = s * hipMax;                  // 0 → +hipMax
            hipX = hipMax * 0.25 * (1 - s);    // return from front to neutral
            knee = 0.45 * (1 - s);
            ankle = -0.10 * (1 - s);
        }
        return { hipX, hipZ, knee, ankle };
    }

    /** DragStep — corps-style march with toe drag aesthetic, but proper stance. */
    public static dragStepLeg(t: number, hipMax: number): LegResult {
        const ss = MarchingAnimationSystem.ss;
        let hipX = 0, knee = 0, ankle = 0;
        if (t < 0.50) {
            // STANCE — foot planted, linear hip sweep matching body speed
            const s = t / 0.50;
            hipX = hipMax * (1 - 2 * s);       // +hipMax → −hipMax
            knee = 0;
            ankle = s * 0.15;                  // toe pushes (plantarflex at end)
        } else if (t < 0.70) {
            // DRAG LIFT — toe drags low along ground (signature of style)
            const s = ss(0.50, 0.70, t);
            hipX = -hipMax * (1 - s * 0.6);    // −hipMax → −0.4*hipMax
            knee = s * 0.08;                   // barely lifts
            ankle = 0.15 * (1 - s) + s * 0.12; // pointed toe drags
        } else {
            // SCOOP FORWARD — foot scoops to reach for next stance
            const s = ss(0.70, 1.0, t);
            hipX = -hipMax * 0.4 + s * hipMax * 1.4; // → +hipMax
            knee = 0.08 * (1 - s);
            ankle = 0.12 * (1 - s);
        }
        return { hipX, hipZ: 0, knee, ankle };
    }

    /** Scatter — loose, asymmetric running with ground contact. */
    public static scatterLeg(t: number, hipMax: number, kneeMax: number): LegResult {
        const ss = MarchingAnimationSystem.ss;
        let hipX = 0, knee = 0, ankle = 0;
        if (t < 0.45) {
            // STANCE — foot planted, linear sweep
            const s = t / 0.45;
            hipX = hipMax * (1 - 2 * s);
            knee = 0.04 * Math.sin(s * Math.PI);
            ankle = 0;
        } else if (t < 0.70) {
            // SWING — loose knee lift
            const s = ss(0.45, 0.70, t);
            hipX = -hipMax * (1 - s * 0.8);
            knee = s * kneeMax * 0.4;
            ankle = -s * 0.12;
        } else {
            // PLANT — set foot down
            const s = ss(0.70, 1.0, t);
            hipX = -hipMax * 0.2 + s * hipMax * 1.2; // → +hipMax
            knee = kneeMax * 0.4 * (1 - s);
            ankle = -0.12 * (1 - s);
        }
        return { hipX, hipZ: 0, knee, ankle };
    }

    /** Pivot — one foot planted, other steps around with ground contact. */
    public static pivotLeg(t: number, hipMax: number, isPivotFoot: boolean): LegResult {
        if (isPivotFoot) {
            // Planted foot — stays still with slight bend
            return { hipX: 0, hipZ: 0, knee: 0.05, ankle: 0 };
        }
        const ss = MarchingAnimationSystem.ss;
        // Stepping foot — arcs around with ground contact
        let hipX = 0, hipZ = 0, knee = 0, ankle = 0;
        if (t < 0.50) {
            // STANCE — foot on ground, arcs laterally
            const s = t / 0.50;
            hipX = -Math.sin(s * Math.PI) * hipMax * 0.3; // slight forward lean mid-stance
            hipZ = hipMax * 0.3 * (1 - 2 * s);              // linear lateral sweep
            knee = 0.03 * Math.sin(s * Math.PI);
            ankle = 0;
        } else if (t < 0.75) {
            // LIFT — foot lifts to step around
            const s = ss(0.50, 0.75, t);
            hipZ = -hipMax * 0.3 * (1 - s);    // returns to center
            hipX = -s * hipMax * 0.2;
            knee = s * 0.25;
            ankle = -s * 0.05;
        } else {
            // REACH — foot sets down at new position
            const s = ss(0.75, 1.0, t);
            hipZ = s * hipMax * 0.3;            // reaches for next stance
            knee = 0.25 * (1 - s);
            ankle = -0.05 * (1 - s);
        }
        return { hipX, hipZ, knee, ankle };
    }

    /** RollStep — corps-style heel-to-toe roll with proper ground contact. */
    public static rollStepLeg(t: number, hipMax: number): LegResult {
        const ss = MarchingAnimationSystem.ss;
        let hipX = 0, knee = 0, ankle = 0;
        if (t < 0.50) {
            // STANCE — heel strike to toe-off, linear hip sweep
            const s = t / 0.50;
            hipX = hipMax * (1 - 2 * s);      // +hipMax → −hipMax
            // Ankle rolls from dorsiflexed (heel) to plantarflexed (toe)
            ankle = -0.12 * (1 - s) + 0.15 * s;
            knee = 0.03 * Math.sin(s * Math.PI); // tiny mid-stance flexion
        } else if (t < 0.75) {
            // SWING — foot lifts, swings forward
            const s = ss(0.50, 0.75, t);
            hipX = -hipMax * (1 - s);          // −hipMax → 0
            knee = s * 0.20;
            ankle = 0.15 * (1 - s) - s * 0.12;
        } else {
            // PLANT — foot reaches forward, heel prepares for strike
            const s = ss(0.75, 1.0, t);
            hipX = s * hipMax;                  // 0 → +hipMax
            knee = 0.20 * (1 - s);
            ankle = -0.12 * s;                  // dorsiflex for heel strike
        }
        return { hipX, hipZ: 0, knee, ankle };
    }

    /** Chassé — galloping lateral step with proper ground contact. */
    public static chasseLeg(t: number, hipMax: number, isLeadLeg: boolean): LegResult {
        const ss = MarchingAnimationSystem.ss;
        let hipX = 0, hipZ = 0, knee = 0, ankle = 0;
        if (isLeadLeg) {
            // Lead leg: takes the big lateral step
            if (t < 0.45) {
                // STANCE — foot planted, linear lateral sweep
                const s = t / 0.45;
                hipZ = hipMax * (1 - 2 * s);   // +hipMax → −hipMax
                hipX = -0.03 * Math.sin(s * Math.PI);
                knee = 0.03 * Math.sin(s * Math.PI);
                ankle = 0;
            } else if (t < 0.70) {
                // LIFT — foot lifts laterally
                const s = ss(0.45, 0.70, t);
                hipZ = -hipMax * (1 - s);      // −hipMax → 0
                hipX = -s * hipMax * 0.08;
                knee = s * 0.20;
                ankle = -s * 0.05;
            } else {
                // GALLOP REACH — quick step out for next stance
                const s = ss(0.70, 1.0, t);
                hipZ = s * hipMax;              // 0 → +hipMax
                knee = 0.20 * (1 - s);
                ankle = -0.05 * (1 - s);
            }
        } else {
            // Trailing leg: closes gap, then prepares
            if (t < 0.45) {
                // STANCE — foot planted, sweeps to close
                const s = t / 0.45;
                hipZ = -hipMax * 0.6 * (1 - 2 * s); // smaller sweep (trailing covers less)
                knee = 0.02 * Math.sin(s * Math.PI);
                ankle = 0;
            } else if (t < 0.70) {
                // HOP — small lift
                const s = ss(0.45, 0.70, t);
                hipZ = hipMax * 0.6 * (1 - s * 0.5);
                knee = s * 0.12;
            } else {
                // CLOSE — reach toward lead
                const s = ss(0.70, 1.0, t);
                hipZ = hipMax * 0.3 * (1 - s)  - s * hipMax * 0.6;
                knee = 0.12 * (1 - s);
            }
        }
        return { hipX, hipZ, knee, ankle };
    }

    /** BoxStep — square-pattern step with proper ground contact each direction. */
    public static boxStepLeg(t: number, hipMax: number, isLeadLeg: boolean): LegResult {
        const ss = MarchingAnimationSystem.ss;
        let hipX = 0, hipZ = 0, knee = 0, ankle = 0;
        // Each quarter = one step direction. First half of each quarter = stance, second = swing.
        if (isLeadLeg) {
            if (t < 0.25) {
                // Forward step
                const q = t / 0.25;
                if (q < 0.55) {
                    // STANCE — foot planted, linear forward sweep
                    const s = q / 0.55;
                    hipX = hipMax * 0.4 * (1 - 2 * s);
                    knee = 0.02 * Math.sin(s * Math.PI);
                } else {
                    // SWING — lift and reach
                    const s = ss(0.55, 1.0, q);
                    hipX = -hipMax * 0.4 * (1 - s) + s * hipMax * 0.4;
                    knee = Math.sin(s * Math.PI) * 0.15;
                }
            } else if (t < 0.5) {
                // Side step
                const q = (t - 0.25) / 0.25;
                if (q < 0.55) {
                    const s = q / 0.55;
                    hipZ = hipMax * 0.35 * (1 - 2 * s);
                    knee = 0.02 * Math.sin(s * Math.PI);
                } else {
                    const s = ss(0.55, 1.0, q);
                    hipZ = -hipMax * 0.35 * (1 - s) + s * hipMax * 0.35;
                    knee = Math.sin(s * Math.PI) * 0.12;
                }
            } else if (t < 0.75) {
                // Back step
                const q = (t - 0.50) / 0.25;
                if (q < 0.55) {
                    const s = q / 0.55;
                    hipX = -hipMax * 0.3 * (1 - 2 * s);
                    knee = 0.02 * Math.sin(s * Math.PI);
                } else {
                    const s = ss(0.55, 1.0, q);
                    hipX = hipMax * 0.3 * (1 - s) - s * hipMax * 0.3;
                    knee = Math.sin(s * Math.PI) * 0.12;
                }
            } else {
                // Close
                const q = (t - 0.75) / 0.25;
                if (q < 0.55) {
                    const s = q / 0.55;
                    hipZ = -hipMax * 0.35 * (1 - 2 * s);
                    knee = 0.02 * Math.sin(s * Math.PI);
                } else {
                    const s = ss(0.55, 1.0, q);
                    hipZ = hipMax * 0.35 * (1 - s) - s * hipMax * 0.35;
                    knee = Math.sin(s * Math.PI) * 0.12;
                }
            }
        } else {
            // Mirror: back, side, forward, close
            if (t < 0.25) {
                const q = t / 0.25;
                if (q < 0.55) {
                    const s = q / 0.55;
                    hipX = -hipMax * 0.3 * (1 - 2 * s);
                    knee = 0.02 * Math.sin(s * Math.PI);
                } else {
                    const s = ss(0.55, 1.0, q);
                    hipX = hipMax * 0.3 * (1 - s) - s * hipMax * 0.3;
                    knee = Math.sin(s * Math.PI) * 0.12;
                }
            } else if (t < 0.5) {
                const q = (t - 0.25) / 0.25;
                if (q < 0.55) {
                    const s = q / 0.55;
                    hipZ = -hipMax * 0.35 * (1 - 2 * s);
                    knee = 0.02 * Math.sin(s * Math.PI);
                } else {
                    const s = ss(0.55, 1.0, q);
                    hipZ = hipMax * 0.35 * (1 - s) - s * hipMax * 0.35;
                    knee = Math.sin(s * Math.PI) * 0.12;
                }
            } else if (t < 0.75) {
                const q = (t - 0.50) / 0.25;
                if (q < 0.55) {
                    const s = q / 0.55;
                    hipX = hipMax * 0.4 * (1 - 2 * s);
                    knee = 0.02 * Math.sin(s * Math.PI);
                } else {
                    const s = ss(0.55, 1.0, q);
                    hipX = -hipMax * 0.4 * (1 - s) + s * hipMax * 0.4;
                    knee = Math.sin(s * Math.PI) * 0.15;
                }
            } else {
                const q = (t - 0.75) / 0.25;
                if (q < 0.55) {
                    const s = q / 0.55;
                    hipZ = hipMax * 0.35 * (1 - 2 * s);
                    knee = 0.02 * Math.sin(s * Math.PI);
                } else {
                    const s = ss(0.55, 1.0, q);
                    hipZ = -hipMax * 0.35 * (1 - s) + s * hipMax * 0.35;
                    knee = Math.sin(s * Math.PI) * 0.12;
                }
            }
        }
        return { hipX, hipZ, knee, ankle };
    }

    /** Flank — 90° snap turn with proper ground contact after pivot. */
    public static flankLeg(t: number, hipMax: number): LegResult {
        const ss = MarchingAnimationSystem.ss;
        let hipX = 0, knee = 0, ankle = 0;
        if (t < 0.15) {
            // PLANT — sharp weight transfer
            const p = ss(0, 0.15, t);
            hipX = hipMax * p;                 // reach forward to plant
            knee = p * 0.10;
            ankle = 0;
        } else if (t < 0.50) {
            // STANCE — foot on ground, hip sweeps matching body
            const s = (t - 0.15) / 0.35;
            hipX = hipMax * (1 - 2 * s);       // +hipMax → −hipMax
            knee = 0.10 * (1 - s);
            ankle = 0;
        } else if (t < 0.75) {
            // SWING — leg lifts for snap turn
            const s = ss(0.50, 0.75, t);
            hipX = -hipMax * (1 - s);
            knee = s * 0.30;
            ankle = -s * 0.08;
        } else {
            // REACH — foot sets down for next step
            const s = ss(0.75, 1.0, t);
            hipX = s * hipMax;
            knee = 0.30 * (1 - s);
            ankle = -0.08 * (1 - s);
        }
        return { hipX, hipZ: 0, knee, ankle };
    }

    /** SkipPrance — bouncy, exaggerated parade step with ground contact. */
    public static skipPranceLeg(t: number, hipMax: number, kneeMax: number): LegResult {
        const ss = MarchingAnimationSystem.ss;
        let hipX = 0, knee = 0, ankle = 0;
        if (t < 0.40) {
            // STANCE — foot planted, linear sweep with slight bounce
            const s = t / 0.40;
            hipX = hipMax * (1 - 2 * s);      // +hipMax → −hipMax
            knee = 0.04 * Math.sin(s * Math.PI);
            ankle = 0;
        } else if (t < 0.60) {
            // HOP LIFT — exaggerated knee drive
            const s = ss(0.40, 0.60, t);
            hipX = -hipMax * (1 - s * 0.8);    // rises toward vertical
            knee = s * kneeMax * 0.9;
            ankle = -s * 0.25;
        } else if (t < 0.80) {
            // PEAK — parade show moment, knee high
            hipX = -hipMax * 0.2;
            knee = kneeMax * 0.9;
            ankle = -0.25;
        } else {
            // BOUNCE DOWN — foot springs down to plant
            const s = ss(0.80, 1.0, t);
            hipX = -hipMax * 0.2 + s * hipMax * 1.2; // → +hipMax
            knee = kneeMax * 0.9 * (1 - s);
            ankle = -0.25 * (1 - s);
        }
        return { hipX, hipZ: 0, knee, ankle };
    }

    /** DragTurn — pivot with one foot dragging in an arc. */
    public static dragTurnLeg(t: number, hipMax: number, isDragFoot: boolean): LegResult {
        if (!isDragFoot) {
            // Planted pivot foot — slight bend, stable
            return { hipX: 0, hipZ: 0, knee: 0.08, ankle: 0 };
        }
        const ss = MarchingAnimationSystem.ss;
        // Dragging foot scribes an arc with toe scraping
        let hipX = 0, hipZ = 0, knee = 0, ankle = 0;
        if (t < 0.5) {
            // ARC OUT — foot drags outward and back
            const a = ss(0, 0.5, t);
            hipZ = -a * hipMax * 0.45;
            hipX = a * hipMax * 0.2;
            knee = 0.05; // nearly straight — toe drags
            ankle = a * 0.2; // pointed toe scrapes ground
        } else {
            // ARC RETURN — foot drags back to center
            const r = ss(0.5, 1.0, t);
            hipZ = -hipMax * 0.45 * (1 - r);
            hipX = hipMax * 0.2 * (1 - r);
            knee = 0.05;
            ankle = 0.2 * (1 - r);
        }
        return { hipX, hipZ, knee, ankle };
    }

    /** StopHit — marching with proper ground contact then abrupt halt. */
    public static stopHitLeg(t: number, hipMax: number, _kneeMax: number): LegResult {
        const ss = MarchingAnimationSystem.ss;
        let hipX = 0, knee = 0, ankle = 0;
        if (t < 0.35) {
            // STANCE — foot planted, hip sweeps matching body
            const s = t / 0.35;
            hipX = hipMax * (1 - 2 * s);      // +hipMax → −hipMax
            knee = 0.03 * Math.sin(s * Math.PI);
            ankle = 0;
        } else if (t < 0.45) {
            // SNAP HALT — abrupt stop, leg slams down
            const s = ss(0.35, 0.45, t);
            hipX = -hipMax * (1 - s);
            knee = s * 0.05;
            ankle = 0;
        } else {
            // LOCKED — attention position, slight rebound
            const r = ss(0.45, 0.65, t);
            const rebound = Math.sin(r * Math.PI) * 0.02;
            hipX = rebound;
            knee = 0.05 * (1 - Math.min(1, (t - 0.45) / 0.20));
            ankle = 0;
        }
        return { hipX, hipZ: 0, knee, ankle };
    }

    /** TrueCrab — lateral slide with both feet pointing forward. */
    /** TrueCrab — lateral movement, both feet point forward, with ground contact. */
    public static trueCrabLeg(t: number, hipMax: number, isLeadLeg: boolean): LegResult {
        const ss = MarchingAnimationSystem.ss;
        let hipZ = 0, knee = 0, ankle = 0;
        if (isLeadLeg) {
            // Lead leg: steps out laterally
            if (t < 0.50) {
                // STANCE — foot planted, linear lateral sweep
                const s = t / 0.50;
                hipZ = hipMax * (1 - 2 * s);   // +hipMax → −hipMax
                knee = 0.03 * Math.sin(s * Math.PI);
                ankle = 0;
            } else if (t < 0.75) {
                // LIFT — foot lifts to step out
                const s = ss(0.50, 0.75, t);
                hipZ = -hipMax * (1 - s);
                knee = s * 0.18;
                ankle = -s * 0.04;
            } else {
                // REACH — foot reaches laterally for next stance
                const s = ss(0.75, 1.0, t);
                hipZ = s * hipMax;
                knee = 0.18 * (1 - s);
                ankle = -0.04 * (1 - s);
            }
        } else {
            // Trailing leg: closes the gap
            if (t < 0.50) {
                // STANCE — foot planted, sweeps to close (smaller range)
                const s = t / 0.50;
                hipZ = -hipMax * 0.6 * (1 - 2 * s);
                knee = 0.02 * Math.sin(s * Math.PI);
                ankle = 0;
            } else if (t < 0.75) {
                // SLIDE CLOSE — foot lifts minimally
                const s = ss(0.50, 0.75, t);
                hipZ = hipMax * 0.6 * (1 - s * 0.5);
                knee = s * 0.08;
            } else {
                // SET — foot sets down
                const s = ss(0.75, 1.0, t);
                hipZ = hipMax * 0.3 * (1 - s) - s * hipMax * 0.6;
                knee = 0.08 * (1 - s);
            }
        }
        return { hipX: 0, hipZ, knee, ankle };
    }

    /**
     * Oblique diagonal march — forward step with lateral hip shift and ground contact.
     * @param side -1 = oblique left, +1 = oblique right
     */
    public static obliqueLeg(t: number, hipMax: number, kneeMax: number, isLeft: boolean, side: number): LegResult {
        const ss = MarchingAnimationSystem.ss;
        let hipX = 0, knee = 0, ankle = 0, hipZ = 0;
        const phase = isLeft ? t : (t + 0.5) % 1;
        if (phase < 0.50) {
            // STANCE — foot planted, hip sweeps linearly (forward + lateral)
            const s = phase / 0.50;
            hipX = hipMax * 0.7 * (1 - 2 * s);       // forward sweep
            hipZ = side * hipMax * 0.3 * (1 - 2 * s); // lateral sweep
            knee = 0.03 * Math.sin(s * Math.PI);
            ankle = 0;
        } else if (phase < 0.75) {
            // SWING — foot lifts, moves diagonally forward
            const s = ss(0.50, 0.75, phase);
            hipX = -hipMax * 0.7 * (1 - s);           // returns toward 0
            hipZ = -side * hipMax * 0.3 * (1 - s);
            knee = s * kneeMax * 0.5;
            ankle = -s * 0.10;
        } else {
            // PLANT — foot reaches diagonally for next stance
            const s = ss(0.75, 1.0, phase);
            hipX = s * hipMax * 0.7;                   // → +0.7*hipMax
            hipZ = s * side * hipMax * 0.3;             // → side*0.3*hipMax
            knee = kneeMax * 0.5 * (1 - s);
            ankle = -0.10 * (1 - s);
        }
        return { hipX, hipZ, knee, ankle };
    }

    /** Compute left + right leg poses for a given style without applying to joints. */
    static computeLegs(
        phaseNorm: number,
        hipMax: number,
        kneeMax: number,
        style: MarchStyle
    ): { legL: LegResult; legR: LegResult } {
        // Use AnimationService for extensibility
        const leftFn = AnimationService.getLegAnimation(style, true);
        const rightFn = AnimationService.getLegAnimation(style, false);
        // Both legs receive the same phase; custom functions can implement their own offset if desired
        const legL = leftFn(phaseNorm, hipMax, kneeMax);
        const legR = rightFn(phaseNorm, hipMax, kneeMax);
        return { legL, legR };
    }

    /** Linearly blend two LegResults. t=0 → a, t=1 → b. */
    private static blendLeg(a: LegResult, b: LegResult, t: number): LegResult {
        const s = 1 - t;
        return {
            hipX:  a.hipX  * s + b.hipX  * t,
            hipZ:  a.hipZ  * s + b.hipZ  * t,
            knee:  a.knee  * s + b.knee  * t,
            ankle: a.ankle * s + b.ankle * t,
        };
    }

    static animateMarcher(
        marchPhase: number,
        bodyParts: BodyParts,
        isSettled: boolean,
        catchupFactor: number,
        swayAmplitude: number = 0,
        style: MarchStyle = MarchStyle.HighStep,
        strideScale: number = 1.0,
        blendFromStyle?: MarchStyle,
        blendT: number = 1.0,
        blendFromStrideScale: number = 1.0
    ): void {
        const phaseNorm = ((marchPhase / (Math.PI * 2)) % 1 + 1) % 1;
        // Physics-correct hip swing: hipMax is CONSTANT so the stance foot
        // sweep (2 × LEG_LENGTH × hipMax = STEP_SIZE) always matches the
        // body displacement during one stance period, regardless of strideScale.
        // Stride scale controls cycle SPEED (via phase accumulation), not
        // stride LENGTH. Scaling hipMax with strideScale causes skating.
        const hipMax  = STEP_SIZE / (2 * LEG_LENGTH);          // 0.2946 rad
        const baseKnee = isSettled ? 1.20 : 0.90;
        const kneeMax = baseKnee * Math.max(0.5, Math.min(strideScale, 1.0));
        const M = MarchingAnimationSystem;

        // ─── LEG DISPATCH (with optional cross-fade blend) ─────────
        let legL: LegResult;
        let legR: LegResult;
        const newLegs = M.computeLegs(phaseNorm, hipMax, kneeMax, style);

        if (blendFromStyle !== undefined && blendT < 1.0) {
            // Compute old-style legs — hipMax is constant (no stride scaling)
            const oldHipMax = hipMax;
            const oldKneeMax = baseKnee * Math.max(0.5, Math.min(blendFromStrideScale, 1.0));
            const oldLegs = M.computeLegs(phaseNorm, oldHipMax, oldKneeMax, blendFromStyle);
            legL = M.blendLeg(oldLegs.legL, newLegs.legL, blendT);
            legR = M.blendLeg(oldLegs.legR, newLegs.legR, blendT);
        } else {
            legL = newLegs.legL;
            legR = newLegs.legR;
        }
        // Use AnimationService for lateral/arm/torso logic if needed in future
        const hasLateral = [MarchStyle.SideStep, MarchStyle.CrabWalk, MarchStyle.Pivot, MarchStyle.Chasse, MarchStyle.BoxStep, MarchStyle.TrueCrab, MarchStyle.DragTurn, MarchStyle.ObliqueLeft, MarchStyle.ObliqueRight]
            .includes(style);

        // ─── APPLY LEG ROTATIONS ───────────────────────────────────
        // Negate hipX: in Babylon.js (left-handed), positive rotation.x
        // swings the leg backward. Our leg functions use positive = forward,
        // so we negate to match the engine convention.
        if (bodyParts.hipJointL) {
            bodyParts.hipJointL.rotation.x = -legL.hipX;
            bodyParts.hipJointL.rotation.z = hasLateral ? legL.hipZ : 0;
        }
        if (bodyParts.kneeJointL)  bodyParts.kneeJointL.rotation.x = legL.knee;
        if (bodyParts.ankleJointL) bodyParts.ankleJointL.rotation.x = legL.ankle;

        if (bodyParts.hipJointR) {
            bodyParts.hipJointR.rotation.x = -legR.hipX;
            bodyParts.hipJointR.rotation.z = hasLateral ? legR.hipZ : 0;
        }
        if (bodyParts.kneeJointR)  bodyParts.kneeJointR.rotation.x = legR.knee;
        if (bodyParts.ankleJointR) bodyParts.ankleJointR.rotation.x = legR.ankle;

        // ─── ARM ANIMATION ─────────────────────────────────────────
        const armSwing = isSettled ? 0.12 : 0.08;
        const elbowBend = style === MarchStyle.Halt ? -0.3
            : style === MarchStyle.JazzRun ? -0.55
            : isSettled ? -0.4 : -0.45;

        // Lateral/halt styles: arms stay still; others counter-swing
        const noArmSwing = hasLateral || style === MarchStyle.Halt;
        const armCounterL = noArmSwing ? 0 : legR.hipX;
        const armCounterR = noArmSwing ? 0 : legL.hipX;

        if (bodyParts.shoulderJointL) {
            bodyParts.shoulderJointL.rotation.x = armCounterL * armSwing / hipMax - 0.15;
        }
        if (bodyParts.elbowJointL) bodyParts.elbowJointL.rotation.x = elbowBend;
        if (bodyParts.wristJointL) bodyParts.wristJointL.rotation.x = 0;

        if (bodyParts.shoulderJointR) {
            bodyParts.shoulderJointR.rotation.x = armCounterR * armSwing / hipMax - 0.15;
        }
        if (bodyParts.elbowJointR) bodyParts.elbowJointR.rotation.x = elbowBend;
        if (bodyParts.wristJointR) bodyParts.wristJointR.rotation.x = 0;

        // ─── TORSO / SPINE ─────────────────────────────────────────
        if (bodyParts.torsoJoint) {
            bodyParts.torsoJoint.position.y = 1.12;
        }

        if (bodyParts.spineJoint) {
            let lateralSway: number;
            switch (style) {
                case MarchStyle.SideStep:
                case MarchStyle.CrabWalk:
                case MarchStyle.TrueCrab: lateralSway = Math.sin(marchPhase) * 0.06; break;
                case MarchStyle.Chasse:   lateralSway = Math.sin(marchPhase) * 0.05; break;
                case MarchStyle.BoxStep:  lateralSway = Math.sin(marchPhase * 0.5) * 0.04; break;
                case MarchStyle.Scatter:  lateralSway = Math.sin(marchPhase * 1.3) * 0.04; break;
                case MarchStyle.Pivot:
                case MarchStyle.DragTurn: lateralSway = Math.sin(marchPhase) * 0.03; break;
                case MarchStyle.SkipPrance: lateralSway = Math.sin(marchPhase) * 0.02; break;
                case MarchStyle.StopHit:  lateralSway = 0; break;
                case MarchStyle.Flank:    lateralSway = Math.sin(marchPhase) * 0.02; break;
                case MarchStyle.ObliqueLeft:
                case MarchStyle.ObliqueRight: lateralSway = Math.sin(marchPhase) * 0.03; break;
                default:                  lateralSway = Math.sin(marchPhase) * swayAmplitude; break;
            }
            bodyParts.spineJoint.rotation.z = lateralSway;
            bodyParts.spineJoint.rotation.x = style === MarchStyle.JazzRun ? -0.08
                : style === MarchStyle.SkipPrance ? -0.06
                : style === MarchStyle.BackMarch ? 0.06
                : isSettled ? 0 : catchupFactor * 0.12;
        }

        // ─── NECK & HEAD ───────────────────────────────────────────
        if (bodyParts.neckJoint) {
            bodyParts.neckJoint.rotation.z = Math.sin(marchPhase) * swayAmplitude * 0.5;
            bodyParts.neckJoint.rotation.x = 0;
        }
        if (bodyParts.headJoint) {
            bodyParts.headJoint.rotation.z = 0;
            bodyParts.headJoint.rotation.x = isSettled ? 0 : catchupFactor * 0.08;
        }
    }

    static getCatchupFactor(gap: number, settleZone: number = 0.25): number {
        if (gap <= settleZone) return 0;
        return Math.min(1.0, (gap - settleZone) / 2.0);
    }
}
