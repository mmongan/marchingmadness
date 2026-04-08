import { Scene, Mesh, MeshBuilder, StandardMaterial, Color3, Matrix, Quaternion, TransformNode, Vector3, Camera } from "@babylonjs/core";
import { WebXRInputSource } from "@babylonjs/core/XR";

export class FirstPersonBody {
    private bodyRoot: TransformNode;
    private torso: Mesh;
    private armL: Mesh;
    private armR: Mesh;
    private legL: Mesh;
    private legR: Mesh;

    private controllerLeft: WebXRInputSource | null = null;
    private controllerRight: WebXRInputSource | null = null;

    // Arm-swing locomotion tracking
    private prevGripPosL: Vector3 | null = null;
    private prevGripPosR: Vector3 | null = null;
    private swingSpeed = 0;
    private armSwingL = 0; // current forward/back offset of left arm
    private armSwingR = 0; // current forward/back offset of right arm
    private readonly SWING_DECAY = 0.85;
    private readonly SWING_GAIN = 2.5;
    private readonly MOVE_SPEED = 3.0;  // meters per second at full swing

    constructor(scene: Scene) {
        const uniformMat = new StandardMaterial("playerUniformMat", scene);
        uniformMat.diffuseColor = new Color3(0.1, 0.2, 0.8);

        const pantsMat = new StandardMaterial("playerPantsMat", scene);
        pantsMat.diffuseColor = new Color3(0.1, 0.2, 0.8);

        this.bodyRoot = new TransformNode("playerBodyRoot", scene);

        this.torso = MeshBuilder.CreateBox("playerTorso", { width: 0.45, height: 0.6, depth: 0.3 }, scene);
        this.torso.material = uniformMat;
        this.torso.isPickable = false;
        this.torso.parent = this.bodyRoot;
        this.torso.position.set(0, -0.65, -0.15);

        // Arms: height=1 boxes that get dynamically scaled & oriented each frame
        // to stretch from shoulder to hand (controller or desktop fallback)
        this.armL = MeshBuilder.CreateBox("playerArmL", { width: 0.12, height: 1, depth: 0.12 }, scene);
        this.armL.material = uniformMat;
        this.armL.isPickable = false;

        this.armR = MeshBuilder.CreateBox("playerArmR", { width: 0.12, height: 1, depth: 0.12 }, scene);
        this.armR.material = uniformMat;
        this.armR.isPickable = false;

        this.legL = MeshBuilder.CreateBox("playerLegL", { width: 0.18, height: 1.0, depth: 0.18 }, scene);
        this.legL.bakeTransformIntoVertices(Matrix.Translation(0, -0.5, 0));
        this.legL.material = pantsMat;
        this.legL.isPickable = false;
        this.legL.parent = this.bodyRoot;
        this.legL.position.set(-0.12, -0.75, 0);

        this.legR = MeshBuilder.CreateBox("playerLegR", { width: 0.18, height: 1.0, depth: 0.18 }, scene);
        this.legR.bakeTransformIntoVertices(Matrix.Translation(0, -0.5, 0));
        this.legR.material = pantsMat;
        this.legR.isPickable = false;
        this.legR.parent = this.bodyRoot;
        this.legR.position.set(0.12, -0.75, 0);
    }

    public setController(handedness: "left" | "right", controller: WebXRInputSource | null): void {
        if (handedness === "left") this.controllerLeft = controller;
        if (handedness === "right") this.controllerRight = controller;
    }

    /**
     * Returns a world-space movement vector driven by arm-swing locomotion.
     * The caller should apply this to the XR camera rig position.
     */
    public update(cam: Camera, marchPhase: number, isMarching: boolean, deltaTime: number): Vector3 {
        // Body root follows camera position and Y rotation
        this.bodyRoot.position.copyFrom(cam.globalPosition);
        this.bodyRoot.rotation.y = cam.absoluteRotation.toEulerAngles().y;

        // Stretch arms from shoulders to hands (controllers or desktop fallback)
        this.updateArm(this.armL, this.controllerLeft, cam, -0.3, marchPhase, isMarching);
        this.updateArm(this.armR, this.controllerRight, cam, 0.3, marchPhase, isMarching);

        // Arm-swing locomotion: detect pumping motion from controllers
        const movement = this.computeArmSwingLocomotion(cam, deltaTime);

        // Legs directly track opposite arm's forward/back position
        // Left arm forward → right leg forward (natural gait)
        this.legR.rotation.x = -this.armSwingL * 3.0;
        this.legL.rotation.x = -this.armSwingR * 3.0;

        return movement;
    }

    private computeArmSwingLocomotion(cam: Camera, deltaTime: number): Vector3 {
        let totalSwing = 0;

        // Measure how fast each grip is swinging along the forward/back axis
        if (this.controllerLeft?.grip) {
            const pos = this.controllerLeft.grip.absolutePosition;
            if (this.prevGripPosL) {
                const delta = pos.subtract(this.prevGripPosL);
                const fwd = cam.getDirection(Vector3.Forward());
                const fwdDot = Vector3.Dot(delta, fwd);
                totalSwing += Math.abs(fwdDot);
                totalSwing += Math.abs(delta.y) * 0.5;
            }
            // Track arm's forward offset relative to shoulder
            const fwd = cam.getDirection(Vector3.Forward());
            const shoulderL = cam.globalPosition.clone().addInPlace(Vector3.Up().scale(-0.38));
            this.armSwingL = Vector3.Dot(pos.subtract(shoulderL), fwd);
            this.prevGripPosL = pos.clone();
        } else {
            this.prevGripPosL = null;
            this.armSwingL *= 0.8; // decay toward zero
        }

        if (this.controllerRight?.grip) {
            const pos = this.controllerRight.grip.absolutePosition;
            if (this.prevGripPosR) {
                const delta = pos.subtract(this.prevGripPosR);
                const fwd = cam.getDirection(Vector3.Forward());
                totalSwing += Math.abs(Vector3.Dot(delta, fwd));
                totalSwing += Math.abs(delta.y) * 0.5;
            }
            const fwd = cam.getDirection(Vector3.Forward());
            const shoulderR = cam.globalPosition.clone().addInPlace(Vector3.Up().scale(-0.38));
            this.armSwingR = Vector3.Dot(pos.subtract(shoulderR), fwd);
            this.prevGripPosR = pos.clone();
        } else {
            this.prevGripPosR = null;
            this.armSwingR *= 0.8;
        }

        // Smooth the swing speed: ramp up with gain, decay when idle
        this.swingSpeed = this.swingSpeed * this.SWING_DECAY + totalSwing * this.SWING_GAIN;
        this.swingSpeed = Math.min(this.swingSpeed, 1.0); // clamp to max

        // Move forward in the camera's facing direction (Y flattened)
        if (this.swingSpeed > 0.02) {
            const fwd = cam.getDirection(Vector3.Forward());
            fwd.y = 0;
            fwd.normalize();
            return fwd.scale(this.swingSpeed * this.MOVE_SPEED * deltaTime);
        }
        return Vector3.Zero();
    }

    private updateArm(arm: Mesh, controller: WebXRInputSource | null, cam: Camera, xOffset: number, marchPhase: number, isMarching: boolean): void {
        // Shoulder position: offset from body root at top-of-torso height
        const right = cam.getDirection(Vector3.Right());
        const shoulderPos = this.bodyRoot.position.clone()
            .addInPlace(right.scale(xOffset * 0.75))
            .addInPlace(Vector3.Up().scale(-0.38));

        // Hand position: VR controller grip or desktop fallback
        let handPos: Vector3;
        if (controller && controller.grip) {
            handPos = controller.grip.absolutePosition.clone();
        } else {
            const fwd = cam.getDirection(Vector3.Forward());
            handPos = cam.globalPosition.clone()
                .addInPlace(right.scale(xOffset))
                .addInPlace(fwd.scale(0.3))
                .addInPlace(Vector3.Up().scale(-0.4));
            // Natural march arm swing: opposite to same-side leg
            if (isMarching) {
                const swing = Math.sin(marchPhase) * Math.sign(xOffset);
                handPos.addInPlace(fwd.scale(swing * 0.25));
                handPos.addInPlace(Vector3.Up().scale(Math.abs(swing) * 0.08));
            }
        }

        // Position at midpoint, scale Y to distance
        Vector3.CenterToRef(shoulderPos, handPos, arm.position);
        const dist = Vector3.Distance(shoulderPos, handPos);
        arm.scaling.set(1, dist, 1);

        // Orient Y axis from shoulder toward hand
        const dir = handPos.subtract(shoulderPos).normalize();
        const yAxis = Vector3.Up();
        const dot = Vector3.Dot(yAxis, dir);
        if (Math.abs(dot) > 0.9999) {
            arm.rotationQuaternion = dot > 0
                ? Quaternion.Identity()
                : Quaternion.RotationAxis(Vector3.Right(), Math.PI);
        } else {
            const axis = Vector3.Cross(yAxis, dir).normalize();
            const angle = Math.acos(Math.max(-1, Math.min(1, dot)));
            arm.rotationQuaternion = Quaternion.RotationAxis(axis, angle);
        }
    }
}
