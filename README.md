# MARCHING MADNESS

VR marching band simulator built with Babylon.js, WebXR, and Tone.js. Players march in formation with an AI band, stepping to beat-synced footstep targets.

## Features

- **VR/Desktop Support**: WebXR for Quest 3, fallback to desktop mouse/keyboard
- **Spatial Audio**: HRTF-based 3D panning per instrument group
- **Beat-Synced Scoring**: Perfect/Good/Miss step detection on each beat
- **MusicXML Support**: Dynamic sheet music rendering via OSMD
- **Formation Animations**: 19 precomputed drill shapes with smooth transitions
- **Auto-March Mode**: Camera follows drill position with free mouse look
- **Free-Fly Mode**: Bird's-eye observation with WASD/mouse
- **Haptic Feedback**: Controller vibration in VR

## Architecture

Modular TypeScript + Babylon.js structure with separated concerns:

### Core Modules

- **`src/main.ts`** — Scene orchestration, render loop, UI, OSMD integration
- **`src/gameConstants.ts`** — Shared constants (BPM, scoring thresholds, band layout)
- **`src/drillMath.ts`** — Pure drill math (formation shapes, position interpolation, grading)
- **`src/drillFactory.ts`** — Band creation and positioning logic
- **`src/environment.ts`** — Skybox and football field rendering
- **`src/audioSystem.ts`** — SoundFont instrument loading, spatial audio
- **`src/musicManager.ts`** — Metronome synth, Tone.Transport setup, instrument scheduling from OSMD
- **`src/bandMemberFactory.ts`** — Band member mesh creation and instrument assignment
- **`src/firstPersonBody.ts`** — Player body animation, treadmill locomotion, haptics
- **`src/marchingAnimationSystem.ts`** — 11 march styles with per-style leg animations

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

1. **Select Song** — Fight Song or Battle Hymn (both public domain)
2. **Step to Beats** — 12 ground markers show upcoming footstep positions; step when each beat arrives
3. **March in Formation** — Auto-march follows the drill; use mouse to look around freely
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
- **audioSystem.ts**: SoundFont loading + spatial audio positioning
- **environment.ts**: Visual setup (skybox, field, lighting)
- **main.ts**: Scene orchestration + game loop (calls into modules)

## Performance Notes

- Precomputed collision-free drill positions (no runtime O(n²) avoidance)
- Inverse-distance-squared weighting for spatial audio (fade distant marchers)
- Instanced shadows under marchers (memory-efficient)
- Measure generation queued dynamically (avoid UI stalls)

## Known Limitations

- Desktop fallback: No haptic feedback (mouse/keyboard only)
- OSMD rendering: Single-staff trumpet 1 part (full score generation possible)

## Next Steps

- Directional march style selection (BackMarch, SideStep based on movement angle)
- Leaderboard persistence (localStorage or Firebase)
- Combo multiplier mechanics
- Crowd ambience and cheering
- Additional song arrangements
