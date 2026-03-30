import { Engine, Scene, Vector3, HemisphericLight, MeshBuilder, StandardMaterial, Color3, FreeCamera, AmmoJSPlugin, PhysicsImpostor, WebXRFeatureName } from "@babylonjs/core";
import "@babylonjs/core/Physics/physicsEngineComponent";

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
        await Ammo();

        const camera = new FreeCamera("camera", new Vector3(0, 1.6, -5), this.scene);
        camera.setTarget(Vector3.Zero());
        camera.attachControl(document.getElementById("renderCanvas"), true);
        
        const light = new HemisphericLight("light", new Vector3(0, 1, 0), this.scene);
        light.intensity = 0.8;

        const ammoPlugin = new AmmoJSPlugin(true, Ammo);
        this.scene.enablePhysics(new Vector3(0, -9.81, 0), ammoPlugin);

        const ground = MeshBuilder.CreateGround("ground", { width: 50, height: 50 }, this.scene);
        const groundMaterial = new StandardMaterial("groundMat", this.scene);
        groundMaterial.diffuseColor = new Color3(0.3, 0.3, 0.3); // Simple gray floor
        ground.material = groundMaterial;

        ground.physicsImpostor = new PhysicsImpostor(
            ground, 
            PhysicsImpostor.BoxImpostor, 
            { mass: 0, restitution: 0.9, friction: 0.5 }, 
            this.scene
        );

        try {
            const xr = await this.scene.createDefaultXRExperienceAsync({
                floorMeshes: [ground],
                uiOptions: {
                    sessionMode: "immersive-vr",
                    referenceSpaceType: "local-floor"
                }
            });

            try {
                xr.baseExperience.featuresManager.enableFeature(WebXRFeatureName.HAND_TRACKING, "latest", {
                    xrInput: xr.input,
                });
            } catch (err) {}

            try {
                xr.baseExperience.featuresManager.enableFeature(WebXRFeatureName.PHYSICS_CONTROLLERS, "latest", {
                    xrInput: xr.input,
                    physicsProperties: {
                        restitution: 0.5,
                        impostorSize: 0.1,
                        impostorType: PhysicsImpostor.BoxImpostor
                    },
                    enableHeadsetImpostor: true
                });
            } catch (err) {}

        } catch (e) {
            console.warn("XR not supported in your environment", e);
        }
    }
}

new App();
