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

    // Desktop keyboard input state
    private keysPressed: { [key: string]: boolean } = {};
    private lastMouseX = 0;
    private lastMouseY = 0;
    private desktopMouseTurnX = 0;
    private desktopMouseTurnY = 0;

    // Treadmill / Walking-in-Place locomotion tracking
    private prevGripPosL: Vector3 | null = null;
    private prevGripPosR: Vector3 | null = null;
    private moveSpeed = 0;
    private turnSpeed = 0;
    private walkPhase = 0;

    // Tuning constants
    private readonly VEL_THRESHOLD = 0.4;   // m/s minimum vertical pump to count
    private readonly MAX_SPEED = 4.0;       // m/s top movement speed
    private readonly MAX_TURN = 1.5;        // rad/s max turn rate
    private readonly ACCEL = 5.0;           // speed ramp-up rate
    private readonly FRICTION = 4.0;        // speed decay rate
    private readonly TURN_FRICTION = 6.0;   // turn decay rate
    private readonly DESKTOP_MOUSE_SENSITIVITY = 0.005;  // mouse look sensitivity

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
        this.armL.parent = this.bodyRoot;
        this.armL.position.set(-0.3, -0.38, 0); // Shoulder position relative to body root

        this.armR = MeshBuilder.CreateBox("playerArmR", { width: 0.12, height: 1, depth: 0.12 }, scene);
        this.armR.material = uniformMat;
        this.armR.isPickable = false;
        this.armR.parent = this.bodyRoot;
        this.armR.position.set(0.3, -0.38, 0); // Shoulder position relative to body root

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

        // Add desktop keyboard and mouse input listeners
        document.addEventListener("keydown", (e) => {
            this.keysPressed[e.key.toLowerCase()] = true;
        });
        document.addEventListener("keyup", (e) => {
            this.keysPressed[e.key.toLowerCase()] = false;
        });
        document.addEventListener("mousemove", (e) => {
            const deltaX = e.clientX - this.lastMouseX;
            const deltaY = e.clientY - this.lastMouseY;
            this.lastMouseX = e.clientX;
            this.lastMouseY = e.clientY;
            if (document.pointerLockElement === document.body || document.pointerLockElement === document.documentElement) {
                this.desktopMouseTurnX += deltaX * this.DESKTOP_MOUSE_SENSITIVITY;
                this.desktopMouseTurnY += deltaY * this.DESKTOP_MOUSE_SENSITIVITY;
            } else {
                // Reset mouse inputs when pointer lock is not active
                this.desktopMouseTurnX = 0;
                this.desktopMouseTurnY = 0;
            }
        });
    }

    public setController(handedness: "left" | "right", controller: WebXRInputSource | null): void {
        if (handedness === "left") this.controllerLeft = controller;
        if (handedness === "right") this.controllerRight = controller;
    }

    /** Pulse haptics on both controllers (intensity 0-1, duration in ms). */
    public pulseHaptics(intensity: number, durationMs: number): void {
        for (const ctrl of [this.controllerLeft, this.controllerRight]) {
            if (!ctrl) continue;
            const gp = ctrl.inputSource.gamepad;
            if ((gp as any)?.hapticActuators?.[0]) {
                (gp as any).hapticActuators[0].pulse(intensity, durationMs);
            } else if ((gp as any)?.vibrationActuator) {
                (gp as any).vibrationActuator.playEffect("dual-rumble", {
                    duration: durationMs, strongMagnitude: intensity, weakMagnitude: intensity * 0.5
                });
            }
        }
    }

    /** Returns the left arm mesh for attaching wrist UI elements. */
    public getLeftArm(): Mesh {
        return this.armL;
    }

    /** Returns the right arm mesh for attaching wrist UI elements. */
    public getRightArm(): Mesh {
        return this.armR;
    }

    /** Returns world positions of all body-part meshes for collision checks. */
    public getBodyPartPositions(): Vector3[] {
        return [
            this.torso.absolutePosition,
            this.armL.absolutePosition,
            this.armR.absolutePosition,
            this.legL.absolutePosition,
            this.legR.absolutePosition,
        ];
    }

    /** Set the body root position (for placing player in the formation). */
    public setBodyPosition(pos: Vector3): void {
        this.bodyRoot.position.copyFrom(pos);
    }

    /**
     * Returns movement vector and turn angle driven by treadmill arm-pump locomotion.
     * The caller should apply movement to camera position and turnY to camera rotation.
     */
    public update(cam: Camera, marchPhase: number, isMarching: boolean, deltaTime: number): { movement: Vector3; turnY: number } {
        // Body root follows camera position and Y rotation
        this.bodyRoot.position.copyFrom(cam.globalPosition);
        this.bodyRoot.rotation.y = cam.absoluteRotation.toEulerAngles().y;

        // Stretch arms from shoulders to hands (controllers or desktop fallback)
        this.updateArm(this.armL, this.controllerLeft, cam, -0.3, marchPhase, isMarching);
        this.updateArm(this.armR, this.controllerRight, cam, 0.3, marchPhase, isMarching);

        // Treadmill locomotion: pump arms up & down to march forward
        const result = this.computeTreadmillLocomotion(cam, deltaTime);

        // Animate legs only when game is actively marching
        // When not marching, keep legs at rest regardless of moveSpeed
        if (isMarching) {
            const absSpeed = Math.abs(this.moveSpeed);
            if (absSpeed > 0.1) {
                this.walkPhase += deltaTime * absSpeed * 3.5;
                const amplitude = Math.min(1, absSpeed / 2.0) * 0.6;
                const dir = this.moveSpeed >= 0 ? 1 : -1;
                this.legL.rotation.x = Math.sin(this.walkPhase) * amplitude * dir;
                this.legR.rotation.x = -Math.sin(this.walkPhase) * amplitude * dir;
            } else {
                this.legL.rotation.x = 0;
                this.legR.rotation.x = 0;
            }
        } else {
            // Game not marching: keep legs at rest
            this.legL.rotation.x = 0;
            this.legR.rotation.x = 0;
            // Reset movement speed when not marching (prevents carryover)
            this.moveSpeed = 0;
            this.turnSpeed = 0;
        }

        return result;
    }

    private computeTreadmillLocomotion(cam: Camera, dt: number): { movement: Vector3; turnY: number } {
        // Check if VR controllers are connected
        const hasVRInput = this.controllerLeft !== null || this.controllerRight !== null;

        if (!hasVRInput) {
            // Desktop fallback: use keyboard and mouse input
            return this.computeDesktopLocomotion(cam, dt);
        }

        // VR mode: compute per-controller velocity from frame deltas
        const velL = this.gripVelocity(this.controllerLeft, this.prevGripPosL, dt);
        this.prevGripPosL = this.controllerLeft?.grip
            ? this.controllerLeft.grip.absolutePosition.clone() : null;

        const velR = this.gripVelocity(this.controllerRight, this.prevGripPosR, dt);
        this.prevGripPosR = this.controllerRight?.grip
            ? this.controllerRight.grip.absolutePosition.clone() : null;

        // Treadmill: measure vertical arm-pump intensity per hand
        // Absolute vertical speed captures the up-and-down pumping motion
        const pumpL = Math.abs(velL.y) > this.VEL_THRESHOLD ? Math.abs(velL.y) : 0;
        const pumpR = Math.abs(velR.y) > this.VEL_THRESHOLD ? Math.abs(velR.y) : 0;

        // Total pump intensity drives forward speed
        const totalPump = pumpL + pumpR;

        // Differential pumping for turning:
        // Left arm pumps harder → turn right (positive Y rotation)
        const turnPump = pumpL - pumpR;

        // Update forward speed with acceleration/friction
        if (totalPump > 0) {
            const targetSpeed = Math.min(this.MAX_SPEED, totalPump * 1.2);
            this.moveSpeed += (targetSpeed - this.moveSpeed) * Math.min(1, this.ACCEL * dt);
        } else {
            if (this.moveSpeed < 0.05) {
                this.moveSpeed = 0;
            } else {
                this.moveSpeed -= Math.min(this.moveSpeed, this.FRICTION * dt);
            }
        }

        // Update turn speed with acceleration/friction
        if (Math.abs(turnPump) > 0.1) {
            const targetTurn = Math.max(-this.MAX_TURN, Math.min(this.MAX_TURN, turnPump * 0.8));
            this.turnSpeed += (targetTurn - this.turnSpeed) * Math.min(1, this.ACCEL * dt);
        } else {
            if (Math.abs(this.turnSpeed) < 0.05) {
                this.turnSpeed = 0;
            } else {
                this.turnSpeed -= Math.sign(this.turnSpeed) * Math.min(Math.abs(this.turnSpeed), this.TURN_FRICTION * dt);
            }
        }

        // Move in head-forward direction (Y-flattened), always forward
        let movement = Vector3.Zero();
        if (this.moveSpeed > 0.01) {
            const fwd = cam.getDirection(Vector3.Forward());
            fwd.y = 0;
            fwd.normalize();
            movement = fwd.scale(this.moveSpeed * dt);
        }

        return { movement, turnY: this.turnSpeed * dt };
    }

    private computeDesktopLocomotion(cam: Camera, dt: number): { movement: Vector3; turnY: number } {
        // WASD / Arrow keys for movement, Q/E for turning
        const moveForward = this.keysPressed['w'] || this.keysPressed['arrowup'];
        const moveBackward = this.keysPressed['s'] || this.keysPressed['arrowdown'];
        const moveLeft = this.keysPressed['a'] || this.keysPressed['arrowleft'];
        const moveRight = this.keysPressed['d'] || this.keysPressed['arrowright'];
        const turnLeft = this.keysPressed['q'];
        const turnRight = this.keysPressed['e'];

        // Compute desired speed: forward is positive, backward is negative
        let targetSpeed = 0;
        if (moveForward) targetSpeed = 2.5; // Default movement speed
        else if (moveBackward) targetSpeed = -1.5;

        // Update forward speed with acceleration
        const speedDiff = targetSpeed - this.moveSpeed;
        if (Math.abs(speedDiff) > 0.01) {
            this.moveSpeed += speedDiff * Math.min(1, this.ACCEL * dt);
        } else {
            this.moveSpeed = targetSpeed;
        }

        // Strafing with A/D or left/right arrow keys
        let strafeDir = 0;
        if (moveLeft) strafeDir = -1;
        else if (moveRight) strafeDir = 1;

        // Compute movement vector
        let movement = Vector3.Zero();
        if (Math.abs(this.moveSpeed) > 0.01 || strafeDir !== 0) {
            const fwd = cam.getDirection(Vector3.Forward());
            fwd.y = 0;
            fwd.normalize();
            
            const right = Vector3.Cross(Vector3.Up(), fwd);
            right.normalize();

            movement = fwd.scale(this.moveSpeed * dt).add(right.scale(strafeDir * 2.0 * dt));
        }

        // Compute target turn speed from Q/E keys and mouse
        let targetTurn = 0;
        if (turnLeft) targetTurn = -2.0;    // Full turn speed left
        if (turnRight) targetTurn = 2.0;   // Full turn speed right
        targetTurn += this.desktopMouseTurnX;  // Add mouse delta if present

        // Update turn speed with acceleration
        const turnDiff = targetTurn - this.turnSpeed;
        if (Math.abs(turnDiff) > 0.01) {
            this.turnSpeed += turnDiff * Math.min(1, this.ACCEL * dt);
        } else {
            this.turnSpeed = targetTurn;
        }

        // Reset mouse input each frame (only apply for one frame, don't accumulate)
        this.desktopMouseTurnX = 0;
        this.desktopMouseTurnY = 0;

        return { movement, turnY: this.turnSpeed * dt };
    }

    private gripVelocity(controller: WebXRInputSource | null, prevPos: Vector3 | null, dt: number): Vector3 {
        if (!controller?.grip || !prevPos || dt <= 0) return Vector3.Zero();
        const pos = controller.grip.absolutePosition;
        return pos.subtract(prevPos).scale(1 / dt);
    }

    private updateArm(arm: Mesh, controller: WebXRInputSource | null, cam: Camera, xOffset: number, marchPhase: number, isMarching: boolean): void {
        // Shoulder position in world space (arm's local position transforms to world via bodyRoot parent)
        const shoulderPos = arm.absolutePosition.clone();

        // Hand position: VR controller grip or desktop fallback
        let handPos: Vector3;
        if (controller && controller.grip) {
            handPos = controller.grip.absolutePosition.clone();
        } else {
            const fwd = cam.getDirection(Vector3.Forward());
            const right = cam.getDirection(Vector3.Right());
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

        // Stretch arm from shoulder to hand: position at midpoint, scale Y to distance
        Vector3.CenterToRef(shoulderPos, handPos, arm.position);
        // Convert midpoint back to local coordinates since arm is a child of bodyRoot
        arm.position.subtractInPlace(this.bodyRoot.position);
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
