# Pre-computed Notation Setup

## Quick Start

1. Open the app at `http://localhost:5173`
2. Open browser console (F12)
3. Run: `precomputeNotation()`
4. Browser auto-downloads PNG slices (e.g., `notation_slice_0.png`, `notation_slice_1.png`)
5. Move files to `public/assets/`
6. Reload page - textures load instantly!

## What This Does

- Generates OSMD music notation (32 measures of random music)
- Exports as PNG texture slices (splits into 4096px max texture chunks for WebGL)
- Pre-computed = zero runtime overhead on Quest 3

## Performance

- **Desktop (before)**: 300-500ms OSMD rendering at startup
- **Quest 3 (before)**: Potential frame drops due to runtime rendering
- **After pre-computation**: Instant texture load, 0ms overhead, stable 72Hz+ on Quest 3

## To Regenerate Textures

If you modify `generateRandomMusicXML()`, just run `precomputeNotation()` again and replace the assets.
