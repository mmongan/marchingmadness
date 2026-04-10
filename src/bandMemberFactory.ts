import { Scene, Mesh, MeshBuilder, StandardMaterial, Color3, Matrix, InstancedMesh, DynamicTexture } from "@babylonjs/core";
import { InstrumentType, InstrumentFactory } from "./instrumentFactory";
import { BodyParts } from "./marchingAnimationSystem";

export type { InstrumentType };

export interface BandMemberData {
    legL: InstancedMesh | Mesh;
    legR: InstancedMesh | Mesh;
    anchor: Mesh;
    plume: InstancedMesh | Mesh; // for health coloring
    bodyParts: BodyParts; // All animated body parts for realistic animation
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
    private baseElbowL!: Mesh;
    private baseElbowR!: Mesh;
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

        /**
         * ANTHROPOMETRIC DESIGN STANDARD (Vitruvian Proportions)
         * 
         * Based on proven human anatomy ratios used in animation/game development:
         * Total height: 1.70m (5'7" - typical marching band member)
         * Head: 1/8 height = 0.2125m diameter
         * Neck: ~0.08-0.10m width, 0.10m height
         * Torso (shoulder to hip): ~0.40m height
         * Upper arm: ~0.36m (shoulder to elbow)
         * Forearm: ~0.32m (elbow to wrist)
         * Hand: ~0.18m length
         * Upper leg: ~0.52m (hip to knee)
         * Lower leg: ~0.45m (knee to ankle)
         * Foot: ~0.15m length
         * 
         * SKELETAL LAYOUT (Y-coordinates from ground):
         * Ground: y=0
         * Foot: y=0.075 (bottom at 0, top at 0.15)
         * Ankle/Spat: y=0.20
         * Knee/Lower-leg midpoint: y=0.425
         * Hip/Upper-leg midpoint: y=0.78
         * Pelvis/Torso base: y=0.98 (bottom of torso)
         * Torso midpoint: y=1.18 (0.98 + 0.4/2)
         * Chest/Shoulder: y=1.38 (top of torso = hip + torso height)
         * Neck midpoint: y=1.43 (shoulder + 0.05)
         * Head midpoint: y=1.65 (top of neck + head radius)
         * Top of head: y=1.75 (1.65 + 0.1 radius)
         */

        // === HEAD (Vitruvian 1/8 of body length ≈ 0.2125m diameter) ===
        this.baseHead = MeshBuilder.CreateSphere("baseHead", { diameter: 0.21, segments: 16 }, scene);
        this.baseHead.material = this.skinMat;

        // === NECK (standard ~0.10m height, 0.09m diameter) ===
        this.baseNeck = MeshBuilder.CreateCylinder("baseNeck", { diameter: 0.09, height: 0.10 }, scene);
        this.baseNeck.material = this.skinMat;

        // === TORSO (0.40m height = shoulder to hip, ~0.38m width) ===
        // Slight trapezoid taper: wider at shoulders (0.38m), narrower at hips (0.34m)
        this.baseTorso = MeshBuilder.CreateBox("baseTorso", { width: 0.38, height: 0.40, depth: 0.22 }, scene);
        this.baseTorso.material = this.shirtMat;
        // Don't taper - keep uniform for simplicity, taper optional via scaling
        const toTransform = Matrix.Scaling(1.0, 1.0, 1.0);
        this.baseTorso.bakeTransformIntoVertices(toTransform);

        // === UPPER ARMS (standard ~0.36m height = shoulder to elbow, 0.13m diameter) ===
        this.baseUpperArmL = MeshBuilder.CreateCylinder("baseUpperArmL", { diameter: 0.13, height: 0.36 }, scene);
        this.baseUpperArmL.material = this.shirtMat;

        this.baseUpperArmR = MeshBuilder.CreateCylinder("baseUpperArmR", { diameter: 0.13, height: 0.36 }, scene);
        this.baseUpperArmR.material = this.shirtMat;

        // === FOREARMS (standard ~0.32m height = elbow to wrist, 0.11m diameter) ===
        this.baseForearmL = MeshBuilder.CreateCylinder("baseForearmL", { diameter: 0.11, height: 0.32 }, scene);
        this.baseForearmL.material = this.skinMat;

        this.baseForearmR = MeshBuilder.CreateCylinder("baseForearmR", { diameter: 0.11, height: 0.32 }, scene);
        this.baseForearmR.material = this.skinMat;

        // === ELBOWS (visible joint spheres, ~0.10m diameter) ===
        this.baseElbowL = MeshBuilder.CreateSphere("baseElbowL", { diameter: 0.10, segments: 8 }, scene);
        this.baseElbowL.material = this.skinMat;

        this.baseElbowR = MeshBuilder.CreateSphere("baseElbowR", { diameter: 0.10, segments: 8 }, scene);
        this.baseElbowR.material = this.skinMat;

        // === HANDS (box ~0.08m width, proportional length) ===
        this.baseHandL = MeshBuilder.CreateBox("baseHandL", { width: 0.08, height: 0.12, depth: 0.08 }, scene);
        this.baseHandL.material = this.skinMat;

        this.baseHandR = MeshBuilder.CreateBox("baseHandR", { width: 0.08, height: 0.12, depth: 0.08 }, scene);
        this.baseHandR.material = this.skinMat;

        // === UPPER LEGS (standard ~0.52m height = hip to knee, 0.17m diameter) ===
        this.baseUpperLegL = MeshBuilder.CreateCylinder("baseUpperLegL", { diameter: 0.17, height: 0.52 }, scene);
        this.baseUpperLegL.material = this.uniformMat;

        this.baseUpperLegR = MeshBuilder.CreateCylinder("baseUpperLegR", { diameter: 0.17, height: 0.52 }, scene);
        this.baseUpperLegR.material = this.uniformMat;

        // === LOWER LEGS (standard ~0.45m height = knee to ankle, 0.14m diameter) ===
        this.baseLowerLegL = MeshBuilder.CreateCylinder("baseLowerLegL", { diameter: 0.14, height: 0.45 }, scene);
        this.baseLowerLegL.material = this.uniformMat;

        this.baseLowerLegR = MeshBuilder.CreateCylinder("baseLowerLegR", { diameter: 0.14, height: 0.45 }, scene);
        this.baseLowerLegR.material = this.uniformMat;

        // === FEET (boxes ~0.15m long, 0.10m high, proportional) ===
        this.baseFootL = MeshBuilder.CreateBox("baseFootL", { width: 0.15, height: 0.10, depth: 0.25 }, scene);
        this.baseFootL.material = this.shoeMat;

        this.baseFootR = MeshBuilder.CreateBox("baseFootR", { width: 0.15, height: 0.10, depth: 0.25 }, scene);
        this.baseFootR.material = this.shoeMat;

        // === SPATS (white ankle covers, 0.08m height) ===
        this.baseSpatL = MeshBuilder.CreateCylinder("baseSpatL", { diameter: 0.16, height: 0.08 }, scene);
        this.baseSpatL.material = this.spatMat;

        this.baseSpatR = MeshBuilder.CreateCylinder("baseSpatR", { diameter: 0.16, height: 0.08 }, scene);
        this.baseSpatR.material = this.spatMat;

        // === HAT (proportional to new head size, 0.22m diameter, 0.12m height) ===
        this.baseHat = MeshBuilder.CreateCylinder("baseHat", { diameter: 0.22, height: 0.12 }, scene);
        this.baseHat.material = this.hatMat;

        // === PLUME (proportional ~0.35m height, 0.06m diameter) ===
        this.basePlume = MeshBuilder.CreateCylinder("basePlume", { diameter: 0.06, height: 0.35, tessellation: 4 }, scene);
        this.basePlume.material = this.plumeMat;

        // Hide all base meshes (used for instancing)
        const baseMeshes = [
            this.baseHead, this.baseNeck, this.baseTorso,
            this.baseUpperArmL, this.baseUpperArmR,
            this.baseForearmL, this.baseForearmR,
            this.baseElbowL, this.baseElbowR,
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

        /**
         * STANDARD SKELETAL HIERARCHY
         * All positions calculated for tight anatomical connections
         * 
         * Y-coordinates (from ground):
         * - Upper leg center: 0.80  (height 0.52, spans 0.54 to 1.06)
         * - Torso center: 1.20 (height 0.40, spans 1.00 to 1.40)
         * - Neck center: 1.50 (height 0.10, spans 1.45 to 1.55)
         * - Head center: 1.665 (diameter 0.21, spans 1.61 to 1.72)
         * - Shoulder/Upper arm: 1.38 (at torso top)
         * - Total height: ~1.77m (appropriate for band member)
         */

        // === BUILD SKELETON HIERARCHY ===
        
        // Torso (center 1.20, height 0.40, hip to shoulders)
        const torso = isBase ? this.baseTorso : this.baseTorso.createInstance(`torso_${r}_${c}`);
        torso.parent = anchor;
        torso.position.set(0, 1.20, 0);

        // Neck (center 1.50, height 0.10, positioned to sit on top of torso)
        const neck = isBase ? this.baseNeck : this.baseNeck.createInstance(`neck_${r}_${c}`);
        neck.parent = anchor;
        neck.position.set(0, 1.50, 0);

        // Head (center 1.665, diameter 0.21, positioned to sit on top of neck)
        const head = isBase ? this.baseHead : this.baseHead.createInstance(`head_${r}_${c}`);
        head.parent = anchor;
        head.position.set(0, 1.665, 0);

        // === LEFT ARM (at shoulder level 1.38) ===
        // Upper arm at shoulder (height 0.36, spans 1.20 to 1.56)
        const upperArmL = isBase ? this.baseUpperArmL : this.baseUpperArmL.createInstance(`upperArmL_${r}_${c}`);
        upperArmL.parent = anchor;
        upperArmL.position.set(-0.21, 1.38, 0);  // Left shoulder, at torso top
        
        // Elbow sphere (visual joint, ~0.10m diameter, positioned at elbow)
        const elbowL = isBase ? this.baseElbowL : this.baseElbowL.createInstance(`elbowL_${r}_${c}`);
        elbowL.parent = upperArmL;
        elbowL.position.set(0, -0.18, 0.04);  // At arm midpoint
        
        // Forearm (child of upper arm, rotates at elbow on X axis)
        const forearmL = isBase ? this.baseForearmL : this.baseForearmL.createInstance(`forearmL_${r}_${c}`);
        forearmL.parent = upperArmL;
        forearmL.position.set(0, -0.34, 0.04);  // Positioned below elbow
        
        // Hand (child of forearm, positioned at wrist)
        const handL = isBase ? this.baseHandL : this.baseHandL.createInstance(`handL_${r}_${c}`);
        handL.parent = forearmL;
        handL.position.set(0, -0.16, 0.04);  // At wrist (half of 0.32m forearm)

        // === RIGHT ARM (at shoulder level 1.38) ===
        // Upper arm at shoulder (height 0.36, spans 1.20 to 1.56)
        const upperArmR = isBase ? this.baseUpperArmR : this.baseUpperArmR.createInstance(`upperArmR_${r}_${c}`);
        upperArmR.parent = anchor;
        upperArmR.position.set(0.21, 1.38, 0);  // Right shoulder, at torso top
        
        // Elbow sphere (visual joint, ~0.10m diameter, positioned at elbow)
        const elbowR = isBase ? this.baseElbowR : this.baseElbowR.createInstance(`elbowR_${r}_${c}`);
        elbowR.parent = upperArmR;
        elbowR.position.set(0, -0.18, 0.04);  // At arm midpoint
        
        // Forearm (child of upper arm, rotates at elbow on X axis)
        const forearmR = isBase ? this.baseForearmR : this.baseForearmR.createInstance(`forearmR_${r}_${c}`);
        forearmR.parent = upperArmR;
        forearmR.position.set(0, -0.34, 0.04);  // Positioned below elbow
        
        // Hand (child of forearm, positioned at wrist)
        const handR = isBase ? this.baseHandR : this.baseHandR.createInstance(`handR_${r}_${c}`);
        handR.parent = forearmR;
        handR.position.set(0, -0.16, 0.04);  // At wrist (half of 0.32m forearm)

        // === LEFT LEG (animated) ===
        const upperLegL = isBase ? this.baseUpperLegL : this.baseUpperLegL.createInstance(`upperLegL_${r}_${c}`);
        upperLegL.parent = anchor;
        upperLegL.position.set(-0.14, 0.80, 0);

        // Lower leg is CHILD of upper leg (rotates with it)
        const lowerLegL = isBase ? this.baseLowerLegL : this.baseLowerLegL.createInstance(`lowerLegL_${r}_${c}`);
        lowerLegL.parent = upperLegL;
        lowerLegL.position.set(0, -0.485, 0);  // Positioned from upper leg center (0.54 total offset)

        // Foot (child of lower leg, positioned at ankle)
        const footL = isBase ? this.baseFootL : this.baseFootL.createInstance(`footL_${r}_${c}`);
        footL.parent = lowerLegL;
        footL.position.set(0, -0.225, 0.075);  // At ankle, slight lift to prevent clipping

        // Spat (white ankle cover, child of lower leg at ankle)
        const spatL = isBase ? this.baseSpatL : this.baseSpatL.createInstance(`spatL_${r}_${c}`);
        spatL.parent = lowerLegL;
        spatL.position.set(0, -0.18, 0);  // Just above ankle

        // === RIGHT LEG (animated) ===
        const upperLegR = isBase ? this.baseUpperLegR : this.baseUpperLegR.createInstance(`upperLegR_${r}_${c}`);
        upperLegR.parent = anchor;
        upperLegR.position.set(0.14, 0.80, 0);

        // Lower leg is CHILD of upper leg (rotates with it)
        const lowerLegR = isBase ? this.baseLowerLegR : this.baseLowerLegR.createInstance(`lowerLegR_${r}_${c}`);
        lowerLegR.parent = upperLegR;
        lowerLegR.position.set(0, -0.485, 0);  // Positioned from upper leg center (0.54 total offset)

        // Foot (child of lower leg, positioned at ankle)
        const footR = isBase ? this.baseFootR : this.baseFootR.createInstance(`footR_${r}_${c}`);
        footR.parent = lowerLegR;
        footR.position.set(0, -0.225, 0.075);  // At ankle, slight lift to prevent clipping

        // Spat (white ankle cover, child of lower leg at ankle)
        const spatR = isBase ? this.baseSpatR : this.baseSpatR.createInstance(`spatR_${r}_${c}`);
        spatR.parent = lowerLegR;
        spatR.position.set(0, -0.18, 0);  // Just above ankle

        // === HAT & PLUME ===
        const hat = isBase ? this.baseHat : this.baseHat.createInstance(`hat_${r}_${c}`);
        hat.parent = anchor;
        hat.position.set(0, 1.665, 0);  // Center on head

        const plume = isBase ? this.basePlume : this.basePlume.createInstance(`plume_${r}_${c}`);
        plume.parent = anchor;
        plume.position.set(0, 1.88, 0);  // Above head

        // Add instruments
        this.instrumentFactory.createInstrument(type, r, c, anchor);

        // === NAME LABEL ===
        const labelText = String.fromCharCode(65 + r) + (c + 1);
        const labelPlane = MeshBuilder.CreatePlane(`label_${r}_${c}`, { width: 0.6, height: 0.3 }, this.scene);
        labelPlane.parent = anchor;
        labelPlane.position.set(0, 1.88, 0);
        
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
        return {
            legL: upperLegL,
            legR: upperLegR,
            anchor,
            plume,
            bodyParts: {
                head,
                headBaseY: 1.665,
                neck,
                neckBaseY: 1.50,
                torso,
                torsoBaseY: 1.20,
                upperArmL,
                upperArmR,
                elbowL,
                elbowR,
                forearmL,
                forearmR,
                handL,
                handR,
                upperLegL,
                upperLegR,
                lowerLegL,
                lowerLegR,
                footL,
                footR,
            },
            startZ: zPos,
            startX: xPos,
            row: r,
            col: c,
            health: 100,
        };
    }
}
