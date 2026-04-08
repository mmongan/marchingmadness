import { BandMemberFactory, InstrumentType, BandMemberData } from "./bandMemberFactory";
import { Engine, Scene, FreeCamera, Vector3, HemisphericLight, MeshBuilder, StandardMaterial, DynamicTexture, Color3, Texture, CubeTexture, ActionManager, ExecuteCodeAction } from "@babylonjs/core";
import { OpenSheetMusicDisplay } from "opensheetmusicdisplay";
import * as Tone from "tone";

// Per-instrument synth voices
const instrumentSynths: Map<number, Tone.PolySynth> = new Map();

function getInstrumentSynth(instrumentIndex: number): Tone.PolySynth {
    if (instrumentSynths.has(instrumentIndex)) return instrumentSynths.get(instrumentIndex)!;

    // Instrument-specific synthesis parameters for clean brass sound
    let oscillatorType: OscillatorType = "sawtooth";
    let filterFreq = 2000;
    let filterQ = 1;
    let volume = -12;
    let attack = 0.05;
    let decay = 0.2;
    let sustain = 0.4;
    let release = 0.3;

    switch (instrumentIndex) {
        case 0: // Trumpet 1 — bright, clear lead
            oscillatorType = "sawtooth";
            filterFreq = 3000;
            filterQ = 0.5;
            volume = -10;
            attack = 0.02;
            decay = 0.15;
            sustain = 0.35;
            release = 0.2;
            break;
        case 1: // Trumpet 2 — slightly softer
            oscillatorType = "sawtooth";
            filterFreq = 2500;
            filterQ = 0.5;
            volume = -12;
            attack = 0.03;
            decay = 0.15;
            sustain = 0.3;
            release = 0.2;
            break;
        case 2: // Horn in F — warm, mellow
            oscillatorType = "triangle";
            filterFreq = 1500;
            filterQ = 0.7;
            volume = -11;
            attack = 0.06;
            decay = 0.25;
            sustain = 0.4;
            release = 0.35;
            break;
        case 3: // Trombone — rich, smooth
            oscillatorType = "sawtooth";
            filterFreq = 1800;
            filterQ = 0.6;
            volume = -11;
            attack = 0.04;
            decay = 0.2;
            sustain = 0.35;
            release = 0.3;
            break;
        case 4: // Tuba — deep, round
            oscillatorType = "sawtooth";
            filterFreq = 800;
            filterQ = 0.8;
            volume = -10;
            attack = 0.06;
            decay = 0.3;
            sustain = 0.4;
            release = 0.4;
            break;
    }

    // Route: synth → filter → destination (single path, no double-routing)
    const filter = new Tone.Filter(filterFreq, "lowpass", -24);
    filter.Q.value = filterQ;
    filter.toDestination();

    const synth = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: oscillatorType },
        envelope: { attack, decay, sustain, release },
    });
    synth.volume.value = volume;
    synth.connect(filter);

    instrumentSynths.set(instrumentIndex, synth);
    return synth;
}

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

const canvas = document.getElementById("renderCanvas") as HTMLCanvasElement;
const engine = new Engine(canvas, true, { audioEngine: false });

// Create the scene
const scene = new Scene(engine);
scene.clearColor = new Color3(0.9, 0.9, 0.9).toColor4();

const camera = new FreeCamera("camera1", new Vector3(0, 1.8, 0), scene);
camera.setTarget(new Vector3(0, 1.8, 1));
camera.attachControl(canvas, true);

const light = new HemisphericLight("light", new Vector3(0, 1, 0), scene);
light.intensity = 0.8;

// Enable WebXR/VR with graceful device detection
scene.createDefaultXRExperienceAsync({
    inputOptions: {
        // Don't force a profile — let the browser report the real controller
    }
}).then((xr) => {
    // If the device doesn't supply a real-world vertical tracking offset (3DoF/Emulators),
    // this ensures the player eyes sit exactly at 1.8 meters from the floor.
    xr.baseExperience.onInitialXRPoseSetObservable.add((xrCamera) => {
        xrCamera.position.y = 1.8;
    });

    // Log connected controllers for debugging
    xr.input.onControllerAddedObservable.add((controller) => {
        console.log(`XR controller connected: ${controller.inputSource.handedness}, profile: ${controller.inputSource.profiles.join(", ")}`);
    });
}).catch((err) => {
    console.warn("WebXR not available, falling back to desktop controls:", err);
});

// Add a standard majestic skybox
function buildSkybox(scene: Scene) {
    const skybox = MeshBuilder.CreateBox("skyBox", { size: 1000.0 }, scene);
    const skyboxMaterial = new StandardMaterial("skyBox", scene);
    skyboxMaterial.backFaceCulling = false;
    skyboxMaterial.reflectionTexture = new CubeTexture("https://playground.babylonjs.com/textures/skybox", scene);
    skyboxMaterial.reflectionTexture.coordinatesMode = Texture.SKYBOX_MODE;
    skyboxMaterial.diffuseColor = new Color3(0, 0, 0);
    skyboxMaterial.specularColor = new Color3(0, 0, 0);
    
    // Ensure skybox renders behind everything else
    skybox.infiniteDistance = true; 
    skybox.material = skyboxMaterial;
}
buildSkybox(scene);

// Create an American Football Field (Player sitting on 50 yard line looking across)
function buildFootballField(scene: Scene) {
    const lengthX = 109.7; // 120 yards long mathematically
    const depthZ = 48.8; // 53.3 yards depth
    
    const ground = MeshBuilder.CreateGround("footballField", { width: lengthX, height: depthZ }, scene);
    // Position field so camera (at X=0, Z=0) drops right into the middle of the field on the 50-yard line
    ground.position = new Vector3(0, -0.01, 0); 
    
    const texWidth = 2048;
    const texHeight = 1024;
    const fieldTex = new DynamicTexture("fieldTex", { width: texWidth, height: texHeight }, scene, true);
    const ctx = fieldTex.getContext() as CanvasRenderingContext2D;
    
    // Fill grass
    ctx.fillStyle = "#2e7d32";
    ctx.fillRect(0, 0, texWidth, texHeight);
    
    // Draw lines
    ctx.strokeStyle = "white";
    ctx.fillStyle = "white";
    
    const yardsX = 120;
    const pixelsPerYardX = texWidth / yardsX;
    
    // Draw Endzone backgrounds First
    ctx.fillStyle = "#1b5e20";
    ctx.fillRect(0, 0, 10 * pixelsPerYardX, texHeight); // Left endzone
    ctx.fillRect(110 * pixelsPerYardX, 0, 10 * pixelsPerYardX, texHeight); // Right endzone
    
    ctx.fillStyle = "white";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    for (let yard = 0; yard <= yardsX; yard += 1) {
        const x = yard * pixelsPerYardX;
        
        ctx.beginPath();
        if (yard >= 10 && yard <= 110) {
            if (yard % 5 === 0) {
                // Line all the way across
                ctx.moveTo(x, 0);
                ctx.lineTo(x, texHeight);
                ctx.lineWidth = (yard % 10 === 0 || yard === 10 || yard === 110) ? 8 : 4;
                ctx.stroke();
                
                if (yard > 10 && yard < 110 && yard % 10 === 0) {
                    let dispYard = yard - 10;
                    if (dispYard > 50) dispYard = 100 - dispYard;
                    
                    ctx.font = "bold 60px Arial";
                    // Bottom numbers (closest to player on sideline)
                    ctx.save();
                    ctx.translate(x, texHeight * 0.85); // 1024 height, player is at bottom
                    ctx.fillText(dispYard.toString(), 0, 0);
                    ctx.restore();
                    
                    // Top numbers (far sideline)
                    ctx.save();
                    ctx.translate(x, texHeight * 0.15);
                    ctx.rotate(Math.PI);
                    ctx.fillText(dispYard.toString(), 0, 0);
                    ctx.restore();
                }
            } else {
                // Short Hash marks every 1 yard
                ctx.lineWidth = 2;
                ctx.moveTo(x, 0); ctx.lineTo(x, 15); ctx.stroke();
                ctx.moveTo(x, texHeight); ctx.lineTo(x, texHeight - 15); ctx.stroke();
                // inner hashes (College/HS spacing usually ~1/3rd from sidelines, close enough)
                ctx.moveTo(x, texHeight * 0.35); ctx.lineTo(x, texHeight * 0.35 + 15); ctx.stroke();
                ctx.moveTo(x, texHeight * 0.65); ctx.lineTo(x, texHeight * 0.65 - 15); ctx.stroke();
            }
        }
    }
    
    // Draw boundary line around playable 100 yards
    ctx.lineWidth = 8;
    ctx.strokeRect(10 * pixelsPerYardX, 0, 100 * pixelsPerYardX, texHeight); 
    
    // Endzone text
    ctx.font = "bold 100px Arial";
    ctx.save();
    ctx.translate(5 * pixelsPerYardX, texHeight / 2);
    ctx.rotate(Math.PI / 2);
    ctx.fillText("MARCHING", 0, 0);
    ctx.restore();
    
    ctx.save();
    ctx.translate(115 * pixelsPerYardX, texHeight / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText("MADNESS", 0, 0);
    ctx.restore();
    
    fieldTex.update();
    
    const mat = new StandardMaterial("fieldMat", scene);
    mat.diffuseTexture = fieldTex;
    mat.specularColor = new Color3(0.05, 0.05, 0.05); // low shine grass
    ground.material = mat;
    
    // Rotate the field 90 degrees so the user looks down the length of the field
    ground.rotation.y = Math.PI / 2;

    // Create a surrounding dark turf base to fix seeing "under" the field edges
    const surroundBase = MeshBuilder.CreateGround("surroundBase", { width: 400, height: 400 }, scene);
    surroundBase.position = new Vector3(0, -0.05, 0); // Just beneath the main field
    const surroundMat = new StandardMaterial("surroundMat", scene);
    surroundMat.diffuseColor = new Color3(0.05, 0.15, 0.05); // Very dark green turf
    surroundMat.specularColor = new Color3(0.01, 0.01, 0.01);
    surroundBase.material = surroundMat;
}
buildFootballField(scene);


type DrillShape = (r: number, c: number, cols: number, rows: number, startX: number, startZ: number) => {x: number, z: number};

const drillShapes: DrillShape[] = [
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
        // Multiplier ranges from 1.0 at ends to 2.2 in the middle
        const stretch = 1.0 + 1.2 * Math.sin(rowPhase);
        return { x: startX * stretch, z: startZ };
    },

    // 4: S-Curve Wave - Entire band slithers left and right down the field
    (_r, _c, _cols, _rows, startX, startZ) => {
        const waveShift = Math.sin(startZ / 5.0) * 3.0;
        return { x: startX * 1.5 + waveShift, z: startZ };
    }
];

const drillTimeline = [
    { beat: 0, shape: 0 },
    { beat: 16, shape: 0 },
    // Expand transition
    { beat: 32, shape: 1 },
    { beat: 48, shape: 1 },
    // Wedge transition
    { beat: 64, shape: 2 },
    { beat: 80, shape: 2 },
    // Diamond transition
    { beat: 96, shape: 4 },
    { beat: 112, shape: 4 },
    // Rings transition
    { beat: 128, shape: 3 },
    { beat: 144, shape: 3 },
    // Back to block transition
    { beat: 160, shape: 0 }, 
];

function getDrillPosition(currentBeat: number, r: number, c: number, cols: number, rows: number, startX: number, startZ: number): {x: number, z: number} {
    // Loop entirely at 160 beats
    const maxBeat = 160;
    let loopedBeat = currentBeat % maxBeat;
    
    // Find phase
    let currentIndex = 0;
    while(currentIndex < drillTimeline.length - 1 && drillTimeline[currentIndex + 1].beat <= loopedBeat) {
        currentIndex++;
    }
    
    const currentPhase = drillTimeline[currentIndex];
    
    if (currentIndex === drillTimeline.length - 1) {
        return drillShapes[currentPhase.shape](r, c, cols, rows, startX, startZ);
    }
    
    const nextPhase = drillTimeline[currentIndex + 1];
    
    // Lerp between shapes
    const progress = (loopedBeat - currentPhase.beat) / (nextPhase.beat - currentPhase.beat);
    
    const p1 = drillShapes[currentPhase.shape](r, c, cols, rows, startX, startZ);
    const p2 = drillShapes[nextPhase.shape](r, c, cols, rows, startX, startZ);
    
    // Smooth transition
    const smoothProgress = progress * progress * (3 - 2 * progress); // smoothstep

    return {
        x: p1.x + (p2.x - p1.x) * smoothProgress,
        z: p1.z + (p2.z - p1.z) * smoothProgress
    };
}

const bandLegs: BandMemberData[] = [];

// Create a 100-member marching band in a 10x10 formation
function buildMarchingBand(scene: Scene) {
    const factory = new BandMemberFactory(scene);

    const rows = 15;
    const cols = 5;
    const spacingX = 2.0; // 2 meters between columns
    const spacingZ = 2.0; // 2 meters between rows
    const startZ = 15; // Start near midfield so all 15 rows (28m deep) stay on the field

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const isFlute = (r === 1);
            const isClarinet = (r === 2);
            const isSaxophone = (r === 3);
            const isMellophone = (r === 4);
            const isTrumpet = (r === 5 || r === 6);
            const isTrombone = (r === 7);
            const isEuphonium = (r === 8);
            const isSousaphone = (r === 9);
            const isGlockenspiel = (r === 10);
            const isSnareDrum = (r === 11);
            const isTomTom = (r === 12);
            const isBassDrum = (r === 13);
            const isCymbals = (r === 14);

            let type: InstrumentType = "DrumMajor";
            if (isFlute) type = "Flute";
            else if (isClarinet) type = "Clarinet";
            else if (isSaxophone) type = "Saxophone";
            else if (isTomTom) type = "TomTom";
            else if (isSnareDrum) type = "SnareDrum";
            else if (isBassDrum) type = "BassDrum";
            else if (isCymbals) type = "Cymbals";
            else if (isTrumpet) type = "Trumpet";
            else if (isMellophone) type = "Mellophone";
            else if (isEuphonium) type = "Euphonium";
            else if (isTrombone) type = "Trombone";
            else if (isSousaphone) type = "Sousaphone";
            else if (isGlockenspiel) type = "Glockenspiel";

            const xPos = (c - cols / 2 + 0.5) * spacingX;
            const zPos = startZ + r * spacingZ;

            const memberData = factory.createMember(r, c, type, xPos, zPos);
            bandLegs.push(memberData);
        }
    }
}
buildMarchingBand(scene);

// Keep reference to blocks
const measureBlocks: any[] = [];
const gameBlocks: { mesh: any, arrivalTime: number, startX: number, startY: number, boxHeight: number, noteFractions: number[], firstT: number }[] = [];
let gameStartTime: number | null = null;
const BPM = 80;
const WHOLE_NOTE_DURATION = (60 / BPM) * 4;

// 8 steps per 5 yards: 5 yards = 5 * (109.7/120) meters = 4.5708m. 8 beats = 4.5708m.
// 1 beat = 4.5708 / 8 = 0.57135m. At BPM, speed = 0.57135 * (BPM / 60) m/s.
const FLY_SPEED = 0.57135 * (BPM / 60);

// Visual beat indicator - a glowing sphere that flashes on each beat
const beatIndicator = MeshBuilder.CreateSphere("beatIndicator", { diameter: 0.15 }, scene);
beatIndicator.position = new Vector3(0, 2.5, 3);
const beatMat = new StandardMaterial("beatMat", scene);
beatMat.emissiveColor = new Color3(1, 0.8, 0);
beatMat.disableLighting = true;
beatIndicator.material = beatMat;
beatIndicator.isVisible = false;

// 3D VR Start Button
const startBtnMesh = MeshBuilder.CreatePlane("startBtnMesh", { width: 2, height: 1 }, scene);
startBtnMesh.position = new Vector3(0, 1.5, 2);

const btnTex = new DynamicTexture("btnTex", { width: 512, height: 256 }, scene, false);
const btnCtx = btnTex.getContext() as CanvasRenderingContext2D;
btnCtx.fillStyle = "#228822";
btnCtx.fillRect(0, 0, 512, 256);
btnCtx.fillStyle = "white";
btnCtx.font = "bold 60px Arial";
btnCtx.textAlign = "center";
btnCtx.fillText("START GAME", 256, 150);
btnTex.update();

const btnMat = new StandardMaterial("btnMat", scene);
btnMat.diffuseTexture = btnTex;
btnMat.emissiveColor = new Color3(1, 1, 1);
startBtnMesh.material = btnMat;

startBtnMesh.actionManager = new ActionManager(scene);
startBtnMesh.actionManager.registerAction(
    new ExecuteCodeAction(
        ActionManager.OnPickTrigger,
        async () => {
            await Tone.start();
            // Pre-initialize all instrument synths
            for (let i = 0; i < 5; i++) getInstrumentSynth(i);
            getMetronomeSynth();
        
            // Sync Tone.Transport to our 80 BPM and start a repeating metronome click
            Tone.Transport.bpm.value = BPM;
            Tone.Transport.scheduleRepeat((time) => {
                getMetronomeSynth().triggerAttackRelease("C5", "32n", time);
            }, "4n");
        
            // Schedule ALL instrument parts onto the Transport timeline
            if (osmd && osmd.Sheet) {
                const instruments = osmd.Sheet.Instruments;
                osmd.Sheet.SourceMeasures.forEach((sourceMeasure, mIndex) => {
                    let measureFirstT = 0;
                    if (sourceMeasure.VerticalSourceStaffEntryContainers.length > 0 && sourceMeasure.VerticalSourceStaffEntryContainers[0].Timestamp) {
                        measureFirstT = sourceMeasure.VerticalSourceStaffEntryContainers[0].Timestamp.RealValue;
                    }

                    sourceMeasure.VerticalSourceStaffEntryContainers.forEach(container => {
                        if (!container.Timestamp) return;
                        const timeInMeasure = (container.Timestamp.RealValue - measureFirstT) * WHOLE_NOTE_DURATION;
                    
                        container.StaffEntries.forEach(entry => {
                            // Find which instrument index this entry belongs to
                            const instrIndex = instruments.findIndex(inst => inst.Id === entry.ParentStaff.ParentInstrument.Id);
                            if (instrIndex < 0) return;

                            const instrSynth = getInstrumentSynth(instrIndex);
                            entry.VoiceEntries.forEach(ve => {
                                ve.Notes.forEach(note => {
                                    if (note.halfTone) {
                                        // halfTone is the WRITTEN pitch as MIDI number.
                                        // PlaybackTranspose is the MusicXML <chromatic> value
                                        // (e.g. -2 for Bb instruments, -7 for Horn in F)
                                        const transpose = (instruments[instrIndex] as any).PlaybackTranspose || 0;
                                        const frequency = Tone.Frequency(note.halfTone + transpose, "midi").toFrequency();
                                        const duration = note.Length.RealValue * WHOLE_NOTE_DURATION;
                                        const scheduleTime = (mIndex * WHOLE_NOTE_DURATION) + timeInMeasure;
                                        Tone.Transport.schedule((time) => {
                                            instrSynth.triggerAttackRelease(frequency, duration, time);
                                        }, scheduleTime);
                                    }
                                });
                            });
                        });
                    });
                });
            }
    
            gameStartTime = Tone.now();
            beatIndicator.isVisible = true;
            // Start the metronome and music specifically delayed by 2 whole notes
            Tone.Transport.start(gameStartTime + 2 * WHOLE_NOTE_DURATION);
            startBtnMesh.dispose(); // Remove the button after starting
        }
    )
);

let osmdContainer: HTMLDivElement | null = null;
let osmd: OpenSheetMusicDisplay | null = null;
let measureCount = 0;
let nextMeasureToGenerate = 1;
let isGenerating = false;

async function initSheetMusic() {
    osmdContainer = document.createElement("div");
    osmdContainer.style.width = "4000px";
    osmdContainer.style.position = "absolute";
    osmdContainer.style.top = "-9999px";
    document.body.appendChild(osmdContainer);

    osmd = new OpenSheetMusicDisplay(osmdContainer, {
        backend: "canvas",
        drawTitle: false,
        drawSubtitle: false,
        drawComposer: false,
        drawLyricist: false,
        drawCredits: false,
        drawPartNames: false,
        drawFromMeasureNumber: 1,
        drawUpToMeasureNumber: 1
    });

    try {
        await osmd.load("assets/score.xml");

        // Only show the 1st instrument (Trumpet 1) part
        if (osmd.Sheet && osmd.Sheet.Instruments) {
            osmd.Sheet.Instruments.forEach((instrument, index) => {
                instrument.Visible = (index === 0);
            });
        }

        measureCount = osmd.Sheet?.SourceMeasures.length || 10;
        console.log(`Found ${measureCount} measures. Starting dynamic generation...`);
        checkAndGenerateMeasures();
    } catch (err) {
        console.error("Failed to load and render Music XML:", err);
    }
}

async function generateSingleMeasure(i: number) {
    if (!osmd || !osmdContainer || !osmd.Sheet) return;

    // Set OSMD to only render this specific measure
    osmd.setOptions({
        drawFromMeasureNumber: i,
        drawUpToMeasureNumber: i
    });
    osmd.render();
    
    // Get the resulting canvas created by OSMD
    const generatedCanvas = osmdContainer.querySelector('canvas') as HTMLCanvasElement;
    if (!generatedCanvas) return;

    const tmpCtx = generatedCanvas.getContext("2d", { willReadFrequently: true });
    let minX = generatedCanvas.width, minY = generatedCanvas.height, maxX = 0, maxY = 0;
    if (tmpCtx) {
        const imgData = tmpCtx.getImageData(0, 0, generatedCanvas.width, generatedCanvas.height);
        const data = imgData.data;
        for (let y = 0; y < generatedCanvas.height; y++) {
            for (let x = 0; x < generatedCanvas.width; x++) {
                const idx = (y * generatedCanvas.width + x) * 4;
                if (data[idx + 3] > 0 && (data[idx] < 250 || data[idx+1] < 250 || data[idx+2] < 250)) {
                    if (x < minX) minX = x;
                    if (x > maxX) maxX = x;
                    if (y < minY) minY = y;
                    if (y > maxY) maxY = y;
                }
            }
        }
    }

    // Defaults if canvas was blank
    if (maxX < minX || maxY < minY) {
        minX = 0; minY = 0; maxX = generatedCanvas.width; maxY = generatedCanvas.height;
    }

    const padding = 20;
    minX = Math.max(0, minX - padding);
    minY = Math.max(0, minY - padding);
    maxX = Math.min(generatedCanvas.width, maxX + padding);
    maxY = Math.min(generatedCanvas.height, maxY + padding);
    
    const cropWidth = Math.max(1, maxX - minX);
    const cropHeight = Math.max(1, maxY - minY);

    const dynamicTexture = new DynamicTexture(`texture_m${i}`, { width: cropWidth, height: cropHeight }, scene, true, Texture.TRILINEAR_SAMPLINGMODE);
    
    const context = dynamicTexture.getContext() as CanvasRenderingContext2D;
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.fillStyle = "white"; // Add a white background for the score
    context.fillRect(0, 0, cropWidth, cropHeight);
    context.drawImage(generatedCanvas, minX, minY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
    dynamicTexture.update(true);

    // Calculate height proportional to width
    const boxHeight = 4 * (cropHeight / cropWidth);
    
    // Extract note fractions for exact temporal and visual alignment
    const sourceMeasure = osmd.Sheet.SourceMeasures[i - 1];
    
    // Always use the first container's timestamp as the true zero-point for this measure
    let firstT = 0;
    if (sourceMeasure.VerticalSourceStaffEntryContainers.length > 0 && sourceMeasure.VerticalSourceStaffEntryContainers[0].Timestamp) {
        firstT = sourceMeasure.VerticalSourceStaffEntryContainers[0].Timestamp.RealValue;
    }
    const measureDuration = sourceMeasure.Duration ? sourceMeasure.Duration.RealValue : 1;
    
    const fractionsSet = new Set<number>();
    sourceMeasure.VerticalSourceStaffEntryContainers.forEach(container => {
        let isTrumpet = false;
        container.StaffEntries.forEach(entry => {
            if (entry.ParentStaff.ParentInstrument.Id === osmd!.Sheet!.Instruments[0].Id) {
                // Ensure it's not just a rest placeholder if possible
                let isRest = false;
                if (entry.VoiceEntries.length > 0 && entry.VoiceEntries[0].Notes.length > 0) {
                    isRest = entry.VoiceEntries[0].Notes[0].isRest();
                }
                if (!isRest) isTrumpet = true;
            }
        });
        if (isTrumpet && container.Timestamp) {
            let frac = (container.Timestamp.RealValue - firstT) / measureDuration;
            if (frac < 0) frac = 0;
            if (frac > 1) frac = 1;
            fractionsSet.add(frac);
        }
    });
    
    let noteFractions = Array.from(fractionsSet).sort((a, b) => a - b);
    if (noteFractions.length === 0) noteFractions = [0, 1];
    else {
        if (noteFractions[0] > 0.05) noteFractions.unshift(0);
        if (noteFractions[noteFractions.length - 1] < 0.95) noteFractions.push(1);
    }

    // Create the block mesh
    const box = MeshBuilder.CreateBox(`measure_${i}`, {
        width: 4,
        height: boxHeight,
        depth: 0.2
    }, scene);
    
    // Create a predictable alternating spread from high up for a curving Guitar Hero style track
    const laneIndex = (i % 5) - 2; // Returns -2, -1, 0, 1, 2 sequentially
    const startX = laneIndex * 20; // Spread extremely wide horizontally: -40, -20, 0, 20, 40
    const startY = 25; // Start high up so they drop down a curved track

    // Start the box far away
    box.position = new Vector3(startX, startY, 150);
    box.isVisible = false; // Hide until it enters the game area

    gameBlocks.push({
        mesh: box,
        arrivalTime: (i + 1) * WHOLE_NOTE_DURATION, // i is 1-indexed. Delay by 2 measures for a smooth fly-in
        startX: startX,
        startY: startY,
        boxHeight: boxHeight,
        noteFractions: noteFractions,
        firstT: firstT
    });

    // Apply material
    const material = new StandardMaterial(`mat_m${i}`, scene);
    material.diffuseTexture = dynamicTexture;
    
    // To prevent blank textures from negative UV scales clamping, we keep scale positive
    // and instead correctly rotate the 3D block to present the texture correctly to the camera
    box.rotation.z = Math.PI; // Flip upright
    box.rotation.y = Math.PI; // Flip horizontally (fixes mirroring)
    
    material.diffuseTexture.hasAlpha = true;
    material.emissiveColor = new Color3(1, 1, 1); 
    material.disableLighting = true; // So it looks like clear sheet music
    
    box.material = material;
    measureBlocks.push(box);
}

async function checkAndGenerateMeasures() {
    if (isGenerating || nextMeasureToGenerate > measureCount) return;
    
    let currentMeasureIndex = 0;
    if (gameStartTime !== null) {
        const currentTime = Tone.now() - gameStartTime;
        currentMeasureIndex = Math.floor(currentTime / WHOLE_NOTE_DURATION);
    }

    // Keep up to 30 measures ahead queued up
    if (nextMeasureToGenerate <= currentMeasureIndex + 30) {
        isGenerating = true;
        try {
            await generateSingleMeasure(nextMeasureToGenerate);
            nextMeasureToGenerate++;
            // Yield a tiny bit to avoid blocking the main thread
            await new Promise(resolve => setTimeout(resolve, 10));
        } catch(e) { 
            console.error(e); 
        } finally {
            isGenerating = false;
        }
        
        // Immediately check if we need to generate more
        checkAndGenerateMeasures();
    }
}

// Start loading the Music XML file
initSheetMusic();

engine.runRenderLoop(() => {
    // Prevent the actively driven camera from clipping under the ground plane or crouching too low
    if (scene.activeCamera && scene.activeCamera.globalPosition.y < 1.5) {
        scene.activeCamera.position.y = 1.5; // Always bounce them back up to a standing height
    }

    // Marching Band Animation
    const currentRenderTime = gameStartTime !== null ? Tone.now() - gameStartTime : performance.now() / 1000;
    const secondsPerBeat = 60 / BPM;
    // Calculate a phase angle where one full stride occurs every 2 beats
    const marchPhase = (currentRenderTime * Math.PI * 2) / (secondsPerBeat * 2);
    const currentBeat = currentRenderTime * (BPM / 60);

    // Animate the beat indicator - flash bright on each beat, then fade
    if (gameStartTime !== null && beatIndicator.isVisible) {
        const beatFrac = currentBeat % 1.0;
        const flashIntensity = Math.max(0, 1.0 - beatFrac * 4.0); // fast fade-out
        beatMat.emissiveColor = new Color3(flashIntensity, flashIntensity * 0.8, 0);
        beatIndicator.scaling.setAll(0.5 + flashIntensity * 0.5);
    }

    if (gameStartTime !== null) {
        // Pre-calculate positions and apply collision avoidance
        const drillPositions = bandLegs.map(member => {
            return getDrillPosition(currentBeat, member.row, member.col, 5, 15, member.startX, member.startZ);
        });

        bandLegs.forEach(({ legL, legR, anchor }, index) => {
            // Swing legs back and forth like pendulums
            legL.rotation.x = Math.sin(marchPhase) * 0.6;
            legR.rotation.x = -Math.sin(marchPhase) * 0.6;

            const targetPos = drillPositions[index];

            // Allow members to point in the direction they march (simple approach)
            const dx = targetPos.x - anchor.position.x;
            const dz = targetPos.z - (anchor.position.z + currentRenderTime * FLY_SPEED);

            if (Math.abs(dx) > 0.05 || Math.abs(dz) > 0.05) {
                const lateralAngle = Math.atan2(dx, dz);
                const targetRotationY = Math.PI - lateralAngle;

                if (Math.abs(dx) < 0.1) {
                    anchor.rotation.y = Math.PI;
                } else {
                    anchor.rotation.y += (targetRotationY - anchor.rotation.y) * 0.1;
                }
            } else {
                anchor.rotation.y = Math.PI;
            }

            anchor.position.x = targetPos.x;
            anchor.position.z = targetPos.z - (currentRenderTime * FLY_SPEED);
        });
    } else {
        bandLegs.forEach(({ legL, legR }) => {
            // Swing legs back and forth like pendulums
            legL.rotation.x = Math.sin(marchPhase) * 0.6;
            legR.rotation.x = -Math.sin(marchPhase) * 0.6;
        });
    }

    // Continuously poll to ensure the queue processes upcoming measures during gameplay
    checkAndGenerateMeasures();

    if (gameStartTime !== null) {
        const currentTime = Tone.now() - gameStartTime;
        
        gameBlocks.forEach(block => {
            // How long until it's supposed to arrive at Z=0?
            const timeUntilArrival = block.arrivalTime - currentTime;
            
            // Calculate current Z so that it arrives slightly in front of the camera (Z = 3) at timeUntilArrival = 0
            const arrivalZ = 3;
            const currentZ = arrivalZ + (timeUntilArrival * FLY_SPEED);

            // Interpolate X and Y to converge to a hit-zone that is lower and wider, so you can see over/around it
            // Assume the block originated from Z = 150
            const totalDistanceZ = 150 - arrivalZ;
            const distanceFraction = (currentZ - arrivalZ) / totalDistanceZ;
            
            // Use distanceFraction squared for Y to create a curved Guitar Hero style waterfall path
            // If it passes the player (distanceFraction < 0), let it continue down smoothly
            const curveY = distanceFraction > 0 ? Math.pow(distanceFraction, 2) : distanceFraction;

            // Arrive exactly at eye-level and keep a bit of X-spread so measures form visible lanes instead of a single overlapping stack
            const arrivalX = block.startX * 0.15; // 0.15 * 40 = 6 spread to either side
            const arrivalY = scene.activeCamera ? scene.activeCamera.globalPosition.y : 1.6;  

            block.mesh.position.x = arrivalX + (block.startX - arrivalX) * distanceFraction;
            block.mesh.position.y = arrivalY + (block.startY - arrivalY) * curveY;
            block.mesh.position.z = currentZ;
            
            // Tilt blocks backwards like a music stand as they arrive, and more drastically when far away
            block.mesh.rotation.x = (Math.PI / 8) + (Math.PI / 4) * distanceFraction;

            // Show it when it's coming from the horizon, vanish it after its duration has fully passed
            const vanishDistance = arrivalZ - (WHOLE_NOTE_DURATION * FLY_SPEED);
            if (currentZ < 150 && currentZ > vanishDistance) {
                block.mesh.isVisible = false; // Hidden per user request
            } else {
                block.mesh.isVisible = false;
            }
        });
    }

    scene.render();
});

window.addEventListener("resize", () => {
    engine.resize();
});
