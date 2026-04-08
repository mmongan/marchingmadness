import { Scene, Mesh, MeshBuilder, StandardMaterial, Color3, Matrix, Vector3, InstancedMesh } from "@babylonjs/core";

export type InstrumentType = 
    | "DrumMajor" | "Flute" | "Clarinet" | "Saxophone" 
    | "TomTom" | "SnareDrum" | "BassDrum" | "Cymbals" 
    | "Trumpet" | "Mellophone" | "Euphonium" | "Trombone" | "Sousaphone" | "Glockenspiel";

export interface BandMemberData {
    legL: InstancedMesh | Mesh;
    legR: InstancedMesh | Mesh;
    anchor: Mesh;
    startZ: number;
}

export class BandMemberFactory {
    private scene: Scene;

    // Materials
    private skinMat!: StandardMaterial;
    private uniformMat!: StandardMaterial;
    private pantsMat!: StandardMaterial;
    private hatMat!: StandardMaterial;
    private plumeMat!: StandardMaterial;
    private brassMat!: StandardMaterial;
    private clarinetMat!: StandardMaterial;
    private fluteMat!: StandardMaterial;
    private maceMat!: StandardMaterial;

    // Body parts
    private baseTorso!: Mesh;
    private baseLeg!: Mesh;
    private baseHead!: Mesh;
    private baseHat!: Mesh;
    private basePlume!: Mesh;
    private baseArm!: Mesh;

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

    private firstPlaced: Record<InstrumentType, boolean>;
    private firstBodyPlaced = false;

    constructor(scene: Scene) {
        this.scene = scene;
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

        this.skinMat = new StandardMaterial("skinMat", scene);
        this.skinMat.diffuseColor = new Color3(0.9, 0.75, 0.6);

        this.uniformMat = new StandardMaterial("uniformMat", scene);
        this.uniformMat.diffuseColor = new Color3(0.8, 0.1, 0.1);

        this.pantsMat = new StandardMaterial("pantsMat", scene);
        this.pantsMat.diffuseColor = new Color3(0.1, 0.1, 0.3);

        this.hatMat = new StandardMaterial("hatMat", scene);
        this.hatMat.diffuseColor = new Color3(0.95, 0.95, 0.95);

        this.plumeMat = new StandardMaterial("plumeMat", scene);
        this.plumeMat.diffuseColor = new Color3(0.1, 0.6, 0.9);

        this.brassMat = new StandardMaterial("brassMat", scene);
        this.brassMat.diffuseColor = new Color3(0.85, 0.7, 0.2);

        this.baseTorso = MeshBuilder.CreateBox("baseTorso", { width: 0.45, height: 0.6, depth: 0.3 }, scene);
        this.baseTorso.material = this.uniformMat;

        this.baseLeg = MeshBuilder.CreateBox("baseLeg", { width: 0.18, height: 0.8, depth: 0.18 }, scene);
        this.baseLeg.bakeTransformIntoVertices(Matrix.Translation(0, -0.4, 0));
        this.baseLeg.material = this.pantsMat;

        this.baseHead = MeshBuilder.CreateSphere("baseHead", { diameter: 0.3 }, scene);
        this.baseHead.material = this.skinMat;

        this.baseHat = MeshBuilder.CreateCylinder("baseHat", { diameter: 0.35, height: 0.2 }, scene);
        this.baseHat.material = this.hatMat;

        this.basePlume = MeshBuilder.CreateCylinder("basePlume", { diameter: 0.1, height: 0.3, tessellation: 3 }, scene);
        this.basePlume.material = this.plumeMat;

        this.baseArm = MeshBuilder.CreateCylinder("baseArm", { diameter: 0.12, height: 0.5 }, scene);
        this.baseArm.material = this.uniformMat;

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
        cymbalL.position.set(-0.15, 0, 0);
        cymbalL.rotation.z = Math.PI / 2;
        cymbalL.rotation.y = Math.PI / 8;
        const cymbalR = MeshBuilder.CreateCylinder("cymbalR", { diameter: 0.5, height: 0.01 }, scene);
        cymbalR.position.set(0.15, 0, 0);
        cymbalR.rotation.z = Math.PI / 2;
        cymbalR.rotation.y = -Math.PI / 8;
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
        const sousaPath: Vector3[] = [];
        
        // Add smooth curve for mouthpiece extension reaching the mouth (mouth local pos: 0, 0.2, 0.05)
        const mouthPos = new Vector3(0, 0.2, 0.05);
        const controlPos = new Vector3(-0.35, 0.2, 0.0);
        const spiralStart = new Vector3(-0.4, -0.4, 0.0);
        
        for (let i = 0; i < 20; i++) {
            const t = i / 20;
            const invT = 1 - t;
            const x = invT * invT * mouthPos.x + 2 * invT * t * controlPos.x + t * t * spiralStart.x;
            const y = invT * invT * mouthPos.y + 2 * invT * t * controlPos.y + t * t * spiralStart.y;
            const z = invT * invT * mouthPos.z + 2 * invT * t * controlPos.z + t * t * spiralStart.z;
            sousaPath.push(new Vector3(x, y, z));
        }

        for (let i = 0; i <= 60; i++) {
            const t = i / 60;
            const angle = t * Math.PI * 1.5;
            const radius = 0.4 + 0.1 * t;
            const x = -radius * Math.cos(angle);
            const y = -0.4 + t * 1.2;
            const z = -radius * Math.sin(angle);
            sousaPath.push(new Vector3(x, y, z));
        }
        const lastP = sousaPath[sousaPath.length - 1];
        const sousaBody = MeshBuilder.CreateTube("sousaBody", { path: sousaPath, radius: 0.08 }, scene);
        const sousaBell = MeshBuilder.CreateCylinder("sousaBell", { diameterTop: 0.8, diameterBottom: 0.1, height: 0.6 }, scene);
        sousaBell.position.set(lastP.x, lastP.y, lastP.z + 0.3);
        sousaBell.rotation.x = Math.PI / 2;
        this.baseSousaphone = Mesh.MergeMeshes([sousaBody, sousaBell], true) as Mesh;
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
        this.baseTrumpet.material = this.brassMat;

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

        // Glockenspiel
        const glockHolder = MeshBuilder.CreateBox("glockHolder", { width: 0.05, height: 0.3, depth: 0.2 }, scene);
        glockHolder.position.set(0, -0.15, 0); 
        const glockBars = MeshBuilder.CreateBox("glockBars", { width: 0.5, height: 0.05, depth: 0.2 }, scene);
        glockBars.position.set(0, 0, 0);
        this.baseGlockenspiel = Mesh.MergeMeshes([glockHolder, glockBars], true) as Mesh;
        this.baseGlockenspiel.name = "baseGlockenspiel";
        const glockMat = new StandardMaterial("glockMat", scene);
        glockMat.diffuseColor = new Color3(0.8, 0.8, 0.8); // Silver/Metallic
        glockMat.specularColor = new Color3(1, 1, 1);
        this.baseGlockenspiel.material = glockMat;
    }

    public createMember(r: number, c: number, type: InstrumentType, xPos: number, zPos: number): BandMemberData {
        const isBase = !this.firstBodyPlaced;
        this.firstBodyPlaced = true;

        const isDrum = ["BassDrum", "SnareDrum", "TomTom", "Cymbals"].includes(type);

        const anchor = MeshBuilder.CreateBox(`anchor_${r}_${c}`, { size: 0.01 }, this.scene);
        anchor.position.set(xPos, 0, zPos);
        anchor.rotation.y = Math.PI;
        anchor.isVisible = false;

        const torso = isBase ? this.baseTorso : this.baseTorso.createInstance(`torso_${r}_${c}`);
        torso.parent = anchor;
        torso.position.set(0, 1.1, 0);

        const legL = isBase ? this.baseLeg : this.baseLeg.createInstance(`legL_${r}_${c}`);
        legL.parent = anchor;
        legL.position.set(-0.12, 0.8, 0);

        const legR = isBase ? this.baseLeg.clone(`legR_${r}_${c}`) : this.baseLeg.createInstance(`legR_${r}_${c}`);
        legR.parent = anchor;
        legR.position.set(0.12, 0.8, 0);

        const head = isBase ? this.baseHead : this.baseHead.createInstance(`head_${r}_${c}`);
        head.parent = anchor;
        head.position.set(0, 1.55, 0);

        const hat = isBase ? this.baseHat : this.baseHat.createInstance(`hat_${r}_${c}`);
        hat.parent = anchor;
        hat.position.set(0, 1.8, 0);

        const plume = isBase ? this.basePlume : this.basePlume.createInstance(`plume_${r}_${c}`);
        plume.parent = anchor;
        plume.position.set(0, 2.0, 0);

        const armL = isBase ? this.baseArm : this.baseArm.createInstance(`armL_${r}_${c}`);
        armL.parent = anchor;
        armL.position.set(-0.3, 1.25, 0.15);
        armL.rotation.x = Math.PI / 4;
        armL.rotation.y = isDrum ? Math.PI / 4 : Math.PI / 8;

        const armR = isBase ? this.baseArm.clone(`armR_${r}_${c}`) : this.baseArm.createInstance(`armR_${r}_${c}`);
        armR.parent = anchor;
        armR.position.set(0.3, 1.25, 0.15);
        armR.rotation.x = Math.PI / 4; 
        armR.rotation.y = isDrum ? -Math.PI / 4 : -Math.PI / 8;

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
                    // Note: Ensure the right arm is held appropriately up for baton as user requested removed previously,
                    // but we must only change arm if the issue with drum major persists. 
                    // Actually, the previous step removed the drum major specific arm hold to fall inline with other players, so we leave it.
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
                    instr.position.set(0, 1.1, 0.35); // Held in front mechanically (harness)
                    instr.rotation.x = Math.PI / 16; // Slight tilt forward
                    break;
            }
        }

        return { legL, legR, anchor, startZ: zPos };
    }
}
