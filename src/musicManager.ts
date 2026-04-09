// Music manager: metronome, Tone.Transport setup, and instrument scheduling
import * as Tone from "tone";
import { BPM, WHOLE_NOTE_DURATION, PART_ID_TO_SF_INDEX, PART_ID_TO_TRANSPOSE } from "./gameConstants";
import { sfInstruments } from "./audioSystem";

let metronomeSynth: Tone.MembraneSynth | null = null;

function getMetronomeSynth(): Tone.MembraneSynth {
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

/**
 * Initialize and start the metronome and schedule all instrument parts from OSMD.
 * Call after SoundFont instruments are loaded and sheet music is parsed.
 * @param osmdSheet OpenSheetMusicDisplay Sheet object with SourceMeasures and Instruments
 * @param gameStartTime Current Tone.now() timestamp
 */
export function startMetronomeAndMusic(
    osmdSheet: any, // OpenSheetMusicDisplay Sheet object
    gameStartTime: number
): void {
    // Set BPM and start metronome
    Tone.Transport.bpm.value = BPM;
    Tone.Transport.scheduleRepeat((time) => {
        getMetronomeSynth().triggerAttackRelease("C5", "32n", time);
    }, "4n");

    // Schedule all instrument notes from the sheet
    if (!osmdSheet) {
        console.error("osmdSheet is undefined");
        return;
    }
    
    if (!osmdSheet.SourceMeasures) {
        console.error("osmdSheet.SourceMeasures is undefined");
        return;
    }

    // Debug: Log instrument transposition values
    console.log("=== OSMD Instruments ===");
    osmdSheet.Instruments.forEach((inst: any, idx: number) => {
        console.log(`[${idx}] ${inst.Name} (ID: ${inst.Id}): PlaybackTranspose=${inst.PlaybackTranspose}`);
    });

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
                    const osmdInstrument = entry.ParentStaff.ParentInstrument;
                    const osmdInstrId = osmdInstrument.Id;
                    
                    // Map OSMD part ID (P1, P2, etc.) to SoundFont index
                    const sfIndex = PART_ID_TO_SF_INDEX[osmdInstrId];
                    if (sfIndex === undefined) return; // Unknown or percussion part
                    
                    const sf = sfInstruments.get(sfIndex);
                    if (!sf) return;

                    let noteCount = 0;
                    entry.VoiceEntries.forEach((ve: any) => {
                        ve.Notes.forEach((note: any) => {
                            if (note.halfTone) {
                                const transpose = PART_ID_TO_TRANSPOSE[osmdInstrId] || 0;
                                const midiNote = note.halfTone + transpose;
                                const duration = note.Length.RealValue * WHOLE_NOTE_DURATION;
                                const scheduleTime = (mIndex * WHOLE_NOTE_DURATION) + timeInMeasure;
                                
                                // Debug: Log first few notes per instrument
                                if (noteCount < 3) {
                                    console.log(`  ${osmdInstrId}: halfTone=${note.halfTone} + transpose=${transpose} = MIDI${midiNote}`);
                                    noteCount++;
                                }
                                
                                Tone.Transport.schedule((time) => {
                                    sf.start({ note: midiNote, time, duration });
                                }, scheduleTime);
                            }
                        });
                    });
                });
            });
        });

    // Start transport with 2 whole note delay (for band to march in place before music)
    Tone.Transport.start(gameStartTime + 2 * WHOLE_NOTE_DURATION);
}

/**
 * Stop metronome and music playback.
 */
export function stopMetronomeAndMusic(): void {
    Tone.Transport.stop();
    Tone.Transport.cancel();
}
