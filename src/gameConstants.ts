// Shared game constants used across modules
export const BPM = 80;
export const WHOLE_NOTE_DURATION = (60 / BPM) * 4; // 3.0 seconds per measure
export const SECONDS_PER_BEAT = 60 / BPM;         // 0.75 seconds
// 8 steps per 5 yards: 5 yards = 4.5708m. 1 beat = 0.57135m
export const FLY_SPEED = 0.57135 * (BPM / 60);

// Collision / physics
export const COLLISION_RADIUS = 1.0;
export const STUMBLE_RECOVERY = 0.5;   // rad/s
export const MAX_TILT = Math.PI / 2;
export const DOWN_DURATION = 4.0;      // seconds
export const OBSTACLE_RADIUS = 1.2;
export const OBSTACLE_PUSH = 3.0;      // m/s
export const MARCHER_COLLISION_RADIUS = 1.5;

// Spatial audio
export const SPATIAL_RADIUS = 20;
export const SPATIAL_RADIUS_SQ = SPATIAL_RADIUS * SPATIAL_RADIUS;

// Footstep scoring
export const PLAYER_DRILL_ROW = 0;
export const PLAYER_DRILL_COL = 2;
export const PLAYER_START_X = (PLAYER_DRILL_COL - 5 / 2 + 0.5) * 2.0; // 0.0
export const PLAYER_START_Z = 15;
export const STEP_LOOK_AHEAD = 12;
export const STEP_HIT_PERFECT = 1.0;
export const STEP_HIT_GOOD = 2.0;
export const FOOT_LATERAL = 0.18;

// Band layout
export const BAND_ROWS = 15;
export const BAND_COLS = 5;
export const SPACING_X = 2.0;
export const SPACING_Z = 2.0;
export const BAND_START_Z = 15;

// Instrument mapping: row → SoundFont instrument index (null = percussion)
export const ROW_TO_SF_INDEX: (number | null)[] = [
    null, // 0  DrumMajor
    5,    // 1  Flute       → flute
    6,    // 2  Clarinet    → clarinet
    7,    // 3  Saxophone   → alto_sax
    2,    // 4  Mellophone  → french_horn
    0,    // 5  Trumpet     → trumpet
    1,    // 6  Trumpet     → trumpet2
    3,    // 7  Trombone    → trombone
    3,    // 8  Euphonium   → trombone
    4,    // 9  Sousaphone  → tuba
    8,    // 10 Glockenspiel→ glockenspiel
    null, // 11 SnareDrum
    null, // 12 TomTom
    null, // 13 BassDrum
    null, // 14 Cymbals
];

// General MIDI instrument config
export const GM_INSTRUMENT_NAMES = [
    "trumpet", "trumpet", "french_horn", "trombone", "tuba",
    "flute", "clarinet", "alto_sax", "glockenspiel"
];
export const GM_INSTRUMENT_VOLUMES = [100, 90, 85, 95, 100, 80, 85, 85, 75];

// Song list
export const SONG_LIST = [
    { file: "assets/score.xml", title: "MacArthur Park", subtitle: "Brass Quintet" },
    { file: "assets/saints.xml", title: "When the Saints", subtitle: "Full Band" },
    { file: "assets/stars_and_stripes.xml", title: "Stars & Stripes", subtitle: "Full Band" },
    { file: "assets/battle_hymn.xml", title: "Battle Hymn", subtitle: "Full Band" },
];

// Stumble state per band member (shared between collision and audio systems)
export interface StumbleState {
    tilt: number;
    tiltDirX: number;
    tiltDirZ: number;
    recovering: boolean;
    downTimer: number;
    playedStumble: boolean;
    playedFall: boolean;
}

export function createStumbleState(): StumbleState {
    return { tilt: 0, tiltDirX: 0, tiltDirZ: 0, recovering: false, downTimer: 0, playedStumble: false, playedFall: false };
}
