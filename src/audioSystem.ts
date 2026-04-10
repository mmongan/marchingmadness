// Audio system: instrument loading, metronome, collision sounds, spatial audio
import * as Tone from "tone";
import { Soundfont } from "smplr";
import { Vector3 } from "@babylonjs/core";
import { BandMemberData } from "./bandMemberFactory";
import {
    GM_INSTRUMENT_NAMES, GM_INSTRUMENT_VOLUMES, ROW_TO_SF_INDEX,
    SPATIAL_RADIUS_SQ
} from "./gameConstants";
import type { StumbleState } from "./gameConstants";

export const sfInstruments: Map<number, Soundfont> = new Map();
export const sfPanners: Map<number, PannerNode> = new Map();

let crashSynth: Tone.NoiseSynth | null = null;
let lastCrashTime = -1;

/** Returns true only when the AudioContext is running (user has interacted). */
function audioReady(): boolean {
    try {
        const ctx = Tone.getContext().rawContext as AudioContext;
        return ctx.state === "running";
    } catch {
        return false;
    }
}

function getCrashSynth() {
    if (!crashSynth) {
        crashSynth = new Tone.NoiseSynth({
            noise: { type: "white" },
            envelope: { attack: 0.01, decay: 0.4, sustain: 0, release: 0.1 },
            volume: -12,
        }).toDestination();
    }
    return crashSynth;
}

export function playStumbleSound(row: number): void {
    if (!audioReady()) return;
    const sfIdx = ROW_TO_SF_INDEX[row];
    if (sfIdx == null) {
        try { getCrashSynth().triggerAttackRelease("16n"); } catch { /* ignored */ }
        return;
    }
    const sf = sfInstruments.get(sfIdx);
    if (!sf) return;
    const baseNote = sfIdx === 4 ? 40 : sfIdx === 3 ? 48 : sfIdx === 5 ? 72 : sfIdx === 8 ? 76 : 60;
    const detune = Math.floor(Math.random() * 5) - 2;
    try { sf.start({ note: baseNote + detune, duration: 0.25 }); } catch { /* ignored */ }
}

export function playCrashSound(row: number): void {
    if (!audioReady()) return;
    const sfIdx = ROW_TO_SF_INDEX[row];
    if (sfIdx == null) {
        try { getCrashSynth().triggerAttackRelease("4n"); } catch { /* ignored */ }
        return;
    }
    const sf = sfInstruments.get(sfIdx);
    if (!sf) return;
    const baseNote = sfIdx === 4 ? 40 : sfIdx === 3 ? 48 : sfIdx === 5 ? 72 : sfIdx === 8 ? 76 : 60;
    let now = Tone.now();
    
    // Ensure start times are strictly increasing to avoid Tone.js timing errors
    // when multiple crash sounds trigger in the same frame
    if (now <= lastCrashTime) {
        now = lastCrashTime + 0.01;
    }
    lastCrashTime = now;
    
    // Stagger the three harmonics to create a richer crash sound
    try {
        sf.start({ note: baseNote - 1, duration: 0.1, time: now });
        sf.start({ note: baseNote + 1, duration: 0.1, time: now + 0.005 });
        sf.start({ note: baseNote + 6, duration: 0.1, time: now + 0.01 });
    } catch {
        // Timing assertion can fire if AudioContext was just resumed;
        // swallow rather than crash the render loop.
    }
}

/** Load all SoundFont instruments with spatial PannerNodes. Call after Tone.start(). */
export async function loadInstruments(): Promise<void> {
    const rawCtx = Tone.getContext().rawContext as AudioContext;
    for (let i = 0; i < GM_INSTRUMENT_NAMES.length; i++) {
        const panner = rawCtx.createPanner();
        panner.panningModel = "HRTF";
        panner.distanceModel = "inverse";
        panner.refDistance = 2;
        panner.maxDistance = 50;
        panner.rolloffFactor = 1;
        panner.coneOuterGain = 0.4;
        panner.connect(rawCtx.destination);
        sfPanners.set(i, panner);

        const sf = new Soundfont(rawCtx, {
            instrument: GM_INSTRUMENT_NAMES[i] as any,
            destination: panner,
        });
        await sf.load;
        sf.output.setVolume(GM_INSTRUMENT_VOLUMES[i]);
        sfInstruments.set(i, sf);
    }
}

/** Sync Web Audio API listener position to camera. */
export function updateAudioListener(camPos: Vector3, camFwd: Vector3): void {
    if (sfPanners.size === 0) return;
    const rawCtx = Tone.getContext().rawContext as AudioContext;
    const listener = rawCtx.listener;
    if (listener.positionX !== undefined) {
        listener.positionX.value = camPos.x;
        listener.positionY.value = camPos.y;
        listener.positionZ.value = camPos.z;
        listener.forwardX.value = camFwd.x;
        listener.forwardY.value = camFwd.y;
        listener.forwardZ.value = camFwd.z;
        listener.upX.value = 0;
        listener.upY.value = 1;
        listener.upZ.value = 0;
    }
}

/** Update spatial panner positions and dynamic volume dropout. */
export function updateSpatialAudio(
    listenerPos: Vector3,
    bandLegs: BandMemberData[],
    stumbleStates: StumbleState[]
): void {
    if (sfPanners.size === 0) return;

    const groupSumX: number[] = new Array(GM_INSTRUMENT_NAMES.length).fill(0);
    const groupSumZ: number[] = new Array(GM_INSTRUMENT_NAMES.length).fill(0);
    const groupWeight: number[] = new Array(GM_INSTRUMENT_NAMES.length).fill(0);
    const groupTotal: number[] = new Array(GM_INSTRUMENT_NAMES.length).fill(0);
    const groupDown: number[] = new Array(GM_INSTRUMENT_NAMES.length).fill(0);

    for (let m = 0; m < bandLegs.length; m++) {
        const sfIdx = ROW_TO_SF_INDEX[bandLegs[m].row];
        if (sfIdx == null) continue;
        groupTotal[sfIdx]++;
        const st = stumbleStates[m];
        if (st.tilt > 0.3 || st.downTimer > 0) groupDown[sfIdx]++;

        const ax = bandLegs[m].anchor.position.x;
        const az = bandLegs[m].anchor.position.z;
        const dx = ax - listenerPos.x;
        const dz = az - listenerPos.z;
        const distSq = dx * dx + dz * dz;
        if (distSq > SPATIAL_RADIUS_SQ) continue;
        const w = 1 / (1 + distSq);
        groupSumX[sfIdx] += ax * w;
        groupSumZ[sfIdx] += az * w;
        groupWeight[sfIdx] += w;
    }

    for (let g = 0; g < GM_INSTRUMENT_NAMES.length; g++) {
        const panner = sfPanners.get(g);
        if (!panner) continue;

        const sf = sfInstruments.get(g);
        if (sf && groupTotal[g] > 0) {
            const activeRatio = 1 - (groupDown[g] / groupTotal[g]);
            const vol = Math.round(GM_INSTRUMENT_VOLUMES[g] * (0.15 + 0.85 * activeRatio));
            sf.output.setVolume(vol);
        }
        if (groupWeight[g] > 0) {
            const cx = groupSumX[g] / groupWeight[g];
            const cz = groupSumZ[g] / groupWeight[g];
            panner.positionX.value = cx;
            panner.positionY.value = 1.5;
            panner.positionZ.value = cz;
        } else {
            panner.positionX.value = listenerPos.x;
            panner.positionY.value = 1.5;
            panner.positionZ.value = listenerPos.z + 1;
        }
    }
}
