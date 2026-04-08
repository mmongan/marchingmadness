// Audio system: instrument loading, metronome, collision sounds, spatial audio
import * as Tone from "tone";
import { Soundfont } from "smplr";
import { Vector3 } from "@babylonjs/core";
import { BandMemberData } from "./bandMemberFactory";
import {
    GM_INSTRUMENT_NAMES, GM_INSTRUMENT_VOLUMES, ROW_TO_SF_INDEX,
    SPATIAL_RADIUS_SQ, BPM, WHOLE_NOTE_DURATION
} from "./gameConstants";
import type { StumbleState } from "./gameConstants";

export const sfInstruments: Map<number, Soundfont> = new Map();
export const sfPanners: Map<number, PannerNode> = new Map();

let metronomeSynth: Tone.MembraneSynth | null = null;
function getMetronomeSynth() {
    if (!metronomeSynth) {
        metronomeSynth = new Tone.MembraneSynth({
            pitchDecay: 0.01,
            octaves: 2,
            envelope: { attack: 0.001, decay: 0.1, sustain: 0, release: 0.1 }
        }).toDestination();
        metronomeSynth.volume.value = -10;
    }
    return metronomeSynth;
}

let crashSynth: Tone.NoiseSynth | null = null;
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
    const sfIdx = ROW_TO_SF_INDEX[row];
    if (sfIdx == null) {
        getCrashSynth().triggerAttackRelease("16n");
        return;
    }
    const sf = sfInstruments.get(sfIdx);
    if (!sf) return;
    const baseNote = sfIdx === 4 ? 40 : sfIdx === 3 ? 48 : sfIdx === 5 ? 72 : sfIdx === 8 ? 76 : 60;
    const detune = Math.floor(Math.random() * 5) - 2;
    sf.start({ note: baseNote + detune, duration: 0.25 });
}

export function playCrashSound(row: number): void {
    const sfIdx = ROW_TO_SF_INDEX[row];
    if (sfIdx == null) {
        getCrashSynth().triggerAttackRelease("4n");
        return;
    }
    const sf = sfInstruments.get(sfIdx);
    if (!sf) return;
    const baseNote = sfIdx === 4 ? 40 : sfIdx === 3 ? 48 : sfIdx === 5 ? 72 : sfIdx === 8 ? 76 : 60;
    sf.start({ note: baseNote - 1, duration: 0.1 });
    sf.start({ note: baseNote + 1, duration: 0.1 });
    sf.start({ note: baseNote + 6, duration: 0.1 });
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
    getMetronomeSynth();
}

/** Start metronome and schedule music on Transport. */
export function startMetronomeAndMusic(
    osmdSheet: any, // OpenSheetMusicDisplay Sheet object
    gameStartTime: number
): void {
    Tone.Transport.bpm.value = BPM;
    Tone.Transport.scheduleRepeat((time) => {
        getMetronomeSynth().triggerAttackRelease("C5", "32n", time);
    }, "4n");

    if (osmdSheet) {
        const instruments = osmdSheet.Instruments;
        osmdSheet.SourceMeasures.forEach((sourceMeasure: any, mIndex: number) => {
            let measureFirstT = 0;
            if (sourceMeasure.VerticalSourceStaffEntryContainers.length > 0 &&
                sourceMeasure.VerticalSourceStaffEntryContainers[0].Timestamp) {
                measureFirstT = sourceMeasure.VerticalSourceStaffEntryContainers[0].Timestamp.RealValue;
            }

            sourceMeasure.VerticalSourceStaffEntryContainers.forEach((container: any) => {
                if (!container.Timestamp) return;
                const timeInMeasure = (container.Timestamp.RealValue - measureFirstT) * WHOLE_NOTE_DURATION;

                container.StaffEntries.forEach((entry: any) => {
                    const instrIndex = instruments.findIndex((inst: any) => inst.Id === entry.ParentStaff.ParentInstrument.Id);
                    if (instrIndex < 0) return;

                    const sf = sfInstruments.get(instrIndex);
                    entry.VoiceEntries.forEach((ve: any) => {
                        ve.Notes.forEach((note: any) => {
                            if (note.halfTone) {
                                const transpose = (instruments[instrIndex] as any).PlaybackTranspose || 0;
                                const midiNote = note.halfTone + transpose;
                                const duration = note.Length.RealValue * WHOLE_NOTE_DURATION;
                                const scheduleTime = (mIndex * WHOLE_NOTE_DURATION) + timeInMeasure;
                                Tone.Transport.schedule((time) => {
                                    sf?.start({ note: midiNote, time, duration });
                                }, scheduleTime);
                            }
                        });
                    });
                });
            });
        });
    }

    Tone.Transport.start(gameStartTime + 2 * WHOLE_NOTE_DURATION);
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
