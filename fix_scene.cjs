const fs = require('fs');

let mainCode = fs.readFileSync('src/main.ts', 'utf-8');

const regex = /    private async createNotationBoard\(\) \{[\s\S]*?    private generateRandomMusicXML\(numMeasures: number\): string \{/g;

const newImplementation = `    private async createNotationBoard() {
        console.log("Setting up standard OSMD music board for XR...");
        
        // 1) Setup a music stand Parent node directly behind the drum
        const standParent = new TransformNode("musicStand", this.scene);
        standParent.position = new Vector3(0, 1.4, 1.4); // Eye level, behind drum
        // Tilt slightly back for reading
        standParent.rotation.x = -Math.PI / 8;

        // 2) Standard Sheet Music Dimensions (A4-ish proportions)
        const pageWidthMeters = 1.0;
        
        // A high-res wrap width for the sheet music
        const texW = 1536;

        // 3) Create an invisible div for OSMD to render the canvas
        const osmdContainer = document.createElement("div");
        osmdContainer.style.position = "absolute";
        osmdContainer.style.top = "-9999px";
        osmdContainer.style.width = texW + "px"; // Force standard wrap width
        // no fixed height, let OSMD expand it downwards as needed to fit standard page layouts
        document.body.appendChild(osmdContainer);

        try {
            const osmd = new OpenSheetMusicDisplay(osmdContainer, {
                backend: "canvas",
                drawTitle: true,
                drawPartNames: false,
                autoResize: false, // Freeze layout so it doesn't break texture sizes
            });

            // Adjust sizing lines for great VR readability
            osmd.EngravingRules.StaffLineWidth = 2.0;
            osmd.EngravingRules.StemWidth = 3.0;
            osmd.EngravingRules.BeamWidth = 2.5;
            osmd.zoom = 1.5;

            // Generate or load some standard music xml
            const musicXml = this.generateRandomMusicXML(16); // Only 16 measures to fit neatly as standard sheet music
            await osmd.load(musicXml);
            osmd.render();

            const osmdCanvas = osmdContainer.querySelector("canvas") as HTMLCanvasElement;
            if (osmdCanvas) {
                console.log(\`Rendered OSMD to \${osmdCanvas.width}x\${osmdCanvas.height}\`);
                
                // We use the actual height rendered by OSMD to scale the 3D mesh perfectly
                const actualRatio = osmdCanvas.height / osmdCanvas.width;
                const actualHeightMeters = pageWidthMeters * actualRatio;

                const texture = new DynamicTexture("sheetMusicTex", {width: osmdCanvas.width, height: osmdCanvas.height}, this.scene, false);
                const ctx = texture.getContext() as CanvasRenderingContext2D;

                // Fill with standard solid white background
                ctx.fillStyle = "white";
                ctx.fillRect(0, 0, osmdCanvas.width, osmdCanvas.height);
                // Draw notation
                ctx.drawImage(osmdCanvas, 0, 0);
                texture.update();
                
                // Nice crisp text mapping without alpha blending issues
                texture.anisotropicFilteringLevel = 16;
                
                const mat = new StandardMaterial("sheetMusicMat", this.scene);
                mat.diffuseTexture = texture;
                mat.emissiveTexture = texture; // Make it pop in VR implicitly via texture
                mat.emissiveColor = new Color3(1, 1, 1);
                mat.disableLighting = true; // Prevents shadows from making paper look gray

                // A single standard reading plane, sized optimally
                const sheetPlane = MeshBuilder.CreatePlane("sheetMusic", { width: pageWidthMeters, height: actualHeightMeters }, this.scene);
                sheetPlane.parent = standParent;
                sheetPlane.material = mat;
                
                console.log("✓ Fully initialized standard sheet music view.");
            }
        } catch (e) {
            console.error("OSMD Failed to load score: ", e);
        } finally {
            if (document.body.contains(osmdContainer)) {
                // document.body.removeChild(osmdContainer);
            }
        }
    }

    private generateRandomMusicXML(numMeasures: number): string {`;

mainCode = mainCode.replace(regex, newImplementation);
fs.writeFileSync('src/main.ts', mainCode);
console.log('Completely rebuilt standard sheet music scene in main.ts!');