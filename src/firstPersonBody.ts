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

    public update(cam: Camera, marchPhase: number, isMarching: boolean): void {
        // Body root follows camera position and Y rotation
        this.bodyRoot.position.copyFrom(cam.globalPosition);
        this.bodyRoot.rotation.y = cam.absoluteRotation.toEulerAngles().y;

        // Stretch arms from shoulders to hands (controllers or desktop fallback)
        this.updateArm(this.armL, this.controllerLeft, cam, -0.3, marchPhase, isMarching);
        this.updateArm(this.armR, this.controllerRight, cam, 0.3, marchPhase, isMarching);

        // Animate legs and arms during march
        if (isMarching) {
            this.legL.rotation.x = Math.sin(marchPhase) * 0.6;
            this.legR.rotation.x = -Math.sin(marchPhase) * 0.6;
        }
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
            // Swing hands slightly during march on desktop
            if (isMarching) {
                const swing = Math.sin(marchPhase) * 0.1 * Math.sign(xOffset);
                handPos.addInPlace(fwd.scale(swing));
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
