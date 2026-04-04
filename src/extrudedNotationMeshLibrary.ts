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
     * Create a measure (staff with notes)
     */
    createMeasureShape(measureNumber: number, noteCountPerMeasure: number = 4): Mesh {
        const name = `measure_${measureNumber}`;
        const measureGroup = new Mesh(name, this.scene);
        
        // Create staff
        const staff = this.createStaffShape(3, 2);
        staff.parent = measureGroup;
        staff.position.z = 0;
        
        // Create notes
        const noteSpacing = 3 / (noteCountPerMeasure + 1);
        for (let n = 0; n < noteCountPerMeasure; n++) {
            const noteX = -1.5 + (n + 1) * noteSpacing;
            const noteY = (Math.random() - 0.5) * 1.5; // Random vertical position
            const isQuarter = Math.random() > 0.3; // 70% quarter notes
            
            const note = this.createCompleteNoteShape(new Vector3(noteX, noteY, 0.1), isQuarter);
            note.parent = measureGroup;
            note.position.x = noteX;
            note.position.y = noteY;
        }
        
        this.meshLibrary.set(name, { name, mesh: measureGroup });
        return measureGroup;
    }

    /**
     * Create a full score visualization (multiple measures)
     */
    createScoreShape(numMeasures: number = 4): Mesh {
        const name = `score_${this.meshLibrary.size}`;
        const scoreGroup = new Mesh(name, this.scene);
        
        const measureWidth = 4;
        const measureGap = 0.5;
        
        for (let m = 0; m < numMeasures; m++) {
            const measure = this.createMeasureShape(m);
            measure.parent = scoreGroup;
            measure.position.x = m * (measureWidth + measureGap);
        }
        
        this.meshLibrary.set(name, { name, mesh: scoreGroup });
        return scoreGroup;
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
            
            // Get the sheet music object
            const sheet = this.osmd.Sheet;
            if (!sheet || !sheet.SourceMeasures) {
                console.warn("No measures found in OSMD sheet");
                return scoreGroup;
            }

            let measureXPos = 0;
            const measureSpacing = 4;

            // Iterate through all measures
            for (let m = 0; m < sheet.SourceMeasures.length; m++) {
                const sourceMeasure = sheet.SourceMeasures[m];
                const measureGroup = new Mesh(`measure_osmd_${m}`, this.scene);
                measureGroup.parent = scoreGroup;
                measureGroup.position.x = measureXPos;

                // Add staff lines
                const staff = this.createStaffShape(2.5, 1.8);
                staff.parent = measureGroup;
                staff.position.z = 0;

                if (sourceMeasure.VerticalSourceStaffEntryContainers) {
                    for (let containerIdx = 0; containerIdx < sourceMeasure.VerticalSourceStaffEntryContainers.length; containerIdx++) {
                        const container = sourceMeasure.VerticalSourceStaffEntryContainers[containerIdx];
                        
                        if (container && container.StaffEntries) {
                            for (let staffIdx = 0; staffIdx < container.StaffEntries.length; staffIdx++) {
                                const staffEntry = container.StaffEntries[staffIdx];
                                
                                if (staffEntry && staffEntry.VoiceEntries) {
                                    // Generate note position based on container timestamp or index
                                    let noteXPos = -1.2 + (containerIdx * 0.4); 
                                    
                                    // Iterate through voice entries (notes in measure)
                                    for (let voiceIdx = 0; voiceIdx < staffEntry.VoiceEntries.length; voiceIdx++) {
                                        const voiceEntry = staffEntry.VoiceEntries[voiceIdx];
                                        
                                        if (voiceEntry.Notes) {
                                            // For each note in the voice entry
                                            for (let noteIdx = 0; noteIdx < voiceEntry.Notes.length; noteIdx++) {
                                                const note = voiceEntry.Notes[noteIdx];
                                                
                                                // Map MIDI pitch to vertical position on staff
                                                // Access the halfTone property from the pitch if it exists
                                                const pitch = note.Pitch as any;
                                                const midiPitch = pitch ? (pitch.halfTone + 60) : 60;
                                                const noteYPos = (midiPitch - 60) * 0.15; // 0.15 units per semitone
                                                
                                                // Determine note type based on length
                                                const duration = note.Length ? note.Length.RealValue : 0.25;
                                                const isQuarterNote = Math.abs(duration - 0.25) < 0.01;
                                                
                                                // Create note mesh
                                                const noteMesh = this.createCompleteNoteShape(
                                                    new Vector3(noteXPos, noteYPos, 0.1),
                                                    isQuarterNote
                                                );
                                                noteMesh.parent = measureGroup;
                                                noteMesh.position.x = noteXPos;
                                                noteMesh.position.y = noteYPos;
                                                
                                                // Add slight offset for chord notes
                                                noteXPos += 0.15;
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }

                measureXPos += measureSpacing;
            }

            this.meshLibrary.set(scoreGroup.name, { name: scoreGroup.name, mesh: scoreGroup });
            console.log(`✓ Created 3D meshes from OSMD notation (${sheet.SourceMeasures.length} measures)`);
            
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
