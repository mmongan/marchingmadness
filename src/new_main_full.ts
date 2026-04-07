import { Engine, Scene, FreeCamera, Vector3, HemisphericLight, MeshBuilder, StandardMaterial, DynamicTexture, Color3, Texture, ActionManager, ExecuteCodeAction } from "@babylonjs/core";
import { OpenSheetMusicDisplay } from "opensheetmusicdisplay";
import * as Tone from "tone";

let synth: Tone.PolySynth | null = null;
function getTrumpetSynth() {
    if (!synth) {
        synth = new Tone.PolySynth(Tone.Synth, {
            oscillator: { type: "sawtooth" },
            envelope: { attack: 0.1, decay: 0.1, sustain: 0.6, release: 0.2 },
        }).toDestination();
        
        // Add a slight lowpass filter to mimic a brass instrument
        const filter = new Tone.Filter(800, "lowpass").toDestination();
        synth.connect(filter);
    }
    return synth;
}

const canvas = document.getElementById("renderCanvas") as HTMLCanvasElement;
const engine = new Engine(canvas, true, { audioEngine: false });

// Create the scene
const scene = new Scene(engine);
scene.clearColor = new Color3(0.9, 0.9, 0.9).toColor4();

const camera = new FreeCamera("camera1", new Vector3(0, 5, -15), scene);
camera.setTarget(Vector3.Zero());
camera.attachControl(canvas, true);

const light = new HemisphericLight("light", new Vector3(0, 1, 0), scene);
light.intensity = 0.8;

// Keep reference to blocks
const measureBlocks: any[] = [];
const gameBlocks: { mesh: any, arrivalTime: number }[] = [];
let gameStartTime: number | null = null;
const BPM = 120;
const WHOLE_NOTE_DURATION = (60 / BPM) * 4; // 2 seconds per measure
const FLY_SPEED = 2; // units per second (slower for readability)

// Make a start button for the UI
const startBtn = document.createElement("button");
startBtn.innerText = "Start Game";
startBtn.style.position = "absolute";
startBtn.style.top = "50%";
startBtn.style.left = "50%";
startBtn.style.transform = "translate(-50%, -50%)";
startBtn.style.fontSize = "30px";
startBtn.style.padding = "20px";
startBtn.style.zIndex = "100";
startBtn.onclick = async () => {
    await Tone.start();
    getTrumpetSynth(); // pre-initialize
    gameStartTime = Tone.now();
    startBtn.style.display = "none";
};
document.body.appendChild(startBtn);

async function loadAndGenerateMeasures() {
    // 1. Setup hidden div for OSMD rendering
    const osmdContainer = document.createElement("div");
    // Ensure it's wide enough that the canvasses aren't squished
    osmdContainer.style.width = "4000px";
    osmdContainer.style.position = "absolute";
    osmdContainer.style.top = "-9999px";
    document.body.appendChild(osmdContainer);

    const osmd = new OpenSheetMusicDisplay(osmdContainer, {
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
        await osmd.load("/assets/score.xml");
        
        // Find total measure count
        const measureCount = osmd.Sheet?.SourceMeasures.length || 10;
        console.log(`Found ${measureCount} measures. Rendering to blocks...`);

        for (let i = 1; i <= measureCount; i++) {
            // Yield every single measure to keep memory spikes low & VRAM from exhaustion
            await new Promise(resolve => setTimeout(resolve, 20));

            // Set OSMD to only render this specific measure
            osmd.setOptions({
                drawFromMeasureNumber: i,
                drawUpToMeasureNumber: i
            });
            osmd.render();
            
            // Get the resulting canvas created by OSMD
            const generatedCanvas = osmdContainer.querySelector('canvas') as HTMLCanvasElement;
            if (!generatedCanvas) continue;

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
            // Create the block mesh
            const box = MeshBuilder.CreateBox(`measure_${i}`, {
                width: 4,
                height: boxHeight,
                depth: 0.2
            }, scene);

            // Rotate the block so the front face texture appears right side up and properly oriented from the camera's perspective
            box.rotation.z = Math.PI;

            // Start the box far away
            box.position = new Vector3(0, boxHeight / 2 + 1, 100);
            box.isVisible = false; // Hide until it enters the game area

            gameBlocks.push({
                mesh: box,
                arrivalTime: i * WHOLE_NOTE_DURATION // Sequence them spaced by 2s
            });

            // Add click interaction to play the notes of this measure
            box.actionManager = new ActionManager(scene);
            box.actionManager.registerAction(
                new ExecuteCodeAction(
                    ActionManager.OnPickTrigger,
                    async () => {
                        await Tone.start();
                        const synthToUse = getTrumpetSynth();
                        const sourceMeasure = osmd.Sheet.SourceMeasures[i - 1]; // 0-indexed
                        
                        const now = Tone.now();
                        const BPM = 120;
                        const WHOLE_NOTE_DURATION = (60 / BPM) * 4; // 2 seconds

                        // Play the notes inside this measure
                        sourceMeasure.VerticalSourceStaffEntryContainers.forEach(container => {
                            const timeInMeasure = container.Timestamp.RealValue * WHOLE_NOTE_DURATION;
                            
                            container.StaffEntries.forEach(entry => {
                                // Only play the Trumpet 1 instrument (index 0)
                                if (entry.ParentStaff.ParentInstrument.Id === osmd.Sheet.Instruments[0].Id) {
                                    entry.VoiceEntries.forEach(ve => {
                                        ve.Notes.forEach(note => {
                                            // OSMD's halfTone property matches valid MIDI note numbers
                                            if (note.halfTone) {
                                                const frequency = Tone.Frequency(note.halfTone, "midi").toFrequency();
                                                const duration = note.Length.RealValue * WHOLE_NOTE_DURATION;
                                                synthToUse.triggerAttackRelease(frequency, duration, now + timeInMeasure);
                                            }
                                        });
                                    });
                                }
                            });
                        });
                    }
                )
            );

            // Apply material
            const material = new StandardMaterial(`mat_m${i}`, scene);
            material.diffuseTexture = dynamicTexture;
            material.diffuseTexture.hasAlpha = true;
            material.emissiveColor = new Color3(1, 1, 1); 
            material.disableLighting = true; // So it looks like clear sheet music
            
            box.material = material;
            measureBlocks.push(box);
        }
    } catch (err) {
        console.error("Failed to load and render Music XML:", err);
    } finally {
        if (osmdContainer.parentNode) {
            osmdContainer.parentNode.removeChild(osmdContainer);
        }
    }
}

// Start loading the Music XML file
loadAndGenerateMeasures();

engine.runRenderLoop(() => {
    if (gameStartTime !== null) {
        const currentTime = Tone.now() - gameStartTime;
        
        gameBlocks.forEach(block => {
            // How long until it's supposed to arrive at Z=0?
            const timeUntilArrival = block.arrivalTime - currentTime;
            
            // Map time directly to Z distance using FLY_SPEED
            const zDistance = timeUntilArrival * FLY_SPEED;
            block.mesh.position.z = zDistance;

            // Show it when it's coming from the horizon, hide when it passes far behind camera
            if (zDistance < 80 && zDistance > -20) {
                block.mesh.isVisible = true;
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
