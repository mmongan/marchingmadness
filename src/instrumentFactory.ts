import { Scene, Mesh, MeshBuilder, StandardMaterial, Color3, Matrix, InstancedMesh } from "@babylonjs/core";

export type InstrumentType =
    | "DrumMajor" | "Flute" | "Clarinet" | "Saxophone"
    | "TomTom" | "SnareDrum" | "BassDrum" | "Cymbals"
    | "Trumpet" | "Mellophone" | "Euphonium" | "Trombone" | "Sousaphone" | "Glockenspiel";

export class InstrumentFactory {
    private scene: Scene;

    // Materials
    private brassMat!: StandardMaterial;
    private clarinetMat!: StandardMaterial;
    private fluteMat!: StandardMaterial;
    private maceMat!: StandardMaterial;

    // Instruments
    private baseBassDrum!: Mesh;
    private baseSnareDrum!: Mesh;
    private baseTomToms!: Mesh;
    private baseCymbals!: Mesh;
    private baseSaxophone!: Mesh;
    private baseClarinet!: Mesh;
    private baseTrombone!: Mesh;
    private baseSousaphone!: Mesh;
    private baseFlute!: Mesh;
    private baseTrumpet!: Mesh;
    private baseMellophone!: Mesh;
    private baseEuphonium!: Mesh;
    private baseMace!: Mesh;
    private baseGlockenspiel!: Mesh;
    private hatMat: StandardMaterial;

    private firstPlaced: Record<InstrumentType, boolean>;

    constructor(scene: Scene, hatMat: StandardMaterial) {
        this.scene = scene;
        this.hatMat = hatMat;
        this.firstPlaced = {
            DrumMajor: false,
            Flute: false,
            Clarinet: false,
            Saxophone: false,
            TomTom: false,
            SnareDrum: false,
            BassDrum: false,
            Cymbals: false,
            Trumpet: false,
            Mellophone: false,
            Euphonium: false,
            Trombone: false,
            Sousaphone: false,
            Glockenspiel: false
        };

        this.initMaterialsAndMeshes();
    }

    private initMaterialsAndMeshes() {
        const scene = this.scene;

        this.brassMat = new StandardMaterial("brassMat", scene);
        this.brassMat.diffuseColor = new Color3(0.85, 0.7, 0.2);

        // Bass Drum
        this.baseBassDrum = MeshBuilder.CreateCylinder("baseBassDrum", { diameter: 0.6, height: 0.3 }, scene);
        this.baseBassDrum.bakeTransformIntoVertices(Matrix.RotationZ(Math.PI / 2));
        this.baseBassDrum.material = this.hatMat;

        // Snare Drum
        this.baseSnareDrum = MeshBuilder.CreateCylinder("baseSnareDrum", { diameter: 0.4, height: 0.2 }, scene);
        this.baseSnareDrum.material = this.hatMat;

        // Tom Toms
        const tom1 = MeshBuilder.CreateCylinder("tom1", { diameter: 0.3, height: 0.2 }, scene);
        tom1.position.set(-0.25, 0, 0);
        const tom2 = MeshBuilder.CreateCylinder("tom2", { diameter: 0.3, height: 0.2 }, scene);
        tom2.position.set(0.25, 0, 0);
        const tom3 = MeshBuilder.CreateCylinder("tom3", { diameter: 0.25, height: 0.2 }, scene);
        tom3.position.set(0, 0, 0.25);
        this.baseTomToms = Mesh.MergeMeshes([tom1, tom2, tom3], true) as Mesh;  
        this.baseTomToms.name = "baseTomToms";
        this.baseTomToms.material = this.hatMat;

        // Cymbals
        const cymbalL = MeshBuilder.CreateCylinder("cymbalL", { diameter: 0.5, height: 0.01 }, scene);
        cymbalL.position.set(-0.1, 0, 0);
        cymbalL.rotation.z = Math.PI / 2;
        cymbalL.rotation.y = 0; // Parallel
        const cymbalR = MeshBuilder.CreateCylinder("cymbalR", { diameter: 0.5, height: 0.01 }, scene);
        cymbalR.position.set(0.1, 0, 0);
        cymbalR.rotation.z = Math.PI / 2;
        cymbalR.rotation.y = 0; // Parallel
        this.baseCymbals = Mesh.MergeMeshes([cymbalL, cymbalR], true) as Mesh;  
        this.baseCymbals.name = "baseCymbals";
        this.baseCymbals.material = this.brassMat;

        // Saxophone
        const saxMain = MeshBuilder.CreateCylinder("saxMain", { diameterTop: 0.05, diameterBottom: 0.08, height: 0.6 }, scene);
        saxMain.position.set(0, -0.3, 0);
        const saxBell = MeshBuilder.CreateCylinder("saxBell", { diameterTop: 0.15, diameterBottom: 0.05, height: 0.25 }, scene);
        saxBell.position.set(0, -0.55, 0.1);
        saxBell.rotation.x = Math.PI / 3;
        this.baseSaxophone = Mesh.MergeMeshes([saxMain, saxBell], true) as Mesh;
        this.baseSaxophone.name = "baseSaxophone";
        this.baseSaxophone.material = this.brassMat;

        // Clarinet
        this.clarinetMat = new StandardMaterial("clarinetMat", scene);
        this.clarinetMat.diffuseColor = new Color3(0.1, 0.1, 0.1);
        this.clarinetMat.specularColor = new Color3(0.5, 0.5, 0.5);
        this.baseClarinet = MeshBuilder.CreateCylinder("baseClarinet", { diameter: 0.04, height: 0.7 }, scene);
        this.baseClarinet.bakeTransformIntoVertices(Matrix.Translation(0, -0.35, 0));
        this.baseClarinet.material = this.clarinetMat;

        // Trombone
        const tbMain = MeshBuilder.CreateCylinder("tbMain", { diameterTop: 0.15, diameterBottom: 0.02, height: 0.6 }, scene);
        tbMain.position.set(0, 0.3, 0);
        const tbSlide1 = MeshBuilder.CreateCylinder("tbSlide1", { diameter: 0.02, height: 0.8 }, scene);
        tbSlide1.position.set(-0.06, 0.5, 0.1);
        const tbSlide2 = MeshBuilder.CreateCylinder("tbSlide2", { diameter: 0.02, height: 0.8 }, scene);
        tbSlide2.position.set(0.06, 0.5, 0.1);
        const tbSlideBottom = MeshBuilder.CreateCylinder("tbSlideBottom", { diameter: 0.02, height: 0.14 }, scene);
        tbSlideBottom.rotation.z = Math.PI / 2;
        tbSlideBottom.position.set(0, 0.9, 0.1);
        this.baseTrombone = Mesh.MergeMeshes([tbMain, tbSlide1, tbSlide2, tbSlideBottom], true) as Mesh;
        this.baseTrombone.name = "baseTrombone";
        this.baseTrombone.material = this.brassMat;

        // Sousaphone
        // Efficient circular design using basic geometric primitives (Torus and Cylinders)
        const sousaBody = MeshBuilder.CreateTorus("sousaBody", { diameter: 0.9, thickness: 0.16, tessellation: 32 }, scene);
        sousaBody.position.set(0, -0.1, 0); // Centered a bit lower than the anchor
        sousaBody.rotation.x = -Math.PI / 8; // Tilt so the back is higher than the front
        sousaBody.rotation.z = -Math.PI / 6;  // Tilt so the right side wraps over the shoulder, left side under the arm

        // Forward-facing prominent Bell
        const sousaBell = MeshBuilder.CreateCylinder("sousaBell", { diameterTop: 0.8, diameterBottom: 0.16, height: 0.7 }, scene);
        sousaBell.position.set(0.4, 0.7, 0.1); // Positioned high above the torus ring
        sousaBell.rotation.x = Math.PI / 2; // Face forward
        sousaBell.rotation.y = Math.PI / 16; // Slight outward flare

        // Mouthpiece tube connecting the main body to the mouth (mouth local: 0, 0.2, 0.05)
        const sousaMouthpipe = MeshBuilder.CreateCylinder("sousaMouthpipe", { diameter: 0.04, height: 0.5 }, scene);
        sousaMouthpipe.position.set(0.15, 0.05, 0.15); // Bridging the gap
        sousaMouthpipe.rotation.z = Math.PI / 4; // Angle up to the mouth
        sousaMouthpipe.rotation.x = Math.PI / 8;

        this.baseSousaphone = Mesh.MergeMeshes([sousaBody, sousaBell, sousaMouthpipe], true) as Mesh;
        this.baseSousaphone.name = "baseSousaphone";
        const sousaMat = new StandardMaterial("sousaMat", scene);
        sousaMat.diffuseColor = new Color3(0.95, 0.95, 0.95); // White fiberglass body
        this.baseSousaphone.material = sousaMat;

        // Flute
        this.baseFlute = MeshBuilder.CreateCylinder("baseFlute", { diameter: 0.02, height: 0.6 }, scene);
        this.baseFlute.bakeTransformIntoVertices(Matrix.Translation(0, 0.3, 0));
        this.fluteMat = new StandardMaterial("fluteMat", scene);
        this.fluteMat.diffuseColor = new Color3(0.9, 0.9, 0.9);
        this.fluteMat.specularColor = new Color3(1, 1, 1);
        this.baseFlute.material = this.fluteMat;

        // Trumpet
        const tptBody = MeshBuilder.CreateCylinder("tptBody", { diameterTop: 0.08, diameterBottom: 0.02, height: 0.4 }, scene);
        tptBody.position.set(0, 0.2, 0);
        const tptValves = MeshBuilder.CreateBox("tptValves", { width: 0.06, height: 0.1, depth: 0.04 }, scene);
        tptValves.position.set(0, 0.15, 0.04);
        this.baseTrumpet = Mesh.MergeMeshes([tptBody, tptValves], true) as Mesh;
        this.baseTrumpet.name = "baseTrumpet";
        this.baseTrumpet.material = this.fluteMat; // Use silver/flute material for trumpet as requested

        // Mellophone
        const melloBody = MeshBuilder.CreateCylinder("melloBody", { diameterTop: 0.18, diameterBottom: 0.02, height: 0.45 }, scene);
        melloBody.position.set(0, 0.225, 0);
        const melloValves = MeshBuilder.CreateBox("melloValves", { width: 0.08, height: 0.12, depth: 0.06 }, scene);
        melloValves.position.set(0, 0.15, 0.05);
        this.baseMellophone = Mesh.MergeMeshes([melloBody, melloValves], true) as Mesh;
        this.baseMellophone.name = "baseMellophone";
        this.baseMellophone.material = this.brassMat;

        // Euphonium
        const euphBody = MeshBuilder.CreateCylinder("euphBody", { diameterTop: 0.25, diameterBottom: 0.05, height: 0.6 }, scene);
        euphBody.position.set(0, 0.3, 0);
        const euphValves = MeshBuilder.CreateBox("euphValves", { width: 0.1, height: 0.15, depth: 0.08 }, scene);
        euphValves.position.set(0, 0.2, 0.06);
        this.baseEuphonium = Mesh.MergeMeshes([euphBody, euphValves], true) as Mesh;
        this.baseEuphonium.name = "baseEuphonium";
        this.baseEuphonium.material = this.brassMat;

        // Drum Major Mace
        const maceShaft = MeshBuilder.CreateCylinder("maceShaft", { diameter: 0.02, height: 0.8 }, scene);
        const maceHead = MeshBuilder.CreateSphere("maceHead", { diameter: 0.08 }, scene);
        maceHead.position.set(0, 0.4, 0);
        const maceTip = MeshBuilder.CreateSphere("maceTip", { diameter: 0.03 }, scene);
        maceTip.position.set(0, -0.4, 0);
        this.baseMace = Mesh.MergeMeshes([maceShaft, maceHead, maceTip], true) as Mesh;
        this.baseMace.name = "baseMace";
        this.maceMat = new StandardMaterial("maceMat", scene);
        this.maceMat.diffuseColor = new Color3(0.9, 0.9, 0.9);
        this.maceMat.specularColor = new Color3(1, 1, 1);
        this.baseMace.material = this.maceMat;

        // Glockenspiel (Bell Lyre)
        const glockPole = MeshBuilder.CreateCylinder("glockPole", { diameter: 0.04, height: 0.8 }, scene);
        glockPole.position.set(0, 0, 0);
        const glockBars = MeshBuilder.CreateBox("glockBars", { width: 0.4, height: 0.5, depth: 0.05 }, scene);
        glockBars.position.set(0, 0.2, 0.02);
        this.baseGlockenspiel = Mesh.MergeMeshes([glockPole, glockBars], true) as Mesh;
        this.baseGlockenspiel.name = "baseGlockenspiel";
        const glockMat = new StandardMaterial("glockMat", scene);
        glockMat.diffuseColor = new Color3(0.8, 0.8, 0.8); // Silver/Metallic
        glockMat.specularColor = new Color3(1, 1, 1);
        this.baseGlockenspiel.material = glockMat;
    }

    public createInstrument(type: InstrumentType, r: number, c: number, anchor: Mesh): void {
        let instr: InstancedMesh | Mesh | undefined;
        let baseInstr: Mesh | undefined;

        switch (type) {
            case "DrumMajor": baseInstr = this.baseMace; break;
            case "BassDrum": baseInstr = this.baseBassDrum; break;
            case "Cymbals": baseInstr = this.baseCymbals; break;
            case "SnareDrum": baseInstr = this.baseSnareDrum; break;
            case "TomTom": baseInstr = this.baseTomToms; break;
            case "Saxophone": baseInstr = this.baseSaxophone; break;
            case "Clarinet": baseInstr = this.baseClarinet; break;
            case "Trombone": baseInstr = this.baseTrombone; break;
            case "Sousaphone": baseInstr = this.baseSousaphone; break;
            case "Flute": baseInstr = this.baseFlute; break;
            case "Trumpet": baseInstr = this.baseTrumpet; break;
            case "Mellophone": baseInstr = this.baseMellophone; break;
            case "Euphonium": baseInstr = this.baseEuphonium; break;
            case "Glockenspiel": baseInstr = this.baseGlockenspiel; break;      
        }

        if (baseInstr) {
            const isInstrBase = !this.firstPlaced[type];
            this.firstPlaced[type] = true;
            instr = isInstrBase ? baseInstr : baseInstr.createInstance(`${type.toLowerCase()}_${r}_${c}`);
            instr.parent = anchor;

            switch (type) {
                case "DrumMajor":
                    instr.position.set(0.3, 1.6, 0.4);
                    instr.rotation.x = -Math.PI / 8;
                    instr.rotation.z = Math.PI / 8;
                    break;
                case "BassDrum":
                    instr.position.set(0, 1.1, 0.45);
                    instr.rotation.x = 0;
                    break;
                case "Cymbals":
                    instr.position.set(0, 1.25, 0.4);
                    instr.rotation.x = 0;
                    break;
                case "SnareDrum":
                    instr.position.set(0, 1.0, 0.35);
                    instr.rotation.x = 0;
                    break;
                case "TomTom":
                    instr.position.set(0, 1.0, 0.4);
                    instr.rotation.x = 0;
                    break;
                case "Saxophone":
                    instr.position.set(0, 1.45, 0.15);
                    instr.rotation.x = -Math.PI / 6;
                    break;
                case "Clarinet":
                    instr.position.set(0, 1.45, 0.15);
                    instr.rotation.x = -Math.PI / 4;
                    break;
                case "Trombone":
                    instr.position.set(0, 1.45, 0.15);
                    instr.rotation.x = Math.PI / 2;
                    break;
                case "Sousaphone":
                    instr.position.set(0, 1.25, 0.1);
                    instr.rotation.x = 0;
                    break;
                case "Flute":
                    instr.position.set(0, 1.45, 0.15);
                    instr.rotation.z = -Math.PI / 2;
                    instr.rotation.y = Math.PI / 8;
                    break;
                case "Trumpet":
                case "Mellophone":
                case "Euphonium":
                    instr.position.set(0, 1.45, 0.15);
                    instr.rotation.x = Math.PI / 2;
                    break;
                case "Glockenspiel":
                    instr.position.set(0, 1.35, 0.3); // Held higher like a lyre, slightly pushed out
                    instr.rotation.x = Math.PI / 8; // Tilted away from the player's face
                    break;
            }
        }
    }
}
