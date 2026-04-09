import { Scene, Mesh, MeshBuilder, StandardMaterial, Color3, Matrix, InstancedMesh, DynamicTexture } from "@babylonjs/core";
import { InstrumentType, InstrumentFactory } from "./instrumentFactory";

export type { InstrumentType };

export interface BandMemberData {
    legL: InstancedMesh | Mesh;
    legR: InstancedMesh | Mesh;
    anchor: Mesh;
    startZ: number;
    startX: number;
    row: number;
    col: number;
}

export class BandMemberFactory {
    private scene: Scene;
    private instrumentFactory: InstrumentFactory;

    // Materials
    private skinMat!: StandardMaterial;
    private uniformMat!: StandardMaterial;
    private pantsMat!: StandardMaterial;
    private hatMat!: StandardMaterial;
    private plumeMat!: StandardMaterial;

    // Body parts
    private baseTorso!: Mesh;
    private baseLeg!: Mesh;
    private baseHead!: Mesh;
    private baseHat!: Mesh;
    private basePlume!: Mesh;
    private baseArm!: Mesh;

    private firstBodyPlaced = false;

    constructor(scene: Scene) {
        this.scene = scene;
        this.initMaterialsAndMeshes();
        this.instrumentFactory = new InstrumentFactory(scene, this.hatMat);
    }

    private initMaterialsAndMeshes() {
        const scene = this.scene;

        this.skinMat = new StandardMaterial("skinMat", scene);
        this.skinMat.diffuseColor = new Color3(0.9, 0.75, 0.6);

        this.uniformMat = new StandardMaterial("uniformMat", scene);
        this.uniformMat.diffuseColor = new Color3(0.1, 0.2, 0.8); // Changed to blue

        this.pantsMat = new StandardMaterial("pantsMat", scene);
        this.pantsMat.diffuseColor = new Color3(0.1, 0.2, 0.8); // Changed to same blue as uniform

        this.hatMat = new StandardMaterial("hatMat", scene);
        this.hatMat.diffuseColor = new Color3(0.95, 0.95, 0.95);

        this.plumeMat = new StandardMaterial("plumeMat", scene);
        this.plumeMat.diffuseColor = new Color3(0.1, 0.6, 0.9);

        this.baseTorso = MeshBuilder.CreateBox("baseTorso", { width: 0.45, height: 0.6, depth: 0.3 }, scene);
        this.baseTorso.material = this.uniformMat;

        this.baseLeg = MeshBuilder.CreateBox("baseLeg", { width: 0.18, height: 1.0, depth: 0.18 }, scene);
        this.baseLeg.bakeTransformIntoVertices(Matrix.Translation(0, -0.5, 0)); 
        this.baseLeg.material = this.pantsMat;

        this.baseHead = MeshBuilder.CreateSphere("baseHead", { diameter: 0.3 }, scene);
        this.baseHead.material = this.skinMat;

        this.baseHat = MeshBuilder.CreateCylinder("baseHat", { diameter: 0.35, height: 0.2 }, scene);
        this.baseHat.material = this.hatMat;

        this.basePlume = MeshBuilder.CreateCylinder("basePlume", { diameter: 0.1, height: 0.3, tessellation: 3 }, scene);
        this.basePlume.material = this.plumeMat;

        this.baseArm = MeshBuilder.CreateBox("baseArm", { width: 0.12, height: 0.5, depth: 0.12 }, scene);
        this.baseArm.material = this.uniformMat;

        // Hide all base meshes (they're only used to create instances)
        this.baseTorso.isVisible = false;
        this.baseLeg.isVisible = false;
        this.baseHead.isVisible = false;
        this.baseHat.isVisible = false;
        this.basePlume.isVisible = false;
        this.baseArm.isVisible = false;
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
        legL.position.set(-0.12, 1.0, 0);

        const legR = isBase ? this.baseLeg.createInstance(`legR_${r}_${c}`) : this.baseLeg.createInstance(`legR_${r}_${c}`);
        legR.parent = anchor;
        legR.position.set(0.12, 1.0, 0);

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

        const armR = isBase ? this.baseArm.createInstance(`armR_${r}_${c}`) : this.baseArm.createInstance(`armR_${r}_${c}`);
        armR.parent = anchor;
        armR.position.set(0.3, 1.25, 0.15);
        armR.rotation.x = Math.PI / 4;
        armR.rotation.y = isDrum ? -Math.PI / 4 : -Math.PI / 8;

        this.instrumentFactory.createInstrument(type, r, c, anchor);

        const labelText = String.fromCharCode(65 + r) + (c + 1); // e.g. A1   
        const labelPlane = MeshBuilder.CreatePlane(`label_${r}_${c}`, { width: 0.6, height: 0.3 }, this.scene);
        labelPlane.parent = anchor;
        labelPlane.position.set(0, 2.1, 0); // Hovering above the head
        
        const labelTexture = new DynamicTexture(`labelTex_${r}_${c}`, { width: 128, height: 64 }, this.scene, false);
        labelTexture.hasAlpha = true;
        labelTexture.drawText(labelText, null, null, "bold 44px Arial", "white", "transparent", true);
        
        const labelMat = new StandardMaterial(`labelMat_${r}_${c}`, this.scene);
        labelMat.diffuseTexture = labelTexture;
        labelMat.emissiveColor = new Color3(1, 1, 1);
        labelMat.disableLighting = true;
        labelPlane.material = labelMat;
        labelPlane.billboardMode = Mesh.BILLBOARDMODE_Y;

        return { legL, legR, anchor, startZ: zPos, startX: xPos, row: r, col: c };
    }
}
