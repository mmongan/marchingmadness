// Pure math/logic extracted from main.ts for testability
import { FIELD_MIN_X, FIELD_MAX_X, FIELD_MIN_Z, FIELD_MAX_Z } from "./gameConstants";

export type DrillShape = (r: number, c: number, cols: number, rows: number, startX: number, startZ: number, rotation?: number) => {x: number, z: number};

export function smoothstep(t: number): number {
    return t * t * (3 - 2 * t);
}

export function rotatePoint(x: number, z: number, angle: number): {x: number, z: number} {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    return {
        x: x * cos - z * sin,
        z: x * sin + z * cos
    };
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
        const newZ = startZ - distFromCenter * 2.0;
        const clampedX = Math.max(FIELD_MIN_X, Math.min(FIELD_MAX_X, startX * 1.2));
        const clampedZ = Math.max(FIELD_MIN_Z, Math.min(FIELD_MAX_Z, newZ));
        return { x: clampedX, z: clampedZ };
    },

    // 3: Diamond Bow - X stretches outward in the middle rows
    (r, _c, _cols, rows, startX, startZ) => {
        const rowPhase = (r / (rows - 1)) * Math.PI;
        const stretch = 1.0 + Math.sin(rowPhase) * 0.8;
        const newX = startX * stretch;
        const clampedX = Math.max(FIELD_MIN_X, Math.min(FIELD_MAX_X, newX));
        return { x: clampedX, z: startZ };
    },

    // 4: S-Curve Wave - Entire band slithers left and right down the field
    (_r, _c, _cols, _rows, startX, startZ) => {
        const waveShift = Math.sin(startZ / 5.0) * 2.0;
        const newX = startX * 1.5 + waveShift;
        const clampedX = Math.max(FIELD_MIN_X, Math.min(FIELD_MAX_X, newX));
        return { x: clampedX, z: startZ };
    },

    // 5: Circle - Band forms a circle
    (_r, c, cols, _rows, _startX, startZ) => {
        const centerCol = (cols - 1) / 2;
        const radius = Math.min(10, Math.max(cols, cols) * 1.5);
        const angle = (c / cols) * Math.PI * 2;
        const newX = Math.cos(angle) * radius;
        const newZ = startZ - (cols - centerCol) * 1.5 + Math.sin(angle) * radius * 0.5;
        return {
            x: Math.max(FIELD_MIN_X, Math.min(FIELD_MAX_X, newX)),
            z: Math.max(FIELD_MIN_Z, Math.min(FIELD_MAX_Z, newZ))
        };
    },

    // 6: Spiral - Band spirals outward as it moves down field
    (_r, c, cols, _rows, _startX, startZ) => {
        const angle = (c / cols) * Math.PI * 4;
        const spiral = (c / cols) * 5;
        const newX = Math.cos(angle) * spiral;
        const newZ = startZ + Math.sin(angle) * spiral * 0.5;
        return {
            x: Math.max(FIELD_MIN_X, Math.min(FIELD_MAX_X, newX)),
            z: Math.max(FIELD_MIN_Z, Math.min(FIELD_MAX_Z, newZ))
        };
    },

    // 7: Plus/Cross - Forms a cross shape
    (r, c, cols, rows, startX, startZ) => {
        const centerRow = (rows - 1) / 2;
        const centerCol = (cols - 1) / 2;
        const isHorizontal = Math.abs(r - centerRow) < 1.5;
        const isVertical = Math.abs(c - centerCol) < 1.5;
        if (isHorizontal || isVertical) {
            return { x: startX, z: startZ };
        }
        // Push non-cross members to sides
        const pushX = (c - centerCol) > 0 ? 3 : -3;
        const pushZ = (r - centerRow) > 0 ? 3 : -3;
        return {
            x: Math.max(FIELD_MIN_X, Math.min(FIELD_MAX_X, startX + pushX)),
            z: Math.max(FIELD_MIN_Z, Math.min(FIELD_MAX_Z, startZ + pushZ))
        };
    },

    // 8: Star - Five-pointed star formation
    (_r, c, cols, _rows, _startX, startZ) => {
        const centerCol = (cols - 1) / 2;
        const distFromCenter = Math.abs(c - centerCol);
        const isPoint = distFromCenter < 1;
        if (isPoint) {
            return { x: 0, z: startZ };
        }
        // Create 5 arms of the star
        const angle = ((c / cols) * Math.PI * 2);
        const armLength = distFromCenter * 2;
        const newX = Math.cos(angle) * armLength;
        const newZ = startZ - (cols / 2) * 1.5 + Math.sin(angle) * armLength;
        return {
            x: Math.max(FIELD_MIN_X, Math.min(FIELD_MAX_X, newX)),
            z: Math.max(FIELD_MIN_Z, Math.min(FIELD_MAX_Z, newZ))
        };
    },

    // 9: Figure-8 - Band traces a figure-8 pattern
    (_r, c, cols, _rows, _startX, startZ) => {
        const progress = c / cols;
        const lobes = Math.sin(progress * Math.PI * 2);
        const newX = Math.sin(progress * Math.PI * 4) * 3 * lobes;
        const newZ = startZ + Math.sin(progress * Math.PI * 2) * 2;
        return {
            x: Math.max(FIELD_MIN_X, Math.min(FIELD_MAX_X, newX)),
            z: Math.max(FIELD_MIN_Z, Math.min(FIELD_MAX_Z, newZ))
        };
    },

    // 10: Diagonal Lines - Columns form diagonal lines
    (_r, c, cols, rows, startX, startZ) => {
        const diagonalShift = (c / cols) * rows * 1.5;
        const newZ = startZ - diagonalShift;
        const centerCol = (cols - 1) / 2;
        const colDist = c - centerCol;
        const newX = startX + colDist * 0.5;
        return {
            x: Math.max(FIELD_MIN_X, Math.min(FIELD_MAX_X, newX)),
            z: Math.max(FIELD_MIN_Z, Math.min(FIELD_MAX_Z, newZ))
        };
    },

    // 11: Hexagon - Fills space with rotating hexagon segments
    (r, c, cols, rows, _startX, startZ) => {
        const centerRow = (rows - 1) / 2;
        const centerCol = (cols - 1) / 2;
        const relRow = r - centerRow;
        const relCol = c - centerCol;
        const angle = Math.atan2(relCol, relRow);
        const hexSides = 6;
        const hexAngle = Math.floor((angle / Math.PI) * hexSides) / hexSides * Math.PI;
        const dist = Math.sqrt(relCol * relCol + relRow * relRow);
        const radius = Math.max(cols, rows) * 1.2;
        const newX = Math.cos(hexAngle) * Math.min(dist, radius);
        const newZ = startZ + Math.sin(hexAngle) * Math.min(dist, radius) * 0.5;
        return {
            x: Math.max(FIELD_MIN_X, Math.min(FIELD_MAX_X, newX)),
            z: Math.max(FIELD_MIN_Z, Math.min(FIELD_MAX_Z, newZ))
        };
    }
];

export const drillTimeline = [
    // Opening block: 0-32 beats
    { beat: 0, shape: 0, rotation: 0 },
    { beat: 16, shape: 0, rotation: 0 },
    { beat: 32, shape: 1, rotation: 0 },
    
    // First rotation: 32-64 beats
    { beat: 48, shape: 1, rotation: Math.PI / 4 },
    { beat: 64, shape: 2, rotation: Math.PI / 2 },
    
    // Wedge to circle: 64-96 beats
    { beat: 80, shape: 2, rotation: Math.PI },
    { beat: 96, shape: 5, rotation: 0 },
    
    // Spiral expansion: 96-128 beats
    { beat: 112, shape: 6, rotation: 0 },
    { beat: 128, shape: 7, rotation: Math.PI / 4 },
    
    // Cross and star: 128-160 beats
    { beat: 144, shape: 8, rotation: Math.PI / 8 },
    { beat: 160, shape: 9, rotation: 0 },
    
    // Figure-8 to diagonal: 160-192 beats
    { beat: 176, shape: 9, rotation: Math.PI / 4 },
    { beat: 192, shape: 10, rotation: Math.PI / 2 },
    
    // Diagonal to hexagon: 192-224 beats
    { beat: 208, shape: 10, rotation: Math.PI },
    { beat: 224, shape: 11, rotation: 0 },
    
    // Hexagon rotations: 224-256 beats
    { beat: 240, shape: 11, rotation: Math.PI / 3 },
    { beat: 256, shape: 11, rotation: (2 * Math.PI) / 3 },
    
    // Back through waves: 256-288 beats
    { beat: 272, shape: 4, rotation: 0 },
    { beat: 288, shape: 4, rotation: Math.PI / 6 },
    
    // Return to diamond: 288-320 beats
    { beat: 304, shape: 3, rotation: 0 },
    { beat: 320, shape: 3, rotation: Math.PI / 2 },
    
    // Back to original: 320+ beats
    { beat: 336, shape: 0, rotation: 0 }
];

export function getDrillPosition(currentBeat: number, r: number, c: number, cols: number, rows: number, startX: number, startZ: number): {x: number, z: number} {
    const maxBeat = 336;
    let loopedBeat = currentBeat % maxBeat;

    let currentIndex = 0;
    while (currentIndex < drillTimeline.length - 1 && drillTimeline[currentIndex + 1].beat <= loopedBeat) {
        currentIndex++;
    }

    const currentPhase = drillTimeline[currentIndex];

    if (currentIndex === drillTimeline.length - 1) {
        const pos = drillShapes[currentPhase.shape](r, c, cols, rows, startX, startZ, currentPhase.rotation);
        const rotated = rotatePoint(pos.x, pos.z, currentPhase.rotation || 0);
        return {
            x: Math.max(FIELD_MIN_X, Math.min(FIELD_MAX_X, rotated.x)),
            z: Math.max(FIELD_MIN_Z, Math.min(FIELD_MAX_Z, rotated.z))
        };
    }

    const nextPhase = drillTimeline[currentIndex + 1];
    const progress = (loopedBeat - currentPhase.beat) / (nextPhase.beat - currentPhase.beat);

    const p1 = drillShapes[currentPhase.shape](r, c, cols, rows, startX, startZ, currentPhase.rotation);
    const p2 = drillShapes[nextPhase.shape](r, c, cols, rows, startX, startZ, nextPhase.rotation);
    
    const rotated1 = rotatePoint(p1.x, p1.z, currentPhase.rotation || 0);
    const rotated2 = rotatePoint(p2.x, p2.z, nextPhase.rotation || 0);
    
    const s = smoothstep(progress);

    const finalPos = {
        x: rotated1.x + (rotated2.x - rotated1.x) * s,
        z: rotated1.z + (rotated2.z - rotated1.z) * s
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
