# Spec Generator (Figma plugin)

TypeScript + React UI + esbuild/Vite pipeline. Figma loads only **`dist/code.js`** and **`dist/ui.html`**.

## Install

```bash
npm install
```

## Build

```bash
npm run build
```

This runs Vite (React → `dist/ui.html` + assets) then esbuild (`src/main/code.ts` + legacy core → `dist/code.js`) with `__html__` injected from the built `dist/ui.html`.

**Figma error `ENOENT … dist/code.js`:** the `dist/` folder is not committed (see `.gitignore`). Run `npm run build` after `npm install`. If Node.js is not installed yet, you can bootstrap legacy files into `dist/` once (no npm dependencies):

```bash
node scripts/bootstrap-dist-legacy.mjs
```

That copies root `code.js` / `ui.html` into `dist/` so the plugin loads; use `npm run build` when you work on `src/`.

## Typecheck

```bash
npm run typecheck
```

## Develop

```bash
npm run dev
```

Runs `vite build --watch` (UI). After UI changes, run `npm run build` once to refresh `dist/code.js` if you changed main-thread code, or extend the script to watch both.

## Import in Figma

1. `npm run build`
2. Figma → **Plugins → Development → Import plugin from manifest…**
3. Select `figma-spec-plugin/manifest.json`

## Architecture

- **`src/main/code.ts`** — Figma main thread entry: `showUI`, `onmessage`, `clientStorage`, delegates generation to `builders/buildSpecification.ts`.
- **`src/main/legacy/legacyCore.js`** — monolith ported from the previous `code.js` (generation, overlays, anatomy, tokens). **Split into `builders/`, `spec/`, `overlays/`, `anatomy/`, `figma/` incrementally** (stubs mark future homes).
- **`src/ui/`** — React UI; communicates via `parent.postMessage({ pluginMessage })`.
- **`src/shared/`** — message types + `PluginSettings`.

## Legacy root files

The repository may still contain `code.js` / `ui.html` at the plugin root from before the migration; **Figma no longer reads them** once `manifest.json` points to `dist/`. Remove them locally when you no longer need the reference.

## Updating anatomy source

Edit `anatomy-generator.js` at the repo root (design-time module), then refresh `legacyCore.js` using your previous workflow or by copying the built anatomy block from `anatomy-generator.js` into `legacyCore.js` (until anatomy is fully split into `src/main/anatomy/*`).
