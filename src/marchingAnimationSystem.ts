import { Mesh, InstancedMesh, TransformNode } from "@babylonjs/core";

/** Available march-step styles. */
export enum MarchStyle {
    /** Traditional marching-band high-step with sharp knee lift. */
    HighStep = "HighStep",
    /** Smooth gliding step — feet stay low, body floats forward. */
    Glide = "Glide",
    /** Lateral side-step — legs cross/uncross while body moves sideways. */
    SideStep = "SideStep",
}

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

/**
 * Marching-band high-step animation system.
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
    private static legPhase(t: number, hipMax: number, kneeMax: number): { hip: number; knee: number; ankle: number } {
        // Smooth helper (Hermite interpolation)
        const smoothstep = (a: number, b: number, x: number) => {
            const s = Math.max(0, Math.min(1, (x - a) / (b - a)));
            return s * s * (3 - 2 * s);
        };

        let hip = 0;
        let knee = 0;
        let ankle = 0;

        if (t < 0.45) {
            // STANCE — leg goes from slightly ahead (0) to slightly behind (0.45)
            // small backward lean gives the "push-off" look
            const stanceT = t / 0.45;                    // 0→1
            hip = stanceT * 0.15 * hipMax;               // trails behind slightly
            knee = 0;                                     // straight
            ankle = 0;
        } else if (t < 0.55) {
            // LIFT — sharp upward snap
            const liftT = smoothstep(0.45, 0.55, t);     // 0→1
            hip = (0.15 - 1.15 * liftT) * hipMax;        // from +0.15 to -1.0 (forward)
            knee = liftT * kneeMax;                       // bend fast
            ankle = -liftT * 0.3;                         // toes up (dorsiflexion)
        } else if (t < 0.75) {
            // PEAK — hold the high-step
            hip = -1.0 * hipMax;
            knee = kneeMax;
            ankle = -0.3;
        } else {
            // PLANT — bring foot down to ground
            const plantT = smoothstep(0.75, 1.0, t);     // 0→1
            hip = -1.0 * hipMax * (1 - plantT);           // returns to 0
            knee = kneeMax * (1 - plantT);                // straightens
            ankle = -0.3 * (1 - plantT);                  // toes level
        }

        return { hip, knee, ankle };
    }

    /**
     * Glide-step leg phase — feet stay low, smooth sinusoidal swing.
     * Produces a flowing, almost floating gait with minimal vertical lift.
     */
    private static glideLegPhase(t: number, hipMax: number): { hip: number; knee: number; ankle: number } {
        // Simple sine-based pendulum swing — no sharp knee lift
        const swing = Math.sin(t * Math.PI * 2);
        const hip = -swing * hipMax * 0.5;           // gentle forward/back swing
        const knee = Math.max(0, -swing) * 0.25;     // slight bend only on back-swing
        const ankle = swing * 0.08;                   // subtle toe articulation
        return { hip, knee, ankle };
    }

    /**
     * Side-step leg phase — alternating lateral abduction/adduction.
     * One leg steps out to the side, the other crosses to meet it.
     * Uses hip rotation.z (abduction) and a slight knee bend on the crossing leg.
     */
    private static sideStepLegPhase(t: number, hipMax: number): { hipX: number; hipZ: number; knee: number; ankle: number } {
        const smoothstep = (a: number, b: number, x: number) => {
            const s = Math.max(0, Math.min(1, (x - a) / (b - a)));
            return s * s * (3 - 2 * s);
        };

        let hipX = 0;
        let hipZ = 0;
        let knee = 0;
        let ankle = 0;

        if (t < 0.25) {
            // LIFT — leg abducts outward and lifts slightly
            const liftT = smoothstep(0, 0.25, t);
            hipZ = -liftT * hipMax * 0.4;       // abduct outward
            hipX = -liftT * hipMax * 0.15;      // slight forward lift
            knee = liftT * 0.3;                 // small bend to clear ground
            ankle = -liftT * 0.1;
        } else if (t < 0.5) {
            // PLANT — leg comes down to new lateral position
            const plantT = smoothstep(0.25, 0.5, t);
            hipZ = -hipMax * 0.4 * (1 - plantT);  // returns toward center
            hipX = -hipMax * 0.15 * (1 - plantT);
            knee = 0.3 * (1 - plantT);            // straighten
            ankle = -0.1 * (1 - plantT);
        } else if (t < 0.75) {
            // CROSS — leg adducts inward (crossing behind/in front)
            const crossT = smoothstep(0.5, 0.75, t);
            hipZ = crossT * hipMax * 0.25;         // adduct inward
            hipX = -crossT * hipMax * 0.1;         // tiny lift
            knee = crossT * 0.2;                   // slight bend
            ankle = 0;
        } else {
            // RETURN — back to neutral
            const returnT = smoothstep(0.75, 1.0, t);
            hipZ = hipMax * 0.25 * (1 - returnT);
            hipX = -hipMax * 0.1 * (1 - returnT);
            knee = 0.2 * (1 - returnT);
            ankle = 0;
        }

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
        // Normalise phase to 0-1 (one full stride)
        const phaseNorm = ((marchPhase / (Math.PI * 2)) % 1 + 1) % 1;

        // Amplitude knobs
        const hipMax  = isSettled ? 0.50 : 0.35 + 0.20 * catchupFactor;
        const kneeMax = isSettled ? 1.20 : 0.90;

        // ─── LEG ANIMATION ─────────────────────────────────────────
        const noLeg = { hip: 0, knee: 0, ankle: 0 };
        let legL = noLeg;
        let legR = noLeg;

        if (style === MarchStyle.SideStep) {
            // Side-step uses dedicated lateral phase with hipX + hipZ
            const sideL = MarchingAnimationSystem.sideStepLegPhase(phaseNorm, hipMax);
            const sideR = MarchingAnimationSystem.sideStepLegPhase((phaseNorm + 0.5) % 1, hipMax);

            if (bodyParts.hipJointL) {
                bodyParts.hipJointL.rotation.x = sideL.hipX;
                bodyParts.hipJointL.rotation.z = sideL.hipZ;
            }
            if (bodyParts.kneeJointL)  bodyParts.kneeJointL.rotation.x = sideL.knee;
            if (bodyParts.ankleJointL) bodyParts.ankleJointL.rotation.x = sideL.ankle;

            if (bodyParts.hipJointR) {
                bodyParts.hipJointR.rotation.x = sideR.hipX;
                bodyParts.hipJointR.rotation.z = sideR.hipZ;
            }
            if (bodyParts.kneeJointR)  bodyParts.kneeJointR.rotation.x = sideR.knee;
            if (bodyParts.ankleJointR) bodyParts.ankleJointR.rotation.x = sideR.ankle;
        } else {
            if (style === MarchStyle.Glide) {
                legL = MarchingAnimationSystem.glideLegPhase(phaseNorm, hipMax);
                legR = MarchingAnimationSystem.glideLegPhase((phaseNorm + 0.5) % 1, hipMax);
            } else {
                legL = MarchingAnimationSystem.legPhase(phaseNorm, hipMax, kneeMax);
                legR = MarchingAnimationSystem.legPhase((phaseNorm + 0.5) % 1, hipMax, kneeMax);
            }

            if (bodyParts.hipJointL) {
                bodyParts.hipJointL.rotation.x = legL.hip;
                bodyParts.hipJointL.rotation.z = 0;
            }
            if (bodyParts.kneeJointL) {
                bodyParts.kneeJointL.rotation.x = legL.knee;
            }
            if (bodyParts.ankleJointL) {
                bodyParts.ankleJointL.rotation.x = legL.ankle;
            }

            if (bodyParts.hipJointR) {
                bodyParts.hipJointR.rotation.x = legR.hip;
                bodyParts.hipJointR.rotation.z = 0;
            }
            if (bodyParts.kneeJointR) {
                bodyParts.kneeJointR.rotation.x = legR.knee;
            }
            if (bodyParts.ankleJointR) {
                bodyParts.ankleJointR.rotation.x = legR.ankle;
            }
        }

        // ─── ARM ANIMATION ─────────────────────────────────────────
        // Arms mostly hold instruments — subtle counter-swing to legs.
        const armSwing = isSettled ? 0.12 : 0.08;
        const elbowBend = isSettled ? 0.4 : 0.45;

        // For side-step, arms don't counter-swing from hip forward/back;
        // use a small lateral-phase value instead.
        const armCounterL = style === MarchStyle.SideStep ? 0 : (legR?.hip ?? 0);
        const armCounterR = style === MarchStyle.SideStep ? 0 : (legL?.hip ?? 0);

        if (bodyParts.shoulderJointL) {
            bodyParts.shoulderJointL.rotation.x = -armCounterL * armSwing / hipMax - 0.15;
        }
        if (bodyParts.elbowJointL) {
            bodyParts.elbowJointL.rotation.x = elbowBend;
        }
        if (bodyParts.wristJointL) {
            bodyParts.wristJointL.rotation.x = 0;
        }

        if (bodyParts.shoulderJointR) {
            bodyParts.shoulderJointR.rotation.x = -armCounterR * armSwing / hipMax - 0.15;
        }
        if (bodyParts.elbowJointR) {
            bodyParts.elbowJointR.rotation.x = elbowBend;
        }
        if (bodyParts.wristJointR) {
            bodyParts.wristJointR.rotation.x = 0;
        }

        // ─── TORSO / SPINE ─────────────────────────────────────────
        // Vertical bounce peaks at each foot-strike (~phase 0 and 0.5).
        // Two bounces per stride cycle.  Glide/SideStep have minimal bounce.
        if (bodyParts.torsoJoint) {
            const strikePhase = phaseNorm * 2 * Math.PI * 2;   // 2 bounces per cycle
            const bounceAmp = style === MarchStyle.HighStep ? 0.025
                : style === MarchStyle.SideStep ? 0.01 : 0.006;
            const bounce = Math.max(0, Math.sin(strikePhase)) * bounceAmp;
            bodyParts.torsoJoint.position.y = 1.12 + bounce;
        }

        if (bodyParts.spineJoint) {
            const lateralSway = style === MarchStyle.SideStep
                ? Math.sin(marchPhase) * 0.06   // noticeable lateral lean during side-step
                : Math.sin(marchPhase) * swayAmplitude;
            bodyParts.spineJoint.rotation.z = lateralSway;
            bodyParts.spineJoint.rotation.x = isSettled ? 0 : catchupFactor * 0.12;
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
