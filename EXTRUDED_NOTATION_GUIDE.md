# Extruded Notation Mesh Library

Convert music notation from OpenSheetMusicDisplay into 3D extruded mesh shapes for creative visualization in Babylon.js.

## Overview

The `ExtrudedNotationMeshLibrary` provides a collection of pre-built 3D mesh shapes that represent musical notation elements:

- **Staff Lines**: Horizontal lines that form the basis of musical notation
- **Note Heads**: Oval shapes representing note positions
- **Note Stems**: Vertical lines extending from note heads
- **Complete Notes**: Full note shapes (head + stem + optional beam)
- **Staves**: 5-line staff groupings
- **Measures**: Complete measures with staff and notes
- **Scores**: Multi-measure compositions from actual OpenSheetMusicDisplay data

## How It Works

## Usage

### Auto-Generated from OpenSheetMusicDisplay

The app automatically generates 3D extruded meshes when it loads:

```typescript
// Automatically runs in createExtrudedNotationScene():
const osmd = new OpenSheetMusicDisplay(container, {...});
await osmd.load(musicXml);
osmd.render();

// Initialize library with OSMD data
await notationLib.initializeWithOSMD(osmd);

// Generate 3D meshes from parsed notation
const score = notationLib.createMeshesFromOSMDData();
score.position.y = 2.5;
```

### Access from Browser Console

After the app loads, interact with the library:

```javascript
// Get the library
const lib = window.notationMeshLibrary;

// List all created meshes
console.log(lib.listMeshes());

// Clone and position a note
const clone = lib.cloneMesh("noteHead_0", "noteHead_clone");
clone.position.x += 1;

// Create a sample score (procedural)
const procScore = lib.createScoreShape(4);
procScore.position = new BABYLON.Vector3(0, 1, 0);
```

## Mesh Structure from OSMD

When `createMeshesFromOSMDData()` runs, it:

1. **Reads all measures** from the parsed OSMD sheet
2. **For each measure:**
   - Creates a staff (5 extruded lines)
   - Reads all voice entries and notes
   - Maps MIDI pitch to Y-position: `noteYPos = (midiPitch - 60) * 0.15`
   - Determines note type based on duration
   - Creates 3D note meshes (head + stem + optional beam)

### Pitch-to-Position Mapping

```    ext
  →  Y Position (units)
────────────────────────────
72 (High C)   →  1.8
60 (Middle C) →  0.0  (reference)
48 (Low C)    →  -1.8
```

### Note Type Detection

- **Quarter notes**: Duration ≈ 0.25 beats
- **Eighth notes**: Duration ≈ 0.125 beats (includes visual beam)
- **Half notes**: Duration ≈ 0.5 beats
- **Whole notes**: Duration ≈ 1.0 beat

## Customization

### Create Custom Notes

```typescript
const lib = window.notationMeshLibrary;

// Single note at specific pitch
const notePos = new BABYLON.Vector3(0, 1.5, 0);
const note = lib.createCompleteNoteShape(notePos, true); // true = quarter note

// Change color
const mat = note.getMeshes()[0].material;
mat.diffuseColor = new BABYLON.Color3(0.8, 0.2, 0.2); // Red
```

### Create Custom Staves

```typescript
// 3 measures in a row
for (let m = 0; m < 3; m++) {
    const staff = lib.createStaffShape(4, 2);
    staff.position.x = m * 5;
    staff.position.y = 2;
}
```

### Add Physics to Meshes

```javascript
const meshes = lib.listMeshes();
const sampleMesh = lib.getMesh(meshes[0]);

if (sampleMesh) {
    sampleMesh.physicsImpostor = new BABYLON.PhysicsImpostor(
        sampleMesh,
        BABYLON.PhysicsImpostor.BoxImpostor,
        { mass: 1, restitution: 0.5 },
        scene
    );
}
```

### Animate Meshes

```javascript
// Rotate all note heads
const lib = window.notationMeshLibrary;
const meshes = lib.listMeshes();

scene.onBeforeRenderObservable.add(() => {
    meshes.forEach(name => {
        const mesh = lib.getMesh(name);
        if (mesh && name.includes("noteHead")) {
            mesh.rotation.z += 0.02;
        }
    });
});
```

## Mesh Library Operations

```typescript
// Get a specific mesh
const mesh = notationLib.getMesh("noteHead_0");

// Clone a mesh
const clonedMesh = notationLib.cloneMesh("note_0", "note_clone_1");

// List all created meshes
const meshNames = notationLib.listMeshes();
console.log(`Total meshes: ${meshNames.length}`);

// Get library size
const size = notationLib.getLibrarySize();

// Clear all meshes (frees memory)
notationLib.clearLibrary();
```

## Performance Tips

1. **Clone instead of create**: Use `cloneMesh()` for repeated shapes
2. **Batch materials**: Reuse materials across multiple meshes
3. **Dispose unused meshes**: Call `mesh.dispose()` when done
4. **Limit visible meshes**: Use `setEnabled(false)` to hide without disposing
5. **Update shader uniforms**: Animate position/rotation instead of creating new meshes

## Example: Interactive 3D Score

```javascript
const lib = window.notationMeshLibrary;

// Find all measures
const measures = lib.listMeshes().filter(name => name.includes("measure_osmd"));

// Arrange measures in a circle
measures.forEach((name, idx) => {
    const mesh = lib.getMesh(name);
    if (mesh) {
        const angle = (idx / measures.length) * Math.PI * 2;
        const radius = 10;
        mesh.position.x = Math.cos(angle) * radius;
        mesh.position.z = Math.sin(angle) * radius;
    }
});

// Animate rotation
scene.onBeforeRenderObservable.add(() => {
    measures.forEach(name => {
        const mesh = lib.getMesh(name);
        if (mesh) mesh.rotation.y += 0.001;
    });
});
```

## Files

- **Library**: `src/extrudedNotationMeshLibrary.ts`
- **Integration**: `src/main.ts` (method: `createExtrudedNotationScene()`)
- **Math**: Pitch mapping, duration detection, staff geometry
- **Access**: `window.notationMeshLibrary` from browser console

## Data Flow

```    ext
MusicXML
  ↓
OpenSheetMusicDisplay (render)
  ↓
OSMD.Sheet.SourceMeasures (parse structure)
  ↓
For each Measure:
  - Create Staff Meshes
  - For each VoiceEntry:
    - Map MIDI Pitch → Y Position
    - Create Note Meshes (Head + Stem)
  ↓
Complete 3D Score Visualization
```

## Debugging

Check console logs for details:

```javascript
// From browser console
window.notationMeshLibrary.listMeshes().forEach(name => {
    const mesh = window.notationMeshLibrary.getMesh(name);
    console.log(`${name}: position=${mesh.position}, children=${mesh.getChildren().length}`);
});
```
