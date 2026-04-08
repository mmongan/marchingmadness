const fs = require('fs');

let mainCode = fs.readFileSync('src/main.ts', 'utf-8');

const drillCode = `
type DrillShape = (r: number, c: number, cols: number, rows: number, startX: number, startZ: number) => {x: number, z: number};

const drillShapes: DrillShape[] = [
    // 0: Original Block
    (r, c, cols, rows, startX, startZ) => ({ x: startX, z: startZ }),
    
    // 1: Expanded Block
    (r, c, cols, rows, startX, startZ) => ({ x: startX * 2.0, z: startZ }),
    
    // 2: Wedge
    (r, c, cols, rows, startX, startZ) => {
        const centerCol = (cols - 1) / 2;
        const distFromCenter = Math.abs(c - centerCol);
        return { x: startX * 1.5, z: startZ - distFromCenter * 2.5 };
    },
    
    // 3: Simple Circle
    (r, c, cols, rows, startX, startZ) => {
        // Map 17x10 grid into concentric circles
        const totalIndex = r * cols + c;
        const totalMembers = cols * rows;
        const angle = (totalIndex / totalMembers) * Math.PI * 2 * 4; // 4 rings
        const ring = Math.floor(r / 4) + 1; // rings 1..5
        const radius = ring * 3 + 4; // outer rings are wider
        
        // Base Z center is roughly where row 8 is (60 + 8*2 = 76)
        const centerZ = 60 + 8 * 2; 
        return { x: Math.cos(angle) * radius, z: centerZ + Math.sin(angle) * radius };
    },

    // 4: Diamond
    (r, c, cols, rows, startX, startZ) => {
        const centerCol = (cols - 1) / 2;
        const distFromCenter = Math.abs(c - centerCol);
        const centerRow = rows / 2;
        const distFromRowCenter = Math.abs(r - centerRow);
        // Diamond 
        return { x: startX * 1.5, z: startZ + (distFromCenter - distFromRowCenter) * 2.0 };
    }
];

const drillTimeline = [
    { beat: 0, shape: 0 },
    { beat: 16, shape: 0 },
    // Expand transition
    { beat: 32, shape: 1 },
    { beat: 48, shape: 1 },
    // Wedge transition
    { beat: 64, shape: 2 },
    { beat: 80, shape: 2 },
    // Diamond transition
    { beat: 96, shape: 4 },
    { beat: 112, shape: 4 },
    // Rings transition
    { beat: 128, shape: 3 },
    { beat: 144, shape: 3 },
    // Back to block transition
    { beat: 160, shape: 0 }, 
];

function getDrillPosition(currentBeat: number, r: number, c: number, cols: number, rows: number, startX: number, startZ: number): {x: number, z: number} {
    // Loop entirely at 160 beats
    const maxBeat = 160;
    let loopedBeat = currentBeat % maxBeat;
    
    // Find phase
    let currentIndex = 0;
    while(currentIndex < drillTimeline.length - 1 && drillTimeline[currentIndex + 1].beat <= loopedBeat) {
        currentIndex++;
    }
    
    const currentPhase = drillTimeline[currentIndex];
    
    if (currentIndex === drillTimeline.length - 1) {
        return drillShapes[currentPhase.shape](r, c, cols, rows, startX, startZ);
    }
    
    const nextPhase = drillTimeline[currentIndex + 1];
    
    // Lerp between shapes
    const progress = (loopedBeat - currentPhase.beat) / (nextPhase.beat - currentPhase.beat);
    
    const p1 = drillShapes[currentPhase.shape](r, c, cols, rows, startX, startZ);
    const p2 = drillShapes[nextPhase.shape](r, c, cols, rows, startX, startZ);
    
    // Smooth transition
    const smoothProgress = progress * progress * (3 - 2 * progress); // smoothstep

    return {
        x: p1.x + (p2.x - p1.x) * smoothProgress,
        z: p1.z + (p2.z - p1.z) * smoothProgress
    };
}
`;

// Insert the drill code before buildMarchingBand
mainCode = mainCode.replace('const bandLegs: BandMemberData[] = [];', drillCode + '\nconst bandLegs: BandMemberData[] = [];');

// Modify the iteration to use drill
const originalForeach = `    bandLegs.forEach(({ legL, legR, anchor, startZ }) => {
        // Swing legs back and forth like pendulums
        legL.rotation.x = Math.sin(marchPhase) * 0.6;
        legR.rotation.x = -Math.sin(marchPhase) * 0.6;
        // Actually move them down the field at standard marching speed
        if (gameStartTime !== null) {
            anchor.position.z = startZ - (currentRenderTime * FLY_SPEED);
        }
    });`;

const newForeach = `    bandLegs.forEach(({ legL, legR, anchor, startZ, startX, row, col }) => {
        // Swing legs back and forth like pendulums
        legL.rotation.x = Math.sin(marchPhase) * 0.6;
        legR.rotation.x = -Math.sin(marchPhase) * 0.6;
        
        // Actually move them down the field at standard marching speed
        if (gameStartTime !== null) {
            const currentBeat = currentRenderTime * (BPM / 60);
            const targetPos = getDrillPosition(currentBeat, row, col, 10, 17, startX, startZ);
            
            // Allow members to point in the direction they march (simple approach)
            const dx = targetPos.x - anchor.position.x;
            const dz = targetPos.z - (anchor.position.z + currentRenderTime * FLY_SPEED); // Relative to moving frame
            
            if (Math.abs(dx) > 0.05 || Math.abs(dz) > 0.05) {
                // If they are moving laterally relative to the scrolling frame, turn them
                // Note: The global frame is negatively moving Z, so they face +Z. 
                // We want to face where they are drifting to
                const lateralAngle = Math.atan2(dx, dz);
                const targetRotationY = Math.PI - lateralAngle; // +PI because they start facing camera (-Z technically, wait)
                
                // Keep them forward facing if their drill move is minor
                if (Math.abs(dx) < 0.1) {
                    anchor.rotation.y = Math.PI; // Face forward
                } else {
                    anchor.rotation.y += (targetRotationY - anchor.rotation.y) * 0.1;
                }
            } else {
                anchor.rotation.y = Math.PI; // Default forward
            }

            anchor.position.x = targetPos.x;
            anchor.position.z = targetPos.z - (currentRenderTime * FLY_SPEED);
        }
    });`;

mainCode = mainCode.replace(originalForeach, newForeach);

fs.writeFileSync('src/main.ts', mainCode, 'utf-8');
console.log('patched main.ts');
