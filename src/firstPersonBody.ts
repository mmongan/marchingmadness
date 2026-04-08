import { Scene, Mesh, MeshBuilder, StandardMaterial, Color3, Matrix, TransformNode, Vector3, Camera } from "@babylonjs/core";
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
        this.torso.position.set(0, -0.65, 0.05);

        // Arms are NOT parented to bodyRoot — positioned independently to track controllers
        // Bake 90° X rotation so the long axis (0.5) aligns with grip forward (forearm direction)
        // and offset pivot to the hand end
        this.armL = MeshBuilder.CreateBox("playerArmL", { width: 0.12, height: 0.5, depth: 0.12 }, scene);
        this.armL.bakeTransformIntoVertices(Matrix.RotationX(-Math.PI / 2).multiply(Matrix.Translation(0, 0, -0.25)));
        this.armL.material = uniformMat;
        this.armL.isPickable = false;
        this.armL.position.set(-0.3, -0.35, 0.15);

        this.armR = MeshBuilder.CreateBox("playerArmR", { width: 0.12, height: 0.5, depth: 0.12 }, scene);
        this.armR.bakeTransformIntoVertices(Matrix.RotationX(-Math.PI / 2).multiply(Matrix.Translation(0, 0, -0.25)));
        this.armR.material = uniformMat;
        this.armR.isPickable = false;
        this.armR.position.set(0.3, -0.35, 0.15);

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

        // Track arms to XR controllers, or fall back to body-relative default
        this.updateArm(this.armL, this.controllerLeft, cam, -0.3);
        this.updateArm(this.armR, this.controllerRight, cam, 0.3);

        // Animate legs and arms during march
        if (isMarching) {
            this.legL.rotation.x = Math.sin(marchPhase) * 0.6;
            this.legR.rotation.x = -Math.sin(marchPhase) * 0.6;
        }
    }

    private updateArm(arm: Mesh, controller: WebXRInputSource | null, cam: Camera, xOffset: number): void {
        if (controller && controller.grip) {
            const grip = controller.grip;
            arm.position.copyFrom(grip.absolutePosition);
            arm.rotationQuaternion = grip.absoluteRotationQuaternion?.clone() ?? null;
        } else {
            const fwd = cam.getDirection(Vector3.Forward());
            const right = cam.getDirection(Vector3.Right());
            arm.position.copyFrom(cam.globalPosition)
                .addInPlace(right.scale(xOffset))
                .addInPlace(fwd.scale(0.3))
                .addInPlace(Vector3.Up().scale(-0.4));
            arm.rotationQuaternion = null;
            arm.rotation.set(0, cam.absoluteRotation.toEulerAngles().y, 0);
        }
    }
}
