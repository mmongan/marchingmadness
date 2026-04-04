import { Mesh, MeshBuilder, StandardMaterial, Color3, Vector3, Scene } from "@babylonjs/core";
import { OpenSheetMusicDisplay } from "opensheetmusicdisplay";

/**
 * ExtrudedNotationMeshLibrary
 * Converts 2D music notation from OpenSheetMusicDisplay into 3D extruded mesh shapes
 */

interface NotationMesh {
    name: string;
    mesh: Mesh;
}

export class ExtrudedNotationMeshLibrary {
    private scene: Scene;
    private meshLibrary: Map<string, NotationMesh> = new Map();
    private osmd: OpenSheetMusicDisplay | null = null;

    constructor(scene: Scene) {
        this.scene = scene;
    }

    /**
     * Initialize with OpenSheetMusicDisplay instance and music data
     * This loads actual music notation and prepares it for mesh generation
     */
    async initializeWithOSMD(osmd: OpenSheetMusicDisplay): Promise<void> {
        this.osmd = osmd;
        console.log("ExtrudedNotationMeshLibrary initialized with OSMD instance");
    }

    /**
     * Create an extruded staff line as a 3D ribbon
     */
    createStaffLineShape(width: number = 10, height: number = 0.2, depth: number = 0.1): Mesh {
        const name = `staffLine_${this.meshLibrary.size}`;
        const plane = MeshBuilder.CreateBox(name, { width, height, depth }, this.scene);
        
        const mat = new StandardMaterial(`${name}_mat`, this.scene);
        mat.diffuseColor = new Color3(0.2, 0.2, 0.2);
        plane.material = mat;
        
        this.meshLibrary.set(name, { name, mesh: plane });
        return plane;
    }

    /**
     * Create an extruded note head (oval shape)
     */
    createNoteHeadShape(width: number = 0.3, depth: number = 0.3, height: number = 0.1): Mesh {
        const name = `noteHead_${this.meshLibrary.size}`;
        
        // Create a cylinder and scale it to make an oval
        const noteHead = MeshBuilder.CreateCylinder(name, {
            diameter: width,
            height: height,
            tessellation: 32
        }, this.scene);
        
        noteHead.scaling = new Vector3(1, 0.6, depth / width);
        
        const mat = new StandardMaterial(`${name}_mat`, this.scene);
        mat.diffuseColor = new Color3(0.1, 0.1, 0.1);
        noteHead.material = mat;
        
        this.meshLibrary.set(name, { name, mesh: noteHead });
        return noteHead;
    }

    /**
     * Create an extruded note stem (vertical line)
     */
    createNoteStemShape(thickness: number = 0.05, length: number = 1.5): Mesh {
        const name = `noteStem_${this.meshLibrary.size}`;
        
        const stem = MeshBuilder.CreateCylinder(name, {
            diameter: thickness,
            height: length,
            tessellation: 16
        }, this.scene);
        
        stem.rotation.z = Math.PI / 2; // Rotate to vertical
        
        const mat = new StandardMaterial(`${name}_mat`, this.scene);
        mat.diffuseColor = new Color3(0.1, 0.1, 0.1);
        stem.material = mat;
        
        this.meshLibrary.set(name, { name, mesh: stem });
        return stem;
    }

    /**
     * Create a complete extruded note (head + stem)
     */
    createCompleteNoteShape(notePosition: Vector3, isQuarterNote: boolean = true): Mesh {
        const name = `note_${this.meshLibrary.size}`;
        
        // Create parent mesh
        const noteGroup = new Mesh(name, this.scene);
        
        // Add note head
        const noteHead = this.createNoteHeadShape();
        noteHead.parent = noteGroup;
        noteHead.position = Vector3.Zero();
        
        // Add stem
        const noteStem = this.createNoteStemShape();
        noteStem.parent = noteGroup;
        noteStem.position = new Vector3(0.2, 0.75, 0);
        
        // Add beam for eighth note variation (if not quarter note)
        if (!isQuarterNote) {
            const beam = MeshBuilder.CreateBox(`beam_${name}`, {
                width: 0.3,
                height: 0.1,
                depth: 0.05
            }, this.scene);
            beam.parent = noteGroup;
            beam.position = new Vector3(0.2, 1.5, 0);
            
            const beamMat = new StandardMaterial(`beam_${name}_mat`, this.scene);
            beamMat.diffuseColor = new Color3(0.1, 0.1, 0.1);
            beam.material = beamMat;
        }
        
        noteGroup.position = notePosition;
        this.meshLibrary.set(name, { name, mesh: noteGroup });
        return noteGroup;
    }

    /**
     * Create a staff (5 horizontal lines with extruded geometry)
     */
    createStaffShape(staffWidth: number = 10, staffHeight: number = 2): Mesh {
        const name = `staff_${this.meshLibrary.size}`;
        const staffGroup = new Mesh(name, this.scene);
        
        const lineSpacing = staffHeight / 4;
        
        for (let i = 0; i < 5; i++) {
            const line = this.createStaffLineShape(staffWidth);
            line.parent = staffGroup;
            line.position.y = (i - 2) * lineSpacing;
        }
        
        this.meshLibrary.set(name, { name, mesh: staffGroup });
        return staffGroup;
    }

    

    /**
     * Create extruded 3D meshes from actual OSMD notation data
     * This reads the OSMD object and creates meshes based on parsed note positions
     */
    createMeshesFromOSMDData(): Mesh | null {
        if (!this.osmd) {
            console.warn("OSMD not initialized. Call initializeWithOSMD() first.");
            return null;
        }

        try {
            const scoreGroup = new Mesh(`osmd_score_${this.meshLibrary.size}`, this.scene);
            
            // Generate exact 3D note meshes overlaid on the exact OSMD graphical positions
            const graphicSheet = this.osmd.GraphicSheet;
            if (!graphicSheet || !graphicSheet.MeasureList) {
                console.warn("No graphical measures found in OSMD sheet");
                return scoreGroup;
            }

            // Iterate through OSMD's pre-calculated graphical layout
            for (let m = 0; m < graphicSheet.MeasureList.length; m++) {
                const measureRow = graphicSheet.MeasureList[m];
                
                for (let s = 0; s < measureRow.length; s++) {
                    const graphicalMeasure = measureRow[s];
                    if (!graphicalMeasure) continue;
                    
                    const measureGroup = new Mesh(`measure_osmd_${m}_${s}`, this.scene);
                    measureGroup.parent = scoreGroup;
                    
                    // Note: We DO NOT draw custom staff lines here because "two different kinds of notes/lines" 
                    // means the user already maps the OSMD canvas texture in 3D.
                    // The 3D meshes simply overlay the texture for physics/interaction.

                    for (let entryIdx = 0; entryIdx < graphicalMeasure.staffEntries.length; entryIdx++) {
                        const staffEntry = graphicalMeasure.staffEntries[entryIdx];
                        
                        for (let voiceIdx = 0; voiceIdx < staffEntry.graphicalVoiceEntries.length; voiceIdx++) {
                            const voiceEntry = staffEntry.graphicalVoiceEntries[voiceIdx];
                            
                            for (let noteIdx = 0; noteIdx < voiceEntry.notes.length; noteIdx++) {
                                const graphicalNote = voiceEntry.notes[noteIdx];
                                const sourceNote = graphicalNote.sourceNote;
                                
                                // Get OSMD's exact calculated absolute position
                                // Note: OSMD Canvas positions have Y increasing downwards.
                                // In Babylon Y increases upwards.
                                const absX = graphicalNote.PositionAndShape.AbsolutePosition.x;
                                const absY = -graphicalNote.PositionAndShape.AbsolutePosition.y; 
                                
                                const duration = sourceNote && sourceNote.Length ? sourceNote.Length.RealValue : 0.25;
                                const isQuarterNote = Math.abs(duration - 0.25) < 0.01;
                                
                                // Create 3D note mesh exactly where OSMD rendered it in 2D
                                const noteMesh = this.createCompleteNoteShape(
                                    new Vector3(absX, absY, 0.1),
                                    isQuarterNote
                                );
                                noteMesh.parent = measureGroup;
                                noteMesh.position.x = absX;
                                noteMesh.position.y = absY;
                            }
                        }
                    }
                }
            }

            this.meshLibrary.set(scoreGroup.name, { name: scoreGroup.name, mesh: scoreGroup });
            console.log(`✓ Created exact 3D notation meshes mapped to OSMD layout`);
            
            return scoreGroup;
        } catch (err) {
            console.error("Error creating meshes from OSMD data:", err);
            return null;
        }
    }

    /**

    /**
     * Get a mesh from the library by name
     */
    getMesh(name: string): Mesh | undefined {
        const entry = this.meshLibrary.get(name);
        return entry?.mesh;
    }

    /**
     * List all meshes in the library
     */
    listMeshes(): string[] {
        return Array.from(this.meshLibrary.keys());
    }

    /**
     * Clone a mesh from the library
     */
    cloneMesh(sourceName: string, newName: string): Mesh | null {
        const source = this.getMesh(sourceName);
        if (!source) return null;
        
        const clone = source.clone(newName);
        if (clone) {
            this.meshLibrary.set(newName, { name: newName, mesh: clone as Mesh });
        }
        return clone as Mesh;
    }

    /**
     * Clear all meshes from the library
     */
    clearLibrary() {
        this.meshLibrary.forEach(entry => {
            entry.mesh.dispose();
        });
        this.meshLibrary.clear();
    }

    /**
     * Get library size
     */
    getLibrarySize(): number {
        return this.meshLibrary.size;
    }
}
