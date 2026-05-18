# Add Styleguide Classes Feature

**Ticket**: N/A
**Branch**: multi-icon-support
**Created**: 2026-03-27
**Status**: Complete

## Summary

Add a new "Add styleguide classes" toggle to the Features section of the settings panel (disabled by default, positioned before "Remove doctype") that post-processes optimized SVGs to inject `ca-icon__colored-fill` and `ca-icon__colored-stroke` CSS classes onto elements whose `fill` or `stroke` attributes are set to a color (i.e., not `none`). Include preview CSS so users can visually confirm class application in the SVG output.

Additionally, fix two issues: (1) downloads must include styleguide classes (without preview styles) when the toggle is enabled, and (2) downloads should use the user-edited icon name from the metadata interface as the filename.

## Quick Status

| Category | Tasks |
|----------|-------|
| **In Progress** | -- |
| **Up Next** | -- |
| **Blocked** | -- |
| **Completed** | T1.1, T2.1, T2.2, T2.3, T3.1, T4.1, T5.1, T6.1, T6.2, T6.3, T7.1 |

## Phase 1: UI Toggle

- [x] **T1.1 Add styleguide classes toggle to Features section**: Add a new checkbox input named `styleguideClasses` (disabled by default) to the "Features" section (`<section class="plugins">`) in `src/index.html`. Place it as a standalone `<label class="setting-item-toggle">` **before** the `{% for plugin in plugins %}` loop, so it appears above "Remove doctype" (the first plugin). Follow the same markup pattern as the plugin toggles.
  - Files: `src/index.html`
  - Modifies: `src/index.html`
  - Verification: `npm run build && grep -q 'styleguideClasses' build/index.html`

## Phase 2: SVG Post-Processing Logic

- [x] **T2.1 Create styleguide class injection utility**: Create `src/js/page/styleguide-classes.js` exporting `addStyleguideClasses(svgText, options)`.
  - Files: `src/js/page/styleguide-classes.js` (new)
  - Verification: `npm run lint:js`

- [x] **T2.2 Integrate post-processing into MainController**: Apply styleguide classes in `_updateForFile` for display and copy.
  - Files: `src/js/page/main-controller.js`
  - Modifies: `src/js/page/main-controller.js`
  - Depends on: T2.1, T2.3
  - Verification: `npm run lint:js`

- [x] **T2.3 Exclude styleguideClasses from SVGO fingerprint and plugin passthrough**: Handle `styleguideClasses` specially in settings -- extract to top-level, exclude from fingerprint and SVGO plugins.
  - Files: `src/js/page/ui/settings.js`
  - Modifies: `src/js/page/ui/settings.js`
  - Depends on: T1.1
  - Verification: `npm run lint:js`

## Phase 3: Preview CSS

- [x] **T3.1 Add styleguide class preview styles**: Inject `<style>` element into SVG with preview CSS rules for visual confirmation.
  - Files: `src/js/page/styleguide-classes.js`
  - Modifies: `src/js/page/styleguide-classes.js`
  - Depends on: T2.1
  - Verification: `npm run lint:js`

## Phase 4: Batch Integration

- [x] **T4.1 Apply styleguide classes in batch optimization flow**: Ensure class injection works for multiple files and all UI flows.
  - Files: `src/js/page/main-controller.js`, `src/js/page/styleguide-classes.js`
  - Modifies: `src/js/page/main-controller.js`, `src/js/page/styleguide-classes.js`
  - Depends on: T2.2, T3.1
  - Verification: `npm run build`

## Phase 5: Final Verification

- [x] **T5.1 Full build and lint check**: Run `npm test` (lint + build). Verify no regressions.
  - Files: (none -- verification only)
  - Verification: `npm test`

## Phase 6: Download Bug Fixes

- [x] **T6.1 Include styleguide classes in single-file download**: In `src/js/page/main-controller.js`, modify `_updateForFile` so that when `settings.styleguideClasses` is enabled, the download button receives an SVG with classes injected but WITHOUT preview styles. Currently the download button gets the raw `svgFile` (no classes at all). The fix:
  1. When `settings.styleguideClasses` is true, reuse the `copyText` variable (which already has classes without preview styles) to create a download-specific `SvgFile`: `const downloadFile = new SvgFile(copyText, svgFile.width, svgFile.height)`
  2. Pass `downloadFile` to `this._downloadButtonUi.setDownload()` instead of the raw `svgFile`
  3. When `settings.styleguideClasses` is false, continue passing the original `svgFile` (no change to current behavior)
  4. The three SVG variants in `_updateForFile` are now: (a) `displayFile` = classes + preview styles (for output preview), (b) `copyText` / `downloadFile` = classes only, no preview styles (for clipboard and download), (c) `svgFile` = original optimized SVG (for size comparison)
  - Files: `src/js/page/main-controller.js`
  - Modifies: `src/js/page/main-controller.js`
  - Verification: `npm run lint:js`

- [x] **T6.2 Use edited icon name as download filename**: In `src/js/page/main-controller.js`, modify `_updateForFile` and add a metadata change listener so the download filename reflects the user-edited display name. The fix:
  1. In `_updateForFile`: read the display name from `this._fileCollection.activeFile` (this is always up-to-date, unlike `this._activeDisplayName` which only syncs on file switch, not on rename). Construct filename as `activeFile.displayName + '.svg'`. Fall back to `this._inputFilename` if no active file exists.
  2. Pass this constructed filename to `this._downloadButtonUi.setDownload(downloadFilename, ...)`
  3. In the constructor, add a listener on `this._fileCollection.emitter.on('change', ...)` that checks if the changed entry is the active file. If so, re-call `this._downloadButtonUi.setDownload()` with the updated filename and the correct SVG file (applying styleguide classes if the setting is enabled). This ensures renaming the icon immediately updates the download filename without re-optimization.
  4. Extract the download-file-building logic (styleguide class application + filename construction) into a small private helper method `_getDownloadInfo()` that returns `{ filename, file }` to avoid duplicating the logic between `_updateForFile` and the change listener.
  - Files: `src/js/page/main-controller.js`
  - Modifies: `src/js/page/main-controller.js`
  - Depends on: T6.1
  - Verification: `npm run lint:js`

- [x] **T6.3 Include styleguide classes and edited names in download-all ZIP**: In `src/js/page/ui/download-all-button.js`, update the `download` method to use edited display names and apply styleguide classes. The fix:
  1. Change `download(files)` signature to `download(files, { styleguideClasses } = {})`
  2. Import `addStyleguideClasses` from `../styleguide-classes.js`
  3. When iterating files: use `entry.displayName + '.svg'` as the ZIP entry filename (instead of `entry.filename`)
  4. When `styleguideClasses` is true, apply `addStyleguideClasses(svgFile.text, { includePreviewStyles: false })` to each file's text before adding to the ZIP
  5. Update the caller in `main-controller.js` constructor: in the download-all click handler, pass the current styleguide setting: `this._downloadAllButtonUi.download(this._fileCollection.files, { styleguideClasses: this._settingsUi.getSettings().styleguideClasses })`
  - Files: `src/js/page/ui/download-all-button.js`, `src/js/page/main-controller.js`
  - Modifies: `src/js/page/ui/download-all-button.js`, `src/js/page/main-controller.js`
  - Depends on: T6.1
  - Verification: `npm run lint:js`

## Phase 7: Final Verification

- [x] **T7.1 Full build and lint check**: Run `npm test` (lint + build). Verify no regressions.
  - Files: (none -- verification only)
  - Verification: `npm test`

## Changelog
- 2026-03-27 12:00: Created plan
- 2026-03-27: Moved toggle from Global settings to Features section. Rewrote T2.3 for special handling in plugin input loop.
- 2026-03-27: Completed all phases T1-T5, marked plan Complete.
- 2026-03-27: Added Phase 6 (T6.1-T6.3) and Phase 7 (T7.1) to fix two issues: (1) BUG -- downloads not including styleguide classes because _updateForFile passed raw svgFile to download button; (2) ENHANCEMENT -- downloads now use user-edited icon name as filename. Also fixed download-all ZIP for both issues.
