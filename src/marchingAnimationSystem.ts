import { Mesh, InstancedMesh } from "@babylonjs/core";

/**
 * Body part references for realistic animation
 */
export interface BodyParts {
    head?: InstancedMesh | Mesh;
    headBaseY?: number;
    neck?: InstancedMesh | Mesh;
    neckBaseY?: number;
    torso?: InstancedMesh | Mesh;
    torsoBaseY?: number;
    upperArmL?: InstancedMesh | Mesh;
    upperArmR?: InstancedMesh | Mesh;
    elbowL?: InstancedMesh | Mesh;
    elbowR?: InstancedMesh | Mesh;
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
        
        // Left leg (forward on first half)
        const legAmplitudeBase = isSettled ? 0.6 : 0.5 + 0.2 * catchupFactor;
        const legAmplitude = legAmplitudeBase * (isSettled ? 0.9 : 1.0); // Slightly less when settled
        
        if (bodyParts.upperLegL) {
            // Swing forward/back
            bodyParts.upperLegL.rotation.x = Math.sin(marchPhase) * legAmplitude;
            // Slight hip rotation for realistic gait
            bodyParts.upperLegL.rotation.z = Math.sin(marchPhase * 0.5) * 0.15;
        }
        
        if (bodyParts.lowerLegL) {
            // Knee bend during swing (straightens at bottom)
            const kneeBend = Math.max(0, Math.sin(legSwing * Math.PI) * 0.8);
            bodyParts.lowerLegL.rotation.x = kneeBend;
        }
        
        // Right leg (opposite phase)
        if (bodyParts.upperLegR) {
            bodyParts.upperLegR.rotation.x = Math.sin(marchPhase + Math.PI) * legAmplitude;
            bodyParts.upperLegR.rotation.z = Math.sin((marchPhase + Math.PI) * 0.5) * 0.15;
        }
        
        if (bodyParts.lowerLegR) {
            const kneeBendR = Math.max(0, Math.sin((phaseNorm + 0.5) % 1 * Math.PI) * 0.8);
            bodyParts.lowerLegR.rotation.x = kneeBendR;
        }
        
        // === ARM ANIMATION ===
        // Arms hold instruments in front - minimal movement
        // Fixed forward posture to maintain instrument position
        
        const elbowBendMax = isSettled ? 0.4 : 0.45;
        
        if (bodyParts.upperArmL) {
            // Keep left arm pointing slightly forward (minimal rotation)
            bodyParts.upperArmL.rotation.x = -0.2;  // Slight forward angle
        }
        
        if (bodyParts.forearmL) {
            // Forearm holds instrument in front, slight variation for natural feel
            const elbowBend = elbowBendMax + Math.sin(marchPhase * 0.5) * 0.08;  // Very subtle flex
            bodyParts.forearmL.rotation.x = -elbowBend;  // Negative = forward/down
        }
        
        if (bodyParts.upperArmR) {
            // Keep right arm pointing slightly forward (minimal rotation)
            bodyParts.upperArmR.rotation.x = -0.2;  // Slight forward angle
        }
        
        if (bodyParts.forearmR) {
            // Forearm holds instrument in front, slight variation for natural feel
            const elbowBend = elbowBendMax + Math.sin(marchPhase * 0.5) * 0.08;  // Very subtle flex
            bodyParts.forearmR.rotation.x = -elbowBend;  // Negative = forward/down
        }
        
        // === TORSO ANIMATION ===
        // Bounce during stepping, rotation with gait
        
        if (bodyParts.torso) {
            // Subtle vertical bounce (easier to feel than see in marching)
            const bodyBounce = stepCurve * 0.05; // 5cm bounce
            const torsoBaseY = bodyParts.torsoBaseY ?? 1.2;
            bodyParts.torso.position.y = torsoBaseY + bodyBounce;
            
            // Torso sway (twist) following legs, controlled by swayAmplitude parameter
            bodyParts.torso.rotation.z = Math.sin(marchPhase * 0.5) * swayAmplitude;
            
            // Crunch forward slightly when catching up
            if (!isSettled) {
                bodyParts.torso.rotation.x = catchupFactor * 0.15;
            }
        }
        
        // === NECK & HEAD ===
        // Head follows torch rhythm with slight bob
        // Note: Neck and head are now children of their parents, so Y positioning 
        // propagates through hierarchy automatically. Only animate rotations.
        
        if (bodyParts.neck) {
            // Neck leans with torso sway, controlled by swayAmplitude parameter
            bodyParts.neck.rotation.z = Math.sin(marchPhase * 0.5) * swayAmplitude * 1.2;
            // Slight nod during step
            bodyParts.neck.rotation.x = stepCurve * 0.08;
        }
        
        if (bodyParts.head) {
            // Head tilts with torso sway, controlled by swayAmplitude parameter
            bodyParts.head.rotation.z = Math.sin(marchPhase * 0.5) * swayAmplitude * 1.5;
            // Slight forward/back during catch-up
            if (!isSettled) {
                bodyParts.head.rotation.x = catchupFactor * 0.1;
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
