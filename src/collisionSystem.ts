// Collision system: stumble/fall physics, domino cascade, hat scatter, dust particles
import { Scene, Vector3, ParticleSystem, Color4, AbstractMesh } from "@babylonjs/core";
import { BandMemberData } from "./bandMemberFactory";
import { FirstPersonBody } from "./firstPersonBody";
import {
    COLLISION_RADIUS, STUMBLE_RECOVERY, MAX_TILT, DOWN_DURATION, STAND_UP_DURATION,
    OBSTACLE_RADIUS, OBSTACLE_PUSH,
    HITS_TO_FALL, HIT_COUNT_RESET_TIME, HEALTH_DAMAGE_PER_FALL
} from "./gameConstants";
import { playStumbleSound, playCrashSound } from "./audioSystem";
import type { StumbleState } from "./gameConstants";
import { createStumbleState } from "./gameConstants";
export type { StumbleState };
export { createStumbleState };

// Scattered hat tracking
interface ScatteredHat {
    mesh: AbstractMesh;
    velX: number; velY: number; velZ: number;
    rotVelX: number; rotVelZ: number;
    timer: number;
}
const scatteredHats: ScatteredHat[] = [];

export function scatterHat(anchor: AbstractMesh, pushDirX: number, pushDirZ: number): void {
    const children = anchor.getChildMeshes(true);
    const hat = children.find(c => c.name.startsWith("hat") || c.name.startsWith("baseHat"));
    const plume = children.find(c => c.name.startsWith("plume") || c.name.startsWith("basePlume"));
    if (!hat) return;

    const worldPos = hat.getAbsolutePosition().clone();
    hat.parent = null;
    hat.position.copyFrom(worldPos);

    if (plume) {
        plume.parent = hat;
        plume.position.set(0, 0.2, 0);
    }

    const speed = 2 + Math.random() * 2;
    scatteredHats.push({
        mesh: hat,
        velX: pushDirX * speed + (Math.random() - 0.5) * 1.5,
        velY: 3 + Math.random() * 2,
        velZ: pushDirZ * speed + (Math.random() - 0.5) * 1.5,
        rotVelX: (Math.random() - 0.5) * 8,
        rotVelZ: (Math.random() - 0.5) * 8,
        timer: 6
    });
}

export function updateScatteredHats(dt: number): void {
    for (let i = scatteredHats.length - 1; i >= 0; i--) {
        const h = scatteredHats[i];
        h.velY -= 9.8 * dt;
        h.mesh.position.x += h.velX * dt;
        h.mesh.position.y += h.velY * dt;
        h.mesh.position.z += h.velZ * dt;
        h.mesh.rotation.x += h.rotVelX * dt;
        h.mesh.rotation.z += h.rotVelZ * dt;

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

export function hasScatteredHats(): boolean {
    return scatteredHats.length > 0;
}

export function emitDustBurst(scene: Scene, position: Vector3): void {
    const ps = new ParticleSystem("dust", 30, scene);
    ps.createPointEmitter(new Vector3(-0.5, 0, -0.5), new Vector3(0.5, 0.3, 0.5));
    ps.emitter = position.clone();
    (ps.emitter as Vector3).y = 0.05;
    ps.minSize = 0.05;
    ps.maxSize = 0.2;
    ps.minLifeTime = 0.3;
    ps.maxLifeTime = 0.8;
    ps.emitRate = 0;
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

export interface CollisionResult {
    obstaclePushX: number;
    obstaclePushZ: number;
    marchersKnockedDown: number;
    formationPenalty: number;
}

/**
 * Process player-to-marcher collisions only.
 * Marchers avoid collisions by routing around obstacles.
 * Returns obstacle push and scoring deltas for the frame.
 */
export function updateCollisions(
    scene: Scene,
    playerPos: Vector3,
    playerBody: FirstPersonBody,
    bandLegs: BandMemberData[],
    stumbleStates: StumbleState[],
    frameDt: number
): CollisionResult {
    let obstaclePushX = 0;
    let obstaclePushZ = 0;
    let knockedThisFrame = 0;
    let penaltyThisFrame = 0;

    const BROAD_RADIUS = 5.0;
    const broadRadiusSq = BROAD_RADIUS * BROAD_RADIUS;

    // === PHASE 1: Player-to-Marcher Collisions ===
    bandLegs.forEach(({ anchor }, index) => {
        const st = stumbleStates[index];
        const isDown = st.tilt >= MAX_TILT * 0.95;

        // Decay hit count over time when not being hit repeatedly
        if (st.hitCount > 0) {
            st.hitCountTimer += frameDt;
            if (st.hitCountTimer >= HIT_COUNT_RESET_TIME) {
                st.hitCount = 0;
                st.hitCountTimer = 0;
            }
        }

        const bx = playerPos.x - anchor.position.x;
        const bz = playerPos.z - anchor.position.z;
        const bDistSq = bx * bx + bz * bz;
        if (bDistSq > broadRadiusSq) {
            if (st.downTimer > 0) {
                st.downTimer = Math.max(0, st.downTimer - frameDt);
                // Transition to standing up when down time expires
                if (st.downTimer <= 0) {
                    st.standingUp = true;
                    st.standingUpTimer = 0;
                }
            } else if (st.standingUp) {
                // Animate stand-up: smooth interpolation from lying flat to vertical
                st.standingUpTimer += frameDt;
                const progress = Math.min(1.0, st.standingUpTimer / STAND_UP_DURATION);
                // Ease-out cubic for natural sit-up motion
                const easeProgress = 1 - Math.pow(1 - progress, 3);
                st.tilt = MAX_TILT * (1 - easeProgress);
                
                if (st.standingUpTimer >= STAND_UP_DURATION) {
                    st.standingUp = false;
                    st.tilt = 0;
                }
            } else if (st.tilt > 0) {
                st.recovering = true;
                st.tilt = Math.max(0, st.tilt - STUMBLE_RECOVERY * frameDt);
            }
            if (st.tilt <= 0.001) {
                anchor.rotation.x = 0;
                anchor.rotation.z = 0;
                // Reset hit tracking when fully recovered
                st.hitCount = 0;
                st.hitCountTimer = 0;
            }
            return;
        }

        // Obstacle push from down marchers (only push, no cascade)
        if (isDown && st.downTimer > 0) {
            const obstDistSq = bx * bx + bz * bz;
            if (obstDistSq < OBSTACLE_RADIUS * OBSTACLE_RADIUS && obstDistSq > 0.001) {
                const obstDist = Math.sqrt(obstDistSq);
                const pushStrength = (1 - obstDist / OBSTACLE_RADIUS) * OBSTACLE_PUSH * frameDt;
                obstaclePushX += (bx / obstDist) * pushStrength;
                obstaclePushZ += (bz / obstDist) * pushStrength;
            }
        }

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

        // Skip collision if standing up (make recovery invulnerable to interruption)
        if (st.standingUp) {
            // During stand-up: just push away gently, no damage
            if (closestDistSq < COLLISION_RADIUS * COLLISION_RADIUS && closestDistSq > 0.001) {
                const dist = Math.sqrt(closestDistSq);
                const pushForce = (1 - dist / COLLISION_RADIUS) * 0.2 * frameDt;
                const pushX = (-closestDx / dist) * pushForce;
                const pushZ = (-closestDz / dist) * pushForce;
                anchor.position.x += pushX;
                anchor.position.z += pushZ;
            }
            // Continue stand-up animation
            st.standingUpTimer += frameDt;
            const progress = Math.min(1.0, st.standingUpTimer / STAND_UP_DURATION);
            const easeProgress = 1 - Math.pow(1 - progress, 3);
            st.tilt = MAX_TILT * (1 - easeProgress);
            
            if (st.standingUpTimer >= STAND_UP_DURATION) {
                st.standingUp = false;
                st.tilt = 0;
                st.playedStumble = false;
                st.playedFall = false;
                st.hitCount = 0;
                st.hitCountTimer = 0;
            }
        } else if (closestDistSq < COLLISION_RADIUS * COLLISION_RADIUS && closestDistSq > 0.001) {
            const dist = Math.sqrt(closestDistSq);
            st.tiltDirX = -closestDx / dist;
            st.tiltDirZ = -closestDz / dist;

            // Increment hit count on new collision (when not already down)
            if (!isDown) {
                st.hitCount++;
                st.hitCountTimer = 0; // reset decay timer
            }

            const overlap = 1 - dist / COLLISION_RADIUS;
            const impact = overlap * 3.0;
            st.tilt = Math.min(MAX_TILT, st.tilt + impact * frameDt * 8);
            st.recovering = false;
            st.downTimer = 0;

            if (!st.playedStumble && st.tilt > 0.3) {
                st.playedStumble = true;
                playStumbleSound(bandLegs[index].row);
                penaltyThisFrame += 2;
                playerBody.pulseHaptics(0.4, 100);
            }

            // Auto-fall if hit multiple times while stumbling (reduces getting stuck)
            if (st.hitCount >= HITS_TO_FALL && st.tilt < MAX_TILT * 0.95) {
                st.tilt = MAX_TILT;
            }

            if (st.tilt >= MAX_TILT * 0.95) {
                st.downTimer = DOWN_DURATION;
                if (!st.playedFall) {
                    st.playedFall = true;
                    playCrashSound(bandLegs[index].row);
                    penaltyThisFrame += 5;
                    knockedThisFrame++;
                    emitDustBurst(scene, anchor.position);
                    playerBody.pulseHaptics(0.8, 200);
                    scatterHat(anchor, st.tiltDirX, st.tiltDirZ);
                    
                    // Decrease band member health on fall
                    bandLegs[index].health = Math.max(0, bandLegs[index].health - HEALTH_DAMAGE_PER_FALL);
                    
                    // Reset hit count once fallen
                    st.hitCount = 0;
                    st.hitCountTimer = 0;
                }
            }
        } else if (st.downTimer > 0) {
            st.downTimer = Math.max(0, st.downTimer - frameDt);
            // Transition to standing up when down time expires
            if (st.downTimer <= 0) {
                st.standingUp = true;
                st.standingUpTimer = 0;
            }
        } else if (st.tilt > 0) {
            st.recovering = true;
            st.tilt = Math.max(0, st.tilt - STUMBLE_RECOVERY * frameDt);
            if (st.tilt <= 0.001) {
                st.playedStumble = false;
                st.playedFall = false;
                // Reset hit count when fully recovered
                st.hitCount = 0;
                st.hitCountTimer = 0;
            }
        }

        if (st.tilt > 0.001) {
            anchor.rotation.x = st.tilt * st.tiltDirZ;
            anchor.rotation.z = -st.tilt * st.tiltDirX;
            
            // Prevent body parts from sinking into ground
            // When tilted, raise the anchor so the lowest body point stays at Y > 0
            // Maximum tilt is ~1.57 rad (π/2), body length from anchor ~1.0m
            // At full tilt, minimum Y should be ~0.5m to keep feet from going below 0
            const minY = 0.5 * Math.sin(st.tilt);
            anchor.position.y = Math.max(anchor.position.y, minY);
        } else {
            anchor.rotation.x = 0;
            anchor.rotation.z = 0;
            // Return to ground level when standing up
            anchor.position.y = 0;
        }
    });

    // === PHASE 2: Marcher Avoidance Routing ===
    // Marchers detect nearby obstacles (player, down marchers) and route around them
    const AVOIDANCE_RADIUS = 2.5; // Detection range for obstacles
    const AVOIDANCE_FORCE = 3.0; // Strength of repulsive force

    bandLegs.forEach(({ anchor }, index) => {
        const st = stumbleStates[index];
        
        // Don't apply avoidance to marchers that are down or standing up
        if (st.downTimer > 0 || st.standingUp || st.tilt >= MAX_TILT * 0.5) {
            return;
        }

        let avoidX = 0;
        let avoidZ = 0;

        // Detect player as obstacle
        const toPlayerX = anchor.position.x - playerPos.x;
        const toPlayerZ = anchor.position.z - playerPos.z;
        const playerDistSq = toPlayerX * toPlayerX + toPlayerZ * toPlayerZ;
        
        if (playerDistSq > 0.001 && playerDistSq < AVOIDANCE_RADIUS * AVOIDANCE_RADIUS) {
            const playerDist = Math.sqrt(playerDistSq);
            const repulsionForce = (1 - playerDist / AVOIDANCE_RADIUS) * AVOIDANCE_FORCE;
            avoidX += (toPlayerX / playerDist) * repulsionForce;
            avoidZ += (toPlayerZ / playerDist) * repulsionForce;
        }

        // Detect down marchers as obstacles
        for (let j = 0; j < bandLegs.length; j++) {
            if (j === index) continue;
            const sj = stumbleStates[j];
            
            // Only treat marchers that are down as obstacles
            if (sj.downTimer <= 0) continue;

            const aj = bandLegs[j].anchor.position;
            const toObstacleX = anchor.position.x - aj.x;
            const toObstacleZ = anchor.position.z - aj.z;
            const obstDistSq = toObstacleX * toObstacleX + toObstacleZ * toObstacleZ;

            if (obstDistSq > 0.001 && obstDistSq < AVOIDANCE_RADIUS * AVOIDANCE_RADIUS) {
                const obstDist = Math.sqrt(obstDistSq);
                const repulsionForce = (1 - obstDist / AVOIDANCE_RADIUS) * AVOIDANCE_FORCE;
                avoidX += (toObstacleX / obstDist) * repulsionForce;
                avoidZ += (toObstacleZ / obstDist) * repulsionForce;
            }
        }

        // Apply avoidance by adjusting position
        if (avoidX !== 0 || avoidZ !== 0) {
            anchor.position.x += avoidX * frameDt;
            anchor.position.z += avoidZ * frameDt;
        }
    });

    return {
        obstaclePushX,
        obstaclePushZ,
        marchersKnockedDown: knockedThisFrame,
        formationPenalty: penaltyThisFrame
    };
}
