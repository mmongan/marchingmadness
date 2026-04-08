// Drill factory: band creation and positioning
import { Scene } from "@babylonjs/core";
import { BandMemberFactory, InstrumentType, BandMemberData } from "./bandMemberFactory";

export interface DrillConfig {
    rows: number;
    cols: number;
    spacingX: number;
    spacingZ: number;
    startZ: number;
}

export interface DrillInfo {
    members: BandMemberData[];
    config: DrillConfig;
}

const DEFAULT_DRILL_CONFIG: DrillConfig = {
    rows: 15,
    cols: 5,
    spacingX: 2.0,
    spacingZ: 2.0,
    startZ: 15
};

/**
 * Map instrument types by row index.
 * Rows 0-14 correspond to different instruments/sections.
 */
function getInstrumentType(row: number): InstrumentType {
    if (row === 0) return "DrumMajor";
    if (row === 1) return "Flute";
    if (row === 2) return "Clarinet";
    if (row === 3) return "Saxophone";
    if (row === 4) return "Mellophone";
    if (row === 5 || row === 6) return "Trumpet";
    if (row === 7) return "Trombone";
    if (row === 8) return "Euphonium";
    if (row === 9) return "Sousaphone";
    if (row === 10) return "Glockenspiel";
    if (row === 11) return "SnareDrum";
    if (row === 12) return "TomTom";
    if (row === 13) return "BassDrum";
    if (row === 14) return "Cymbals";
    return "DrumMajor"; // fallback
}

/**
 * Create a marching band with the given configuration.
 * Each band member is positioned in a grid layout.
 * @param scene Babylon.js scene
 * @param config Drill configuration (defaults to 15x5 standard band)
 * @returns DrillInfo with all band members
 */
export function createDrill(scene: Scene, config: DrillConfig = DEFAULT_DRILL_CONFIG): DrillInfo {
    const factory = new BandMemberFactory(scene);
    const members: BandMemberData[] = [];

    for (let r = 0; r < config.rows; r++) {
        for (let c = 0; c < config.cols; c++) {
            // Calculate position in the grid
            const xPos = (c - config.cols / 2 + 0.5) * config.spacingX;
            const zPos = config.startZ + r * config.spacingZ;

            // Determine instrument type for this row
            const instrumentType = getInstrumentType(r);

            // Create the member
            const memberData = factory.createMember(r, c, instrumentType, xPos, zPos);
            members.push(memberData);
        }
    }

    return {
        members,
        config
    };
}

/**
 * Create a custom drill with specific rows/columns.
 * Useful for forming smaller sub-groups or testing.
 * @param scene Babylon.js scene
 * @param rows Number of rows
 * @param cols Number of columns
 * @returns DrillInfo with custom-sized band
 */
export function createCustomDrill(scene: Scene, rows: number, cols: number): DrillInfo {
    const config: DrillConfig = {
        rows,
        cols,
        spacingX: 2.0,
        spacingZ: 2.0,
        startZ: 15
    };
    return createDrill(scene, config);
}
