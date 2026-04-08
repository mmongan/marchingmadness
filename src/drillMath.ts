// Pure math/logic extracted from main.ts for testability

export type DrillShape = (r: number, c: number, cols: number, rows: number, startX: number, startZ: number) => {x: number, z: number};

export function smoothstep(t: number): number {
    return t * t * (3 - 2 * t);
}

export const drillShapes: DrillShape[] = [
    // 0: Original Block
    (_r, _c, _cols, _rows, startX, startZ) => ({ x: startX, z: startZ }),

    // 1: Expanded Block
    (_r, _c, _cols, _rows, startX, startZ) => ({ x: startX * 2.0, z: startZ }),

    // 2: Wedge (Arrowhead) - Z shifts based on column distance from center
    (_r, c, cols, _rows, startX, startZ) => {
        const centerCol = (cols - 1) / 2;
        const distFromCenter = Math.abs(c - centerCol);
        return { x: startX * 1.5, z: startZ - distFromCenter * 3.0 };
    },

    // 3: Diamond Bow - X stretches outward in the middle rows
    (r, _c, _cols, rows, startX, startZ) => {
        const rowPhase = (r / (rows - 1)) * Math.PI;
        const stretch = 1.0 + 1.2 * Math.sin(rowPhase);
        return { x: startX * stretch, z: startZ };
    },

    // 4: S-Curve Wave - Entire band slithers left and right down the field
    (_r, _c, _cols, _rows, startX, startZ) => {
        const waveShift = Math.sin(startZ / 5.0) * 3.0;
        return { x: startX * 1.5 + waveShift, z: startZ };
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
        return drillShapes[currentPhase.shape](r, c, cols, rows, startX, startZ);
    }

    const nextPhase = drillTimeline[currentIndex + 1];
    const progress = (loopedBeat - currentPhase.beat) / (nextPhase.beat - currentPhase.beat);

    const p1 = drillShapes[currentPhase.shape](r, c, cols, rows, startX, startZ);
    const p2 = drillShapes[nextPhase.shape](r, c, cols, rows, startX, startZ);
    const s = smoothstep(progress);

    return {
        x: p1.x + (p2.x - p1.x) * s,
        z: p1.z + (p2.z - p1.z) * s
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
