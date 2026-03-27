# Icon Metadata, Styleguide Export, and CSS Background Copy

**Ticket**: N/A
**Branch**: multi-icon-support
**Created**: 2026-03-27
**Status**: Complete

## Summary

Extend the multi-icon support with metadata editing (icon name and search keywords per icon), a styleguide HTML export feature that outputs icons in a specific format for documentation, and a "Copy as CSS background" feature that copies the active SVG as a `url('data:image/svg+xml,...')` value. These features build on the existing `SvgFileCollection` model and `FileList` UI.

## Quick Status

| Category | Tasks |
|----------|-------|
| **In Progress** | -- |
| **Up Next** | -- |
| **Blocked** | -- |
| **Completed** | T1.1, T1.2, T2.1, T2.2, T2.3, T2.4, T3.1, T3.2, T3.3, T3.4, T4.1, T4.2, T4.3, T4.4, T5.1 |

## Phase 1: Data Model -- Icon Metadata

- [x] **T1.1 Add metadata fields to SvgFileCollection entries**: Extend the `add()` method in `SvgFileCollection` to include `displayName` (string, defaults to filename without `.svg` extension) and `keywords` (array of strings, defaults to empty array) on each entry. Add an `updateMetadata(id, { displayName, keywords })` method that updates these fields and emits a `'change'` event. The `displayName` is the user-editable icon name (e.g., `v3/auto`), and `keywords` are comma-separated search terms (e.g., `["auto", "car", "vehicle"]`).
  - Files: `src/js/page/svg-file-collection.js`
  - Modifies: `src/js/page/svg-file-collection.js`
  - Verification: `npm run lint:js`

- [x] **T1.2 Wire metadata into MainController**: When files are added to the collection in `_onBatchInput`, derive the initial `displayName` from the filename (strip `.svg` extension). No changes to the optimization pipeline -- metadata is orthogonal to SVG processing. Ensure `_onActiveFileChange` exposes the active file's metadata so downstream UI can read it.
  - Files: `src/js/page/main-controller.js`
  - Modifies: `src/js/page/main-controller.js`
  - Verification: `npm run lint:js`
  - Depends on: T1.1

## Phase 2: Editable Icon Name and Keywords in FileList UI

- [x] **T2.1 Add inline name editing to FileList items**: Extend the `FileList` component to make the icon name (`.file-list-item-name`) editable. On double-click (or click on an edit icon), replace the name span with a text input pre-filled with the current `displayName`. On blur or Enter, emit a `'rename'` event with `{ id, displayName }`. On Escape, cancel the edit. Update `createItemEl` to render the `displayName` (from the entry) instead of the filename. Show the original filename as a tooltip.
  - Files: `src/js/page/ui/file-list.js`
  - Modifies: `src/js/page/ui/file-list.js`
  - Verification: `npm run lint:js`
  - Depends on: T1.1

- [x] **T2.2 Add keywords editing to FileList items**: Add a small keywords area below the name in each file list item (desktop only -- hidden on mobile for space). Display current keywords as comma-separated text. On click, show an editable text input. On blur or Enter, parse the comma-separated string into an array, trim whitespace, and emit a `'keywords'` event with `{ id, keywords }`. If no keywords are set, show a subtle "Add keywords..." placeholder.
  - Files: `src/js/page/ui/file-list.js`
  - Modifies: `src/js/page/ui/file-list.js`
  - Verification: `npm run lint:js`
  - Depends on: T2.1

- [x] **T2.3 Wire rename and keywords events to collection**: In `MainController`, listen for `'rename'` and `'keywords'` events from the FileList UI. Call `this._fileCollection.updateMetadata(id, { displayName })` and `this._fileCollection.updateMetadata(id, { keywords })` respectively. The collection's `'change'` event will automatically update the FileList UI via the existing wiring.
  - Files: `src/js/page/main-controller.js`
  - Modifies: `src/js/page/main-controller.js`
  - Verification: `npm run lint:js`
  - Depends on: T2.1, T2.2, T1.2

- [x] **T2.4 Style metadata editing in FileList**: Add SCSS styles for the inline name edit input, keywords display and edit input, and the "Add keywords..." placeholder. The edit inputs should match the file list's visual style (small font, compact). Ensure the file list item does not jump in size when switching between display and edit modes.
  - Files: `src/css/components/_file-list.scss`
  - Modifies: `src/css/components/_file-list.scss`
  - Verification: `npm run lint:css`
  - Depends on: T2.1, T2.2

## Phase 3: Copy as CSS Background

- [x] **T3.1 Create CopyBgButton UI component**: Create a new floating action button (extending `FloatingActionButton`) called `CopyBgButton`. When clicked, it takes the active file's optimized SVG text (or original if not optimized), URI-encodes it for use in a CSS `url()` value, and copies the result to the clipboard. The format is: `url('data:image/svg+xml,<encoded-svg>')`. The encoding must replace `#` with `%23`, `'` with `%27`, and other special characters. Use the Clipboard API (`navigator.clipboard.writeText()`) with a fallback to the `document.execCommand('copy')` pattern used by the existing `CopyButton`.
  - Files: `src/js/page/ui/copy-bg-button.js`
  - Verification: `npm run lint:js`

- [x] **T3.2 Add SVG-to-CSS-background utility function**: Create a utility function `svgToCssBackground(svgText)` in `utils.js` that takes raw SVG text and returns the full `url('data:image/svg+xml,...')` string. The encoding should: (1) remove newlines and collapse whitespace, (2) encode `#` as `%23`, (3) encode `'` as `%27`, (4) encode `<` as `%3C` and `>` as `%3E` only if needed for browser compatibility, or use minimal encoding. This keeps the output compact while being valid CSS.
  - Files: `src/js/page/utils.js`
  - Modifies: `src/js/page/utils.js`
  - Verification: `npm run lint:js`

- [x] **T3.3 Integrate CopyBgButton into MainController**: Instantiate `CopyBgButton` in the constructor. Append it to the `minorActionContainer` (alongside the existing `BgFillButton` and `CopyButton`). In `_updateForFile`, call `this._copyBgButtonUi.setSvgText(svgFile.text)` to keep the button's source text in sync with the active file. Show a toast on successful copy ("CSS background copied") or failure.
  - Files: `src/js/page/main-controller.js`
  - Modifies: `src/js/page/main-controller.js`
  - Verification: `npm run lint:js`
  - Depends on: T3.1, T3.2

- [x] **T3.4 Style CopyBgButton**: Add any needed SCSS for the new button. Since it extends `FloatingActionButton`, it inherits most styling. May need a distinct icon color or tooltip styling to differentiate it from the existing Copy button.
  - Files: `src/css/components/_floating-action-button.scss`
  - Modifies: `src/css/components/_floating-action-button.scss`
  - Verification: `npm run lint:css`

## Phase 4: Styleguide HTML Export

- [x] **T4.1 Create ExportButton UI component**: Create a new button (extending `FloatingActionButton` or as a standalone button in the action area) that triggers the styleguide export. When clicked, it generates an HTML string from all files in the collection using this template per icon:

  ```html
  <a href="#" class="ca-icon__grid-cell js-element-cell js-icon-cell" data-search-keywords="keyword1, keyword2" id="DISPLAY_NAME">{% include "frontend/icons/DISPLAY_NAME.html" %}</a>
  ```

  Where `DISPLAY_NAME` is the icon's `displayName` and keywords come from the `keywords` array. The generated HTML is joined with newlines. The button should copy the full output to the clipboard and show a toast confirmation. The button should only be visible/enabled when there are files in the collection.
  - Files: `src/js/page/ui/export-button.js`
  - Verification: `npm run lint:js`
  - Depends on: T1.1

- [x] **T4.2 Create styleguide export generator function**: Create a pure function `generateStyleguideExport(files)` (in a new module or in `utils.js`) that takes the array of file collection entries and returns the full HTML string. Each entry produces one `<a>` tag line. The function handles escaping of `displayName` and `keywords` for use in HTML attributes. This separation from the UI makes the logic testable and reusable.
  - Files: `src/js/page/styleguide-export.js`
  - Verification: `npm run lint:js`
  - Depends on: T1.1

- [x] **T4.3 Integrate ExportButton into MainController**: Instantiate `ExportButton` in the constructor. Append it to the `actionContainer` (near the download buttons). Wire the click handler to call `generateStyleguideExport(this._fileCollection.files)`, copy the result to clipboard, and show a toast. Show/hide the button based on collection length (visible when >= 1 file). Also offer a "Download as HTML" fallback that saves the export as a `.html` file via blob URL.
  - Files: `src/js/page/main-controller.js`
  - Modifies: `src/js/page/main-controller.js`
  - Verification: `npm run lint:js`
  - Depends on: T4.1, T4.2

- [x] **T4.4 Style ExportButton**: Add SCSS for the export button. If it uses `FloatingActionButton`, it inherits base styles. Add a distinct icon (e.g., a code/export icon) and ensure it visually groups with the other action buttons without crowding the UI.
  - Files: `src/css/components/_floating-action-button.scss`
  - Modifies: `src/css/components/_floating-action-button.scss`
  - Verification: `npm run lint:css`

## Phase 5: Build and Test Verification

- [x] **T5.1 Full build and lint verification**: Run the full build pipeline and linting. Verify no regressions in the existing multi-icon workflow. Confirm all new buttons render correctly, metadata editing works, export generates correct HTML, and CSS background copy produces valid output.
  - Files: (no new files)
  - Verification: `npm test`
  - Depends on: T4.3, T3.3, T2.4

## Changelog
- 2026-03-27: Created plan
