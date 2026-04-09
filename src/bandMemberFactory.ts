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
    private shoeMat!: StandardMaterial;
    private spatMat!: StandardMaterial;

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
    private baseSpatL!: Mesh;
    private baseSpatR!: Mesh;

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

        this.shoeMat = new StandardMaterial("shoeMat", scene);
        this.shoeMat.diffuseColor = new Color3(0.05, 0.05, 0.05); // Black shoes

        this.spatMat = new StandardMaterial("spatMat", scene);
        this.spatMat.diffuseColor = new Color3(0.95, 0.95, 0.95); // White spats

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
        // Positioned UP for marching pose (not extended horizontally)
        this.baseUpperArmL = MeshBuilder.CreateCylinder("baseUpperArmL", { diameter: 0.14, height: 0.5 }, scene);
        this.baseUpperArmL.material = this.shirtMat;
        this.baseUpperArmL.rotation.z = Math.PI / 6;  // ~30° forward pump (more vertical than before)

        this.baseUpperArmR = MeshBuilder.CreateCylinder("baseUpperArmR", { diameter: 0.14, height: 0.5 }, scene);
        this.baseUpperArmR.material = this.shirtMat;
        this.baseUpperArmR.rotation.z = Math.PI / 6;

        // === FOREARMS (thinner cylinders, ~3.5cm diameter) ===
        // Bent upward for dynamic marching position
        this.baseForearmL = MeshBuilder.CreateCylinder("baseForearmL", { diameter: 0.12, height: 0.45 }, scene);
        this.baseForearmL.material = this.skinMat;
        this.baseForearmL.rotation.z = -Math.PI / 4;  // ~-45° bent upward

        this.baseForearmR = MeshBuilder.CreateCylinder("baseForearmR", { diameter: 0.12, height: 0.45 }, scene);
        this.baseForearmR.material = this.skinMat;
        this.baseForearmR.rotation.z = -Math.PI / 4;

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

        // === FEET (boxes - black shoes) ===
        this.baseFootL = MeshBuilder.CreateBox("baseFootL", { width: 0.18, height: 0.12, depth: 0.25 }, scene);
        this.baseFootL.material = this.shoeMat;

        this.baseFootR = MeshBuilder.CreateBox("baseFootR", { width: 0.18, height: 0.12, depth: 0.25 }, scene);
        this.baseFootR.material = this.shoeMat;

        // === SPATS (white ankle covers) ===
        this.baseSpatL = MeshBuilder.CreateCylinder("baseSpatL", { diameter: 0.17, height: 0.1 }, scene);
        this.baseSpatL.material = this.spatMat;

        this.baseSpatR = MeshBuilder.CreateCylinder("baseSpatR", { diameter: 0.17, height: 0.1 }, scene);
        this.baseSpatR.material = this.spatMat;

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
        baseMeshes.push(this.baseSpatL, this.baseSpatR);
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
        // Upper arm at shoulder, raised for marching pump
        const upperArmL = isBase ? this.baseUpperArmL : this.baseUpperArmL.createInstance(`upperArmL_${r}_${c}`);
        upperArmL.parent = anchor;
        upperArmL.position.set(-0.25, 1.5, 0.1);  // Shoulder, slightly forward for raised posture
        
        // Forearm bent upward from elbow
        const forearmL = isBase ? this.baseForearmL : this.baseForearmL.createInstance(`forearmL_${r}_${c}`);
        forearmL.parent = anchor;
        forearmL.position.set(-0.32, 1.85, 0.22);  // End of upper arm + offset for upward bend
        
        // Hand at end of forearm
        const handL = isBase ? this.baseHandL : this.baseHandL.createInstance(`handL_${r}_${c}`);
        handL.parent = anchor;
        handL.position.set(-0.38, 2.05, 0.32);  // End of forearm extension

        // === RIGHT ARM ===
        // Upper arm at shoulder, raised for marching pump
        const upperArmR = isBase ? this.baseUpperArmR.createInstance(`upperArmR_${r}_${c}`) : this.baseUpperArmR.createInstance(`upperArmR_${r}_${c}`);
        upperArmR.parent = anchor;
        upperArmR.position.set(0.25, 1.5, 0.1);  // Shoulder, slightly forward for raised posture
        
        // Forearm bent upward from elbow
        const forearmR = isBase ? this.baseForearmR.createInstance(`forearmR_${r}_${c}`) : this.baseForearmR.createInstance(`forearmR_${r}_${c}`);
        forearmR.parent = anchor;
        forearmR.position.set(0.32, 1.85, 0.22);  // End of upper arm + offset for upward bend
        
        // Hand at end of forearm
        const handR = isBase ? this.baseHandR.createInstance(`handR_${r}_${c}`) : this.baseHandR.createInstance(`handR_${r}_${c}`);
        handR.parent = anchor;
        handR.position.set(0.38, 2.05, 0.32);  // End of forearm extension

        // === LEFT LEG (animated) ===
        const upperLegL = isBase ? this.baseUpperLegL : this.baseUpperLegL.createInstance(`upperLegL_${r}_${c}`);
        upperLegL.parent = anchor;
        upperLegL.position.set(-0.15, 0.8, 0);

        // Lower leg is CHILD of upper leg so it rotates with it
        const lowerLegL = isBase ? this.baseLowerLegL : this.baseLowerLegL.createInstance(`lowerLegL_${r}_${c}`);
        lowerLegL.parent = upperLegL;  // Now a child of upper leg!
        lowerLegL.position.set(0, -0.525, 0);  // Offset from upper leg center

        // Foot is child of lower leg, positioned higher to prevent ground sinking
        const footL = isBase ? this.baseFootL : this.baseFootL.createInstance(`footL_${r}_${c}`);
        footL.parent = lowerLegL;  // Child of lower leg
        footL.position.set(0, -0.24, 0.08);  // Moved up from -0.31 to prevent ground clipping

        // Spat (white ankle cover) on left leg
        const spatL = isBase ? this.baseSpatL : this.baseSpatL.createInstance(`spatL_${r}_${c}`);
        spatL.parent = lowerLegL;  // Child of lower leg
        spatL.position.set(0, -0.18, 0);  // Just above the foot

        // === RIGHT LEG (animated) ===
        const upperLegR = isBase ? this.baseUpperLegR.createInstance(`upperLegR_${r}_${c}`) : this.baseUpperLegR.createInstance(`upperLegR_${r}_${c}`);
        upperLegR.parent = anchor;
        upperLegR.position.set(0.15, 0.8, 0);

        // Lower leg is CHILD of upper leg so it rotates with it
        const lowerLegR = isBase ? this.baseLowerLegR.createInstance(`lowerLegR_${r}_${c}`) : this.baseLowerLegR.createInstance(`lowerLegR_${r}_${c}`);
        lowerLegR.parent = upperLegR;  // Now a child of upper leg!
        lowerLegR.position.set(0, -0.525, 0);  // Offset from upper leg center

        // Foot is child of lower leg, positioned higher to prevent ground sinking
        const footR = isBase ? this.baseFootR.createInstance(`footR_${r}_${c}`) : this.baseFootR.createInstance(`footR_${r}_${c}`);
        footR.parent = lowerLegR;  // Child of lower leg
        footR.position.set(0, -0.24, 0.08);  // Moved up from -0.31 to prevent ground clipping

        // Spat (white ankle cover) on right leg
        const spatR = isBase ? this.baseSpatR.createInstance(`spatR_${r}_${c}`) : this.baseSpatR.createInstance(`spatR_${r}_${c}`);
        spatR.parent = lowerLegR;  // Child of lower leg
        spatR.position.set(0, -0.18, 0);  // Just above the foot

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
