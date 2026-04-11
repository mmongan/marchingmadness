import { Scene, Mesh, MeshBuilder, StandardMaterial, Color3, InstancedMesh, DynamicTexture, TransformNode } from "@babylonjs/core";
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
        baseMeshes.forEach(m => { m.isVisible = false; m.isPickable = false; });
    }

    public createMember(r: number, c: number, type: InstrumentType, xPos: number, zPos: number): BandMemberData {
        const isBase = !this.firstBodyPlaced;
        this.firstBodyPlaced = true;

        // Root anchor positioned at ground level
        const anchor = MeshBuilder.CreateBox(`anchor_${r}_${c}`, { size: 0.01 }, this.scene);
        anchor.position.set(xPos, 0, zPos);
        anchor.rotation.y = Math.PI;
        anchor.isVisible = false;
        anchor.isPickable = false;

        /**
         * JOINT-BASED SKELETAL HIERARCHY
         *
         * Every joint is a TransformNode.  Bones are mesh children of joints.
         * When a joint rotates, every descendant (bones + child joints) pivots
         * around that joint's world-space position.
         *
         * anchor (y=0)
         * └─ torsoJoint  y=1.12  (hip level – body root)
         *     ├─ pelvis mesh  y=+0.10
         *     ├─ spineJoint   y=+0.20  (torso bottom)
         *     │   ├─ torso mesh  y=+0.20
         *     │   ├─ neckJoint   y=+0.40
         *     │   │   ├─ neck mesh  y=+0.05
         *     │   │   └─ headJoint  y=+0.10
         *     │   │       └─ head mesh  y=+0.105
         *     │   ├─ shoulderJointL  x=-0.21 y=+0.40
         *     │   │   ├─ upperArmL   y=-0.18
         *     │   │   └─ elbowJointL y=-0.36
         *     │   │       ├─ forearmL y=-0.16
         *     │   │       └─ wristJointL y=-0.32
         *     │   │           └─ handL y=-0.06
         *     │   └─ shoulderJointR  x=+0.21 y=+0.40
         *     │       (mirror of left arm)
         *     ├─ hipJointL  x=-0.13 y=0
         *     │   ├─ upperLegL   y=-0.26
         *     │   └─ kneeJointL  y=-0.52
         *     │       ├─ lowerLegL  y=-0.225
         *     │       └─ ankleJointL y=-0.45
         *     │           └─ footL   y=-0.05
         *     └─ hipJointR  x=+0.13 y=0
         *         (mirror of left leg)
         */

        // ═══════════════════════════════════════════════════════════
        // TORSO / SPINE
        // ═══════════════════════════════════════════════════════════

        // torsoJoint — root body pivot at hip level  (world y = 1.12)
        const torsoJoint = new TransformNode(`torsoJoint_${r}_${c}`, this.scene);
        torsoJoint.parent = anchor;
        torsoJoint.position.set(0, 1.12, 0);

        // Pelvis mesh (child of torsoJoint, centered slightly above hip)
        const pelvis = isBase ? this.basePelvis : this.basePelvis.createInstance(`pelvis_${r}_${c}`);
        pelvis.parent = torsoJoint;
        pelvis.position.set(0, 0.10, 0);  // center at world y 1.22

        // spineJoint — bottom of torso / ribcage  (world y = 1.32)
        const spineJoint = new TransformNode(`spineJoint_${r}_${c}`, this.scene);
        spineJoint.parent = torsoJoint;
        spineJoint.position.set(0, 0.20, 0);

        // Torso mesh (child of spineJoint, centered at torso mid-height)
        const torso = isBase ? this.baseTorso : this.baseTorso.createInstance(`torso_${r}_${c}`);
        torso.parent = spineJoint;
        torso.position.set(0, 0.20, 0);  // center at world y 1.52

        // ═══════════════════════════════════════════════════════════
        // NECK / HEAD
        // ═══════════════════════════════════════════════════════════

        // neckJoint — at top of torso  (world y = 1.72)
        const neckJoint = new TransformNode(`neckJoint_${r}_${c}`, this.scene);
        neckJoint.parent = spineJoint;
        neckJoint.position.set(0, 0.40, 0);

        // Neck mesh
        const neck = isBase ? this.baseNeck : this.baseNeck.createInstance(`neck_${r}_${c}`);
        neck.parent = neckJoint;
        neck.position.set(0, 0.05, 0);  // center at world y 1.77

        // headJoint — at top of neck  (world y = 1.82)
        const headJoint = new TransformNode(`headJoint_${r}_${c}`, this.scene);
        headJoint.parent = neckJoint;
        headJoint.position.set(0, 0.10, 0);

        // Head mesh
        const head = isBase ? this.baseHead : this.baseHead.createInstance(`head_${r}_${c}`);
        head.parent = headJoint;
        head.position.set(0, 0.105, 0);  // center at world y 1.925

        // ═══════════════════════════════════════════════════════════
        // LEFT ARM
        // ═══════════════════════════════════════════════════════════

        // shoulderJointL — at top-left of torso  (world x=-0.21  y=1.72)
        const shoulderJointL = new TransformNode(`shoulderJointL_${r}_${c}`, this.scene);
        shoulderJointL.parent = spineJoint;
        shoulderJointL.position.set(-0.21, 0.40, 0);

        const upperArmL = isBase ? this.baseUpperArmL : this.baseUpperArmL.createInstance(`upperArmL_${r}_${c}`);
        upperArmL.parent = shoulderJointL;
        upperArmL.position.set(0, -0.18, 0);

        // elbowJointL — at end of upper arm
        const elbowJointL = new TransformNode(`elbowJointL_${r}_${c}`, this.scene);
        elbowJointL.parent = shoulderJointL;
        elbowJointL.position.set(0, -0.36, 0);

        const forearmL = isBase ? this.baseForearmL : this.baseForearmL.createInstance(`forearmL_${r}_${c}`);
        forearmL.parent = elbowJointL;
        forearmL.position.set(0, -0.16, 0);

        const sleeveL = isBase ? this.baseSleeveL : this.baseSleeveL.createInstance(`sleeveL_${r}_${c}`);
        sleeveL.parent = forearmL;
        sleeveL.position.set(0, 0, 0);

        // wristJointL — at end of forearm
        const wristJointL = new TransformNode(`wristJointL_${r}_${c}`, this.scene);
        wristJointL.parent = elbowJointL;
        wristJointL.position.set(0, -0.32, 0);

        const handL = isBase ? this.baseHandL : this.baseHandL.createInstance(`handL_${r}_${c}`);
        handL.parent = wristJointL;
        handL.position.set(0, -0.06, 0);

        // ═══════════════════════════════════════════════════════════
        // RIGHT ARM
        // ═══════════════════════════════════════════════════════════

        const shoulderJointR = new TransformNode(`shoulderJointR_${r}_${c}`, this.scene);
        shoulderJointR.parent = spineJoint;
        shoulderJointR.position.set(0.21, 0.40, 0);

        const upperArmR = isBase ? this.baseUpperArmR : this.baseUpperArmR.createInstance(`upperArmR_${r}_${c}`);
        upperArmR.parent = shoulderJointR;
        upperArmR.position.set(0, -0.18, 0);

        const elbowJointR = new TransformNode(`elbowJointR_${r}_${c}`, this.scene);
        elbowJointR.parent = shoulderJointR;
        elbowJointR.position.set(0, -0.36, 0);

        const forearmR = isBase ? this.baseForearmR : this.baseForearmR.createInstance(`forearmR_${r}_${c}`);
        forearmR.parent = elbowJointR;
        forearmR.position.set(0, -0.16, 0);

        const sleeveR = isBase ? this.baseSleeveR : this.baseSleeveR.createInstance(`sleeveR_${r}_${c}`);
        sleeveR.parent = forearmR;
        sleeveR.position.set(0, 0, 0);

        const wristJointR = new TransformNode(`wristJointR_${r}_${c}`, this.scene);
        wristJointR.parent = elbowJointR;
        wristJointR.position.set(0, -0.32, 0);

        const handR = isBase ? this.baseHandR : this.baseHandR.createInstance(`handR_${r}_${c}`);
        handR.parent = wristJointR;
        handR.position.set(0, -0.06, 0);

        // ═══════════════════════════════════════════════════════════
        // LEFT LEG  (own hip joint — swings independently)
        // ═══════════════════════════════════════════════════════════

        // hipJointL — at left hip  (world x=-0.13  y=1.12)
        const hipJointL = new TransformNode(`hipJointL_${r}_${c}`, this.scene);
        hipJointL.parent = torsoJoint;
        hipJointL.position.set(-0.13, 0, 0);

        const upperLegL = isBase ? this.baseUpperLegL : this.baseUpperLegL.createInstance(`upperLegL_${r}_${c}`);
        upperLegL.parent = hipJointL;
        upperLegL.position.set(0, -0.26, 0);  // center of 0.52m bone

        // kneeJointL — at end of upper leg  (world y = 0.60)
        const kneeJointL = new TransformNode(`kneeJointL_${r}_${c}`, this.scene);
        kneeJointL.parent = hipJointL;
        kneeJointL.position.set(0, -0.52, 0);

        const lowerLegL = isBase ? this.baseLowerLegL : this.baseLowerLegL.createInstance(`lowerLegL_${r}_${c}`);
        lowerLegL.parent = kneeJointL;
        lowerLegL.position.set(0, -0.225, 0);  // center of 0.45m bone

        // ankleJointL — at end of lower leg  (world y = 0.15)
        const ankleJointL = new TransformNode(`ankleJointL_${r}_${c}`, this.scene);
        ankleJointL.parent = kneeJointL;
        ankleJointL.position.set(0, -0.45, 0);

        const footL = isBase ? this.baseFootL : this.baseFootL.createInstance(`footL_${r}_${c}`);
        footL.parent = ankleJointL;
        footL.position.set(0, -0.05, 0.05);  // slightly forward

        const spatL = isBase ? this.baseSpatL : this.baseSpatL.createInstance(`spatL_${r}_${c}`);
        spatL.parent = ankleJointL;
        spatL.position.set(0, 0, 0);

        // ═══════════════════════════════════════════════════════════
        // RIGHT LEG  (own hip joint — swings independently)
        // ═══════════════════════════════════════════════════════════

        const hipJointR = new TransformNode(`hipJointR_${r}_${c}`, this.scene);
        hipJointR.parent = torsoJoint;
        hipJointR.position.set(0.13, 0, 0);

        const upperLegR = isBase ? this.baseUpperLegR : this.baseUpperLegR.createInstance(`upperLegR_${r}_${c}`);
        upperLegR.parent = hipJointR;
        upperLegR.position.set(0, -0.26, 0);

        const kneeJointR = new TransformNode(`kneeJointR_${r}_${c}`, this.scene);
        kneeJointR.parent = hipJointR;
        kneeJointR.position.set(0, -0.52, 0);

        const lowerLegR = isBase ? this.baseLowerLegR : this.baseLowerLegR.createInstance(`lowerLegR_${r}_${c}`);
        lowerLegR.parent = kneeJointR;
        lowerLegR.position.set(0, -0.225, 0);

        const ankleJointR = new TransformNode(`ankleJointR_${r}_${c}`, this.scene);
        ankleJointR.parent = kneeJointR;
        ankleJointR.position.set(0, -0.45, 0);

        const footR = isBase ? this.baseFootR : this.baseFootR.createInstance(`footR_${r}_${c}`);
        footR.parent = ankleJointR;
        footR.position.set(0, -0.05, 0.05);

        const spatR = isBase ? this.baseSpatR : this.baseSpatR.createInstance(`spatR_${r}_${c}`);
        spatR.parent = ankleJointR;
        spatR.position.set(0, 0, 0);

        // === HAT & PLUME ===
        const hat = isBase ? this.baseHat : this.baseHat.createInstance(`hat_${r}_${c}`);
        hat.parent = head;
        hat.position.set(0, 0.115, 0);  // On top of head

        const plume = isBase ? this.basePlume : this.basePlume.createInstance(`plume_${r}_${c}`);
        plume.parent = hat;
        plume.position.set(0, 0.235, 0);  // Above hat

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
                neck,
                torso,
                pelvis,
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
                // JOINT NODES (animated by MarchingAnimationSystem)
                torsoJoint,
                spineJoint,
                neckJoint,
                headJoint,
                shoulderJointL,
                shoulderJointR,
                elbowJointL,
                elbowJointR,
                wristJointL,
                wristJointR,
                hipJointL,
                hipJointR,
                kneeJointL,
                kneeJointR,
                ankleJointL,
                ankleJointR,
            },
            startZ: zPos,
            startX: xPos,
            row: r,
            col: c,
            health: 100,
        };
    }
}
