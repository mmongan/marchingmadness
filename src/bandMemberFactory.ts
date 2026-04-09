import { Scene, Mesh, MeshBuilder, StandardMaterial, Color3, Matrix, InstancedMesh, DynamicTexture } from "@babylonjs/core";
import { InstrumentType, InstrumentFactory } from "./instrumentFactory";

export type { InstrumentType };

export interface BandMemberData {
    legL: InstancedMesh | Mesh;
    legR: InstancedMesh | Mesh;
    anchor: Mesh;
    plume: InstancedMesh | Mesh; // for health coloring
    startZ: number;
    startX: number;
    row: number;
    col: number;
    health: number; // 0-100 percentage
}

export class BandMemberFactory {
    private scene: Scene;
    private instrumentFactory: InstrumentFactory;

    // Materials
    private skinMat!: StandardMaterial;
    private uniformMat!: StandardMaterial;
    private shirtMat!: StandardMaterial;
    private hatMat!: StandardMaterial;
    private plumeMat!: StandardMaterial;

    // Base meshes for instancing (realistic proportions)
    private baseHead!: Mesh;
    private baseNeck!: Mesh;
    private baseTorso!: Mesh;
    private baseUpperArmL!: Mesh;
    private baseUpperArmR!: Mesh;
    private baseForearmL!: Mesh;
    private baseForearmR!: Mesh;
    private baseHandL!: Mesh;
    private baseHandR!: Mesh;
    private baseUpperLegL!: Mesh;
    private baseUpperLegR!: Mesh;
    private baseLowerLegL!: Mesh;
    private baseLowerLegR!: Mesh;
    private baseFootL!: Mesh;
    private baseFootR!: Mesh;
    private baseHat!: Mesh;
    private basePlume!: Mesh;

    private firstBodyPlaced = false;

    constructor(scene: Scene) {
        this.scene = scene;
        this.initMaterialsAndMeshes();
        this.instrumentFactory = new InstrumentFactory(scene, this.hatMat);
    }

    private initMaterialsAndMeshes() {
        const scene = this.scene;

        // Materials
        this.skinMat = new StandardMaterial("skinMat", scene);
        this.skinMat.diffuseColor = new Color3(0.95, 0.82, 0.69); // Realistic skin tone

        this.uniformMat = new StandardMaterial("uniformMat", scene);
        this.uniformMat.diffuseColor = new Color3(0.1, 0.15, 0.6); // Dark blue uniform

        this.shirtMat = new StandardMaterial("shirtMat", scene);
        this.shirtMat.diffuseColor = new Color3(0.12, 0.18, 0.65); // Slightly lighter blue shirt

        this.hatMat = new StandardMaterial("hatMat", scene);
        this.hatMat.diffuseColor = new Color3(0.15, 0.15, 0.15); // Dark gray hat

        this.plumeMat = new StandardMaterial("plumeMat", scene);
        this.plumeMat.diffuseColor = new Color3(0.2, 0.7, 1.0); // Bright blue plume

        // === HEAD (realistic sphere, ~10cm diameter) ===
        this.baseHead = MeshBuilder.CreateSphere("baseHead", { diameter: 0.35, segments: 16 }, scene);
        this.baseHead.material = this.skinMat;

        // === NECK (small cylinder) ===
        this.baseNeck = MeshBuilder.CreateCylinder("baseNeck", { diameter: 0.15, height: 0.15 }, scene);
        this.baseNeck.material = this.skinMat;

        // === TORSO (realistic tapered shape) ===
        // Create a more realistic torso with proper proportions
        this.baseTorso = MeshBuilder.CreateBox("baseTorso", { width: 0.42, height: 0.7, depth: 0.25 }, scene);
        this.baseTorso.material = this.shirtMat;
        // Slightly taper towards top by baking scale
        const toTransform = Matrix.Scaling(1.0, 1.0, 1.0);
        this.baseTorso.bakeTransformIntoVertices(toTransform);

        // === UPPER ARMS (realistic cylinders, ~4cm diameter) ===
        this.baseUpperArmL = MeshBuilder.CreateCylinder("baseUpperArmL", { diameter: 0.14, height: 0.45 }, scene);
        this.baseUpperArmL.material = this.shirtMat;
        this.baseUpperArmL.rotation.z = Math.PI / 2.2;

        this.baseUpperArmR = MeshBuilder.CreateCylinder("baseUpperArmR", { diameter: 0.14, height: 0.45 }, scene);
        this.baseUpperArmR.material = this.shirtMat;
        this.baseUpperArmR.rotation.z = Math.PI / 2.2;

        // === FOREARMS (thinner cylinders, ~3.5cm diameter) ===
        this.baseForearmL = MeshBuilder.CreateCylinder("baseForearmL", { diameter: 0.12, height: 0.4 }, scene);
        this.baseForearmL.material = this.skinMat;
        this.baseForearmL.rotation.z = Math.PI / 2.2;

        this.baseForearmR = MeshBuilder.CreateCylinder("baseForearmR", { diameter: 0.12, height: 0.4 }, scene);
        this.baseForearmR.material = this.skinMat;
        this.baseForearmR.rotation.z = Math.PI / 2.2;

        // === HANDS (small boxes at end of arms) ===
        this.baseHandL = MeshBuilder.CreateBox("baseHandL", { width: 0.12, height: 0.15, depth: 0.08 }, scene);
        this.baseHandL.material = this.skinMat;

        this.baseHandR = MeshBuilder.CreateBox("baseHandR", { width: 0.12, height: 0.15, depth: 0.08 }, scene);
        this.baseHandR.material = this.skinMat;

        // === UPPER LEGS (realistic cylinders, ~5cm diameter) ===
        this.baseUpperLegL = MeshBuilder.CreateCylinder("baseUpperLegL", { diameter: 0.18, height: 0.55 }, scene);
        this.baseUpperLegL.material = this.uniformMat;

        this.baseUpperLegR = MeshBuilder.CreateCylinder("baseUpperLegR", { diameter: 0.18, height: 0.55 }, scene);
        this.baseUpperLegR.material = this.uniformMat;

        // === LOWER LEGS (slightly thinner, ~4cm diameter) ===
        this.baseLowerLegL = MeshBuilder.CreateCylinder("baseLowerLegL", { diameter: 0.15, height: 0.5 }, scene);
        this.baseLowerLegL.material = this.uniformMat;

        this.baseLowerLegR = MeshBuilder.CreateCylinder("baseLowerLegR", { diameter: 0.15, height: 0.5 }, scene);
        this.baseLowerLegR.material = this.uniformMat;

        // === FEET (boxes) ===
        this.baseFootL = MeshBuilder.CreateBox("baseFootL", { width: 0.18, height: 0.12, depth: 0.25 }, scene);
        this.baseFootL.material = this.skinMat;

        this.baseFootR = MeshBuilder.CreateBox("baseFootR", { width: 0.18, height: 0.12, depth: 0.25 }, scene);
        this.baseFootR.material = this.skinMat;

        // === HAT (flat-top cylinder) ===
        this.baseHat = MeshBuilder.CreateCylinder("baseHat", { diameter: 0.4, height: 0.15 }, scene);
        this.baseHat.material = this.hatMat;

        // === PLUME (thin cylinder for feathery look) ===
        this.basePlume = MeshBuilder.CreateCylinder("basePlume", { diameter: 0.08, height: 0.45, tessellation: 4 }, scene);
        this.basePlume.material = this.plumeMat;

        // Hide all base meshes (used for instancing)
        const baseMeshes = [
            this.baseHead, this.baseNeck, this.baseTorso,
            this.baseUpperArmL, this.baseUpperArmR,
            this.baseForearmL, this.baseForearmR,
            this.baseHandL, this.baseHandR,
            this.baseUpperLegL, this.baseUpperLegR,
            this.baseLowerLegL, this.baseLowerLegR,
            this.baseFootL, this.baseFootR,
            this.baseHat, this.basePlume
        ];
        baseMeshes.forEach(m => m.isVisible = false);
    }

    public createMember(r: number, c: number, type: InstrumentType, xPos: number, zPos: number): BandMemberData {
        const isBase = !this.firstBodyPlaced;
        this.firstBodyPlaced = true;

        // Root anchor positioned at ground level
        const anchor = MeshBuilder.CreateBox(`anchor_${r}_${c}`, { size: 0.01 }, this.scene);
        anchor.position.set(xPos, 0, zPos);
        anchor.rotation.y = Math.PI;
        anchor.isVisible = false;

        // === BUILD SKELETON HIERARCHY ===
        
        // Head positioned at ~1.7m (realistic standing height)
        const head = isBase ? this.baseHead : this.baseHead.createInstance(`head_${r}_${c}`);
        head.parent = anchor;
        head.position.set(0, 1.7, 0);

        // Neck below head
        const neck = isBase ? this.baseNeck : this.baseNeck.createInstance(`neck_${r}_${c}`);
        neck.parent = anchor;
        neck.position.set(0, 1.55, 0);

        // Torso at ~base 1.2m
        const torso = isBase ? this.baseTorso : this.baseTorso.createInstance(`torso_${r}_${c}`);
        torso.parent = anchor;
        torso.position.set(0, 1.2, 0);

        // === LEFT ARM ===
        const upperArmL = isBase ? this.baseUpperArmL : this.baseUpperArmL.createInstance(`upperArmL_${r}_${c}`);
        upperArmL.parent = anchor;
        upperArmL.position.set(-0.35, 1.45, 0);
        
        const forearmL = isBase ? this.baseForearmL : this.baseForearmL.createInstance(`forearmL_${r}_${c}`);
        forearmL.parent = anchor;
        forearmL.position.set(-0.52, 1.28, 0);
        
        const handL = isBase ? this.baseHandL : this.baseHandL.createInstance(`handL_${r}_${c}`);
        handL.parent = anchor;
        handL.position.set(-0.62, 1.15, 0);

        // === RIGHT ARM ===
        const upperArmR = isBase ? this.baseUpperArmR.createInstance(`upperArmR_${r}_${c}`) : this.baseUpperArmR.createInstance(`upperArmR_${r}_${c}`);
        upperArmR.parent = anchor;
        upperArmR.position.set(0.35, 1.45, 0);
        
        const forearmR = isBase ? this.baseForearmR.createInstance(`forearmR_${r}_${c}`) : this.baseForearmR.createInstance(`forearmR_${r}_${c}`);
        forearmR.parent = anchor;
        forearmR.position.set(0.52, 1.28, 0);
        
        const handR = isBase ? this.baseHandR.createInstance(`handR_${r}_${c}`) : this.baseHandR.createInstance(`handR_${r}_${c}`);
        handR.parent = anchor;
        handR.position.set(0.62, 1.15, 0);

        // === LEFT LEG (animated) ===
        const upperLegL = isBase ? this.baseUpperLegL : this.baseUpperLegL.createInstance(`upperLegL_${r}_${c}`);
        upperLegL.parent = anchor;
        upperLegL.position.set(-0.15, 0.8, 0);

        const lowerLegL = isBase ? this.baseLowerLegL : this.baseLowerLegL.createInstance(`lowerLegL_${r}_${c}`);
        lowerLegL.parent = anchor;
        lowerLegL.position.set(-0.15, 0.45, 0);

        const footL = isBase ? this.baseFootL : this.baseFootL.createInstance(`footL_${r}_${c}`);
        footL.parent = anchor;
        footL.position.set(-0.15, 0.08, 0.08);

        // === RIGHT LEG (animated) ===
        const upperLegR = isBase ? this.baseUpperLegR.createInstance(`upperLegR_${r}_${c}`) : this.baseUpperLegR.createInstance(`upperLegR_${r}_${c}`);
        upperLegR.parent = anchor;
        upperLegR.position.set(0.15, 0.8, 0);

        const lowerLegR = isBase ? this.baseLowerLegR.createInstance(`lowerLegR_${r}_${c}`) : this.baseLowerLegR.createInstance(`lowerLegR_${r}_${c}`);
        lowerLegR.parent = anchor;
        lowerLegR.position.set(0.15, 0.45, 0);

        const footR = isBase ? this.baseFootR.createInstance(`footR_${r}_${c}`) : this.baseFootR.createInstance(`footR_${r}_${c}`);
        footR.parent = anchor;
        footR.position.set(0.15, 0.08, 0.08);

        // === HAT & PLUME ===
        const hat = isBase ? this.baseHat : this.baseHat.createInstance(`hat_${r}_${c}`);
        hat.parent = anchor;
        hat.position.set(0, 1.85, 0);

        const plume = isBase ? this.basePlume : this.basePlume.createInstance(`plume_${r}_${c}`);
        plume.parent = anchor;
        plume.position.set(0, 2.2, 0);

        // Add instruments
        this.instrumentFactory.createInstrument(type, r, c, anchor);

        // === NAME LABEL ===
        const labelText = String.fromCharCode(65 + r) + (c + 1);
        const labelPlane = MeshBuilder.CreatePlane(`label_${r}_${c}`, { width: 0.6, height: 0.3 }, this.scene);
        labelPlane.parent = anchor;
        labelPlane.position.set(0, 2.2, 0);
        
        const labelTexture = new DynamicTexture(`labelTex_${r}_${c}`, { width: 128, height: 64 }, this.scene, false);
        labelTexture.hasAlpha = true;
        labelTexture.drawText(labelText, null, null, "bold 44px Arial", "white", "transparent", true);
        
        const labelMat = new StandardMaterial(`labelMat_${r}_${c}`, this.scene);
        labelMat.diffuseTexture = labelTexture;
        labelMat.emissiveColor = new Color3(1, 1, 1);
        labelMat.disableLighting = true;
        labelPlane.material = labelMat;
        labelPlane.billboardMode = Mesh.BILLBOARDMODE_Y;
        labelPlane.isVisible = false;

        // Use left upper leg for animations (its rotation drives the marching)
        return { legL: upperLegL, legR: upperLegR, anchor, plume, startZ: zPos, startX: xPos, row: r, col: c, health: 100 };
    }
}
