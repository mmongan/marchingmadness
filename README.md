# MARCHING MADNESS

## Tips for Long Sessions

- Use /clear between unrelated tasks – do not carry old context into new work
- Run /compact proactively when you notice slowdowns
- Use subagents for verbose operations (test runs, log analysis) – their output stays in the subagent context
- Move detailed instructions to skills instead of typing them every time
- Keep CLAUDE.md under 200 lines – move details to separate files and import with @filename

## Build and Test

- Run tests: `npm test`
- Build: `npm run build`
- Lint: `npm run lint`

## Code Style

- Use TypeScript strict mode
- use @babylonjs WebXR VR/AR for Quest 3
- include Quest 3 controller profile
- Prefer functional components in React
- All API responses must include error handling
- Never commit .env files

## Architecture

- Create a bablylonjs typescript WebXR VR basketball court with Ammo Physics

See @README.md for project overview.
See @package.json for available scripts.

## PROMPT

- Create a bablylonjs typescript WebXR VR basketball court with Ammo Physics
