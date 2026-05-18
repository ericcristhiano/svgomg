# Multi-Icon Support for SVGOMG

**Ticket**: N/A
**Branch**: multi-icon-support
**Created**: 2026-03-27
**Status**: Complete

## Summary

Add multi-icon support to SVGOMG so users can load, optimize, and export several SVG icons at once. The current app is fundamentally single-file (one `_inputItem`, one output view, one download button). This plan introduces a file collection model, a file list sidebar for navigating between loaded files, batch optimization via the existing SVGO worker, and a "Download All" zip export. The single-file viewing/editing experience is preserved -- the file list acts as a navigator to switch between files.

## Quick Status

| Category | Tasks |
|----------|-------|
| **In Progress** | -- |
| **Up Next** | -- |
| **Blocked** | -- |
| **Completed** | T1.1, T1.2, T2.1, T2.2, T2.3, T3.1, T3.2, T3.3, T4.1, T4.2, T5.1, T5.2, T5.3, T6.1, T6.2, T6.3, T6.4, T7.1 |

## Phase 1: Core Data Model -- File Collection

- [x] **T1.1 Create SvgFileCollection model**: Create a new `SvgFileCollection` class that manages an ordered list of SVG files and their optimization state. Each entry holds: `id` (unique), `filename`, `inputItem` (original SvgFile), `outputItem` (optimized SvgFile or null), `status` ('pending' | 'optimizing' | 'done' | 'error'), and `error` (if any). The collection emits events via nanoevents: `add`, `remove`, `change`, `active-change`. It tracks the currently "active" file (the one displayed in the output view). This class replaces the single `_inputItem` / `_inputFilename` / `_cache` pattern in MainController.
  - Files: `src/js/page/svg-file-collection.js`
  - Verification: `npm run lint:js`

- [x] **T1.2 Update SvgFile with release tracking**: Add an `id` property to `SvgFile` and ensure `release()` is called when files are removed from the collection to prevent blob URL leaks. This is a minor enhancement -- the class already has `release()`, we just need to ensure the collection calls it on removal.
  - Files: `src/js/page/svg-file.js`
  - Modifies: `src/js/page/svg-file.js`
  - Verification: `npm run lint:js`
  - Depends on: T1.1

## Phase 2: Multi-File Input Support

- [x] **T2.1 Enable multiple file selection in MainMenu**: Change the file input to accept `multiple` attribute. Update `_onFileInputChange` to iterate over all selected files and emit `svgDataLoad` for each, or emit a new `svgBatchLoad` event with an array of `{ data, filename }` objects. The `_loadFileInput` element in `src/index.html` needs the `multiple` attribute, and the JS handler in `main-menu.js` needs to loop through `this._loadFileInput.files`.
  - Files: `src/index.html`, `src/js/page/ui/main-menu.js`
  - Modifies: `src/index.html`, `src/js/page/ui/main-menu.js`
  - Verification: `npm run lint:js`

- [x] **T2.2 Enable multiple file drop in FileDrop**: Update `_onDrop` to handle `event.dataTransfer.files` (all files, not just `files[0]`). Filter to only `.svg` files. Emit a `svgBatchLoad` event with array of `{ data, filename }`.
  - Files: `src/js/page/ui/file-drop.js`
  - Modifies: `src/js/page/ui/file-drop.js`
  - Verification: `npm run lint:js`

- [x] **T2.3 Update MainController to handle batch input**: Refactor `_onInputChange` to work with `SvgFileCollection`. Add a new `_onBatchInput` handler for `svgBatchLoad` events. Each incoming file is wrapped via `svgo.wrapOriginal()` and added to the collection. The first file (or first of the batch) becomes active. Optimization runs for the active file. Wire up collection events to update UI components. Remove the single-file `_inputItem`, `_inputFilename`, and `_cache` fields -- the collection manages all of this.
  - Files: `src/js/page/main-controller.js`
  - Modifies: `src/js/page/main-controller.js`
  - Verification: `npm run lint:js`
  - Depends on: T1.1, T2.1, T2.2

## Phase 3: File List Sidebar UI

- [x] **T3.1 Create FileList UI component**: Create a new UI component that renders a vertical list of loaded files. Each item shows: filename (truncated), a small thumbnail (using the SVG blob URL), file size, optimization status indicator (spinner/checkmark/error icon), and percentage savings when done. The active file is highlighted. Clicking a file emits an `activate` event with the file id. Include a remove button (x) per file that emits `remove`. Use nanoevents for the emitter pattern, consistent with other UI components.
  - Files: `src/js/page/ui/file-list.js`
  - Verification: `npm run lint:js`

- [x] **T3.2 Create FileList SCSS styles**: Style the file list as a sidebar panel. On desktop (>=640px), it appears as a narrow column (180px) to the left of the output area. On mobile, it appears as a horizontal scrollable strip above the output. Each file item has a thumbnail, name, and status badge. Active item has a highlighted border. The strip/sidebar should scroll when many files are loaded.
  - Files: `src/css/components/_file-list.scss`, `src/css/_components.scss`
  - Modifies: `src/css/_components.scss`
  - Verification: `npm run lint:css`

- [x] **T3.3 Integrate FileList into layout**: Add the FileList component into the main layout. In `main-controller.js`, instantiate FileList and wire it to SvgFileCollection events. When the collection emits `add`/`remove`/`change`, update the file list UI. When FileList emits `activate`, set the active file in the collection and update output/results. When FileList emits `remove`, remove the file from the collection. The file list panel should only be visible when more than one file is loaded (or always visible once files are loaded -- to be refined). Update `src/index.html` to add a container div for the file list within `.main`.
  - Files: `src/js/page/main-controller.js`, `src/index.html`, `src/css/_main-layout.scss`
  - Modifies: `src/js/page/main-controller.js`, `src/index.html`, `src/css/_main-layout.scss`
  - Verification: `npm run lint && npm run build`
  - Depends on: T3.1, T3.2, T2.3

## Phase 4: Batch Optimization Engine

- [x] **T4.1 Add batch optimization to MainController**: When files are added to the collection, queue optimization for all of them (not just the active one). Use the existing `svgo.process()` method but call it sequentially for each file (the worker handles one at a time). Update each file's status in the collection as it progresses. The active file's optimization is prioritized (optimized first). Store optimized results on the collection entry. When settings change, re-optimize all files (clear all cached results). Use a job queue pattern: maintain an array of pending file IDs, process them one by one, and allow cancellation when settings change.
  - Files: `src/js/page/main-controller.js`
  - Modifies: `src/js/page/main-controller.js`
  - Verification: `npm run lint:js`
  - Depends on: T2.3

- [x] **T4.2 Update Results display for active file**: Modify the results display to show stats for the currently active file. When switching between files in the file list, the Results component should update to reflect the active file's original vs optimized size. The Output component should display the active file's optimized SVG (or original if "Show original" is toggled). This is mostly wiring -- the existing `_updateForFile` method works per-file, we just need to call it when the active file changes.
  - Files: `src/js/page/main-controller.js`
  - Modifies: `src/js/page/main-controller.js`
  - Verification: `npm run lint:js`
  - Depends on: T4.1, T3.3

## Phase 5: Download All (Zip Export)

- [x] **T5.1 Add JSZip dependency**: Install JSZip for creating zip archives in the browser. This is a well-established library (~100KB) for client-side zip generation. Add it to `package.json` dependencies.
  - Files: `package.json`, `package-lock.json`
  - Verification: `npm install && npm ls jszip`

- [x] **T5.2 Create DownloadAllButton UI component**: Create a new floating action button that appears when multiple files are loaded. It generates a zip file containing all optimized SVGs (or original if not yet optimized) and triggers a download. The button shows a zip icon and a spinner while generating. Use JSZip to build the archive and `URL.createObjectURL` with the resulting blob to trigger the download via a temporary anchor element. The button should be disabled while any file is still optimizing (or offer to download what's ready).
  - Files: `src/js/page/ui/download-all-button.js`
  - Verification: `npm run lint:js`
  - Depends on: T5.1

- [x] **T5.3 Integrate DownloadAllButton into layout**: Add the DownloadAllButton to the action button container in MainController. Show it only when more than one file is in the collection. Wire it to the collection to get all optimized file data. Update the existing download button to download only the currently active file (it already does this, just confirm the behavior is preserved). Position the DownloadAll button near the existing download button.
  - Files: `src/js/page/main-controller.js`, `src/css/components/_floating-action-button.scss`
  - Modifies: `src/js/page/main-controller.js`, `src/css/components/_floating-action-button.scss`
  - Verification: `npm run lint && npm run build`
  - Depends on: T5.2, T4.1

## Phase 6: Polish and Edge Cases

- [x] **T6.1 Handle non-SVG files in batch input**: When users drop or select multiple files, filter out non-SVG files and show a toast notification for any skipped files (e.g., "3 files loaded, 2 skipped (not SVG)"). Update both FileDrop and MainMenu to validate file extensions and content.
  - Files: `src/js/page/ui/file-drop.js`, `src/js/page/ui/main-menu.js`, `src/js/page/main-controller.js`
  - Modifies: `src/js/page/ui/file-drop.js`, `src/js/page/ui/main-menu.js`, `src/js/page/main-controller.js`
  - Verification: `npm run lint:js`
  - Depends on: T2.1, T2.2

- [x] **T6.2 Add "Clear All" action**: Add a button or menu item to clear all loaded files and return to the initial state (main menu visible). This resets the collection, hides the file list, and shows the main menu. Could be placed in the file list header or as a toolbar action.
  - Files: `src/js/page/ui/file-list.js`, `src/js/page/main-controller.js`
  - Modifies: `src/js/page/ui/file-list.js`, `src/js/page/main-controller.js`
  - Verification: `npm run lint:js`
  - Depends on: T3.3

- [x] **T6.3 Preserve single-file UX**: Ensure that when only one file is loaded, the app behaves identically to the current experience -- no file list visible, download button works as before, results show as before. The file list should gracefully appear when a second file is added and disappear when files are removed down to one. Test that paste input, demo loading, and Ctrl+O still work for single files.
  - Files: `src/js/page/main-controller.js`, `src/js/page/ui/file-list.js`
  - Modifies: `src/js/page/main-controller.js`, `src/js/page/ui/file-list.js`
  - Verification: `npm run lint && npm run build`
  - Depends on: T3.3, T5.3

- [x] **T6.4 Update keyboard shortcuts**: Update the Ctrl+O handler to open the multi-file picker. Ensure paste still works (adds one file). Add keyboard navigation for the file list (arrow keys to switch active file when file list is focused).
  - Files: `src/js/page/main-controller.js`
  - Modifies: `src/js/page/main-controller.js`
  - Verification: `npm run lint:js`
  - Depends on: T3.3

## Phase 7: Build and Test Verification

- [x] **T7.1 Full build and manual test**: Run the full build pipeline (`npm run build`) and verify no errors. Run linting (`npm run lint`). Manually test: load multiple SVGs via file picker, load via drag-and-drop, switch between files, verify optimization runs for all, download individual file, download all as zip, clear all files, verify single-file UX is preserved.
  - Files: (no new files)
  - Verification: `npm test`
  - Depends on: T6.3

## Changelog
- 2026-03-27: Created plan
