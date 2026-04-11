import { Mesh, InstancedMesh, TransformNode } from "@babylonjs/core";

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
}

/**
 * Velocity range per style in meters-per-beat.
 * minVelocity: comfortable slowest pace. maxVelocity: fastest before it looks wrong.
 * Styles with 0 min are usable when stationary (same formation held).
 */
export const STYLE_VELOCITY: Record<MarchStyle, { min: number; max: number }> = {
    [MarchStyle.Halt]:      { min: 0,    max: 0 },       // no movement
    [MarchStyle.MarkTime]:  { min: 0,    max: 0 },       // in-place only
    [MarchStyle.HighStep]:  { min: 0.3,  max: 0.7 },     // standard 8-to-5 pace
    [MarchStyle.Glide]:     { min: 0.2,  max: 0.6 },     // smooth, moderate
    [MarchStyle.DragStep]:  { min: 0.15, max: 0.5 },     // slow corps style
    [MarchStyle.BackMarch]: { min: 0.15, max: 0.45 },    // careful backward
    [MarchStyle.SideStep]:  { min: 0.1,  max: 0.4 },     // lateral, slower
    [MarchStyle.CrabWalk]:  { min: 0.1,  max: 0.4 },     // grapevine, slower
    [MarchStyle.Pivot]:     { min: 0.05, max: 0.35 },    // mostly rotational
    [MarchStyle.JazzRun]:   { min: 0.6,  max: 1.2 },     // fast traversal
    [MarchStyle.Scatter]:   { min: 0.5,  max: 1.0 },     // free-form run
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
     * Phase breakdown (marching-band high-step):
     *   0.00 – 0.45  STANCE  foot planted, leg straight / trailing behind body
     *   0.45 – 0.55  LIFT    hip flexes forward, knee bends sharply (foot clears ground)
     *   0.55 – 0.75  PEAK    knee held high (parade "show" moment)
     *   0.75 – 1.00  PLANT   leg straightens, foot returns to ground
     *
     * Returns { hip, knee, ankle } rotation.x values (radians).
     */
    private static legPhase(t: number, hipMax: number, kneeMax: number): LegResult {
        const smoothstep = (a: number, b: number, x: number) => {
            const s = Math.max(0, Math.min(1, (x - a) / (b - a)));
            return s * s * (3 - 2 * s);
        };

        let hipX = 0;
        let knee = 0;
        let ankle = 0;

        if (t < 0.45) {
            const stanceT = t / 0.45;
            hipX = stanceT * 0.15 * hipMax;
            knee = 0;
            ankle = 0;
        } else if (t < 0.55) {
            const liftT = smoothstep(0.45, 0.55, t);
            hipX = (0.15 - 1.15 * liftT) * hipMax;
            knee = liftT * kneeMax;
            ankle = -liftT * 0.3;
        } else if (t < 0.75) {
            hipX = -1.0 * hipMax;
            knee = kneeMax;
            ankle = -0.3;
        } else {
            const plantT = smoothstep(0.75, 1.0, t);
            hipX = -1.0 * hipMax * (1 - plantT);
            knee = kneeMax * (1 - plantT);
            ankle = -0.3 * (1 - plantT);
        }

        return { hipX, hipZ: 0, knee, ankle };
    }

    /** Unified leg result: forward/back hip (x), lateral hip (z), knee, ankle. */
    private static readonly ZERO_LEG: LegResult = { hipX: 0, hipZ: 0, knee: 0, ankle: 0 };

    private static ss(a: number, b: number, x: number): number {
        const s = Math.max(0, Math.min(1, (x - a) / (b - a)));
        return s * s * (3 - 2 * s);
    }

    /** Glide — smooth sinusoidal swing, feet stay low. */
    private static glideLeg(t: number, hipMax: number): LegResult {
        const swing = Math.sin(t * Math.PI * 2);
        return { hipX: -swing * hipMax * 0.5, hipZ: 0, knee: Math.max(0, -swing) * 0.25, ankle: swing * 0.08 };
    }

    /** SideStep — lateral abduction/adduction with crossover. */
    private static sideStepLeg(t: number, hipMax: number): LegResult {
        const ss = MarchingAnimationSystem.ss;
        let hipX = 0, hipZ = 0, knee = 0, ankle = 0;
        if (t < 0.25) {
            const l = ss(0, 0.25, t);
            hipZ = -l * hipMax * 0.4; hipX = -l * hipMax * 0.15; knee = l * 0.3; ankle = -l * 0.1;
        } else if (t < 0.5) {
            const p = ss(0.25, 0.5, t);
            hipZ = -hipMax * 0.4 * (1 - p); hipX = -hipMax * 0.15 * (1 - p); knee = 0.3 * (1 - p); ankle = -0.1 * (1 - p);
        } else if (t < 0.75) {
            const c = ss(0.5, 0.75, t);
            hipZ = c * hipMax * 0.25; hipX = -c * hipMax * 0.1; knee = c * 0.2;
        } else {
            const r = ss(0.75, 1.0, t);
            hipZ = hipMax * 0.25 * (1 - r); hipX = -hipMax * 0.1 * (1 - r); knee = 0.2 * (1 - r);
        }
        return { hipX, hipZ, knee, ankle };
    }

    /** MarkTime — marching in place, knees pump vertically. */
    private static markTimeLeg(t: number, hipMax: number, kneeMax: number): LegResult {
        const ss = MarchingAnimationSystem.ss;
        let hipX = 0, knee = 0, ankle = 0;
        if (t < 0.4) {
            // LIFT — knee comes up
            const l = ss(0, 0.4, t);
            hipX = -l * hipMax * 0.6;
            knee = l * kneeMax * 0.7;
            ankle = -l * 0.2;
        } else if (t < 0.6) {
            // HOLD — knee stays up
            hipX = -hipMax * 0.6;
            knee = kneeMax * 0.7;
            ankle = -0.2;
        } else {
            // DOWN — foot returns to ground
            const d = ss(0.6, 1.0, t);
            hipX = -hipMax * 0.6 * (1 - d);
            knee = kneeMax * 0.7 * (1 - d);
            ankle = -0.2 * (1 - d);
        }
        return { hipX, hipZ: 0, knee, ankle };
    }

    /** BackMarch — reversed stride, shorter swing, heel-toe roll. */
    private static backMarchLeg(t: number, hipMax: number): LegResult {
        const ss = MarchingAnimationSystem.ss;
        let hipX = 0, knee = 0, ankle = 0;
        if (t < 0.5) {
            // Reach back
            const r = ss(0, 0.5, t);
            hipX = r * hipMax * 0.4;        // hip extends backward
            knee = r * 0.15;                // slight bend
            ankle = r * 0.15;              // plantarflexion (toe push)
        } else {
            // Return forward
            const f = ss(0.5, 1.0, t);
            hipX = hipMax * 0.4 * (1 - f);
            knee = 0.15 * (1 - f);
            ankle = 0.15 * (1 - f);
        }
        return { hipX, hipZ: 0, knee, ankle };
    }

    /** JazzRun — exaggerated long strides, pointed toes, fast traversal. */
    private static jazzRunLeg(t: number, hipMax: number, kneeMax: number): LegResult {
        const ss = MarchingAnimationSystem.ss;
        let hipX = 0, knee = 0, ankle = 0;
        if (t < 0.3) {
            // BIG PUSH — leg trails far behind
            const p = ss(0, 0.3, t);
            hipX = p * hipMax * 0.7;         // large backward extension
            knee = 0;
            ankle = p * 0.25;              // pointed toe
        } else if (t < 0.5) {
            // SWING THROUGH — fast forward snap
            const s = ss(0.3, 0.5, t);
            hipX = hipMax * (0.7 - 1.7 * s); // from +0.7 to -1.0 forward
            knee = s * kneeMax * 0.6;
            ankle = 0.25 * (1 - s) - s * 0.15;
        } else if (t < 0.7) {
            // EXTENDED REACH — leg stretches far forward
            hipX = -hipMax * 1.0;
            knee = kneeMax * 0.6 * (1 - ss(0.5, 0.7, t) * 0.5);
            ankle = -0.15;
        } else {
            // PLANT — foot strikes ground
            const pl = ss(0.7, 1.0, t);
            hipX = -hipMax * 1.0 * (1 - pl);
            knee = kneeMax * 0.3 * (1 - pl);
            ankle = -0.15 * (1 - pl);
        }
        return { hipX, hipZ: 0, knee, ankle };
    }

    /** CrabWalk — grapevine crossover, stronger lateral motion than SideStep. */
    private static crabWalkLeg(t: number, hipMax: number): LegResult {
        const ss = MarchingAnimationSystem.ss;
        let hipX = 0, hipZ = 0, knee = 0, ankle = 0;
        if (t < 0.25) {
            // CROSS OVER — leg swings across body
            const c = ss(0, 0.25, t);
            hipZ = c * hipMax * 0.5;          // strong adduction
            hipX = -c * hipMax * 0.2;         // slight lift
            knee = c * 0.35;
            ankle = -c * 0.1;
        } else if (t < 0.5) {
            // PLANT crossed
            const p = ss(0.25, 0.5, t);
            hipZ = hipMax * 0.5 * (1 - p);
            hipX = -hipMax * 0.2 * (1 - p);
            knee = 0.35 * (1 - p);
            ankle = -0.1 * (1 - p);
        } else if (t < 0.75) {
            // OPEN — leg abducts outward
            const o = ss(0.5, 0.75, t);
            hipZ = -o * hipMax * 0.45;
            hipX = -o * hipMax * 0.15;
            knee = o * 0.25;
        } else {
            // RETURN to center
            const r = ss(0.75, 1.0, t);
            hipZ = -hipMax * 0.45 * (1 - r);
            hipX = -hipMax * 0.15 * (1 - r);
            knee = 0.25 * (1 - r);
        }
        return { hipX, hipZ, knee, ankle };
    }

    /** DragStep — corps-style toe drag before planting. */
    private static dragStepLeg(t: number, hipMax: number): LegResult {
        const ss = MarchingAnimationSystem.ss;
        let hipX = 0, knee = 0, ankle = 0;
        if (t < 0.4) {
            // DRAG — toe trails behind, barely off ground
            const d = t / 0.4;
            hipX = d * hipMax * 0.2;          // slight backward extension
            knee = 0;
            ankle = d * 0.2;                // pointed toe drags
        } else if (t < 0.6) {
            // SCOOP FORWARD — foot scoops forward along ground
            const s = ss(0.4, 0.6, t);
            hipX = hipMax * (0.2 - 0.7 * s);  // transitions from back to front
            knee = s * 0.15;
            ankle = 0.2 * (1 - s);
        } else if (t < 0.8) {
            // PLANT — heel strikes
            const p = ss(0.6, 0.8, t);
            hipX = -hipMax * 0.5 * (1 - p * 0.4);
            knee = 0.15 * (1 - p);
            ankle = -p * 0.1;
        } else {
            // SETTLE — weight transfers
            const se = ss(0.8, 1.0, t);
            hipX = -hipMax * 0.3 * (1 - se);
            knee = 0;
            ankle = -0.1 * (1 - se);
        }
        return { hipX, hipZ: 0, knee, ankle };
    }

    /** Scatter — loose, asymmetric running stride. */
    private static scatterLeg(t: number, hipMax: number, kneeMax: number): LegResult {
        // Asymmetric sine-based run — faster forward, slower return
        const forward = Math.sin(t * Math.PI);                    // 0→1→0, fast
        const backward = Math.sin((t + 0.5) % 1.0 * Math.PI);   // offset
        const hipX = -(forward * 0.8 - backward * 0.3) * hipMax;
        const knee = forward * kneeMax * 0.5;
        const ankle = -forward * 0.2 + backward * 0.1;
        return { hipX, hipZ: 0, knee, ankle };
    }

    /** Pivot — one foot planted, other arcs around. The "stepping" foot does the work. */
    private static pivotLeg(t: number, hipMax: number, isPivotFoot: boolean): LegResult {
        if (isPivotFoot) {
            // Planted foot — stays still with slight bend
            return { hipX: 0, hipZ: 0, knee: 0.05, ankle: 0 };
        }
        // Stepping foot — arcs in a circle
        const angle = t * Math.PI * 2;
        const hipX = -Math.sin(angle) * hipMax * 0.4;
        const hipZ = -Math.cos(angle) * hipMax * 0.3;
        const knee = Math.max(0, Math.sin(angle)) * 0.3;
        const ankle = 0;
        return { hipX, hipZ, knee, ankle };
    }

    static animateMarcher(
        marchPhase: number,
        bodyParts: BodyParts,
        isSettled: boolean,
        catchupFactor: number,
        swayAmplitude: number = 0,
        style: MarchStyle = MarchStyle.HighStep
    ): void {
        const phaseNorm = ((marchPhase / (Math.PI * 2)) % 1 + 1) % 1;
        const hipMax  = isSettled ? 0.50 : 0.35 + 0.20 * catchupFactor;
        const kneeMax = isSettled ? 1.20 : 0.90;
        const Z = MarchingAnimationSystem.ZERO_LEG;
        const M = MarchingAnimationSystem;

        // ─── LEG DISPATCH ──────────────────────────────────────────
        let legL: LegResult;
        let legR: LegResult;
        const hasLateral = style === MarchStyle.SideStep || style === MarchStyle.CrabWalk || style === MarchStyle.Pivot;

        switch (style) {
            case MarchStyle.Halt:
                legL = Z; legR = Z; break;
            case MarchStyle.Glide:
                legL = M.glideLeg(phaseNorm, hipMax);
                legR = M.glideLeg((phaseNorm + 0.5) % 1, hipMax); break;
            case MarchStyle.SideStep:
                legL = M.sideStepLeg(phaseNorm, hipMax);
                legR = M.sideStepLeg((phaseNorm + 0.5) % 1, hipMax); break;
            case MarchStyle.MarkTime:
                legL = M.markTimeLeg(phaseNorm, hipMax, kneeMax);
                legR = M.markTimeLeg((phaseNorm + 0.5) % 1, hipMax, kneeMax); break;
            case MarchStyle.BackMarch:
                legL = M.backMarchLeg(phaseNorm, hipMax);
                legR = M.backMarchLeg((phaseNorm + 0.5) % 1, hipMax); break;
            case MarchStyle.JazzRun:
                legL = M.jazzRunLeg(phaseNorm, hipMax, kneeMax);
                legR = M.jazzRunLeg((phaseNorm + 0.5) % 1, hipMax, kneeMax); break;
            case MarchStyle.CrabWalk:
                legL = M.crabWalkLeg(phaseNorm, hipMax);
                legR = M.crabWalkLeg((phaseNorm + 0.5) % 1, hipMax); break;
            case MarchStyle.DragStep:
                legL = M.dragStepLeg(phaseNorm, hipMax);
                legR = M.dragStepLeg((phaseNorm + 0.5) % 1, hipMax); break;
            case MarchStyle.Scatter:
                legL = M.scatterLeg(phaseNorm, hipMax, kneeMax);
                legR = M.scatterLeg((phaseNorm + 0.5) % 1, hipMax, kneeMax); break;
            case MarchStyle.Pivot:
                legL = M.pivotLeg(phaseNorm, hipMax, true);   // left planted
                legR = M.pivotLeg(phaseNorm, hipMax, false);  // right steps
                break;
            default: // HighStep
                legL = M.legPhase(phaseNorm, hipMax, kneeMax);
                legR = M.legPhase((phaseNorm + 0.5) % 1, hipMax, kneeMax); break;
        }

        // ─── APPLY LEG ROTATIONS ───────────────────────────────────
        if (bodyParts.hipJointL) {
            bodyParts.hipJointL.rotation.x = legL.hipX;
            bodyParts.hipJointL.rotation.z = hasLateral ? legL.hipZ : 0;
        }
        if (bodyParts.kneeJointL)  bodyParts.kneeJointL.rotation.x = legL.knee;
        if (bodyParts.ankleJointL) bodyParts.ankleJointL.rotation.x = legL.ankle;

        if (bodyParts.hipJointR) {
            bodyParts.hipJointR.rotation.x = legR.hipX;
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
            bodyParts.shoulderJointL.rotation.x = -armCounterL * armSwing / hipMax - 0.15;
        }
        if (bodyParts.elbowJointL) bodyParts.elbowJointL.rotation.x = elbowBend;
        if (bodyParts.wristJointL) bodyParts.wristJointL.rotation.x = 0;

        if (bodyParts.shoulderJointR) {
            bodyParts.shoulderJointR.rotation.x = -armCounterR * armSwing / hipMax - 0.15;
        }
        if (bodyParts.elbowJointR) bodyParts.elbowJointR.rotation.x = elbowBend;
        if (bodyParts.wristJointR) bodyParts.wristJointR.rotation.x = 0;

        // ─── TORSO / SPINE ─────────────────────────────────────────
        if (bodyParts.torsoJoint) {
            const strikePhase = phaseNorm * 2 * Math.PI * 2;
            let bounceAmp: number;
            switch (style) {
                case MarchStyle.Halt:     bounceAmp = 0; break;
                case MarchStyle.HighStep: bounceAmp = 0.025; break;
                case MarchStyle.JazzRun:  bounceAmp = 0.03; break;
                case MarchStyle.Scatter:  bounceAmp = 0.02; break;
                case MarchStyle.MarkTime: bounceAmp = 0.02; break;
                case MarchStyle.SideStep:
                case MarchStyle.CrabWalk: bounceAmp = 0.01; break;
                default:                  bounceAmp = 0.006; break;
            }
            const bounce = Math.max(0, Math.sin(strikePhase)) * bounceAmp;
            bodyParts.torsoJoint.position.y = 1.12 + bounce;
        }

        if (bodyParts.spineJoint) {
            let lateralSway: number;
            switch (style) {
                case MarchStyle.SideStep:
                case MarchStyle.CrabWalk: lateralSway = Math.sin(marchPhase) * 0.06; break;
                case MarchStyle.Scatter:  lateralSway = Math.sin(marchPhase * 1.3) * 0.04; break;
                case MarchStyle.Pivot:    lateralSway = Math.sin(marchPhase) * 0.03; break;
                default:                  lateralSway = Math.sin(marchPhase) * swayAmplitude; break;
            }
            bodyParts.spineJoint.rotation.z = lateralSway;
            bodyParts.spineJoint.rotation.x = style === MarchStyle.JazzRun ? -0.08
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
