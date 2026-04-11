// Audio system: instrument loading, metronome, collision sounds, spatial audio
import * as Tone from "tone";
import { Soundfont } from "smplr";
import { Vector3 } from "@babylonjs/core";
import { BandMemberData } from "./bandMemberFactory";
import {
    GM_INSTRUMENT_NAMES, GM_INSTRUMENT_VOLUMES, ROW_TO_SF_INDEX,
    SPATIAL_RADIUS_SQ
} from "./gameConstants";

export const sfInstruments: Map<number, Soundfont> = new Map();
export const sfPanners: Map<number, PannerNode> = new Map();



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

/** Update spatial panner positions. */
export function updateSpatialAudio(
    listenerPos: Vector3,
    bandLegs: BandMemberData[]
): void {
    if (sfPanners.size === 0) return;

    const groupSumX: number[] = new Array(GM_INSTRUMENT_NAMES.length).fill(0);
    const groupSumZ: number[] = new Array(GM_INSTRUMENT_NAMES.length).fill(0);
    const groupWeight: number[] = new Array(GM_INSTRUMENT_NAMES.length).fill(0);

    for (let m = 0; m < bandLegs.length; m++) {
        const sfIdx = ROW_TO_SF_INDEX[bandLegs[m].row];
        if (sfIdx == null) continue;

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
