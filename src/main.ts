import { Engine, Scene, Vector3, HemisphericLight, MeshBuilder, StandardMaterial, Color3, FreeCamera, AmmoJSPlugin, PhysicsImpostor, WebXRFeatureName, ActionManager, ExecuteCodeAction, DynamicTexture, TransformNode } from "@babylonjs/core";
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
            });

            // Adjust sizing lines for great VR readability
            osmd.EngravingRules.StaffLineWidth = 0.25; // Prevent VR mipmap vanishing
            osmd.EngravingRules.StemWidth = 0.3;
            osmd.EngravingRules.LedgerLineWidth = 0.3;
            osmd.EngravingRules.BeamWidth = 0.6;
            osmd.zoom = 5.0;

            // Load standard music xml from assets
            const xmlResponse = await fetch(scoreUrl as string);
            const musicXml = await xmlResponse.text();
            await osmd.load(musicXml);
            osmd.render();

            const osmdCanvas = osmdContainer.querySelector("canvas") as HTMLCanvasElement;
            if (osmdCanvas) {
                console.log(`Rendered OSMD to ${osmdCanvas.width}x${osmdCanvas.height}`);
                
                // We use the actual height rendered by OSMD to scale the 3D mesh perfectly
                const actualRatio = osmdCanvas.height / osmdCanvas.width;
                const actualHeightMeters = pageWidthMeters * actualRatio;

                const texture = new DynamicTexture("sheetMusicTex", {width: osmdCanvas.width, height: osmdCanvas.height}, this.scene, true);
                const ctx = texture.getContext() as CanvasRenderingContext2D;

                // Fill with standard solid white background
                ctx.fillStyle = "white";
                ctx.fillRect(0, 0, osmdCanvas.width, osmdCanvas.height);
                // Draw notation
                ctx.drawImage(osmdCanvas, 0, 0);
                texture.update();
                
                // Nice crisp text mapping without alpha blending issues
                texture.anisotropicFilteringLevel = 16;
                
                const mat = new StandardMaterial("sheetMusicMat", this.scene);
                mat.diffuseTexture = texture;
                mat.emissiveTexture = texture; // Make it pop in VR implicitly via texture
                mat.emissiveColor = new Color3(1, 1, 1);
                mat.disableLighting = true; // Prevents shadows from making paper look gray
                mat.backFaceCulling = false; // Allow reading from both sides

                // A single standard reading plane, sized optimally
                const sheetPlane = MeshBuilder.CreatePlane("sheetMusic", { width: pageWidthMeters, height: actualHeightMeters }, this.scene);
                sheetPlane.parent = standParent;
                sheetPlane.material = mat;
                
                console.log("✓ Fully initialized standard sheet music view.");
            }
        } catch (e) {
            console.error("OSMD Failed to load score: ", e);
        } finally {
            if (document.body.contains(osmdContainer)) {
                // document.body.removeChild(osmdContainer);
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



