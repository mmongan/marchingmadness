import { Engine, Scene, Vector3, HemisphericLight, MeshBuilder, StandardMaterial, Color3, FreeCamera, AmmoJSPlugin, PhysicsImpostor, WebXRFeatureName, ActionManager, ExecuteCodeAction } from "@babylonjs/core";
import "@babylonjs/core/Physics/physicsEngineComponent";
import * as Tone from "tone";

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

        // 3.5 Create VR Drum & Synth
        this.createDrum();

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

            // Ensure Tone starts upon entering VR
            xr.baseExperience.sessionManager.onXRSessionInit.add(async () => {
                await Tone.start();
                console.log("Audio ready");
            });

        } catch (e) {
            console.warn("XR not supported in your environment", e);
        }
    }

    private drumSynth: Tone.MembraneSynth | null = null;
    private drumLastHit = 0;

    private createDrum() {
        // Setup Tone.js Synth
        this.drumSynth = new Tone.MembraneSynth().toDestination();

        // Visual Drum Mesh
        const drum = MeshBuilder.CreateCylinder("drum", { diameter: 0.6, height: 0.3 }, this.scene);
        drum.position = new Vector3(0, 1, 1); // 1m high, 1m in front of starting position
        
        const drumMat = new StandardMaterial("drumMat", this.scene);
        drumMat.diffuseColor = new Color3(0.8, 0.2, 0.2); // Red drum
        drum.material = drumMat;

        // Physics so it feels solid
        drum.physicsImpostor = new PhysicsImpostor(
            drum, 
            PhysicsImpostor.CylinderImpostor, 
            { mass: 0, restitution: 0.1 }, 
            this.scene
        );

        // Interaction via XR Pointers or Mouse Clicks
        drum.actionManager = new ActionManager(this.scene);
        drum.actionManager.registerAction(
            new ExecuteCodeAction(ActionManager.OnPickDownTrigger, async () => {
                await Tone.start(); // Ensure context is running if clicked before VR
                this.hitDrum();
            })
        );

        // Setup a collision check loop directly vs controller/hand physics meshes
        // This simulates a physical "thwack" if the controller bumps it
        this.scene.onBeforeRenderObservable.add(() => {
            const now = Date.now();
            if (now - this.drumLastHit < 200) return; // Basic debounce (200ms)

            // Very basic distance check for controllers (approximated)
            // A more rigorous approach involves registering onCollide physics events, but WebXR dynamically adds impostors.
            // This grabs XR controllers if they are close enough
            this.scene.meshes.forEach(mesh => {
                // If it's a headset or a controller mesh (added by physics/hand tracking)
                if (mesh.name.indexOf("controller") !== -1 || mesh.name.indexOf("hand") !== -1 || mesh.name.indexOf("handTracker") !== -1) {
                    if (Vector3.Distance(mesh.absolutePosition, drum.position) < 0.4) {
                        this.hitDrum();
                    }
                }
            });
        });
    }

    private hitDrum() {
        const now = Date.now();
        if (this.drumSynth && (now - this.drumLastHit) > 100) {
            this.drumLastHit = now;
            // Play a punchy C2 note
            this.drumSynth.triggerAttackRelease("C2", "8n");
            
            // Brief visual flash
            const mat = this.scene.getMeshByName("drum")?.material as StandardMaterial;
            if (mat) {
                mat.emissiveColor = new Color3(0.5, 0.5, 0.5);
                setTimeout(() => mat.emissiveColor = new Color3(0, 0, 0), 100);
            }
        }
    }
}

new App();
