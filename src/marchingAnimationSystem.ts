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
    static animateMarcher(
        marchPhase: number,
        bodyParts: BodyParts,
        isSettled: boolean,
        catchupFactor: number,
        swayAmplitude: number = 0
    ): void {
        // ─── LEG ANIMATION ─────────────────────────────────────────
        // Hip joint swings the whole leg (upper + knee + lower + foot).
        // Knee joint bends the lower leg during the forward-swing phase.
        // Ankle joint gives a subtle toe-lift during the swing.

        const hipSwing = isSettled ? 0.45 : 0.35 + 0.20 * catchupFactor;
        const kneeBendMax = isSettled ? 0.85 : 0.65;

        // Left leg — leads at phase 0→π
        if (bodyParts.hipJointL) {
            bodyParts.hipJointL.rotation.x = -Math.sin(marchPhase) * hipSwing;
            bodyParts.hipJointL.rotation.z = 0; // no lateral splay
        }
        if (bodyParts.kneeJointL) {
            // Knee bends only when leg is swinging forward (sin > 0)
            bodyParts.kneeJointL.rotation.x = Math.max(0, Math.sin(marchPhase)) * kneeBendMax;
        }
        if (bodyParts.ankleJointL) {
            // Slight dorsiflexion during swing, plantarflexion at toe-off
            bodyParts.ankleJointL.rotation.x = Math.sin(marchPhase) * 0.15;
        }

        // Right leg — opposite phase
        if (bodyParts.hipJointR) {
            bodyParts.hipJointR.rotation.x = -Math.sin(marchPhase + Math.PI) * hipSwing;
            bodyParts.hipJointR.rotation.z = 0;
        }
        if (bodyParts.kneeJointR) {
            bodyParts.kneeJointR.rotation.x = Math.max(0, Math.sin(marchPhase + Math.PI)) * kneeBendMax;
        }
        if (bodyParts.ankleJointR) {
            bodyParts.ankleJointR.rotation.x = Math.sin(marchPhase + Math.PI) * 0.15;
        }

        // ─── ARM ANIMATION ─────────────────────────────────────────
        // Arms mostly fixed forward (holding instruments).
        // Slight counter-swing to legs for natural feel.

        const armSwing = isSettled ? 0.12 : 0.08;
        const elbowBend = isSettled ? 0.4 : 0.45;

        if (bodyParts.shoulderJointL) {
            // Counter to right leg: when right leg forward, left arm forward
            bodyParts.shoulderJointL.rotation.x = Math.sin(marchPhase + Math.PI) * armSwing - 0.15;
        }
        if (bodyParts.elbowJointL) {
            bodyParts.elbowJointL.rotation.x = elbowBend;
        }
        if (bodyParts.wristJointL) {
            bodyParts.wristJointL.rotation.x = 0;
        }

        if (bodyParts.shoulderJointR) {
            // Counter to left leg
            bodyParts.shoulderJointR.rotation.x = Math.sin(marchPhase) * armSwing - 0.15;
        }
        if (bodyParts.elbowJointR) {
            bodyParts.elbowJointR.rotation.x = elbowBend;
        }
        if (bodyParts.wristJointR) {
            bodyParts.wristJointR.rotation.x = 0;
        }

        // ─── TORSO / SPINE ─────────────────────────────────────────
        // Subtle vertical bounce (two bounces per stride = abs(sin))
        // Slight sway controlled by swayAmplitude parameter.

        if (bodyParts.spineJoint) {
            bodyParts.spineJoint.rotation.z = Math.sin(marchPhase) * swayAmplitude;
            if (!isSettled) {
                bodyParts.spineJoint.rotation.x = catchupFactor * 0.12;
            } else {
                bodyParts.spineJoint.rotation.x = 0;
            }
        }

        if (bodyParts.torsoJoint) {
            // Vertical bounce on the root joint
            const bounce = Math.abs(Math.sin(marchPhase)) * 0.03;
            bodyParts.torsoJoint.position.y = 1.12 + bounce;
        }

        // ─── NECK & HEAD ───────────────────────────────────────────
        if (bodyParts.neckJoint) {
            bodyParts.neckJoint.rotation.z = Math.sin(marchPhase) * swayAmplitude * 0.5;
            bodyParts.neckJoint.rotation.x = Math.abs(Math.sin(marchPhase)) * 0.04;
        }
        if (bodyParts.headJoint) {
            bodyParts.headJoint.rotation.z = 0;
            if (!isSettled) {
                bodyParts.headJoint.rotation.x = catchupFactor * 0.08;
            } else {
                bodyParts.headJoint.rotation.x = 0;
            }
        }
    }

    static getCatchupFactor(gap: number, settleZone: number = 0.25): number {
        if (gap <= settleZone) return 0;
        return Math.min(1.0, (gap - settleZone) / 2.0);
    }
}
