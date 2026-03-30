import { Engine, Scene, Vector3, HemisphericLight, MeshBuilder, StandardMaterial, Color3, FreeCamera, AmmoJSPlugin, PhysicsImpostor } from "@babylonjs/core";
import "@babylonjs/core/Physics/physicsEngineComponent";

// Make sure global Ammo object is available
declare var Ammo: any;

class App {
    private engine: Engine;
    private scene: Scene;

    constructor() {
        const canvas = document.getElementById("renderCanvas") as HTMLCanvasElement;
        this.engine = new Engine(canvas, true);
        this.scene = new Scene(this.engine);
        
        this.init().then(() => {
            this.engine.runRenderLoop(() => {
                this.scene.render();
            });
            window.addEventListener("resize", () => {
                this.engine.resize();
            });
        });
    }

    private async init() {
        // Wait for global Ammo to load from the CDN script
        await Ammo();

        // 1. Setup Camera and Lighting
        const camera = new FreeCamera("camera", new Vector3(0, 1.6, -5), this.scene);
        camera.setTarget(Vector3.Zero());
        camera.attachControl(document.getElementById("renderCanvas"), true);
        
        const light = new HemisphericLight("light", new Vector3(0, 1, 0), this.scene);
        light.intensity = 0.8;

        // 2. Initialize Physics (Ammo.js)
        const ammoPlugin = new AmmoJSPlugin(true, Ammo);
        this.scene.enablePhysics(new Vector3(0, -9.81, 0), ammoPlugin);

        // 3. Create Court (Ground)
        this.createCourt();

        // 4. Create Hoops
        this.createHoop(new Vector3(0, 0, 10)); // Opposite hoop
        this.createHoop(new Vector3(0, 0, -10)); // Near hoop

        // 5. Create Basketballs
        this.createBasketball(new Vector3(0, 5, 0));
        this.createBasketball(new Vector3(1, 4, 1));
        this.createBasketball(new Vector3(-1, 6, -1));

        // 5.1 Create Room & Whiteboard
        this.createRoom();
        this.createWhiteboard();

        // 6. Setup WebXR Experience
        try {
            await this.scene.createDefaultXRExperienceAsync({
                floorMeshes: [this.scene.getMeshByName("court")!]
            });
        } catch (e) {
            console.warn("XR not supported in your environment", e);
        }
    }

    private createCourt() {
        const court = MeshBuilder.CreateGround("court", { width: 15, height: 28 }, this.scene);
        const courtMaterial = new StandardMaterial("courtMat", this.scene);
        courtMaterial.diffuseColor = new Color3(0.85, 0.65, 0.45); // Hardwood color
        court.material = courtMaterial;

        // Physics Impostor (Static)
        court.physicsImpostor = new PhysicsImpostor(
            court, 
            PhysicsImpostor.BoxImpostor, 
            { mass: 0, restitution: 0.9, friction: 0.5 }, 
            this.scene
        );
    }

    private createHoop(position: Vector3) {
        // Simple backboard
        const backboard = MeshBuilder.CreateBox("backboard", { width: 1.8, height: 1.05, depth: 0.1 }, this.scene);
        backboard.position = position.clone().add(new Vector3(0, 3.05, 0));
        
        const bbMaterial = new StandardMaterial("bbMat", this.scene);
        bbMaterial.diffuseColor = new Color3(1, 1, 1);
        backboard.material = bbMaterial;

        backboard.physicsImpostor = new PhysicsImpostor(
            backboard, 
            PhysicsImpostor.BoxImpostor, 
            { mass: 0, restitution: 0.8 }, 
            this.scene
        );

        // Pole
        const pole = MeshBuilder.CreateCylinder("pole", { height: 3.05, diameter: 0.15 }, this.scene);
        pole.position = position.clone().add(new Vector3(0, 3.05 / 2, -0.4)); // Behind backboard
        
        pole.physicsImpostor = new PhysicsImpostor(
            pole,
            PhysicsImpostor.CylinderImpostor,
            { mass: 0, restitution: 0.5 },
            this.scene
        );
        
        // Simple ring representation (Torus) - Note: simple torus impostor in Ammo can be complex, using MeshImpostor or approximations.
        const rim = MeshBuilder.CreateTorus("rim", { diameter: 0.45, thickness: 0.05 }, this.scene);
        rim.position = backboard.position.clone().add(new Vector3(0, -0.2, 0.3));
        
        const rimMat = new StandardMaterial("rimMat", this.scene);
        rimMat.diffuseColor = new Color3(1, 0.4, 0); // Orange rim
        rim.material = rimMat;

        // For proper rim physics allowing balls to go *through*, 
        // we use a mesh impostor.
        rim.physicsImpostor = new PhysicsImpostor(
            rim,
            PhysicsImpostor.MeshImpostor,
            { mass: 0, restitution: 0.7, friction: 0.5 },
            this.scene
        );
    }

    private createBasketball(position: Vector3) {
        const ball = MeshBuilder.CreateSphere("basketball", { diameter: 0.24 }, this.scene); // Pro regulation size
        ball.position = position;

        const ballMaterial = new StandardMaterial("ballMat", this.scene);
        ballMaterial.diffuseColor = new Color3(0.9, 0.4, 0.1); // Orange
        ball.material = ballMaterial;

        // Bouncy physics
        ball.physicsImpostor = new PhysicsImpostor(
            ball, 
            PhysicsImpostor.SphereImpostor, 
            { mass: 0.6, restitution: 0.9, friction: 0.6 }, 
            this.scene
        );
        
        // Ensure balls can be grabbed in XR (Basic XR implementation)
        // Advanced XR grab requires pointer interactions, but Babylon helper helps.
    }

    private createRoom() {
        const wallMaterial = new StandardMaterial("wallMat", this.scene);
        wallMaterial.diffuseColor = new Color3(0.9, 0.9, 0.9); // Off-white walls 

        const optionsWalls = { mass: 0, restitution: 0.5, friction: 0.5 };

        // Left wall
        const leftWall = MeshBuilder.CreateBox("leftWall", { width: 0.2, height: 10, depth: 30 }, this.scene);
        leftWall.position = new Vector3(-7.6, 5, 0);
        leftWall.material = wallMaterial;
        leftWall.physicsImpostor = new PhysicsImpostor(leftWall, PhysicsImpostor.BoxImpostor, optionsWalls, this.scene);

        // Right wall
        const rightWall = MeshBuilder.CreateBox("rightWall", { width: 0.2, height: 10, depth: 30 }, this.scene);
        rightWall.position = new Vector3(7.6, 5, 0);
        rightWall.material = wallMaterial;
        rightWall.physicsImpostor = new PhysicsImpostor(rightWall, PhysicsImpostor.BoxImpostor, optionsWalls, this.scene);

        // Front wall
        const frontWall = MeshBuilder.CreateBox("frontWall", { width: 15.4, height: 10, depth: 0.2 }, this.scene);
        frontWall.position = new Vector3(0, 5, 14.1);
        frontWall.material = wallMaterial;
        frontWall.physicsImpostor = new PhysicsImpostor(frontWall, PhysicsImpostor.BoxImpostor, optionsWalls, this.scene);

        // Back wall
        const backWall = MeshBuilder.CreateBox("backWall", { width: 15.4, height: 10, depth: 0.2 }, this.scene);
        backWall.position = new Vector3(0, 5, -14.1);
        backWall.material = wallMaterial;
        backWall.physicsImpostor = new PhysicsImpostor(backWall, PhysicsImpostor.BoxImpostor, optionsWalls, this.scene);

        // Ceiling
        const ceiling = MeshBuilder.CreateBox("ceiling", { width: 15.4, height: 0.2, depth: 30 }, this.scene);
        ceiling.position = new Vector3(0, 10.1, 0);
        ceiling.material = wallMaterial;
        ceiling.physicsImpostor = new PhysicsImpostor(ceiling, PhysicsImpostor.BoxImpostor, optionsWalls, this.scene);
    }

    private createWhiteboard() {
        // Main board
        const whiteboard = MeshBuilder.CreateBox("whiteboard", { width: 0.1, height: 1.5, depth: 3 }, this.scene);
        whiteboard.position = new Vector3(-7.45, 1.8, 0); // on the left wall, roughly eye level

        const wbMat = new StandardMaterial("wbMat", this.scene);
        wbMat.diffuseColor = new Color3(1, 1, 1);
        wbMat.specularColor = new Color3(0.5, 0.5, 0.5); // Slight shine like a real whiteboard
        whiteboard.material = wbMat;

        // Tray / Trim
        const tray = MeshBuilder.CreateBox("tray", { width: 0.15, height: 0.05, depth: 3.1 }, this.scene);
        tray.position = new Vector3(-7.4, 1.05, 0);
        
        const trayMat = new StandardMaterial("trayMat", this.scene);
        trayMat.diffuseColor = new Color3(0.6, 0.6, 0.6); // Gray metallic
        tray.material = trayMat;

        // Adding Physics so balls can bounce off it
        whiteboard.physicsImpostor = new PhysicsImpostor(whiteboard, PhysicsImpostor.BoxImpostor, { mass: 0, restitution: 0.5 }, this.scene);
        tray.physicsImpostor = new PhysicsImpostor(tray, PhysicsImpostor.BoxImpostor, { mass: 0, restitution: 0.5 }, this.scene);
    }
}

new App();