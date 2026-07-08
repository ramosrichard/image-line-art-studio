# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.1.0] - 2026-07-07

### Added
- **Vite Integration:** Added a complete Vite development structure configured in `package.json` and `vite.config.js`.
- **Git Hygiene (`.gitignore`):** Created a standard `.gitignore` file to ensure `node_modules` and compiled `dist` builds are not tracked by Git.

### Changed
- **Architectural Reorganization:** Separated the monolithic `index.html` structure into logical, modular files:
  - `src/css/styles.css`: Houses custom range inputs, scrollbars, and checkerboard configurations.
  - `src/js/state.js`: Stores application configuration models.
  - `src/js/presets.js`: Houses predefined color themes.
  - `src/js/generators.js`: Contains procedural canvas drawing math (Sphere, Waves, Silhouette).
  - `src/js/engine.js`: Performs grayscale luminance scan, contrast adjustments, Y-smoothing, and ribbon rendering.
  - `src/js/exporter.js`: Generates scalable PNG and vector SVG strings.
  - `src/js/ui.js`: Binds controls, file drag zones, compare clicks, and canvas drag-pan translation metrics.
  - `src/js/app.js`: Coordinates the main module initialization.

---

## [1.0.0] - 2026-07-07

### Added
- **Interactive UI Layout:** Designed a developer-friendly, responsive split-screen dark mode UI using Tailwind CSS CDN and custom Outfit/Inter web fonts.
- **Modulation Engine:** Developed a client-side HTML5 Canvas pixel analysis loop to translate grayscale brightness into modulated vertical line widths.
- **Y-Axis Smoothing:** Added a box-blur moving average algorithm to eliminate jagged edges and produce clean, organic lines.
- **Positioning Controls:** Added real-time image manipulation tools including Drag-to-Pan (mouse and touch-capable), Zoom scale multipliers, and $90^\circ$ rotation increments.
- **Preloaded Generators:** Coded three mathematical placeholder vector presets (*Art Portrait Silhouette*, *3D Shaded Sphere*, and *Optical Ripples*) for instant testing.
- **Curated Color Presets:** Built 8 color presets supporting gradient line sweeps (e.g. *Cyberpunk*, *Ocean*, *Sunset*) and alpha transparency checkerboards.
- **Vector SVG & High-Res PNG Exports:**
  - Scaled offscreen rendering for high-resolution PNG downloads matching original image sizes.
  - Custom XML path compiler (`M ... L ... Z`) to export clean, vector-resizable SVG files.
- **Documentation & History:** Initialized local Git repository, synchronized with GitHub, and documented parameters in the README.
