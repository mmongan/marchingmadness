// Pure math/logic extracted from main.ts for testability
import { FIELD_MIN_X, FIELD_MAX_X, FIELD_MIN_Z, FIELD_MAX_Z } from "./gameConstants";

export type DrillShape = (r: number, c: number, cols: number, rows: number, startX: number, startZ: number) => {x: number, z: number};

export function smoothstep(t: number): number {
    return t * t * (3 - 2 * t);
}

export const drillShapes: DrillShape[] = [
    // 0: Original Block
    (_r, _c, _cols, _rows, startX, startZ) => ({ x: startX, z: startZ }),

    // 1: Expanded Block - constrained to field bounds
    (_r, _c, _cols, _rows, startX, startZ) => {
        const expandedX = startX * 1.5;
        // Clamp X to field bounds
        const clampedX = Math.max(FIELD_MIN_X, Math.min(FIELD_MAX_X, expandedX));
        return { x: clampedX, z: startZ };
    },

    // 2: Wedge (Arrowhead) - Z shifts based on column distance from center
    (_r, c, cols, _rows, startX, startZ) => {
        const centerCol = (cols - 1) / 2;
        const distFromCenter = Math.abs(c - centerCol);
        const newZ = startZ - distFromCenter * 2.0; // reduced from 3.0
        const clampedX = Math.max(FIELD_MIN_X, Math.min(FIELD_MAX_X, startX * 1.2));
        const clampedZ = Math.max(FIELD_MIN_Z, Math.min(FIELD_MAX_Z, newZ));
        return { x: clampedX, z: clampedZ };
    },

    // 3: Diamond Bow - X stretches outward in the middle rows
    (r, _c, _cols, rows, startX, startZ) => {
        const rowPhase = (r / (rows - 1)) * Math.PI;
        const stretch = 1.0 + Math.sin(rowPhase) * 0.8; // reduced from 1.2
        const newX = startX * stretch;
        const clampedX = Math.max(FIELD_MIN_X, Math.min(FIELD_MAX_X, newX));
        return { x: clampedX, z: startZ };
    },

    // 4: S-Curve Wave - Entire band slithers left and right down the field
    (_r, _c, _cols, _rows, startX, startZ) => {
        const waveShift = Math.sin(startZ / 5.0) * 2.0; // reduced from 3.0
        const newX = startX * 1.5 + waveShift;
        const clampedX = Math.max(FIELD_MIN_X, Math.min(FIELD_MAX_X, newX));
        return { x: clampedX, z: startZ };
    }
];

export const drillTimeline = [
    { beat: 0, shape: 0 },
    { beat: 16, shape: 0 },
    { beat: 32, shape: 1 },
    { beat: 48, shape: 1 },
    { beat: 64, shape: 2 },
    { beat: 80, shape: 2 },
    { beat: 96, shape: 4 },
    { beat: 112, shape: 4 },
    { beat: 128, shape: 3 },
    { beat: 144, shape: 3 },
    { beat: 160, shape: 0 },
];

export function getDrillPosition(currentBeat: number, r: number, c: number, cols: number, rows: number, startX: number, startZ: number): {x: number, z: number} {
    const maxBeat = 160;
    let loopedBeat = currentBeat % maxBeat;

    let currentIndex = 0;
    while (currentIndex < drillTimeline.length - 1 && drillTimeline[currentIndex + 1].beat <= loopedBeat) {
        currentIndex++;
    }

    const currentPhase = drillTimeline[currentIndex];

    if (currentIndex === drillTimeline.length - 1) {
        const pos = drillShapes[currentPhase.shape](r, c, cols, rows, startX, startZ);
        return {
            x: Math.max(FIELD_MIN_X, Math.min(FIELD_MAX_X, pos.x)),
            z: Math.max(FIELD_MIN_Z, Math.min(FIELD_MAX_Z, pos.z))
        };
    }

    const nextPhase = drillTimeline[currentIndex + 1];
    const progress = (loopedBeat - currentPhase.beat) / (nextPhase.beat - currentPhase.beat);

    const p1 = drillShapes[currentPhase.shape](r, c, cols, rows, startX, startZ);
    const p2 = drillShapes[nextPhase.shape](r, c, cols, rows, startX, startZ);
    const s = smoothstep(progress);

    const finalPos = {
        x: p1.x + (p2.x - p1.x) * s,
        z: p1.z + (p2.z - p1.z) * s
    };
    
    // Final clamp to ensure no marchers go outside field
    return {
        x: Math.max(FIELD_MIN_X, Math.min(FIELD_MAX_X, finalPos.x)),
        z: Math.max(FIELD_MIN_Z, Math.min(FIELD_MAX_Z, finalPos.z))
    };
}

export function getGrade(formationQuality: number): string {
    return formationQuality >= 90 ? "A"
        : formationQuality >= 80 ? "B"
        : formationQuality >= 70 ? "C"
        : formationQuality >= 60 ? "D"
        : "F";
}

export const STEP_HIT_PERFECT = 1.0;
export const STEP_HIT_GOOD = 2.0;

export type StepResult = "perfect" | "good" | "miss";

export function scoreStep(distance: number): StepResult {
    if (distance < STEP_HIT_PERFECT) return "perfect";
    if (distance < STEP_HIT_GOOD) return "good";
    return "miss";
}

export function qualityDelta(result: StepResult): number {
    if (result === "perfect") return 0.8;
    if (result === "good") return 0.2;
    return -0.3;
}

export const BPM = 80;
export const WHOLE_NOTE_DURATION = (60 / BPM) * 4;
export const FLY_SPEED = 0.57135 * (BPM / 60);
export const SECONDS_PER_BEAT = 60 / BPM;
