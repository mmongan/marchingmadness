# MARCHING MADNESS

VR marching band simulator built with Babylon.js, WebXR, and Tone.js. Players step to drill footstep targets while avoiding collisions with AI marchers in real-time physics.

## Features

- **VR/Desktop Support**: WebXR for Quest 3, fallback to desktop mouse/keyboard
- **Spatial Audio**: HRTF-based 3D panning per instrument group
- **Collision Physics**: Stumble/fall mechanics with domino cascade
- **Beat-Synced Scoring**: Perfect/Good/Miss step detection on each beat
- **MusicXML Support**: Dynamic sheet music rendering via OSMD
- **Formation Animations**: 5 drill shapes with smooth transitions
- **Haptic Feedback**: Controller vibration on collisions
- **Particle Effects**: Dust bursts, hat scatter, debris physics

## Architecture

Modular TypeScript + Babylon.js structure with separated concerns:

### Core Modules

- **`src/main.ts`** (1515 lines) — Scene orchestration, render loop, UI, OSMD integration
- **`src/gameConstants.ts`** — Shared constants (BPM, physics, scoring thresholds, band layout)
- **`src/drillMath.ts`** — Pure drill math (formation shapes, position interpolation, grading)
- **`src/environment.ts`** — Skybox and football field rendering
- **`src/audioSystem.ts`** — Instrument loading, metronome, collision sounds, spatial audio
- **`src/collisionSystem.ts`** — Player-marcher collisions, domino cascade, particle effects
- **`src/bandMemberFactory.ts`** — Band member mesh creation and instrument assignment
- **`src/firstPersonBody.ts`** — Player body animat ion, treadmill locomotion, haptics

### Build & Test

```bash
npm install
npm run build      # TypeScript → JavaScript (Vite)
npm test          # Run vitest unit tests
npm run dev       # Dev server with HMR
```

### Requirements

- Node.js 18+
- Quest 3 (for WebXR) or desktop browser
- TypeScript 5+

## Gameplay

1. **Select Song** — Choose from 4 arrangements (MacArthur Park, When the Saints, Stars & Stripes, Battle Hymn)
2. **Step to Beats** — 12 ground markers show upcoming footstep positions; step when each beat arrives
3. **Manage Formation** — Stay near band members, avoid knocking them down
4. **Earn Points** — Perfect steps (+0.8%), Good steps (+0.2%), Misses (-0.3%)
5. **Review Results** — Final grade (A–F) based on formation quality and step accuracy

## Code Quality

- TypeScript strict mode enabled
- All tests must pass before commit
- 0 lint/compilation errors required
- Unused imports/variables not allowed

## Development

### To Add a New Feature

1. **Extract pure logic** to a named function/constant in appropriate module
2. **Add tests** in `tests/unit/*.spec.ts`
3. **Document** in code comments
4. **Run full test suite**: `npm test`
5. **Commit** with clear message referencing the feature

### Module Responsibilities

- **gameConstants.ts**: All numeric/config values (no business logic)
- **drillMath.ts**: Formation calculations (pure functions, 100% testable)
- **audioSystem.ts**: All sound generation (synthesis + SoundFont loading)
- **collisionSystem.ts**: Physics simulation (stumble, domino, particles)
- **environment.ts**: Visual setup (skybox, field, lighting)
- **main.ts**: Scene orchestration + game loop (calls into modules)

## Performance Notes

- Spatial hash grid (2.0m cells) for marcher-to-marcher collision O(n) instead of O(n²)
- Inverse-distance-squared weighting for spatial audio (fade distant marchers)
- Instanced shadows under marchers (memory-efficient)
- Measure generation queued dynamically (avoid UI stalls)
- Particle systems disposed on completion

## Known Limitations

- Desktop fallback: No haptic feedback (mouse/keyboard only)
- OSMD rendering: Single-staff trumpet 1 part (full score generation possible)
- Hat physics: 6-second timeout before cleanup (prevents memory leak)
- Domino cascade: Limited to 3×3 grid neighborhood (spatial hash prevents runaway)

## Next Steps

- Full main.ts integration with extracted modules (in progress)
- Leaderboard persistence (localStorage or Firebase)
- Combo multiplier mechanics
- Crowd ambience and cheering
- Additional song arrangements
