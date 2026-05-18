# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

SVGOMG is the web GUI for [SVGO](https://github.com/svg/svgo) (SVG Optimizer). It's a client-side single-page app that lets users optimize SVGs with visual feedback and granular control over SVGO plugins.

## Commands

- **Dev server:** `npm run dev` (builds, watches, serves on localhost:8080)
- **Production build:** `npm run build` (outputs to `build/`)
- **Lint all:** `npm run lint` (runs both JS and CSS linting)
- **Lint JS only:** `npm run lint:js` (uses [xo](https://github.com/xojs/xo) with Prettier)
- **Lint CSS only:** `npm run lint:css` (uses stylelint)
- **Auto-fix JS:** `npm run fix`
- **Test:** `npm test` (runs lint + build; there are no unit tests)

## Architecture

### Build System

Gulp-based (`gulpfile.js`). Compiles SCSS, bundles JS with Rollup, renders HTML templates with Nunjucks, and copies static assets to `build/`. Properties prefixed with `_` are mangled by Terser in production builds (for the `page` bundle only).

### JavaScript Bundles

Five separate Rollup entry points, each producing an IIFE bundle:

- **`src/js/page/index.js`** — Main app. Instantiates `MainController` which wires together all UI components.
- **`src/js/svgo-worker/index.js`** — Web Worker that runs SVGO optimization via `svgo/browser`. Receives SVG data + settings, returns optimized SVG + dimensions.
- **`src/js/gzip-worker/index.js`** — Web Worker for gzip size calculation (uses pako).
- **`src/js/prism-worker/index.js`** — Web Worker for syntax highlighting SVG code output.
- **`src/js/sw/index.js`** — Service Worker for offline support. Outputs to `build/sw.js`.

Workers communicate with the main thread via a message-passing protocol in `src/js/page/worker-messenger.js`.

### UI Components (`src/js/page/ui/`)

Each UI component is a class that owns a DOM element and emits events via `nanoevents`. Components: `MainUi`, `Output` (code + SVG views), `Settings` (SVGO plugin toggles), `MainMenu` (file input/demo), `FileDrop`, `Results`, `Toasts`, etc.

### SVGO Plugin Configuration

`src/config.json` defines the list of SVGO plugins exposed in the UI. Each entry has an `id` (matching SVGO plugin name), display `name`, and `enabledByDefault`. This file drives both the settings UI and the Nunjucks HTML template rendering.

### CSS

SCSS files in `src/css/`, compiled by gulp-sass. `head.css` is inlined into the HTML template at build time for critical CSS.

### Versioning

App version comes from `src/changelog.json` (first entry). SVGO library version is read from the svgo package. Both are injected at build time via Rollup's replace plugin and Nunjucks template context.

## Code Style

- JS: xo + Prettier (spaces, single quotes, bracket spacing)
- `no-shadow` is enforced as an error
- `prefer-template` is enforced
- Browser environment assumed (no Node.js globals in client code)
