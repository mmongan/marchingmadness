import { Mesh, InstancedMesh, TransformNode } from "@babylonjs/core";

/**
 * Body part references for realistic animation
 * 
 * Now uses JOINT NODES (TransformNodes) instead of bone meshes.
 * When a joint rotates, all bones attached to it rotate around that joint's position.
 * This creates proper skeletal animation where limbs rotate at their endpoints.
 */
export interface BodyParts {
    // Bone meshes (for reference, but NOT animated directly)
    head?: InstancedMesh | Mesh;
    headBaseY?: number;
    neck?: InstancedMesh | Mesh;
    neckBaseY?: number;
    torso?: InstancedMesh | Mesh;
    torsoBaseY?: number;
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
    
    // JOINT NODES (animated)
    torsoJoint?: TransformNode;
    neckJoint?: TransformNode;
    headJoint?: TransformNode;
    shoulderJointL?: TransformNode;
    shoulderJointR?: TransformNode;
    elbowJointL?: TransformNode;
    elbowJointR?: TransformNode;
    wristJointL?: TransformNode;
    wristJointR?: TransformNode;
    hipJoint?: TransformNode;
    kneeJointL?: TransformNode;
    kneeJointR?: TransformNode;
    ankleJointL?: TransformNode;
    ankleJointR?: TransformNode;
}

/**
 * High-fidelity marching animation system
 * 
 * Creates realistic band member animations with:
 * - Sophisticated leg motion (not just simple sine wave)
 * - Arm swing in counterpoint to legs
 * - Torso bounce and hip rotation
 * - Head tilt and neck movement
 * - Natural cadence and marching feel
 */
export class MarchingAnimationSystem {
    /**
     * Animates a single marcher with physiology-based marching motion
     * 
     * @param marchPhase - Animation phase (0-2π) for one complete stride (2 beats)
     * @param bodyParts - References to animated body parts
     * @param isSettled - Whether marcher is in formation (affects animation style)
     * @param catchupFactor - 0-1, how much marcher is catching up (0=settled, 1=max catch-up)
     * @param swayAmplitude - Torso sway (twist) amplitude in radians (default: 0, disabled)
     */
    static animateMarcher(
        marchPhase: number,
        bodyParts: BodyParts,
        isSettled: boolean,
        catchupFactor: number,
        swayAmplitude: number = 0
    ): void {
        // Normalize phase to 0-1 for easier calculation
        const phaseNorm = marchPhase / (Math.PI * 2);
        
        // Which leg is in swing vs stance phase (0-1)
        // Leg swing happens from 0-0.5 phase, stance from 0.5-1
        const legSwing = (phaseNorm % 1 < 0.5) ? (phaseNorm % 1) * 2 : (1 - (phaseNorm % 1)) * 2;
        
        // Smooth step function: 0 at boundaries, 1 at middle
        const stepCurve = Math.sin(legSwing * Math.PI);
        
        // === LEG ANIMATION ===
        // More realistic leg motion: hip rise with forward leg, proper knee bend
        // Rotate JOINTS so bones rotate around joint endpoints
        
        // Left leg (forward on first half)
        const legAmplitudeBase = isSettled ? 0.6 : 0.5 + 0.2 * catchupFactor;
        const legAmplitude = legAmplitudeBase * (isSettled ? 0.9 : 1.0); // Slightly less when settled
        
        if (bodyParts.kneeJointL) {
            // Swing forward/back
            bodyParts.kneeJointL.rotation.x = Math.sin(marchPhase) * legAmplitude;
            // Slight hip rotation for realistic gait
            bodyParts.kneeJointL.rotation.z = Math.sin(marchPhase * 0.5) * 0.15;
        }
        
        if (bodyParts.ankleJointL) {
            // Knee bend during swing (straightens at bottom)
            const kneeBend = Math.max(0, Math.sin(legSwing * Math.PI) * 0.8);
            bodyParts.ankleJointL.rotation.x = kneeBend;
        }
        
        // Right leg (opposite phase)
        if (bodyParts.kneeJointR) {
            bodyParts.kneeJointR.rotation.x = Math.sin(marchPhase + Math.PI) * legAmplitude;
            bodyParts.kneeJointR.rotation.z = Math.sin((marchPhase + Math.PI) * 0.5) * 0.15;
        }
        
        if (bodyParts.ankleJointR) {
            const kneeBendR = Math.max(0, Math.sin((phaseNorm + 0.5) % 1 * Math.PI) * 0.8);
            bodyParts.ankleJointR.rotation.x = kneeBendR;
        }
        
        // === ARM ANIMATION ===
        // Arms hold instruments in front - minimal movement
        // Animate ELBOW and WRIST joints
        // Fixed forward posture to maintain instrument position
        
        const elbowBendMax = isSettled ? 0.4 : 0.45;
        
        if (bodyParts.elbowJointL) {
            // Keep elbow pointed slightly forward (minimal rotation)
            bodyParts.elbowJointL.rotation.x = -0.2;  // Slight forward angle
        }
        
        if (bodyParts.wristJointL) {
            // Wrist holds instrument in front, slight variation for natural feel
            const wristBend = elbowBendMax + Math.sin(marchPhase * 0.5) * 0.08;  // Very subtle flex
            bodyParts.wristJointL.rotation.x = -wristBend;  // Negative = forward/down
        }
        
        if (bodyParts.elbowJointR) {
            // Keep right elbow pointed slightly forward (minimal rotation)
            bodyParts.elbowJointR.rotation.x = -0.2;  // Slight forward angle
        }
        
        if (bodyParts.wristJointR) {
            // Wrist holds instrument in front, slight variation for natural feel
            const wristBend = elbowBendMax + Math.sin(marchPhase * 0.5) * 0.08;  // Very subtle flex
            bodyParts.wristJointR.rotation.x = -wristBend;  // Negative = forward/down
        }
        
        // === TORSO ANIMATION ===
        // Bounce during stepping, rotation with gait
        // Animate torsoJoint for sway/rotation
        
        if (bodyParts.torsoJoint) {
            // Torso sway (twist) following legs, controlled by swayAmplitude parameter
            bodyParts.torsoJoint.rotation.z = Math.sin(marchPhase * 0.5) * swayAmplitude;
            
            // Crunch forward slightly when catching up
            if (!isSettled) {
                bodyParts.torsoJoint.rotation.x = catchupFactor * 0.15;
            }
        }
        
        if (bodyParts.torso) {
            // Subtle vertical bounce (easier to feel than see in marching)
            const bodyBounce = stepCurve * 0.05; // 5cm bounce
            const torsoBaseY = bodyParts.torsoBaseY ?? 1.2;
            bodyParts.torso.position.y = torsoBaseY + bodyBounce;
        }
        
        // === NECK & HEAD ===
        // Head follows torch rhythm with slight bob
        // Animate neck and head JOINTS
        
        if (bodyParts.neckJoint) {
            // Neck leans with torso sway, controlled by swayAmplitude parameter
            bodyParts.neckJoint.rotation.z = Math.sin(marchPhase * 0.5) * swayAmplitude * 1.2;
            // Slight nod during step
            bodyParts.neckJoint.rotation.x = stepCurve * 0.08;
        }
        
        if (bodyParts.headJoint) {
            // Head tilts with torso sway, controlled by swayAmplitude parameter
            bodyParts.headJoint.rotation.z = Math.sin(marchPhase * 0.5) * swayAmplitude * 1.5;
            // Slight forward/back during catch-up
            if (!isSettled) {
                bodyParts.headJoint.rotation.x = catchupFactor * 0.1;
            }
        }
    }
    
    /**
     * Get catch-up factor (0-1) based on distance from formation position
     * @param gap - Distance from formation position in meters
     * @param settleZone - Distance threshold for settling (default 0.25m)
     * @returns 0 if settled, approaching 1 as gap increases
     */
    static getCatchupFactor(gap: number, settleZone: number = 0.25): number {
        if (gap <= settleZone) return 0;
        // Gradually increases from 0 at settle zone to 1 at 2m gap
        return Math.min(1.0, (gap - settleZone) / 2.0);
    }
}
