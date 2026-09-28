# Tile 2048

GeaStack app id: `tile-2048`. TypeScript + JSX + CSS, browser (`web`) target.

Slide tiles with the arrow keys (or WASD), merge equal numbers, and reach 2048.
`R` restarts; on-screen arrow buttons work without a keyboard.

```sh
npm run check   # tsc --noEmit
npx gea doctor  # packages and toolchains
npx gea dev     # dev server with HMR (browser preview)
npx gea build --target web
```

## Files

- `src/index.tsx` — entrypoint (`gea.entry`), mounts `App`.
- `src/App.tsx` — `ReactiveComponent` holding board, score, status.
- `src/game.ts` — pure 2048 rules (move, spawn, win/lose detection).
- `src/styles.css` — layout, tile palette, controls.

## Targets

Only `web` is enabled in the `gea` manifest. To run on hardware later, enable
the target (for example `esp32`), check target support for the APIs used, then:

```sh
npx gea doctor
npx gea build --board <alias> --dry-run
npx gea run --board <alias>
```
