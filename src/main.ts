import { Engine, Scene, FreeCamera, Vector3, Matrix, Mesh, HemisphericLight, MeshBuilder, StandardMaterial, DynamicTexture, Color3, Texture, CubeTexture, ActionManager, ExecuteCodeAction } from "@babylonjs/core";
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

// Enable WebXR/VR
scene.createDefaultXRExperienceAsync().then((xr) => {
    // If the device doesn't supply a real-world vertical tracking offset (3DoF/Emulators),
    // this ensures the player eyes sit exactly at 1.8 meters from the floor.
    xr.baseExperience.onInitialXRPoseSetObservable.add((xrCamera) => {
        xrCamera.position.y = 1.8;
    });
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

const bandLegs: { legL: any, legR: any, anchor: any, startZ: number }[] = [];

// Create a 100-member marching band in a 10x10 formation
function buildMarchingBand(scene: Scene) {
    // Generate Materials for different parts (Colors)
    const skinMat = new StandardMaterial("skinMat", scene);
    skinMat.diffuseColor = new Color3(0.9, 0.75, 0.6); // Skin tone

    const uniformMat = new StandardMaterial("uniformMat", scene);
    uniformMat.diffuseColor = new Color3(0.8, 0.1, 0.1); // Bright red jacket

    const pantsMat = new StandardMaterial("pantsMat", scene);
    pantsMat.diffuseColor = new Color3(0.1, 0.1, 0.3); // Navy blue pants

    const hatMat = new StandardMaterial("hatMat", scene);
    hatMat.diffuseColor = new Color3(0.95, 0.95, 0.95); // White hat

    const plumeMat = new StandardMaterial("plumeMat", scene);
    plumeMat.diffuseColor = new Color3(0.1, 0.6, 0.9); // Blue plume

    const brassMat = new StandardMaterial("brassMat", scene);
    brassMat.diffuseColor = new Color3(0.85, 0.7, 0.2); // Gold brass instrument
    
    // Create base body part meshes to be instanced (using cylinders, boxes, prisms)
    const baseTorso = MeshBuilder.CreateBox("baseTorso", { width: 0.45, height: 0.6, depth: 0.3 }, scene);
    baseTorso.material = uniformMat;

    const baseLeg = MeshBuilder.CreateBox("baseLeg", { width: 0.18, height: 0.8, depth: 0.18 }, scene);
    // Shift geometry down so the origin of the mesh is at the top (the hip pivot)
    baseLeg.bakeTransformIntoVertices(Matrix.Translation(0, -0.4, 0));
    baseLeg.material = pantsMat;

    const baseHead = MeshBuilder.CreateSphere("baseHead", { diameter: 0.3 }, scene);
    baseHead.material = skinMat;

    const baseHat = MeshBuilder.CreateCylinder("baseHat", { diameter: 0.35, height: 0.2 }, scene);
    baseHat.material = hatMat;

    // Triangular prism for the plume (cylinder with 3 sides)
    const basePlume = MeshBuilder.CreateCylinder("basePlume", { diameter: 0.1, height: 0.3, tessellation: 3 }, scene);
    basePlume.material = plumeMat;

    const baseArm = MeshBuilder.CreateCylinder("baseArm", { diameter: 0.12, height: 0.5 }, scene);
    baseArm.material = uniformMat;

    // Cone-shaped trumpet / brass instrument
    
    // Bass Drum (Cylinder facing sideways)
    const baseBassDrum = MeshBuilder.CreateCylinder("baseBassDrum", { diameter: 0.6, height: 0.3 }, scene);
    baseBassDrum.bakeTransformIntoVertices(Matrix.RotationZ(Math.PI / 2));
    baseBassDrum.material = hatMat; // White drum shell

    // Snare Drum (Cylinder facing up)
    const baseSnareDrum = MeshBuilder.CreateCylinder("baseSnareDrum", { diameter: 0.4, height: 0.2 }, scene);
    baseSnareDrum.material = hatMat; // White drum shell

    // Tom Toms (3 Cylinders merged into one)
    const tom1 = MeshBuilder.CreateCylinder("tom1", { diameter: 0.3, height: 0.2 }, scene);
    tom1.position.set(-0.25, 0, 0); // Left
    const tom2 = MeshBuilder.CreateCylinder("tom2", { diameter: 0.3, height: 0.2 }, scene);
    tom2.position.set(0.25, 0, 0); // Right
    const tom3 = MeshBuilder.CreateCylinder("tom3", { diameter: 0.25, height: 0.2 }, scene);
    tom3.position.set(0, 0, 0.25); // Front-center
    const baseTomToms = Mesh.MergeMeshes([tom1, tom2, tom3], true) as Mesh;
    baseTomToms.name = "baseTomToms";
    baseTomToms.material = hatMat;

    // Saxophone (brass vertical cylinder with a bell pointing out)
    const saxMain = MeshBuilder.CreateCylinder("saxMain", { diameterTop: 0.05, diameterBottom: 0.08, height: 0.6 }, scene);
    saxMain.position.set(0, -0.3, 0); // main tube shifted down
    const saxBell = MeshBuilder.CreateCylinder("saxBell", { diameterTop: 0.15, diameterBottom: 0.05, height: 0.25 }, scene);
    saxBell.position.set(0, -0.55, 0.1); 
    saxBell.rotation.x = Math.PI / 3; // curve upwards and out
    const baseSaxophone = Mesh.MergeMeshes([saxMain, saxBell], true) as Mesh;
    baseSaxophone.name = "baseSaxophone";
    baseSaxophone.material = brassMat;

    // Clarinet (thin black cylinder)
    const clarinetMat = new StandardMaterial("clarinetMat", scene);
    clarinetMat.diffuseColor = new Color3(0.1, 0.1, 0.1); // Near black
    clarinetMat.specularColor = new Color3(0.5, 0.5, 0.5); // some shine
    const baseClarinet = MeshBuilder.CreateCylinder("baseClarinet", { diameter: 0.04, height: 0.7 }, scene);
    baseClarinet.bakeTransformIntoVertices(Matrix.Translation(0, -0.35, 0)); // Shift origin to top
    baseClarinet.material = clarinetMat;

    // Trombone (shorter bell with looped slide)
    const tbMain = MeshBuilder.CreateCylinder("tbMain", { diameterTop: 0.15, diameterBottom: 0.02, height: 0.6 }, scene);
    tbMain.position.set(0, 0.3, 0); // Shift UP so origin is near the narrow mouthpiece
    
    // Slide loop (2 parallel tubes + 1 bottom connector)
    const tbSlide1 = MeshBuilder.CreateCylinder("tbSlide1", { diameter: 0.02, height: 0.8 }, scene);
    tbSlide1.position.set(-0.06, 0.5, 0.1); // Offset in X and Z to avoid intersecting the bell
    const tbSlide2 = MeshBuilder.CreateCylinder("tbSlide2", { diameter: 0.02, height: 0.8 }, scene);
    tbSlide2.position.set(0.06, 0.5, 0.1); 
    const tbSlideBottom = MeshBuilder.CreateCylinder("tbSlideBottom", { diameter: 0.02, height: 0.14 }, scene);
    tbSlideBottom.rotation.z = Math.PI / 2; // Connect the two slide tubes
    tbSlideBottom.position.set(0, 0.9, 0.1);

    const baseTrombone = Mesh.MergeMeshes([tbMain, tbSlide1, tbSlide2, tbSlideBottom], true) as Mesh;
    baseTrombone.name = "baseTrombone";
    baseTrombone.material = brassMat;

    // Sousaphone (spiral body with big bell above the head)
    const sousaPath: Vector3[] = [];
    for (let i = 0; i <= 60; i++) {
        const t = i / 60;
        const angle = t * Math.PI * 1.5; // 0.75 loops instead of 1, so it ends on the right side
        const radius = 0.4 + 0.1 * t; // spiral increasing outward slightly
        // Negate x so the spiral wraps to the other direction, ending at right side
        const x = -radius * Math.cos(angle);
        const y = -0.4 + t * 1.2; // spiraling from waist up to shoulder
        const z = -radius * Math.sin(angle); // keep behind the player mostly
        sousaPath.push(new Vector3(x, y, z));
    }
    // ensure last point smoothly connects to the bell
    const lastP = sousaPath[sousaPath.length - 1];
    
    const sousaBody = MeshBuilder.CreateTube("sousaBody", { path: sousaPath, radius: 0.08 }, scene);
    
    // Attach the bell to the end of the tube
    const sousaBell = MeshBuilder.CreateCylinder("sousaBell", { diameterTop: 0.8, diameterBottom: 0.1, height: 0.6 }, scene);
    sousaBell.position.set(lastP.x, lastP.y, lastP.z + 0.3); // Extends forward from the tube's end
    sousaBell.rotation.x = Math.PI / 2; // Bell pointing forward
    const baseSousaphone = Mesh.MergeMeshes([sousaBody, sousaBell], true) as Mesh;

    baseSousaphone.name = "baseSousaphone";
    baseSousaphone.material = brassMat;

    // Flute (thin silver tube, held to the side)
    const baseFlute = MeshBuilder.CreateCylinder("baseFlute", { diameter: 0.02, height: 0.6 }, scene);
    // Shift origin to the end (mouthpiece)
    baseFlute.bakeTransformIntoVertices(Matrix.Translation(0, 0.3, 0));
    baseFlute.material = new StandardMaterial("fluteMat", scene);
    (baseFlute.material as StandardMaterial).diffuseColor = new Color3(0.9, 0.9, 0.9); // Silver
    (baseFlute.material as StandardMaterial).specularColor = new Color3(1, 1, 1);

    // Trumpet (brass, smaller shape, held forward)
    const tptBody = MeshBuilder.CreateCylinder("tptBody", { diameterTop: 0.08, diameterBottom: 0.02, height: 0.4 }, scene);
    tptBody.position.set(0, 0.2, 0); // Bell at top, mouthpiece at origin
    const tptValves = MeshBuilder.CreateBox("tptValves", { width: 0.06, height: 0.1, depth: 0.04 }, scene);
    tptValves.position.set(0, 0.15, 0.04);
    const baseTrumpet = Mesh.MergeMeshes([tptBody, tptValves], true) as Mesh;
    baseTrumpet.name = "baseTrumpet";
    baseTrumpet.material = brassMat;

    // Mellophone (forward-facing large bell like trumpet but chunkier)
    const melloBody = MeshBuilder.CreateCylinder("melloBody", { diameterTop: 0.18, diameterBottom: 0.02, height: 0.45 }, scene);
    melloBody.position.set(0, 0.225, 0); 
    const melloValves = MeshBuilder.CreateBox("melloValves", { width: 0.08, height: 0.12, depth: 0.06 }, scene);
    melloValves.position.set(0, 0.15, 0.05);
    const baseMellophone = Mesh.MergeMeshes([melloBody, melloValves], true) as Mesh;
    baseMellophone.name = "baseMellophone";
    baseMellophone.material = brassMat;

    // Euphonium (large marching brass instrument, similar to thick trumpet)
    const euphBody = MeshBuilder.CreateCylinder("euphBody", { diameterTop: 0.25, diameterBottom: 0.05, height: 0.6 }, scene);
    euphBody.position.set(0, 0.3, 0); 
    const euphValves = MeshBuilder.CreateBox("euphValves", { width: 0.1, height: 0.15, depth: 0.08 }, scene);
    euphValves.position.set(0, 0.2, 0.06);
    const baseEuphonium = Mesh.MergeMeshes([euphBody, euphValves], true) as Mesh;
    baseEuphonium.name = "baseEuphonium";
    baseEuphonium.material = brassMat;

    const rows = 14;
    const cols = 10;
    const spacingX = 2.0; // 2 meters between columns
    const spacingZ = 2.0; // 2 meters between rows
    const startZ = 60;

    let firstFlutePlaced = false;
    let firstTrumpetPlaced = false;
    let firstMellophonePlaced = false;
    let firstEuphoniumPlaced = false;    let firstBassDrumPlaced = false;
    let firstSnareDrumPlaced = false;
    let firstTomTomPlaced = false;
    let firstSaxophonePlaced = false;
    let firstClarinetPlaced = false;
    let firstTrombonePlaced = false;
    let firstSousaphonePlaced = false;

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const isBase = (r === 0 && c === 0);
            const isFlute = (r === 0); // Row 0
            const isClarinet = (r === 1 || r === 2); // Rows 1 and 2
            const isSaxophone = (r === 3 || r === 4); // Rows 3 and 4
            const isTomTom = (r === 5); // Row 5
            const isSnareDrum = (r === 6 || r === 7); // Rows 6 and 7
            const isBassDrum = (r === 8); // Row 8
            const isTrumpet = (r === 9); // Row 9
            const isMellophone = (r === 10); // Row 10
            const isEuphonium = (r === 11); // Row 11
            const isTrombone = (r === 12); // Row 12
            const isSousaphone = (r === 13); // Row 13 (back row)
            const isDrum = isBassDrum || isSnareDrum || isTomTom;
            
            const xPos = (c - cols / 2 + 0.5) * spacingX;
            const zPos = startZ + r * spacingZ;

            // Anchor point for this member
            const anchor = MeshBuilder.CreateBox(`anchor_${r}_${c}`, { size: 0.01 }, scene);
            anchor.position.set(xPos, 0, zPos);
            anchor.rotation.y = Math.PI; // Face towards the camera / negative Z direction
            anchor.isVisible = false;

            // Torso (Box)
            const torso = isBase ? baseTorso : baseTorso.createInstance(`torso_${r}_${c}`);
            torso.parent = anchor;
            torso.position.set(0, 1.1, 0);

            // Left Leg (Box)
            const legL = isBase ? baseLeg : baseLeg.createInstance(`legL_${r}_${c}`);
            legL.parent = anchor;
            legL.position.set(-0.12, 0.8, 0); // attached at the hip

            // Right Leg (Clone or Instance)
            const legR = isBase ? baseLeg.clone(`legR_${r}_${c}`) : baseLeg.createInstance(`legR_${r}_${c}`);
            legR.parent = anchor;
            legR.position.set(0.12, 0.8, 0); // attached at the hip

            bandLegs.push({ legL, legR, anchor, startZ: zPos });

            // Head (Sphere)
            const head = isBase ? baseHead : baseHead.createInstance(`head_${r}_${c}`);
            head.parent = anchor;
            head.position.set(0, 1.55, 0);

            // Hat (Cylinder)
            const hat = isBase ? baseHat : baseHat.createInstance(`hat_${r}_${c}`);
            hat.parent = anchor;
            hat.position.set(0, 1.8, 0);

            // Plume (Prism / Cylinder with tessellation 3)
            const plume = isBase ? basePlume : basePlume.createInstance(`plume_${r}_${c}`);
            plume.parent = anchor;
            plume.position.set(0, 2.0, 0);

            // Left Arm (Cylinder)
            const armL = isBase ? baseArm : baseArm.createInstance(`armL_${r}_${c}`);
            armL.parent = anchor;
            armL.position.set(-0.3, 1.25, 0.15);
            armL.rotation.x = Math.PI / 4;
            armL.rotation.y = isDrum ? Math.PI / 4 : Math.PI / 8;

            // Right Arm (Clone or Instance)
            const armR = isBase ? baseArm.clone(`armR_${r}_${c}`) : baseArm.createInstance(`armR_${r}_${c}`);
            armR.parent = anchor;
            armR.position.set(0.3, 1.25, 0.15);
            armR.rotation.x = Math.PI / 4;
            armR.rotation.y = isDrum ? -Math.PI / 4 : -Math.PI / 8;

            // Instrument (Cylinder)
            let instr;
            if (isBassDrum) {
                instr = (!firstBassDrumPlaced) ? baseBassDrum : baseBassDrum.createInstance(`bassdrum_${r}_${c}`);
                firstBassDrumPlaced = true;
                instr.parent = anchor;
                instr.position.set(0, 1.1, 0.45); // Pushed forward so it doesn't clip into the torso
                instr.rotation.x = 0; // Flat facing sideways
            } else if (isSnareDrum) {
                instr = (!firstSnareDrumPlaced) ? baseSnareDrum : baseSnareDrum.createInstance(`snaredrum_${r}_${c}`);
                firstSnareDrumPlaced = true;
                instr.parent = anchor;
                instr.position.set(0, 1.0, 0.35); // Hanging around waist, resting flat
                instr.rotation.x = 0;
            } else if (isTomTom) {
                instr = (!firstTomTomPlaced) ? baseTomToms : baseTomToms.createInstance(`tomtom_${r}_${c}`);
                firstTomTomPlaced = true;
                instr.parent = anchor;
                instr.position.set(0, 1.0, 0.4); // Moved further forward to avoid intersecting torso
                instr.rotation.x = 0;
            } else if (isSaxophone) {
                instr = (!firstSaxophonePlaced) ? baseSaxophone : baseSaxophone.createInstance(`sax_${r}_${c}`);
                firstSaxophonePlaced = true;
                instr.parent = anchor;
                // Connect to mouth area and tilt bottom outward (negative X rotation)
                instr.position.set(0, 1.45, 0.15); // Origin is at the mouthpiece, placed at the lips
                instr.rotation.x = -Math.PI / 6; // Negative rotation tilts the bottom of the instrument forward, away from the torso
            } else if (isClarinet) {
                instr = (!firstClarinetPlaced) ? baseClarinet : baseClarinet.createInstance(`clarinet_${r}_${c}`);
                firstClarinetPlaced = true;
                instr.parent = anchor;
                // Connect to mouth area and tilt bottom outward, slightly steeper than sax
                instr.position.set(0, 1.45, 0.15); 
                instr.rotation.x = -Math.PI / 4; 
            } else if (isTrombone) {
                instr = (!firstTrombonePlaced) ? baseTrombone : baseTrombone.createInstance(`trombone_${r}_${c}`);
                firstTrombonePlaced = true;
                instr.parent = anchor;
                // Connect origin (mouthpiece) directly to the mouth area
                instr.position.set(0, 1.45, 0.15);
                instr.rotation.x = Math.PI / 2;
            } else if (isSousaphone) {
                instr = (!firstSousaphonePlaced) ? baseSousaphone : baseSousaphone.createInstance(`sousaphone_${r}_${c}`);
                firstSousaphonePlaced = true;
                instr.parent = anchor;
                // Wrap around the right shoulder, bell protruding forward
                instr.position.set(0, 1.25, 0.1); 
                instr.rotation.x = 0;
            } else if (isFlute) {
                instr = (!firstFlutePlaced) ? baseFlute : baseFlute.createInstance(`flute_${r}_${c}`);
                firstFlutePlaced = true;
                instr.parent = anchor;
                // Move origin (mouthpiece) to the lips, pivot instrument to face right horizontally
                instr.position.set(0, 1.45, 0.15);
                instr.rotation.z = -Math.PI / 2; // Pivot to point to the right
                instr.rotation.y = Math.PI / 8; // Slight angle forward
            } else if (isTrumpet) {
                instr = (!firstTrumpetPlaced) ? baseTrumpet : baseTrumpet.createInstance(`trumpet_${r}_${c}`);
                firstTrumpetPlaced = true;
                instr.parent = anchor;
                instr.position.set(0, 1.45, 0.15);
                instr.rotation.x = Math.PI / 2;
            } else if (isMellophone) {
                instr = (!firstMellophonePlaced) ? baseMellophone : baseMellophone.createInstance(`mello_${r}_${c}`);
                firstMellophonePlaced = true;
                instr.parent = anchor;
                instr.position.set(0, 1.45, 0.15);
                instr.rotation.x = Math.PI / 2;
            } else if (isEuphonium) {
                instr = (!firstEuphoniumPlaced) ? baseEuphonium : baseEuphonium.createInstance(`euph_${r}_${c}`);
                firstEuphoniumPlaced = true;
                instr.parent = anchor;
                instr.position.set(0, 1.45, 0.15);
                instr.rotation.x = Math.PI / 2;
            }
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
const synth = getTrumpetSynth(); // pre-initialize
        getMetronomeSynth(); // pre-initialize
        
        // Sync Tone.Transport to our 80 BPM and start a repeating metronome click
        Tone.Transport.bpm.value = BPM;
        // Delay metronome by exactly 2 whole notes so it starts right when the first block arrives
        Tone.Transport.scheduleRepeat((time) => {
            getMetronomeSynth().triggerAttackRelease("C5", "32n", time);
        }, "4n");
        
        // Schedule all generated sheet music notes onto the Transport timeline instantly
        if (osmd && osmd.Sheet) {
            osmd.Sheet.SourceMeasures.forEach((sourceMeasure, mIndex) => {
                let measureFirstT = 0;
                if (sourceMeasure.VerticalSourceStaffEntryContainers.length > 0 && sourceMeasure.VerticalSourceStaffEntryContainers[0].Timestamp) {
                    measureFirstT = sourceMeasure.VerticalSourceStaffEntryContainers[0].Timestamp.RealValue;
                }

                sourceMeasure.VerticalSourceStaffEntryContainers.forEach(container => {
                    if (!container.Timestamp) return;
                    const timeInMeasure = (container.Timestamp.RealValue - measureFirstT) * WHOLE_NOTE_DURATION;
                    
                    container.StaffEntries.forEach(entry => {
                        // Only play the Trumpet 1 instrument (index 0)
                        if (entry.ParentStaff.ParentInstrument.Id === osmd!.Sheet!.Instruments[0].Id) {
                            entry.VoiceEntries.forEach(ve => {
                                ve.Notes.forEach(note => {
                                    // OSMD's halfTone property matches valid MIDI note numbers
                                    if (note.halfTone) {
                                        const frequency = Tone.Frequency(note.halfTone, "midi").toFrequency();
                                        const duration = note.Length.RealValue * WHOLE_NOTE_DURATION;
                                        const scheduleTime = (mIndex * WHOLE_NOTE_DURATION) + timeInMeasure;
                                        Tone.Transport.schedule((time) => {
                                            synth.triggerAttackRelease(frequency, duration, time);
                                    }, scheduleTime);
                                }
                            });
                        });
                    }
                });
            });
        });
    }
    
    gameStartTime = Tone.now();
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
    bandLegs.forEach(({ legL, legR, anchor, startZ }) => {
        // Swing legs back and forth like pendulums
        legL.rotation.x = Math.sin(marchPhase) * 0.6;
        legR.rotation.x = -Math.sin(marchPhase) * 0.6;
        // Actually move them down the field at standard marching speed
        if (gameStartTime !== null) {
            anchor.position.z = startZ - (currentRenderTime * FLY_SPEED);
        }
    });

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
