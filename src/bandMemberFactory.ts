import { Scene, Mesh, MeshBuilder, StandardMaterial, Color3, InstancedMesh, DynamicTexture } from "@babylonjs/core";
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
    private baseHandL!: Mesh;
    private baseHandR!: Mesh;
    private baseUpperLegL!: Mesh;
    private baseUpperLegR!: Mesh;
    private basePelvis!: Mesh;
    private baseLowerLegL!: Mesh;
    private baseLowerLegR!: Mesh;
    private baseFootL!: Mesh;
    private baseFootR!: Mesh;
    private baseHat!: Mesh;
    private basePlume!: Mesh;
    private baseSpatL!: Mesh;
    private baseSpatR!: Mesh;
    
    // Sleeves (covers for forearms)
    private baseSleeveL!: Mesh;
    private baseSleeveR!: Mesh;

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
         * SKELETON HIERARCHY (Clean bone chains, no joint spheres):
         * 
         * SPINE:      Anchor → Torso → Neck → Head
         * LEFT ARM:   Torso → UpperArm → Forearm → Hand  
         * RIGHT ARM:  Torso → UpperArm → Forearm → Hand
         * PELVIS:     Torso → Pelvis
         * LEFT LEG:   Pelvis → UpperLeg → LowerLeg → Foot
         * RIGHT LEG:  Pelvis → UpperLeg → LowerLeg → Foot
         * 
         * BONE POSITIONING (Y-coordinates, end-to-end connection):
         * 
         * Feet bottom: y=0.05
         * Foot center: y=0.10 (height 0.10, extends 0.05 to 0.15)
         * LowerLeg center: y=0.405 (height 0.45, extends 0.18 to 0.63)
         * UpperLeg center: y=0.86 (height 0.52, extends 0.60 to 1.12)
         * Pelvis center: y=1.22 (height 0.20, extends 1.12 to 1.32)
         * Torso center: y=1.52 (height 0.40, extends 1.32 to 1.72)
         * Neck center: y=1.77 (height 0.10, extends 1.72 to 1.82)
         * Head center: y=1.665 (diameter 0.21, extends 1.56 to 1.77)
         * 
         * TOTAL HEIGHT: 1.77m (from ground at 0.05 to head top at 1.77) ✓
         */

        // === HEAD (Vitruvian 1/8 of body length ≈ 0.2125m diameter) ===
        this.baseHead = MeshBuilder.CreateSphere("baseHead", { diameter: 0.21, segments: 16 }, scene);
        this.baseHead.material = this.skinMat;

        // === NECK (standard ~0.10m height, 0.09m diameter) ===
        this.baseNeck = MeshBuilder.CreateCylinder("baseNeck", { diameter: 0.09, height: 0.10 }, scene);
        this.baseNeck.material = this.skinMat;

        // === TORSO (0.40m height = shoulder to hip, ~0.38m width) ===
        this.baseTorso = MeshBuilder.CreateBox("baseTorso", { width: 0.38, height: 0.40, depth: 0.22 }, scene);
        this.baseTorso.material = this.shirtMat;

        // === UPPER ARMS (standard ~0.36m height = shoulder to elbow, 0.13m diameter) ===
        this.baseUpperArmL = MeshBuilder.CreateCylinder("baseUpperArmL", { diameter: 0.13, height: 0.36 }, scene);
        this.baseUpperArmL.material = this.shirtMat;

        this.baseUpperArmR = MeshBuilder.CreateCylinder("baseUpperArmR", { diameter: 0.13, height: 0.36 }, scene);
        this.baseUpperArmR.material = this.shirtMat;

        // === FOREARMS (standard ~0.32m height = elbow to wrist, 0.11m diameter) ===
        this.baseForearmL = MeshBuilder.CreateCylinder("baseForearmL", { diameter: 0.11, height: 0.32 }, scene);
        this.baseForearmL.material = this.shirtMat;

        this.baseForearmR = MeshBuilder.CreateCylinder("baseForearmR", { diameter: 0.11, height: 0.32 }, scene);
        this.baseForearmR.material = this.shirtMat;

        // === SLEEVES (uniform material covering forearms, 0.14m diameter) ===
        this.baseSleeveL = MeshBuilder.CreateCylinder("baseSleeveL", { diameter: 0.14, height: 0.32 }, scene);
        this.baseSleeveL.material = this.shirtMat;

        this.baseSleeveR = MeshBuilder.CreateCylinder("baseSleeveR", { diameter: 0.14, height: 0.32 }, scene);
        this.baseSleeveR.material = this.shirtMat;

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

        // === PELVIS (connects hips, 0.34m wide, 0.20m height) ===
        this.basePelvis = MeshBuilder.CreateBox("basePelvis", { width: 0.34, height: 0.20, depth: 0.18 }, scene);
        this.basePelvis.material = this.uniformMat;

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
            this.baseSleeveL, this.baseSleeveR,
            this.baseHandL, this.baseHandR,
            this.baseUpperLegL, this.baseUpperLegR,
            this.basePelvis,
            this.baseLowerLegL, this.baseLowerLegR,
            this.baseFootL, this.baseFootR,
            this.baseHat, this.basePlume,
            this.baseSpatL, this.baseSpatR,
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

        /**
         * CLEAN SKELETAL HIERARCHY (Bone chains with no joint spheres)
         * 
         * Chain Structure:
         * SPINE:      Anchor → Torso → Neck → Head
         * LEFT ARM:   Torso → UpperArm → Forearm → Hand  
         * RIGHT ARM:  Torso → UpperArm → Forearm → Hand
         * PELVIS:     Torso → Pelvis
         * LEFT LEG:   Pelvis → UpperLeg → LowerLeg → Foot
         * RIGHT LEG:  Pelvis → UpperLeg → LowerLeg → Foot
         * 
         * Positioning (end-to-end connections):
         * - Torso center: y=1.52, height 0.40 (extends 1.32 to 1.72)
         * - Neck center: y=1.77, height 0.10 (extends 1.72 to 1.82, attached to torso top)
         * - Head center: y=1.665, diameter 0.21 (extends 1.56 to 1.77, attached to neck top)
         * - Pelvis center: y=1.22, height 0.20 (extends 1.12 to 1.32, attached to torso bottom)
         * - UpperLeg center: y=0.86, height 0.52 (extends 0.60 to 1.12, attached to pelvis)
         * - LowerLeg center: y=0.405, height 0.45 (extends 0.18 to 0.63, attached to upperleg bottom)
         * - Foot center: y=0.10, height 0.10 (extends 0.05 to 0.15, attached to lowerleg bottom)
         * 
         * TOTAL HEIGHT: 1.77m ✓
         */

        // === SPINE CHAIN ===
        
        // Torso (root of skeleton, center at 1.52)
        const torso = isBase ? this.baseTorso : this.baseTorso.createInstance(`torso_${r}_${c}`);
        torso.parent = anchor;
        torso.position.set(0, 1.52, 0);

        // Neck (child of torso, positioned at torso top)
        const neck = isBase ? this.baseNeck : this.baseNeck.createInstance(`neck_${r}_${c}`);
        neck.parent = torso;
        neck.position.set(0, 0.25, 0);  // local y = torso_radius(0.20) + neck_radius(0.05) = 0.25

        // Head (child of neck, positioned at neck top)
        const head = isBase ? this.baseHead : this.baseHead.createInstance(`head_${r}_${c}`);
        head.parent = neck;
        head.position.set(0, 0.105, 0);  // local y = neck_radius(0.05) + head_radius(0.105) = 0.155, but adjusted for connection

        // === LEFT ARM CHAIN ===
        
        // Upper arm (child of torso, positioned at left shoulder)
        const upperArmL = isBase ? this.baseUpperArmL : this.baseUpperArmL.createInstance(`upperArmL_${r}_${c}`);
        upperArmL.parent = torso;
        upperArmL.position.set(-0.23, 0.20, 0);  // At torso top, left side
        // Upper arm height 0.36: extends from 0.20 to -0.16 (20 + 18 = 0.38, so center should be at 0.02?)
        // Actually positioned at midpoint: if local parent top is 0.20 and arm is 0.36 tall, center should be 0.20 - 0.18 = 0.02
        upperArmL.position.y = 0.02;  // Midpoint of 0.36 height = 0.18, so center at 0.20 - 0.18 = 0.02

        // Forearm (child of upper arm, positioned at upper arm bottom)
        const forearmL = isBase ? this.baseForearmL : this.baseForearmL.createInstance(`forearmL_${r}_${c}`);
        forearmL.parent = upperArmL;
        forearmL.position.set(0, -0.34, 0);  // To upper arm bottom (0.18 + 0.16 = 0.34 down from center)
        // Forearm height 0.32: center at midpoint = -0.34 - 0.16 = -0.50
        forearmL.position.y = -0.16;  // Midpoint of 0.32 height = 0.16 down from attachment

        // Sleeve (uniform material covering forearm, child of forearm at same position)
        const sleeveL = isBase ? this.baseSleeveL : this.baseSleeveL.createInstance(`sleeveL_${r}_${c}`);
        sleeveL.parent = forearmL;
        sleeveL.position.set(0, 0, 0);  // At forearm center

        // Hand (child of forearm, positioned at forearm bottom)
        const handL = isBase ? this.baseHandL : this.baseHandL.createInstance(`handL_${r}_${c}`);
        handL.parent = forearmL;
        handL.position.set(0, -0.22, 0);  // To forearm bottom (0.16 + 0.06 = 0.22 down from center)

        // === RIGHT ARM CHAIN ===
        
        // Upper arm (child of torso, positioned at right shoulder)
        const upperArmR = isBase ? this.baseUpperArmR : this.baseUpperArmR.createInstance(`upperArmR_${r}_${c}`);
        upperArmR.parent = torso;
        upperArmR.position.set(0.23, 0.02, 0);  // At torso top, right side, midpoint

        // Forearm (child of upper arm, positioned at upper arm bottom)
        const forearmR = isBase ? this.baseForearmR : this.baseForearmR.createInstance(`forearmR_${r}_${c}`);
        forearmR.parent = upperArmR;
        forearmR.position.set(0, -0.16, 0);  // Midpoint of 0.32 height

        // Sleeve (uniform material covering forearm, child of forearm at same position)
        const sleeveR = isBase ? this.baseSleeveR : this.baseSleeveR.createInstance(`sleeveR_${r}_${c}`);
        sleeveR.parent = forearmR;
        sleeveR.position.set(0, 0, 0);  // At forearm center

        // Hand (child of forearm, positioned at forearm bottom)
        const handR = isBase ? this.baseHandR : this.baseHandR.createInstance(`handR_${r}_${c}`);
        handR.parent = forearmR;
        handR.position.set(0, -0.22, 0);  // To forearm bottom

        // === PELVIS ===
        const pelvis = isBase ? this.basePelvis : this.basePelvis.createInstance(`pelvis_${r}_${c}`);
        pelvis.parent = torso;
        pelvis.position.set(0, -0.30, 0);  // Positioned at torso bottom (0.20 + 0.10 = 0.30 down)

        // === LEFT LEG CHAIN ===
        
        // Upper leg (child of pelvis, positioned at left hip)
        const upperLegL = isBase ? this.baseUpperLegL : this.baseUpperLegL.createInstance(`upperLegL_${r}_${c}`);
        upperLegL.parent = pelvis;
        upperLegL.position.set(-0.17, -0.26, 0);  // Left side, at pelvis bottom (0.10 + 0.16 = 0.26)
        // Upper leg height 0.52: extends from 0 to -0.52, midpoint at -0.26

        // Lower leg (child of upper leg, positioned at upper leg bottom)
        const lowerLegL = isBase ? this.baseLowerLegL : this.baseLowerLegL.createInstance(`lowerLegL_${r}_${c}`);
        lowerLegL.parent = upperLegL;
        lowerLegL.position.set(0, -0.225, 0);  // To upper leg bottom
        // Lower leg height 0.45: extends from 0 to -0.45, midpoint at -0.225

        // Foot (child of lower leg, positioned at lower leg bottom)
        const footL = isBase ? this.baseFootL : this.baseFootL.createInstance(`footL_${r}_${c}`);
        footL.parent = lowerLegL;
        footL.position.set(0, -0.275, 0);  // To lower leg bottom (0.225 + 0.05 = 0.275)

        // Spat (white ankle cover, child of lower leg)
        const spatL = isBase ? this.baseSpatL : this.baseSpatL.createInstance(`spatL_${r}_${c}`);
        spatL.parent = lowerLegL;
        spatL.position.set(0, -0.18, 0);  // Just above ankle

        // === RIGHT LEG CHAIN ===
        
        // Upper leg (child of pelvis, positioned at right hip)
        const upperLegR = isBase ? this.baseUpperLegR : this.baseUpperLegR.createInstance(`upperLegR_${r}_${c}`);
        upperLegR.parent = pelvis;
        upperLegR.position.set(0.17, -0.26, 0);  // Right side, at pelvis bottom

        // Lower leg (child of upper leg, positioned at upper leg bottom)
        const lowerLegR = isBase ? this.baseLowerLegR : this.baseLowerLegR.createInstance(`lowerLegR_${r}_${c}`);
        lowerLegR.parent = upperLegR;
        lowerLegR.position.set(0, -0.225, 0);  // To upper leg bottom

        // Foot (child of lower leg, positioned at lower leg bottom)
        const footR = isBase ? this.baseFootR : this.baseFootR.createInstance(`footR_${r}_${c}`);
        footR.parent = lowerLegR;
        footR.position.set(0, -0.275, 0);  // To lower leg bottom

        // Spat (white ankle cover, child of lower leg)
        const spatR = isBase ? this.baseSpatR : this.baseSpatR.createInstance(`spatR_${r}_${c}`);
        spatR.parent = lowerLegR;
        spatR.position.set(0, -0.18, 0);  // Just above ankle

        // === HAT & PLUME ===
        const hat = isBase ? this.baseHat : this.baseHat.createInstance(`hat_${r}_${c}`);
        hat.parent = head;
        hat.position.set(0, 0.15, 0);  // On top of head

        const plume = isBase ? this.basePlume : this.basePlume.createInstance(`plume_${r}_${c}`);
        plume.parent = hat;
        plume.position.set(0, 0.23, 0);  // Above hat on top of head

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
                neckBaseY: 1.77,
                torso,
                torsoBaseY: 1.52,
                upperArmL,
                upperArmR,
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
