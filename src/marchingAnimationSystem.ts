import { Mesh, InstancedMesh, TransformNode } from "@babylonjs/core";

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

    static animateMarcher(
        marchPhase: number,
        bodyParts: BodyParts,
        isSettled: boolean,
        catchupFactor: number,
        swayAmplitude: number = 0
    ): void {
        // Normalise phase to 0-1 (one full stride)
        const phaseNorm = ((marchPhase / (Math.PI * 2)) % 1 + 1) % 1;

        // Amplitude knobs
        const hipMax  = isSettled ? 0.50 : 0.35 + 0.20 * catchupFactor;
        const kneeMax = isSettled ? 1.20 : 0.90;

        // ─── LEG ANIMATION ─────────────────────────────────────────
        const legL = MarchingAnimationSystem.legPhase(phaseNorm, hipMax, kneeMax);
        const legR = MarchingAnimationSystem.legPhase((phaseNorm + 0.5) % 1, hipMax, kneeMax);

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

        // ─── ARM ANIMATION ─────────────────────────────────────────
        // Arms mostly hold instruments — subtle counter-swing to legs.
        const armSwing = isSettled ? 0.12 : 0.08;
        const elbowBend = isSettled ? 0.4 : 0.45;

        if (bodyParts.shoulderJointL) {
            bodyParts.shoulderJointL.rotation.x = -legR.hip * armSwing / hipMax - 0.15;
        }
        if (bodyParts.elbowJointL) {
            bodyParts.elbowJointL.rotation.x = elbowBend;
        }
        if (bodyParts.wristJointL) {
            bodyParts.wristJointL.rotation.x = 0;
        }

        if (bodyParts.shoulderJointR) {
            bodyParts.shoulderJointR.rotation.x = -legL.hip * armSwing / hipMax - 0.15;
        }
        if (bodyParts.elbowJointR) {
            bodyParts.elbowJointR.rotation.x = elbowBend;
        }
        if (bodyParts.wristJointR) {
            bodyParts.wristJointR.rotation.x = 0;
        }

        // ─── TORSO / SPINE ─────────────────────────────────────────
        // Vertical bounce peaks at each foot-strike (~phase 0 and 0.5).
        // Two bounces per stride cycle.
        if (bodyParts.torsoJoint) {
            const strikePhase = phaseNorm * 2 * Math.PI * 2;   // 2 bounces per cycle
            const bounce = Math.max(0, Math.sin(strikePhase)) * 0.025;
            bodyParts.torsoJoint.position.y = 1.12 + bounce;
        }

        if (bodyParts.spineJoint) {
            bodyParts.spineJoint.rotation.z = Math.sin(marchPhase) * swayAmplitude;
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
