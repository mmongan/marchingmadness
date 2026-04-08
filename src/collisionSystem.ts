// Collision system: stumble/fall physics, domino cascade, hat scatter, dust particles
import { Scene, Vector3, ParticleSystem, Color4, AbstractMesh } from "@babylonjs/core";
import { BandMemberData } from "./bandMemberFactory";
import { FirstPersonBody } from "./firstPersonBody";
import {
    COLLISION_RADIUS, STUMBLE_RECOVERY, MAX_TILT, DOWN_DURATION,
    OBSTACLE_RADIUS, OBSTACLE_PUSH, MARCHER_COLLISION_RADIUS
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
 * Process player-to-marcher collisions + domino cascade.
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

    bandLegs.forEach(({ anchor }, index) => {
        const st = stumbleStates[index];
        const isDown = st.tilt >= MAX_TILT * 0.95;

        const bx = playerPos.x - anchor.position.x;
        const bz = playerPos.z - anchor.position.z;
        const bDistSq = bx * bx + bz * bz;
        if (bDistSq > broadRadiusSq) {
            if (st.downTimer > 0) {
                st.downTimer = Math.max(0, st.downTimer - frameDt);
            } else if (st.tilt > 0) {
                st.recovering = true;
                st.tilt = Math.max(0, st.tilt - STUMBLE_RECOVERY * frameDt);
            }
            if (st.tilt <= 0.001) {
                anchor.rotation.x = 0;
                anchor.rotation.z = 0;
            }
            return;
        }

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

        if (closestDistSq < COLLISION_RADIUS * COLLISION_RADIUS && closestDistSq > 0.001) {
            const dist = Math.sqrt(closestDistSq);
            st.tiltDirX = -closestDx / dist;
            st.tiltDirZ = -closestDz / dist;

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
                }
            }
        } else if (st.downTimer > 0) {
            st.downTimer = Math.max(0, st.downTimer - frameDt);
        } else if (st.tilt > 0) {
            st.recovering = true;
            st.tilt = Math.max(0, st.tilt - STUMBLE_RECOVERY * frameDt);
            if (st.tilt <= 0.001) {
                st.playedStumble = false;
                st.playedFall = false;
            }
        }

        if (st.tilt > 0.001) {
            anchor.rotation.x = st.tilt * st.tiltDirZ;
            anchor.rotation.z = -st.tilt * st.tiltDirX;
        } else {
            anchor.rotation.x = 0;
            anchor.rotation.z = 0;
        }
    });

    // Domino cascade via spatial grid
    const MARCHER_COL_SQ = MARCHER_COLLISION_RADIUS * MARCHER_COLLISION_RADIUS;
    const GRID_CELL = 2.0;
    const INV_CELL = 1 / GRID_CELL;
    const grid = new Map<number, number[]>();

    for (let j = 0; j < bandLegs.length; j++) {
        const p = bandLegs[j].anchor.position;
        const cx = (p.x * INV_CELL) | 0;
        const cz = (p.z * INV_CELL) | 0;
        const key = cx * 73856093 + cz * 19349663;
        const bucket = grid.get(key);
        if (bucket) bucket.push(j); else grid.set(key, [j]);
    }

    for (let i = 0; i < bandLegs.length; i++) {
        const si = stumbleStates[i];
        if (si.tilt < 0.4 && si.downTimer <= 0) continue;

        const ai = bandLegs[i].anchor.position;
        const cx = (ai.x * INV_CELL) | 0;
        const cz = (ai.z * INV_CELL) | 0;

        for (let ox = -1; ox <= 1; ox++) {
            for (let oz = -1; oz <= 1; oz++) {
                const key = (cx + ox) * 73856093 + (cz + oz) * 19349663;
                const bucket = grid.get(key);
                if (!bucket) continue;

                for (const j of bucket) {
                    if (i === j) continue;
                    const sj = stumbleStates[j];
                    if (sj.tilt > 0.3 || sj.downTimer > 0) continue;

                    const aj = bandLegs[j].anchor.position;
                    const dx = aj.x - ai.x;
                    const dz = aj.z - ai.z;
                    const distSq = dx * dx + dz * dz;
                    if (distSq >= MARCHER_COL_SQ || distSq < 0.001) continue;

                    const dist = Math.sqrt(distSq);
                    const overlap = 1 - dist / MARCHER_COLLISION_RADIUS;
                    const transferFactor = (si.tilt / MAX_TILT) * overlap * 1.5;
                    sj.tilt = Math.min(MAX_TILT, sj.tilt + transferFactor * frameDt * 6);
                    sj.tiltDirX = dx / dist;
                    sj.tiltDirZ = dz / dist;
                    sj.recovering = false;

                    if (!sj.playedStumble && sj.tilt > 0.3) {
                        sj.playedStumble = true;
                        playStumbleSound(bandLegs[j].row);
                        penaltyThisFrame += 2;
                    }
                    if (sj.tilt >= MAX_TILT * 0.95) {
                        sj.downTimer = DOWN_DURATION;
                        if (!sj.playedFall) {
                            sj.playedFall = true;
                            playCrashSound(bandLegs[j].row);
                            penaltyThisFrame += 5;
                            knockedThisFrame++;
                            emitDustBurst(scene, bandLegs[j].anchor.position);
                            scatterHat(bandLegs[j].anchor, sj.tiltDirX, sj.tiltDirZ);
                        }
                    }
                }
            }
        }
    }

    // Separation pass: push apart marchers who are both stumbling/down to prevent mesh overlap
    const SEPARATION_RADIUS = MARCHER_COLLISION_RADIUS + 0.1;
    const SEPARATION_FORCE = 0.4; // m/s² separation acceleration (reduced from 1.0)
    for (let i = 0; i < bandLegs.length; i++) {
        const si = stumbleStates[i];
        if (si.tilt <= 0.3 && si.downTimer <= 0) continue; // only stumbling/down marchers

        const ai = bandLegs[i].anchor.position;
        const cx = (ai.x * INV_CELL) | 0;
        const cz = (ai.z * INV_CELL) | 0;

        for (let ox = -1; ox <= 1; ox++) {
            for (let oz = -1; oz <= 1; oz++) {
                const key = (cx + ox) * 73856093 + (cz + oz) * 19349663;
                const bucket = grid.get(key);
                if (!bucket) continue;

                for (const j of bucket) {
                    if (i >= j) continue; // avoid double-processing
                    const sj = stumbleStates[j];
                    if (sj.tilt <= 0.3 && sj.downTimer <= 0) continue; // only if j is also stumbling/down

                    const aj = bandLegs[j].anchor.position;
                    const dx = aj.x - ai.x;
                    const dz = aj.z - ai.z;
                    const distSq = dx * dx + dz * dz;
                    const sepRadiusSq = SEPARATION_RADIUS * SEPARATION_RADIUS;
                    if (distSq >= sepRadiusSq || distSq < 0.001) continue;

                    const dist = Math.sqrt(distSq);
                    const overlap = SEPARATION_RADIUS - dist;
                    const pushForce = overlap * SEPARATION_FORCE * frameDt;
                    const pushX = (dx / dist) * pushForce;
                    const pushZ = (dz / dist) * pushForce;

                    // Push both marchers apart equally
                    ai.x -= pushX * 0.5;
                    ai.z -= pushZ * 0.5;
                    aj.x += pushX * 0.5;
                    aj.z += pushZ * 0.5;
                }
            }
        }
    }

    return {
        obstaclePushX,
        obstaclePushZ,
        marchersKnockedDown: knockedThisFrame,
        formationPenalty: penaltyThisFrame
    };
}
