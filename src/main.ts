import { Engine, Scene, Vector3, Vector4, HemisphericLight, MeshBuilder, StandardMaterial, Color3, FreeCamera, AmmoJSPlugin, PhysicsImpostor, WebXRFeatureName, ActionManager, ExecuteCodeAction, DynamicTexture, TransformNode } from "@babylonjs/core";
import "@babylonjs/core/Physics/physicsEngineComponent";
import * as Tone from "tone";
import { OpenSheetMusicDisplay } from "opensheetmusicdisplay";

// @ts-ignore
import scoreUrl from "../public/assets/score.xml?url";

declare var Ammo: any;

class App {
    private engine: Engine;
    private scene: Scene;

    constructor() {
        const canvas = document.getElementById("renderCanvas") as HTMLCanvasElement;
        this.engine = new Engine(canvas, true);
        this.scene = new Scene(this.engine);
        
        this.init().then(() => {
            this.engine.runRenderLoop(() => {
                this.scene.render();
            });
            window.addEventListener("resize", () => {
                this.engine.resize();
            });
        });
    }

    private async init() {
        await Ammo();

        const camera = new FreeCamera("camera", new Vector3(0, 1.6, 0), this.scene);
        camera.setTarget(new Vector3(0, 1.6, 1)); // Look forward at the drum
        camera.attachControl(document.getElementById("renderCanvas"), true);
        camera.speed = 0.15; // Slow down desktop WASD/Arrow key movement significantly
        camera.minZ = 0.1;   // Prevent clipping when getting very close to objects
        
        const light = new HemisphericLight("light", new Vector3(0, 1, 0), this.scene);
        light.intensity = 0.8;

        const ammoPlugin = new AmmoJSPlugin(true, Ammo);
        this.scene.enablePhysics(new Vector3(0, -9.81, 0), ammoPlugin);

        const ground = MeshBuilder.CreateGround("ground", { width: 50, height: 50 }, this.scene);
        const groundMaterial = new StandardMaterial("groundMat", this.scene);
        groundMaterial.diffuseColor = new Color3(0.3, 0.3, 0.3); // Simple gray floor
        ground.material = groundMaterial;

        ground.physicsImpostor = new PhysicsImpostor(
            ground,
            PhysicsImpostor.BoxImpostor,
            { mass: 0, restitution: 0.9, friction: 0.5 },
            this.scene
        );

        // 3.5 Create VR Drum & Synth
        this.createDrum();
        
        this.createRhythmCubes();

        // 3.6 Setup Physical MIDI Keyboard Support
        this.setupMidi();

        // 3.7 Add Music Notation
        this.createNotationBoard();

        try {
            const xr = await this.scene.createDefaultXRExperienceAsync({
                floorMeshes: [ground],
                uiOptions: {
                    sessionMode: "immersive-vr",
                    referenceSpaceType: "local-floor"
                }
            });

            try {
                xr.baseExperience.featuresManager.enableFeature(WebXRFeatureName.HAND_TRACKING, "latest", {
                    xrInput: xr.input,
                });
            } catch (err) {}

            try {
                xr.baseExperience.featuresManager.enableFeature(WebXRFeatureName.PHYSICS_CONTROLLERS, "latest", {
                    xrInput: xr.input,
                    physicsProperties: {
                        restitution: 0.5,
                        impostorSize: 0.1,
                        impostorType: PhysicsImpostor.BoxImpostor
                    },
                    enableHeadsetImpostor: true
                });
            } catch (err) {}

            // Ensure Tone starts upon entering VR
            xr.baseExperience.sessionManager.onXRSessionInit.add(async () => {
                await Tone.start();
                console.log("Audio ready");
            });

        } catch (e) {
            console.warn("XR not supported in your environment", e);
        }
    }

    private drumSynth: Tone.MembraneSynth | null = null;
    private drumLastHit = 0;

    private createDrum() {
        // Setup Tone.js Synth
        this.drumSynth = new Tone.MembraneSynth().toDestination();

        // Visual Drum Mesh
        const drum = MeshBuilder.CreateCylinder("drum", { diameter: 0.6, height: 0.3 }, this.scene);
        drum.isVisible = false; // Hidden per user request
        drum.position = new Vector3(0, 1, 1); // 1m high, 1m in front of starting position
        
        const drumMat = new StandardMaterial("drumMat", this.scene);
        drumMat.diffuseColor = new Color3(0.8, 0.2, 0.2); // Red drum
        drum.material = drumMat;

        // Physics so it feels solid
        drum.physicsImpostor = new PhysicsImpostor(
            drum, 
            PhysicsImpostor.CylinderImpostor, 
            { mass: 0, restitution: 0.1 }, 
            this.scene
        );

        // Interaction via XR Pointers or Mouse Clicks
        drum.actionManager = new ActionManager(this.scene);
        drum.actionManager.registerAction(
            new ExecuteCodeAction(ActionManager.OnPickDownTrigger, async () => {
                await Tone.start(); // Ensure context is running if clicked before VR
                this.hitDrum();
            })
        );

        // Setup a collision check loop directly vs controller/hand physics meshes
        // This simulates a physical "thwack" if the controller bumps it
        this.scene.onBeforeRenderObservable.add(() => {
            const now = Date.now();
            if (now - this.drumLastHit < 200) return; // Basic debounce (200ms)

            // Very basic distance check for controllers (approximated)
            // A more rigorous approach involves registering onCollide physics events, but WebXR dynamically adds impostors.
            // This grabs XR controllers if they are close enough
            this.scene.meshes.forEach(mesh => {
                // If it's a headset or a controller mesh (added by physics/hand tracking)
                if (mesh.name.indexOf("controller") !== -1 || mesh.name.indexOf("hand") !== -1 || mesh.name.indexOf("handTracker") !== -1) {
                    if (Vector3.Distance(mesh.absolutePosition, drum.position) < 0.4) {
                        this.hitDrum();
                    }
                }
            });
        });
    }

    private hitDrum() {
        const now = Date.now();
        if (this.drumSynth && (now - this.drumLastHit) > 100) {
            this.drumLastHit = now;
            // Play a punchy C2 note
            this.drumSynth.triggerAttackRelease("C2", "8n");
            
            // Brief visual flash
            const mat = this.scene.getMeshByName("drum")?.material as StandardMaterial;
            if (mat) {
                mat.emissiveColor = new Color3(0.5, 0.5, 0.5);
                setTimeout(() => mat.emissiveColor = new Color3(0, 0, 0), 100);
            }
        }
    }

    private midiSynth: Tone.PolySynth | null = null;

    private async setupMidi() {
        // Create a basic polyphonic synth for MIDI input
        this.midiSynth = new Tone.PolySynth(Tone.Synth).toDestination();

        if (navigator.requestMIDIAccess) {
            try {
                const midiAccess = await navigator.requestMIDIAccess();
                
                // Connect to all currently available inputs
                for (const input of midiAccess.inputs.values()) {
                    input.onmidimessage = this.getMIDIMessage.bind(this);
                }

                // Listen for new devices being plugged in
                midiAccess.onstatechange = (e: any) => {
                    console.log("MIDI state changed:", e.port.name, e.port.state);
                    if (e.port.type === "input" && e.port.state === "connected") {
                         e.port.onmidimessage = this.getMIDIMessage.bind(this);
                    }
                };
                console.log("MIDI Support Enabled");
            } catch (err) {
                console.warn("MIDI Access failed. You might need to grant browser permissions.", err);
            }
        } else {
            console.warn("Web MIDI API not supported in this browser.");
        }
    }

    private getMIDIMessage(message: any) {
        const command = message.data[0];
        const note = message.data[1];
        const velocity = (message.data.length > 2) ? message.data[2] : 0;

        // Command 144 is Note On, 128 is Note Off
        // Some keyboards send Note On with 0 velocity instead of Note Off
        if (command >= 144 && command <= 159) { // Note On across any of the 16 channels
            if (velocity > 0) {
                this.noteOn(note, velocity);
            } else {
                this.noteOff(note);
            }
        } else if (command >= 128 && command <= 143) { // Note Off across any of the 16 channels
            this.noteOff(note);
        }
    }

    private noteOn(midiNote: number, velocity: number) {
        if (!this.midiSynth) return;
        Tone.start(); // Ensure audio context is alive
        const freq = Tone.mtof(midiNote as any); // convert MIDI note integer to frequency Hz
        // Trigger attack with normalized velocity (0-1)
        this.midiSynth.triggerAttack(freq, Tone.now(), velocity / 127);
        
        // Optional: flash the scene light or do something cool visually on MIDI note hit
        const mat = this.scene.getMeshByName("ground")?.material as StandardMaterial;
        if (mat) {
             mat.emissiveColor = new Color3(Math.random() * 0.2, Math.random() * 0.2, Math.random() * 0.2);
        }
    }

    private noteOff(midiNote: number) {
        if (!this.midiSynth) return;
        const freq = Tone.mtof(midiNote as any);
        this.midiSynth.triggerRelease(freq, Tone.now());
        
        const mat = this.scene.getMeshByName("ground")?.material as StandardMaterial;
        if (mat) {
             mat.emissiveColor = new Color3(0, 0, 0); // Turn off flash
        }
    }

    private async createRhythmCubes() {
        console.log("Generating rhythm cubes...");

        const osmdContainer = document.createElement("div");
        osmdContainer.style.position = "absolute";
        osmdContainer.style.top = "-9999px";
        osmdContainer.style.width = "400px";
        document.body.appendChild(osmdContainer);

        const osmd = new OpenSheetMusicDisplay(osmdContainer, {
            backend: "canvas",
            drawTitle: false,
            drawPartNames: false,
            drawMeasureNumbers: false,
            autoResize: false
        });
        osmd.EngravingRules.RenderClefsAtBeginningOfStaffline = false;
        osmd.EngravingRules.RenderTimeSignatures = false;
        osmd.EngravingRules.RenderKeySignatures = false;
        osmd.EngravingRules.StaffLineWidth = 2.0;
        osmd.EngravingRules.StemWidth = 2.5;
        osmd.EngravingRules.LedgerLineWidth = 2.0;
        osmd.EngravingRules.BeamWidth = 2.5;
        osmd.zoom = 3.0;

        const rhythms = [
            `<note><pitch><step>B</step><octave>4</octave></pitch><duration>4</duration><type>quarter</type><stem>down</stem></note>`,
            `<note><pitch><step>B</step><octave>4</octave></pitch><duration>4</duration><type>quarter</type><stem>down</stem></note>`,
            `<note><pitch><step>B</step><octave>4</octave></pitch><duration>4</duration><type>quarter</type><stem>down</stem></note>`,
            `<note><pitch><step>B</step><octave>4</octave></pitch><duration>4</duration><type>quarter</type><stem>down</stem></note>`,
            `<note><pitch><step>B</step><octave>4</octave></pitch><duration>4</duration><type>quarter</type><stem>down</stem></note>`,
            `<note><pitch><step>B</step><octave>4</octave></pitch><duration>4</duration><type>quarter</type><stem>down</stem></note>`
        ];

        const tileSize = 512;
        const atlasW = 4096; // Use Power-of-Two width (512 * 8 = 4096)
        const atlasH = 512; // Power-of-Two height

        const texture = new DynamicTexture("rhythmAtlas", {width: atlasW, height: atlasH}, this.scene, true);
        const ctx = texture.getContext() as CanvasRenderingContext2D;
        
        ctx.fillStyle = "white";
        ctx.fillRect(0, 0, atlasW, atlasH);

        for (let i = 0; i < 6; i++) {
            const xml = `<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 3.1 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd"><score-partwise version="3.1"><part-list><score-part id="P1"><part-name></part-name></score-part></part-list><part id="P1"><measure number="1"><attributes><divisions>4</divisions><key><fifths>0</fifths></key><time><beats>1</beats><beat-type>4</beat-type></time><clef><sign>percussion</sign><line>2</line></clef></attributes>${rhythms[i]}</measure></part></score-partwise>`;
            await osmd.load(xml);
            osmd.render();

            const canvas = osmdContainer.querySelector("canvas");
            if (canvas) {
                const margin = 20;
                const scaleW = (tileSize - margin) / canvas.width;
                const scaleH = (tileSize - margin) / canvas.height;
                const scale = Math.min(scaleW, scaleH, 1.0); // Don't scale up if smaller

                const drawW = canvas.width * scale;
                const drawH = canvas.height * scale;
                
                const dx = (i * tileSize) + (tileSize - drawW) / 2;
                const dy = (tileSize - drawH) / 2;
                
                ctx.drawImage(canvas, 0, 0, canvas.width, canvas.height, dx, dy, drawW, drawH);
            }
        }

        texture.update();
        texture.anisotropicFilteringLevel = 16;
        
        if (document.body.contains(osmdContainer)) {
            document.body.removeChild(osmdContainer);
        }

        const mat = new StandardMaterial("rhythmCubeMat", this.scene);
        mat.diffuseTexture = texture;
        mat.emissiveTexture = texture;
        mat.emissiveColor = new Color3(1, 1, 1);
        mat.disableLighting = true;

        const faceUV = new Array(6);
        for (let i = 0; i < 6; i++) {
            // Map 512x512 blocks out of the 4096x512 atlas
            const uMin = (i * 512) / 4096;
            const uMax = ((i + 1) * 512) / 4096;
            faceUV[i] = new Vector4(uMin, 0, uMax, 1);
        }

        for (let j = 0; j < 3; j++) {
            const box = MeshBuilder.CreateBox(`rhythmCube_${j}`, { size: 0.3, faceUV: faceUV }, this.scene);
            box.material = mat;
            box.position = new Vector3(-0.5 + (j * 0.5), 1.5 + (j * 0.4), 0.8);
            try {
                box.physicsImpostor = new PhysicsImpostor(box, PhysicsImpostor.BoxImpostor, { mass: 0.5, restitution: 0.4, friction: 0.5 }, this.scene);
            } catch (err) {}
        }
    }

    private async createNotationBoard() {
        console.log("Setting up standard OSMD music board for XR...");
        
        // 1) Setup a music stand Parent node directly behind the drum
        const standParent = new TransformNode("musicStand", this.scene);
        standParent.position = new Vector3(0, 1.4, 1.4); // Eye level, behind drum
        // Tilt slightly back for reading
        standParent.rotation.x = -Math.PI / 8;

        // 2) Standard Sheet Music Dimensions (A4-ish proportions)
        const pageWidthMeters = 2.0; // Increased from 1.0 to make the page larger in VR

        // A high-res wrap width for the sheet music
        const texW = 1536;

        // 3) Create an invisible div for OSMD to render the canvas
        const osmdContainer = document.createElement("div");
        osmdContainer.style.position = "absolute";
        osmdContainer.style.top = "-9999px";
        osmdContainer.style.width = texW + "px"; // Force standard wrap width
        // no fixed height, let OSMD expand it downwards as needed to fit standard page layouts
        document.body.appendChild(osmdContainer);

        try {
            const osmd = new OpenSheetMusicDisplay(osmdContainer, {
                backend: "canvas",
                drawTitle: true,
                drawPartNames: false,
                autoResize: false, // Freeze layout so it doesn't break texture sizes
                pageFormat: "A4_P",
            });

            // Adjust sizing lines for great VR readability
            osmd.EngravingRules.StaffLineWidth = 0.25; // Prevent VR mipmap vanishing
            osmd.EngravingRules.StemWidth = 0.3;
            osmd.EngravingRules.LedgerLineWidth = 0.3;
            osmd.EngravingRules.BeamWidth = 0.6;
            
            // At zoom=5.0, OSMD's layout engine collapses vertical spacing to fit 1536px width.
            // We revert to 2.0 to prevent staff overlap, but add StaffDistance to pad lines.
            osmd.EngravingRules.StaffDistance = 12.0;
            osmd.zoom = 2.0;

            // Load standard music xml from assets
            const xmlResponse = await fetch(scoreUrl as string);
            const musicXml = await xmlResponse.text();
            await osmd.load(musicXml);
            osmd.render();

            const allCanvases = Array.from(osmdContainer.querySelectorAll("canvas")) as HTMLCanvasElement[];
            console.log(`OSMD generated ${allCanvases.length} individual pages`);

            if (allCanvases.length > 0) {
                const baseCanvas = allCanvases[0];
                const actualRatio = baseCanvas.height / baseCanvas.width;
                const actualHeightMeters = pageWidthMeters * actualRatio;

                const materials: StandardMaterial[] = [];

                for (let i = 0; i < allCanvases.length; i++) {
                    const canvas = allCanvases[i];
                    
                    const texture = new DynamicTexture(`sheetMusicTex_${i}`, {width: canvas.width, height: canvas.height}, this.scene, true);
                    const ctx = texture.getContext() as CanvasRenderingContext2D;

                    // Fill white background natively, then draw the specific OSMD canvas
                    ctx.fillStyle = "white";
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                    ctx.drawImage(canvas, 0, 0);
                    texture.update();

                    texture.anisotropicFilteringLevel = 16;

                    const mat = new StandardMaterial(`sheetMusicMat_${i}`, this.scene);
                    mat.diffuseTexture = texture;
                    mat.emissiveTexture = texture; 
                    mat.emissiveColor = new Color3(1, 1, 1);
                    mat.disableLighting = true; 
                    mat.backFaceCulling = false; 

                    materials.push(mat);
                }

                // Create a single plane representing the Music Stand's focused "Page"
                const sheetPlane = MeshBuilder.CreatePlane(`sheetMusicPlane`, { width: pageWidthMeters, height: actualHeightMeters }, this.scene);
                sheetPlane.parent = standParent;
                
                let currentPageIndex = 0;
                sheetPlane.material = materials[currentPageIndex];

                // Register an interaction that swaps the material to the next page when clicked
                sheetPlane.actionManager = new ActionManager(this.scene);
                sheetPlane.actionManager.registerAction(
                    new ExecuteCodeAction(ActionManager.OnPickTrigger, () => {
                        currentPageIndex = (currentPageIndex + 1) % materials.length;
                        sheetPlane.material = materials[currentPageIndex];
                        console.log(`Flipped to page ${currentPageIndex + 1}`);
                    })
                );

                console.log(`✓ Fully initialized music board with ${materials.length} flippable pages.`);
            }
        } catch (e) {
            console.error("OSMD Failed to load score: ", e);
        } finally {
            if (document.body.contains(osmdContainer)) {
                // Must remove from DOM to prevent it bleeding over the 3D canvas!
                document.body.removeChild(osmdContainer);
            }
        }
    }

    // @ts-ignore: Keep around for future testing
    private generateRandomMusicXML(numMeasures: number): string {
        const steps = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
        const octaves = [4, 5];
        
        let measuresXml = "";

        for (let m = 1; m <= numMeasures; m++) {
            let measureContent = `<measure number="${m}">\n`;
            
            // Only the first measure needs the standard attributes
            if (m === 1) {
                measureContent += `
                <attributes>
                    <divisions>1</divisions>
                    <key><fifths>0</fifths></key>
                    <time><beats>4</beats><beat-type>4</beat-type></time>
                    <clef><sign>G</sign><line>2</line></clef>
                </attributes>\n`;
            }

            // Generate 4 random quarter notes per measure
            for (let n = 0; n < 4; n++) {
                const randomStep = steps[Math.floor(Math.random() * steps.length)];
                const randomOctave = octaves[Math.floor(Math.random() * octaves.length)];
                
                measureContent += `
                <note>
                    <pitch>
                        <step>${randomStep}</step>
                        <octave>${randomOctave}</octave>
                    </pitch>
                    <duration>1</duration>
                    <type>quarter</type>
                </note>\n`;
            }

            measureContent += `</measure>\n`;
            measuresXml += measureContent;
        }

        return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 3.1 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">
<score-partwise version="3.1">
  <part-list>
    <score-part id="P1"><part-name>Random Score</part-name></score-part>
  </part-list>
  <part id="P1">
    ${measuresXml}
  </part>
</score-partwise>`;
    }
}

// Expose precomputation helper to global scope for convenience
(window as any).precomputeNotation = async () => {
    console.log("Starting pre-computation. Check browser downloads folder...");
    
    const osmdContainer = document.createElement("div");
    osmdContainer.style.position = "absolute";
    osmdContainer.style.top = "-9999px";
    osmdContainer.style.width = "8192px";
    document.body.appendChild(osmdContainer);

    const osmd = new OpenSheetMusicDisplay(osmdContainer, {
        backend: "canvas",
        drawTitle: false,
        drawPartNames: false,
        autoResize: false
    });

    // Set engraving rules after instantiation
    osmd.EngravingRules.StaffLineWidth = 5.0;
    osmd.EngravingRules.StemWidth = 5.5;
    osmd.EngravingRules.BeamWidth = 3.5;
    osmd.EngravingRules.LedgerLineWidth = 5.0;

    osmd.zoom = 5.0;

    // Generate random music
    const steps = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
    const octaves = [4, 5];
    let measuresXml = "";
    for (let m = 1; m <= 32; m++) {
        let measureContent = `<measure number="${m}">\n`;
        if (m === 1) {
            measureContent += `<attributes><divisions>1</divisions><key><fifths>0</fifths></key><time><beats>4</beats><beat-type>4</beat-type></time><clef><sign>G</sign><line>2</line></clef></attributes>\n`;
        }
        for (let n = 0; n < 4; n++) {
            const randomStep = steps[Math.floor(Math.random() * steps.length)];
            const randomOctave = octaves[Math.floor(Math.random() * octaves.length)];
            measureContent += `<note><pitch><step>${randomStep}</step><octave>${randomOctave}</octave></pitch><duration>1</duration><type>quarter</type></note>\n`;
        }
        measureContent += `</measure>\n`;
        measuresXml += measureContent;
    }

    const musicXml = `<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 3.1 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd"><score-partwise version="3.1"><part-list><score-part id="P1"><part-name>Notation</part-name></score-part></part-list><part id="P1">${measuresXml}</part></score-partwise>`;

    await osmd.load(musicXml);
    osmd.render();

    const osmdCanvas = osmdContainer.querySelector("canvas") as HTMLCanvasElement;

    if (osmdCanvas) {
        const totalPixelsW = osmdCanvas.width;
        const totalPixelsH = osmdCanvas.height;
        const maxTexSize = 4096;
        const slices = Math.ceil(totalPixelsW / maxTexSize);

        for (let i = 0; i < slices; i++) {
            const srcX = i * maxTexSize;
            const slicePixW = Math.min(maxTexSize, totalPixelsW - srcX);

            const sliceCanvas = document.createElement("canvas");
            sliceCanvas.width = slicePixW;
            sliceCanvas.height = totalPixelsH;

            const ctx = sliceCanvas.getContext("2d") as CanvasRenderingContext2D;
            ctx.fillStyle = "white"; // Draw opaque white background
            ctx.fillRect(0, 0, slicePixW, totalPixelsH);
            ctx.drawImage(osmdCanvas, srcX, 0, slicePixW, totalPixelsH, 0, 0, slicePixW, totalPixelsH);

            // Make notes black with proper alpha, background transparent
                    const imgData = ctx.getImageData(0, 0, slicePixW, totalPixelsH);
                    for (let p = 0; p < imgData.data.length; p += 4) {
                        const brightness = (imgData.data[p] + imgData.data[p+1] + imgData.data[p+2]) / 3;
                        
                        imgData.data[p]   = 0;
                        imgData.data[p+1] = 0;
                        imgData.data[p+2] = 0;
                        imgData.data[p+3] = 255 - brightness;
                    }
                    ctx.putImageData(imgData, 0, 0);

            sliceCanvas.toBlob((blob) => {
                if (blob) {
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement("a");
                    link.href = url;
                    link.download = `notation_slice_${i}.png`;
                    link.click();
                    URL.revokeObjectURL(url);
                    console.log(`✓ Downloaded notation_slice_${i}.png`);
                }
            });
        }
    }

    document.body.removeChild(osmdContainer);
    console.log("✓ Pre-computation complete! Save PNGs to public/assets/ then reload.");
};

new App();



