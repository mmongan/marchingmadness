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
    private baseShoulderL!: Mesh;
    private baseShoulderR!: Mesh;
    private baseForearmL!: Mesh;
    private baseForearmR!: Mesh;
    private baseElbowL!: Mesh;
    private baseElbowR!: Mesh;
    private baseHandL!: Mesh;
    private baseHandR!: Mesh;
    private baseUpperLegL!: Mesh;
    private baseUpperLegR!: Mesh;
    private baseHipL!: Mesh;
    private baseHipR!: Mesh;
    private basePelvis!: Mesh;
    private baseKneeL!: Mesh;
    private baseKneeR!: Mesh;
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
    
    // Connector spheres (small spheres to fill gaps between parent/child joints)
    private baseNeckConnector!: Mesh;
    private baseHeadConnector!: Mesh;
    private baseForearmHandConnectorL!: Mesh;
    private baseForearmHandConnectorR!: Mesh;
    private baseLowerLegFootConnectorL!: Mesh;
    private baseLowerLegFootConnectorR!: Mesh;

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

        // === SHOULDERS (visible joint spheres, ~0.10m diameter at shoulder joint) ===
        this.baseShoulderL = MeshBuilder.CreateSphere("baseShoulderL", { diameter: 0.10, segments: 8 }, scene);
        this.baseShoulderL.material = this.shirtMat;

        this.baseShoulderR = MeshBuilder.CreateSphere("baseShoulderR", { diameter: 0.10, segments: 8 }, scene);
        this.baseShoulderR.material = this.shirtMat;

        // === HIPS (visible joint spheres, 0.16m diameter at hip joint) ===
        this.baseHipL = MeshBuilder.CreateSphere("baseHipL", { diameter: 0.16, segments: 8 }, scene);
        this.baseHipL.material = this.uniformMat;

        this.baseHipR = MeshBuilder.CreateSphere("baseHipR", { diameter: 0.16, segments: 8 }, scene);
        this.baseHipR.material = this.uniformMat;

        // === PELVIS (connects hips, 0.34m wide, 0.20m height) ===
        this.basePelvis = MeshBuilder.CreateBox("basePelvis", { width: 0.34, height: 0.20, depth: 0.18 }, scene);
        this.basePelvis.material = this.uniformMat;

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

        // === ELBOWS (visible joint spheres, 0.13m diameter) ===
        this.baseElbowL = MeshBuilder.CreateSphere("baseElbowL", { diameter: 0.13, segments: 8 }, scene);
        this.baseElbowL.material = this.skinMat;

        this.baseElbowR = MeshBuilder.CreateSphere("baseElbowR", { diameter: 0.13, segments: 8 }, scene);
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

        // === KNEES (visible joint spheres, 0.15m diameter at knee joint) ===
        this.baseKneeL = MeshBuilder.CreateSphere("baseKneeL", { diameter: 0.15, segments: 8 }, scene);
        this.baseKneeL.material = this.uniformMat;

        this.baseKneeR = MeshBuilder.CreateSphere("baseKneeR", { diameter: 0.15, segments: 8 }, scene);
        this.baseKneeR.material = this.uniformMat;

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

        // === CONNECTOR SPHERES (small spheres to fill gaps at joint connections) ===
        // Neck-Torso connector (fills gap between torso top and neck)
        this.baseNeckConnector = MeshBuilder.CreateSphere("baseNeckConnector", { diameter: 0.10, segments: 6 }, scene);
        this.baseNeckConnector.material = this.skinMat;

        // Head-Neck connector (fills gap between neck and head)
        this.baseHeadConnector = MeshBuilder.CreateSphere("baseHeadConnector", { diameter: 0.10, segments: 6 }, scene);
        this.baseHeadConnector.material = this.skinMat;

        // Forearm-Hand connectors (fills gap at wrist)
        this.baseForearmHandConnectorL = MeshBuilder.CreateSphere("baseForearmHandConnectorL", { diameter: 0.10, segments: 6 }, scene);
        this.baseForearmHandConnectorL.material = this.shirtMat;

        this.baseForearmHandConnectorR = MeshBuilder.CreateSphere("baseForearmHandConnectorR", { diameter: 0.10, segments: 6 }, scene);
        this.baseForearmHandConnectorR.material = this.shirtMat;

        // Lower Leg-Foot connectors (fills gap at ankle)
        this.baseLowerLegFootConnectorL = MeshBuilder.CreateSphere("baseLowerLegFootConnectorL", { diameter: 0.10, segments: 6 }, scene);
        this.baseLowerLegFootConnectorL.material = this.shoeMat;

        this.baseLowerLegFootConnectorR = MeshBuilder.CreateSphere("baseLowerLegFootConnectorR", { diameter: 0.10, segments: 6 }, scene);
        this.baseLowerLegFootConnectorR.material = this.shoeMat;

        // === HAT (proportional to new head size, 0.22m diameter, 0.12m height) ===
        this.baseHat = MeshBuilder.CreateCylinder("baseHat", { diameter: 0.22, height: 0.12 }, scene);
        this.baseHat.material = this.hatMat;

        // === PLUME (proportional ~0.35m height, 0.06m diameter) ===
        this.basePlume = MeshBuilder.CreateCylinder("basePlume", { diameter: 0.06, height: 0.35, tessellation: 4 }, scene);
        this.basePlume.material = this.plumeMat;

        // Hide all base meshes (used for instancing)
        const baseMeshes = [
            this.baseHead, this.baseNeck, this.baseTorso,
            this.baseShoulderL, this.baseShoulderR,
            this.baseUpperArmL, this.baseUpperArmR,
            this.baseForearmL, this.baseForearmR,
            this.baseSleeveL, this.baseSleeveR,
            this.baseElbowL, this.baseElbowR,
            this.baseHandL, this.baseHandR,
            this.baseHipL, this.baseHipR,
            this.baseUpperLegL, this.baseUpperLegR,
            this.baseKneeL, this.baseKneeR,
            this.baseLowerLegL, this.baseLowerLegR,
            this.baseFootL, this.baseFootR,
            this.baseHat, this.basePlume,
            this.baseSpatL, this.baseSpatR,
            this.baseNeckConnector, this.baseHeadConnector,
            this.baseForearmHandConnectorL, this.baseForearmHandConnectorR,
            this.baseLowerLegFootConnectorL, this.baseLowerLegFootConnectorR
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

        // Neck-Torso connector (fills gap between torso top and neck, serves as rotation pivot)
        const neckConnector = isBase ? this.baseNeckConnector : this.baseNeckConnector.createInstance(`neckConnector_${r}_${c}`);
        neckConnector.parent = torso;
        neckConnector.position.set(0, 0.25, 0);  // Midpoint between torso top (0.20) and neck center (0.30)

        // Neck (CHILD of connector, rotates around connector center)
        const neck = isBase ? this.baseNeck : this.baseNeck.createInstance(`neck_${r}_${c}`);
        neck.parent = neckConnector;
        neck.position.set(0, 0.05, 0);  // Local offset from connector to neck center

        // Head-Neck connector (fills gap between neck and head, serves as rotation pivot)
        const headConnector = isBase ? this.baseHeadConnector : this.baseHeadConnector.createInstance(`headConnector_${r}_${c}`);
        headConnector.parent = neck;
        headConnector.position.set(0, 0.10, 0);  // Positioned at top of neck

        // Head (CHILD of connector, rotates around connector center)
        const head = isBase ? this.baseHead : this.baseHead.createInstance(`head_${r}_${c}`);
        head.parent = headConnector;
        head.position.set(0, 0.065, 0);  // Local offset from connector to head center

        // === LEFT SHOULDER & ARM ===
        // Left shoulder (child of torso at shoulder joint)
        const shoulderL = isBase ? this.baseShoulderL : this.baseShoulderL.createInstance(`shoulderL_${r}_${c}`);
        shoulderL.parent = torso;
        shoulderL.position.set(-0.19, 0.20, 0.04);  // At torso top, left side
        
        // Upper arm (child of shoulder)
        const upperArmL = isBase ? this.baseUpperArmL : this.baseUpperArmL.createInstance(`upperArmL_${r}_${c}`);
        upperArmL.parent = shoulderL;
        upperArmL.position.set(0, -0.18, 0.04);  // Positioned to end at elbow
        
        // Elbow sphere (visual joint, child of upper arm, serves as forearm pivot)
        const elbowL = isBase ? this.baseElbowL : this.baseElbowL.createInstance(`elbowL_${r}_${c}`);
        elbowL.parent = upperArmL;
        elbowL.position.set(0, -0.36, 0);  // At far endpoint of upper arm
        
        // Forearm (child of elbow sphere, rotates around elbow center)
        const forearmL = isBase ? this.baseForearmL : this.baseForearmL.createInstance(`forearmL_${r}_${c}`);
        forearmL.parent = elbowL;
        forearmL.position.set(0, -0.16, 0);  // Positioned to extend from elbow to wrist
        
        // Sleeve (uniform material covering forearm, child of forearm)
        const sleeveL = isBase ? this.baseSleeveL : this.baseSleeveL.createInstance(`sleeveL_${r}_${c}`);
        sleeveL.parent = forearmL;
        sleeveL.position.set(0, 0, 0);  // At same position as forearm
        
        // Forearm-Hand connector (fills gap at wrist, serves as rotation pivot)
        const forearmHandConnectorL = isBase ? this.baseForearmHandConnectorL : this.baseForearmHandConnectorL.createInstance(`forearmHandConnectorL_${r}_${c}`);
        forearmHandConnectorL.parent = forearmL;
        forearmHandConnectorL.position.set(0, -0.32, 0.04);  // At far endpoint of forearm
        
        // Hand (child of connector, rotates around connector center)
        const handL = isBase ? this.baseHandL : this.baseHandL.createInstance(`handL_${r}_${c}`);
        handL.parent = forearmHandConnectorL;
        handL.position.set(0, 0, 0);  // Positioned at connector center

        // === RIGHT SHOULDER & ARM ===
        // Right shoulder (child of torso at shoulder joint)
        const shoulderR = isBase ? this.baseShoulderR : this.baseShoulderR.createInstance(`shoulderR_${r}_${c}`);
        shoulderR.parent = torso;
        shoulderR.position.set(0.19, 0.20, 0.04);  // At torso top, right side
        
        // Upper arm (child of shoulder)
        const upperArmR = isBase ? this.baseUpperArmR : this.baseUpperArmR.createInstance(`upperArmR_${r}_${c}`);
        upperArmR.parent = shoulderR;
        upperArmR.position.set(0, -0.18, 0.04);  // Positioned to end at elbow
        
        // Elbow sphere (visual joint, child of upper arm, serves as forearm pivot)
        const elbowR = isBase ? this.baseElbowR : this.baseElbowR.createInstance(`elbowR_${r}_${c}`);
        elbowR.parent = upperArmR;
        elbowR.position.set(0, -0.36, 0);  // At far endpoint of upper arm
        
        // Forearm (child of elbow sphere, rotates around elbow center)
        const forearmR = isBase ? this.baseForearmR : this.baseForearmR.createInstance(`forearmR_${r}_${c}`);
        forearmR.parent = elbowR;
        forearmR.position.set(0, -0.16, 0);  // Positioned to extend from elbow to wrist
        
        // Sleeve (uniform material covering forearm, child of forearm)
        const sleeveR = isBase ? this.baseSleeveR : this.baseSleeveR.createInstance(`sleeveR_${r}_${c}`);
        sleeveR.parent = forearmR;
        sleeveR.position.set(0, 0, 0);  // At same position as forearm
        
        // Forearm-Hand connector (fills gap at wrist, serves as rotation pivot)
        const forearmHandConnectorR = isBase ? this.baseForearmHandConnectorR : this.baseForearmHandConnectorR.createInstance(`forearmHandConnectorR_${r}_${c}`);
        forearmHandConnectorR.parent = forearmR;
        forearmHandConnectorR.position.set(0, -0.32, 0.04);  // At far endpoint of forearm
        
        // Hand (child of connector, rotates around connector center)
        const handR = isBase ? this.baseHandR : this.baseHandR.createInstance(`handR_${r}_${c}`);
        handR.parent = forearmHandConnectorR;
        handR.position.set(0, 0, 0);  // Positioned at connector center

        // === PELVIS (central hip connector) ===
        const pelvis = isBase ? this.basePelvis : this.basePelvis.createInstance(`pelvis_${r}_${c}`);
        pelvis.parent = torso;
        pelvis.position.set(0, -0.20, 0);  // Positioned at torso bottom

        // === LEFT HIP & LEG ===
        // Left hip (child of pelvis at hip joint)
        const hipL = isBase ? this.baseHipL : this.baseHipL.createInstance(`hipL_${r}_${c}`);
        hipL.parent = pelvis;
        hipL.position.set(-0.17, 0, 0.04);  // Positioned on left side of pelvis
        
        // Upper leg (child of hip)
        const upperLegL = isBase ? this.baseUpperLegL : this.baseUpperLegL.createInstance(`upperLegL_${r}_${c}`);
        upperLegL.parent = hipL;
        upperLegL.position.set(0, -0.26, 0);  // Positioned to end at knee

        // Knee sphere (visual joint, child of upper leg, serves as lower leg pivot)
        const kneeL = isBase ? this.baseKneeL : this.baseKneeL.createInstance(`kneeL_${r}_${c}`);
        kneeL.parent = upperLegL;
        kneeL.position.set(0, -0.52, 0.04);  // At far endpoint of upper leg

        // Lower leg (child of knee, rotates around knee center)
        const lowerLegL = isBase ? this.baseLowerLegL : this.baseLowerLegL.createInstance(`lowerLegL_${r}_${c}`);
        lowerLegL.parent = kneeL;
        lowerLegL.position.set(0, -0.225, 0.04);  // Positioned to extend from knee to ankle

        // Lower Leg-Foot connector (fills gap at ankle, serves as rotation pivot)
        const lowerLegFootConnectorL = isBase ? this.baseLowerLegFootConnectorL : this.baseLowerLegFootConnectorL.createInstance(`lowerLegFootConnectorL_${r}_${c}`);
        lowerLegFootConnectorL.parent = lowerLegL;
        lowerLegFootConnectorL.position.set(0, -0.45, 0);  // At far endpoint of lower leg

        // Foot (child of connector, rotates around connector center)
        const footL = isBase ? this.baseFootL : this.baseFootL.createInstance(`footL_${r}_${c}`);
        footL.parent = lowerLegFootConnectorL;
        footL.position.set(0, 0, 0.035);  // Overlaps with connector for seamless connection

        // Spat (white ankle cover, child of lower leg)
        const spatL = isBase ? this.baseSpatL : this.baseSpatL.createInstance(`spatL_${r}_${c}`);
        spatL.parent = lowerLegL;
        spatL.position.set(0, -0.18, 0);  // Just above ankle

        // === RIGHT HIP & LEG ===
        // Right hip (child of pelvis at hip joint)
        const hipR = isBase ? this.baseHipR : this.baseHipR.createInstance(`hipR_${r}_${c}`);
        hipR.parent = pelvis;
        hipR.position.set(0.17, 0, 0.04);  // Positioned on right side of pelvis
        
        // Upper leg (child of hip)
        const upperLegR = isBase ? this.baseUpperLegR : this.baseUpperLegR.createInstance(`upperLegR_${r}_${c}`);
        upperLegR.parent = hipR;
        upperLegR.position.set(0, -0.26, 0);  // Positioned to end at knee

        // Knee sphere (visual joint, child of upper leg, serves as lower leg pivot)
        const kneeR = isBase ? this.baseKneeR : this.baseKneeR.createInstance(`kneeR_${r}_${c}`);
        kneeR.parent = upperLegR;
        kneeR.position.set(0, -0.52, 0.04);  // At far endpoint of upper leg

        // Lower leg (child of knee, rotates around knee center)
        const lowerLegR = isBase ? this.baseLowerLegR : this.baseLowerLegR.createInstance(`lowerLegR_${r}_${c}`);
        lowerLegR.parent = kneeR;
        lowerLegR.position.set(0, -0.225, 0.04);  // Positioned to extend from knee to ankle

        // Lower Leg-Foot connector (fills gap at ankle, serves as rotation pivot)
        const lowerLegFootConnectorR = isBase ? this.baseLowerLegFootConnectorR : this.baseLowerLegFootConnectorR.createInstance(`lowerLegFootConnectorR_${r}_${c}`);
        lowerLegFootConnectorR.parent = lowerLegR;
        lowerLegFootConnectorR.position.set(0, -0.45, 0);  // At far endpoint of lower leg

        // Foot (child of connector, rotates around connector center)
        const footR = isBase ? this.baseFootR : this.baseFootR.createInstance(`footR_${r}_${c}`);
        footR.parent = lowerLegFootConnectorR;
        footR.position.set(0, 0, 0.035);  // Overlaps with connector for seamless connection

        // Spat (white ankle cover, child of lower leg)
        const spatR = isBase ? this.baseSpatR : this.baseSpatR.createInstance(`spatR_${r}_${c}`);
        spatR.parent = lowerLegR;
        spatR.position.set(0, -0.18, 0);  // Just above ankle

        // === HAT & PLUME (anchored to head) ===
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
