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

    // Arm-swing locomotion tracking (Gorilla Tag style)
    private prevGripPosL: Vector3 | null = null;
    private prevGripPosR: Vector3 | null = null;
    private velocityL = Vector3.Zero();
    private velocityR = Vector3.Zero();
    private moveSpeed = 0;
    private walkPhase = 0;

    // Tuning constants
    private readonly VEL_THRESHOLD = 0.4;   // m/s minimum swing to count
    private readonly MAX_SPEED = 4.0;       // m/s top movement speed
    private readonly ACCEL = 8.0;           // how fast moveSpeed ramps up
    private readonly FRICTION = 5.0;        // how fast moveSpeed decays

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

        // Arm-swing locomotion: Gorilla Tag style
        const movement = this.computeArmSwingLocomotion(cam, deltaTime);

        // Animate legs from movement speed
        if (this.moveSpeed > 0.1) {
            this.walkPhase += deltaTime * this.moveSpeed * 3.5;
            const amplitude = Math.min(1, this.moveSpeed / 2.0) * 0.6;
            this.legL.rotation.x = Math.sin(this.walkPhase) * amplitude;
            this.legR.rotation.x = -Math.sin(this.walkPhase) * amplitude;
        } else {
            this.legL.rotation.x = 0;
            this.legR.rotation.x = 0;
        }

        return movement;
    }

    private computeArmSwingLocomotion(cam: Camera, dt: number): Vector3 {
        const fwd = cam.getDirection(Vector3.Forward());
        fwd.y = 0;
        fwd.normalize();

        // Compute per-controller velocity from frame deltas
        this.velocityL = this.gripVelocity(this.controllerLeft, this.prevGripPosL, dt);
        this.prevGripPosL = this.controllerLeft?.grip
            ? this.controllerLeft.grip.absolutePosition.clone() : null;

        this.velocityR = this.gripVelocity(this.controllerRight, this.prevGripPosR, dt);
        this.prevGripPosR = this.controllerRight?.grip
            ? this.controllerRight.grip.absolutePosition.clone() : null;

        // Measure backward swing intensity for each hand.
        // Gorilla Tag style: pushing hands backward propels you forward.
        // Negative dot with camera forward = hand moving backward.
        const headFwd = cam.getDirection(Vector3.Forward());
        const swingL = Math.max(0, -Vector3.Dot(this.velocityL, headFwd));
        const swingR = Math.max(0, -Vector3.Dot(this.velocityR, headFwd));

        // Apply velocity threshold — ignore tiny idle jitter
        const effectiveL = swingL > this.VEL_THRESHOLD ? swingL : 0;
        const effectiveR = swingR > this.VEL_THRESHOLD ? swingR : 0;
        const totalSwing = effectiveL + effectiveR;

        // Ramp speed up when swinging, friction when not
        if (totalSwing > 0) {
            // Nonlinear: stronger swings accelerate faster
            const targetSpeed = Math.min(this.MAX_SPEED, totalSwing * 2.0);
            this.moveSpeed += (targetSpeed - this.moveSpeed) * Math.min(1, this.ACCEL * dt);
        } else {
            this.moveSpeed -= this.moveSpeed * Math.min(1, this.FRICTION * dt);
            if (this.moveSpeed < 0.01) this.moveSpeed = 0;
        }

        if (this.moveSpeed > 0) {
            return fwd.scale(this.moveSpeed * dt);
        }
        return Vector3.Zero();
    }

    private gripVelocity(controller: WebXRInputSource | null, prevPos: Vector3 | null, dt: number): Vector3 {
        if (!controller?.grip || !prevPos || dt <= 0) return Vector3.Zero();
        const pos = controller.grip.absolutePosition;
        return pos.subtract(prevPos).scale(1 / dt);
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
