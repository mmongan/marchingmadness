import { Engine, Scene, Vector3, HemisphericLight, FreeCamera, Color3, StandardMaterial, MeshBuilder, DynamicTexture } from "@babylonjs/core";
import { OpenSheetMusicDisplay } from "opensheetmusicdisplay";

class NotationExamplesApp {
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
        const camera = new FreeCamera("camera", new Vector3(0, 2, -10), this.scene);
        camera.setTarget(new Vector3(0, 1.6, 0));
        camera.attachControl(document.getElementById("renderCanvas"), true);
        camera.speed = 0.15;
        camera.minZ = 0.1;
        
        const light = new HemisphericLight("light", new Vector3(0, 1, 0), this.scene);
        light.intensity = 0.8;

        const ground = MeshBuilder.CreateGround("ground", { width: 50, height: 50 }, this.scene);
        const groundMaterial = new StandardMaterial("groundMat", this.scene);
        groundMaterial.diffuseColor = new Color3(0.3, 0.3, 0.3);
        ground.material = groundMaterial;

        // Examples of every notation via proper OSMD 2D graphics laid onto Solid Extruded Blocks
        await this.createNotationBlock("1. Treble Staff, C-Major, 4/4 Time", this.getXMLSnippet(""), new Vector3(-6, 2, 0));
        await this.createNotationBlock("2. Quarter Notes", this.getXMLSnippet("<note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note><note><pitch><step>E</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>"), new Vector3(-2, 2, 0));
        await this.createNotationBlock("3. Eighth Notes (Beam)", this.getXMLSnippet("<note><pitch><step>G</step><octave>4</octave></pitch><duration>1</duration><type>eighth</type><beam number=\"1\">begin</beam></note><note><pitch><step>A</step><octave>4</octave></pitch><duration>1</duration><type>eighth</type><beam number=\"1\">end</beam></note>"), new Vector3(2, 2, 0));
        await this.createNotationBlock("4. Rests", this.getXMLSnippet("<note><rest/><duration>1</duration><type>quarter</type></note><note><rest/><duration>1</duration><type>eighth</type></note>"), new Vector3(6, 2, 0));
        
        await this.createNotationBlock("5. Accidentals (Sharps & Flats)", this.getXMLSnippet("<note><pitch><step>C</step><alter>1</alter><octave>4</octave></pitch><duration>1</duration><type>quarter</type><accidental>sharp</accidental></note><note><pitch><step>B</step><alter>-1</alter><octave>4</octave></pitch><duration>1</duration><type>quarter</type><accidental>flat</accidental></note>"), new Vector3(-4, -1, 0));
        await this.createNotationBlock("6. Chords", this.getXMLSnippet("<note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note><note><chord/><pitch><step>E</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note><note><chord/><pitch><step>G</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>"), new Vector3(0, -1, 0));
        await this.createNotationBlock("7. Ties and Slurs", this.getXMLSnippet("<note><pitch><step>C</step><octave>5</octave></pitch><duration>1</duration><type>quarter</type><notations><slur type=\"start\" number=\"1\"/></notations></note><note><pitch><step>D</step><octave>5</octave></pitch><duration>1</duration><type>quarter</type><notations><slur type=\"stop\" number=\"1\"/></notations></note>"), new Vector3(4, -1, 0));

        console.log("All proper OSMD 2D notation blocks securely extruded as solid meshes.");
    }

    private getXMLSnippet(notesXml: string): string {
        return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 3.1 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">
<score-partwise version="3.1">
  <part-list>
    <score-part id="P1"><part-name>Example</part-name></score-part>
  </part-list>
  <part id="P1">
    <measure number="1">
      <attributes>
        <divisions>1</divisions>
        <key><fifths>0</fifths></key>
        <time><beats>4</beats><beat-type>4</beat-type></time>
        <clef><sign>G</sign><line>2</line></clef>
      </attributes>
      ${notesXml}
    </measure>
  </part>
</score-partwise>`;
    }

    private async createNotationBlock(name: string, xmlData: string, position: Vector3) {
        // Render OSMD to an invisible container
        const osmdContainer = document.createElement("div");
        osmdContainer.style.position = "absolute";
        osmdContainer.style.top = "-9999px";
        osmdContainer.style.width = "1024px"; // Fixed width so blocks are uniform
        document.body.appendChild(osmdContainer);

        const osmd = new OpenSheetMusicDisplay(osmdContainer, {
            backend: "canvas",
            drawTitle: false,
            drawPartNames: false,
            autoResize: false
        });

        osmd.EngravingRules.StaffLineWidth = 5.0;
        osmd.EngravingRules.StemWidth = 5.5;
        osmd.EngravingRules.BeamWidth = 3.5;
        osmd.EngravingRules.LedgerLineWidth = 5.0;
        osmd.zoom = 5.0;

        await osmd.load(xmlData);
        osmd.render();

        const canvas = osmdContainer.querySelector("canvas") as HTMLCanvasElement;
        
        if (canvas) {
            // Apply the actual 2D graphic to a THICK solid block mesh via extrusion
            // Block dimensions match real-world aspect ratio
            const blockWidth = 3;
            const blockHeight = blockWidth * (canvas.height / canvas.width);
            const blockDepth = 0.2; // Extrusion depth - solid slab!

            // Create solid thick box
            const block = MeshBuilder.CreateBox(name, {
                width: blockWidth, 
                height: blockHeight, 
                depth: blockDepth 
            }, this.scene);

            block.position = position;

            // Apply texture
            const texture = new DynamicTexture(`tex_${name}`, canvas, this.scene, false);
            const mat = new StandardMaterial(`mat_${name}`, this.scene);
            mat.diffuseTexture = texture;
            mat.specularColor = new Color3(0, 0, 0);
            mat.emissiveColor = new Color3(0.9, 0.9, 0.9); // Make it bright
            
            // Optional: transparent edges to only render ink on a thick clear block
            // mat.diffuseTexture.hasAlpha = true;
            // mat.useAlphaFromDiffuseTexture = true;
            // mat.useObjectSpaceLighting = true;

            block.material = mat;
        }

        document.body.removeChild(osmdContainer);
    }
}

new NotationExamplesApp();
