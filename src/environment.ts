// Environment setup: skybox and football field
import { Scene, MeshBuilder, StandardMaterial, DynamicTexture, Color3, Texture, CubeTexture, Vector3 } from "@babylonjs/core";

export function buildSkybox(scene: Scene): void {
    const skybox = MeshBuilder.CreateBox("skyBox", { size: 1000.0 }, scene);
    const skyboxMaterial = new StandardMaterial("skyBox", scene);
    skyboxMaterial.backFaceCulling = false;
    skyboxMaterial.reflectionTexture = new CubeTexture("https://playground.babylonjs.com/textures/skybox", scene);
    skyboxMaterial.reflectionTexture.coordinatesMode = Texture.SKYBOX_MODE;
    skyboxMaterial.diffuseColor = new Color3(0, 0, 0);
    skyboxMaterial.specularColor = new Color3(0, 0, 0);
    skybox.infiniteDistance = true;
    skybox.material = skyboxMaterial;
}

export function buildFootballField(scene: Scene): void {
    const lengthX = 109.7;
    const depthZ = 48.8;

    const ground = MeshBuilder.CreateGround("footballField", { width: lengthX, height: depthZ }, scene);
    ground.position = new Vector3(0, -0.01, 0);

    const texWidth = 2048;
    const texHeight = 1024;
    const fieldTex = new DynamicTexture("fieldTex", { width: texWidth, height: texHeight }, scene, true);
    const ctx = fieldTex.getContext() as CanvasRenderingContext2D;

    // Fill grass
    ctx.fillStyle = "#2e7d32";
    ctx.fillRect(0, 0, texWidth, texHeight);

    ctx.strokeStyle = "white";
    ctx.fillStyle = "white";

    const yardsX = 120;
    const pixelsPerYardX = texWidth / yardsX;

    // Endzone backgrounds
    ctx.fillStyle = "#1b5e20";
    ctx.fillRect(0, 0, 10 * pixelsPerYardX, texHeight);
    ctx.fillRect(110 * pixelsPerYardX, 0, 10 * pixelsPerYardX, texHeight);

    ctx.fillStyle = "white";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    for (let yard = 0; yard <= yardsX; yard += 1) {
        const x = yard * pixelsPerYardX;

        ctx.beginPath();
        if (yard >= 10 && yard <= 110) {
            if (yard % 5 === 0) {
                ctx.moveTo(x, 0);
                ctx.lineTo(x, texHeight);
                ctx.lineWidth = (yard % 10 === 0 || yard === 10 || yard === 110) ? 8 : 4;
                ctx.stroke();

                if (yard > 10 && yard < 110 && yard % 10 === 0) {
                    let dispYard = yard - 10;
                    if (dispYard > 50) dispYard = 100 - dispYard;

                    ctx.font = "bold 60px Arial";
                    ctx.save();
                    ctx.translate(x, texHeight * 0.85);
                    ctx.fillText(dispYard.toString(), 0, 0);
                    ctx.restore();

                    ctx.save();
                    ctx.translate(x, texHeight * 0.15);
                    ctx.rotate(Math.PI);
                    ctx.fillText(dispYard.toString(), 0, 0);
                    ctx.restore();
                }
            } else {
                ctx.lineWidth = 2;
                ctx.moveTo(x, 0); ctx.lineTo(x, 15); ctx.stroke();
                ctx.moveTo(x, texHeight); ctx.lineTo(x, texHeight - 15); ctx.stroke();
                ctx.moveTo(x, texHeight * 0.35); ctx.lineTo(x, texHeight * 0.35 + 15); ctx.stroke();
                ctx.moveTo(x, texHeight * 0.65); ctx.lineTo(x, texHeight * 0.65 - 15); ctx.stroke();
            }
        }
    }

    ctx.lineWidth = 8;
    ctx.strokeRect(10 * pixelsPerYardX, 0, 100 * pixelsPerYardX, texHeight);

    // Endzone text
    ctx.font = "bold 100px Arial";
    ctx.save();
    ctx.translate(5 * pixelsPerYardX, texHeight / 2);
    ctx.rotate(Math.PI / 2);
    ctx.fillText("MARCHING", 0, 0);
    ctx.restore();

    ctx.save();
    ctx.translate(115 * pixelsPerYardX, texHeight / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText("MADNESS", 0, 0);
    ctx.restore();

    fieldTex.update();

    const mat = new StandardMaterial("fieldMat", scene);
    mat.diffuseTexture = fieldTex;
    mat.specularColor = new Color3(0.05, 0.05, 0.05);
    ground.material = mat;

    ground.rotation.y = Math.PI / 2;

    const surroundBase = MeshBuilder.CreateGround("surroundBase", { width: 400, height: 400 }, scene);
    surroundBase.position = new Vector3(0, -0.05, 0);
    const surroundMat = new StandardMaterial("surroundMat", scene);
    surroundMat.diffuseColor = new Color3(0.05, 0.15, 0.05);
    surroundMat.specularColor = new Color3(0.01, 0.01, 0.01);
    surroundBase.material = surroundMat;
}
