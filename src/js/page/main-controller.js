import { idbKeyval as storage } from '../utils/storage.js';
import Svgo from './svgo.js';
import { domReady } from './utils.js';
import Output from './ui/output.js';
import DownloadButton from './ui/download-button.js';
import DownloadAllButton from './ui/download-all-button.js';
import CopyButton from './ui/copy-button.js';
import CopyBgButton from './ui/copy-bg-button.js';
import ExportButton from './ui/export-button.js';
import BgFillButton from './ui/bg-fill-button.js';
import { addStyleguideClasses } from './styleguide-classes.js';
import { generateStyleguideExport } from './styleguide-export.js';
import Results from './ui/results.js';
import Settings from './ui/settings.js';
import MainMenu from './ui/main-menu.js';
import Toasts from './ui/toasts.js';
import FileDrop from './ui/file-drop.js';
import Preloader from './ui/preloader.js';
import Changelog from './ui/changelog.js';
import ResultsContainer from './ui/results-container.js';
import ViewToggler from './ui/view-toggler.js';
import ResultsCache from './results-cache.js';
import MainUi from './ui/main-ui.js';
import FileList from './ui/file-list.js';
import SvgFile from './svg-file.js';
import SvgFileCollection from './svg-file-collection.js';

const svgo = new Svgo();

export default class MainController {
  constructor() {
    // ui components
    this._mainUi = null;
    this._outputUi = new Output();
    this._downloadButtonUi = new DownloadButton();
    this._downloadAllButtonUi = new DownloadAllButton();
    this._copyButtonUi = new CopyButton();
    this._copyBgButtonUi = new CopyBgButton();
    this._exportButtonUi = new ExportButton();
    this._resultsUi = new Results();
    this._settingsUi = new Settings();
    this._mainMenuUi = new MainMenu();
    this._toastsUi = new Toasts();

    const bgFillUi = new BgFillButton();
    const dropUi = new FileDrop();
    const preloaderUi = new Preloader();
    const changelogUi = new Changelog(self.version);
    // _resultsContainerUi is unused
    this._resultsContainerUi = new ResultsContainer(this._resultsUi);
    const viewTogglerUi = new ViewToggler();

    // ui events
    this._settingsUi.emitter.on('change', () => this._onSettingsChange());
    this._settingsUi.emitter.on('reset', (oldSettings) =>
      this._onSettingsReset(oldSettings),
    );
    this._mainMenuUi.emitter.on('svgDataLoad', (event) =>
      this._onInputChange(event),
    );
    this._mainMenuUi.emitter.on('svgBatchLoad', (event) =>
      this._onBatchInput(event),
    );
    dropUi.emitter.on('svgBatchLoad', (event) => this._onBatchInput(event));
    this._mainMenuUi.emitter.on('error', ({ error }) =>
      this._handleError(error),
    );
    viewTogglerUi.emitter.on('change', (event) =>
      this._outputUi.set(event.value),
    );
    window.addEventListener('keydown', (event) => this._onGlobalKeyDown(event));
    window.addEventListener('paste', (event) => this._onGlobalPaste(event));
    window.addEventListener('copy', (event) => this._onGlobalCopy(event));
    this._copyBgButtonUi.emitter.on('copy', ({ success }) =>
      this._toastsUi.show(
        success ? 'CSS background copied' : 'Nothing to copy',
        { duration: 2000 },
      ),
    );
    this._exportButtonUi.emitter.on('click', () => this._exportStyleguide());

    // state
    this._inputItem = null;
    this._activeDisplayName = '';
    this._activeKeywords = [];
    this._cache = new ResultsCache(10);
    this._latestCompressJobId = 0;
    this._userHasInteracted = false;
    this._reloading = false;
    this._fileCollection = new SvgFileCollection();

    // Batch optimization state
    this._optimizationQueue = [];
    this._optimizing = false;
    this._optimizationVersion = 0;
    this._fileListUi = new FileList();
    this._fileListUi.hide();

    // Wire collection events to file list UI
    this._fileCollection.emitter.on('add', (entry) => {
      this._fileListUi.addFile(entry);
      this._updateFileListVisibility();
      this._exportButtonUi.setFiles(this._fileCollection.files);
    });
    this._fileCollection.emitter.on('remove', (entry) => {
      this._fileListUi.removeFile(entry.id);
      this._updateFileListVisibility();
      this._exportButtonUi.setFiles(this._fileCollection.files);
    });
    this._fileCollection.emitter.on('change', (entry) => {
      this._fileListUi.updateFile(entry.id, entry);
      this._updateDownloadAllEnabled();
      this._exportButtonUi.setFiles(this._fileCollection.files);

      // If the changed entry is the active file, update the download button
      // so that renaming immediately reflects in the download filename.
      const currentActive = this._fileCollection.activeFile;
      if (currentActive && currentActive.id === entry.id) {
        const downloadInfo = this._getDownloadInfo();
        if (downloadInfo) {
          this._downloadButtonUi.setDownload(
            downloadInfo.filename,
            downloadInfo.file,
          );
        }
      }
    });
    this._fileCollection.emitter.on('active-change', (entry) => {
      if (entry) this._fileListUi.setActive(entry.id);
      this._onActiveFileChange(entry);
      // Re-prioritize queue: move active file to front
      if (entry && this._optimizationQueue.length > 1) {
        const idx = this._optimizationQueue.indexOf(entry.id);
        if (idx > 0) {
          this._optimizationQueue.splice(idx, 1);
          this._optimizationQueue.unshift(entry.id);
        }
      }
    });

    // Wire file list UI events back to collection
    // FileList emits string IDs from dataset; collection uses numeric IDs
    this._fileListUi.emitter.on('activate', (id) =>
      this._fileCollection.setActive(Number(id)),
    );
    this._fileListUi.emitter.on('remove', (id) =>
      this._fileCollection.remove(Number(id)),
    );
    this._fileListUi.emitter.on('clearAll', () => this._clearAllFiles());
    this._fileListUi.emitter.on('rename', ({ id, displayName }) =>
      this._fileCollection.updateMetadata(Number(id), { displayName }),
    );
    this._fileListUi.emitter.on('keywords', ({ id, keywords }) =>
      this._fileCollection.updateMetadata(Number(id), { keywords }),
    );

    // Wire download-all button
    this._downloadAllButtonUi.emitter.on('click', () =>
      this._downloadAllButtonUi.download(this._fileCollection.files, {
        styleguideClasses: this._settingsUi.getSettings().styleguideClasses,
      }),
    );

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('sw.js', { scope: './' })
        .then((registration) => {
          registration.addEventListener('updatefound', () =>
            this._onUpdateFound(registration),
          );
        });
    }

    // tell the user about the latest update
    storage.get('last-seen-version').then((lastSeenVersion) => {
      if (lastSeenVersion) changelogUi.showLogFrom(lastSeenVersion);
      storage.set('last-seen-version', self.version);
    });

    domReady.then(() => {
      const container = document.querySelector('.app-output');
      const actionContainer = container.querySelector(
        '.action-button-container',
      );
      const minorActionContainer = container.querySelector(
        '.minor-action-container',
      );
      const toolbarElement = container.querySelector('.toolbar');
      const outputElement = container.querySelector('.output');
      const menuExtraElement = container.querySelector('.menu-extra');

      // elements for intro anim
      this._mainUi = new MainUi(
        toolbarElement,
        actionContainer,
        this._outputUi.container,
        this._settingsUi.container,
      );

      this._fileListContainer = document.querySelector('.file-list-container');
      this._fileListContainer.append(this._fileListUi.container);

      minorActionContainer.append(
        bgFillUi.container,
        this._copyButtonUi.container,
        this._copyBgButtonUi.container,
      );
      actionContainer.append(
        this._exportButtonUi.container,
        this._downloadAllButtonUi.container,
        this._downloadButtonUi.container,
      );
      outputElement.append(this._outputUi.container);
      container.append(this._toastsUi.container, dropUi.container);
      menuExtraElement.append(changelogUi.container);

      // load previous settings
      this._loadSettings();

      // someone managed to hit the preloader, aww
      if (preloaderUi.activated) {
        this._toastsUi.show('Ready now!', { duration: 3000 });
      }

      // for testing
      // eslint-disable-next-line no-constant-condition
      if (false) {
        (async () => {
          const data = await fetch('test-svgs/car-lite.svg').then((response) =>
            response.text(),
          );
          this._onInputChange({ data, filename: 'car-lite.svg' });
        })();
      }
    });
  }

  _onGlobalKeyDown(event) {
    if (event.key === 'o' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      this._mainMenuUi.showFilePicker();
    }

    if (event.key === 'Escape') this._mainMenuUi.hide();
  }

  _onGlobalPaste(event) {
    const value = event.clipboardData.getData('text');
    if (!value.includes('</svg>')) {
      this._toastsUi.show('Pasted value not an SVG', { duration: 2000 });
    } else {
      this._mainMenuUi.setPasteInput(value);
      event.preventDefault();
    }
  }

  _onGlobalCopy(event) {
    const selection = window.getSelection();
    if (!selection.isCollapsed) return;

    this._toastsUi.show(
      this._copyButtonUi.copyText() ? 'Copy successful' : 'Nothing to copy',
      { duration: 2000 },
    );

    event.preventDefault();
  }

  _onUpdateFound(registration) {
    const newWorker = registration.installing;

    registration.installing.addEventListener('statechange', async () => {
      if (this._reloading) return;

      // the very first activation!
      // tell the user stuff works offline
      if (
        newWorker.state === 'activated' &&
        !navigator.serviceWorker.controller
      ) {
        this._toastsUi.show('Ready to work offline', { duration: 5000 });
        return;
      }

      if (
        newWorker.state === 'activated' &&
        navigator.serviceWorker.controller
      ) {
        // if the user hasn't interacted yet, do a sneaky reload
        if (!this._userHasInteracted) {
          this._reloading = true;
          location.reload();
          return;
        }

        // otherwise, show the user an alert
        const toast = this._toastsUi.show('Update available', {
          buttons: ['reload', 'dismiss'],
        });
        const answer = await toast.answer;

        if (answer === 'reload') {
          this._reloading = true;
          location.reload();
        }
      }
    });
  }

  _onSettingsChange() {
    const settings = this._settingsUi.getSettings();
    this._saveSettings(settings);
    this._compressSvg(settings);

    // Re-optimize non-active files in the collection when settings change.
    // The active file is already handled by _compressSvg above.
    if (this._fileCollection.length > 1) {
      this._optimizationVersion++;
      const activeFile = this._fileCollection.activeFile;
      const activeId = activeFile ? activeFile.id : null;

      for (const file of this._fileCollection.files) {
        if (file.id !== activeId) {
          this._fileCollection.update(file.id, {
            outputItem: null,
            status: 'pending',
            error: null,
          });
        }
      }

      this._queueOptimization();
    }
  }

  async _onSettingsReset(oldSettings) {
    const toast = this._toastsUi.show('Settings reset', {
      buttons: ['undo', 'dismiss'],
      duration: 5000,
    });
    const answer = await toast.answer;

    if (answer === 'undo') {
      this._settingsUi.setSettings(oldSettings);
      this._onSettingsChange();
    }
  }

  async _onInputChange({ data, filename }) {
    this._onBatchInput({ files: [{ data, filename }], skippedCount: 0 });
  }

  async _onBatchInput({ files, skippedCount }) {
    this._userHasInteracted = true;

    if (skippedCount > 0) {
      this._toastsUi.show(
        `${files.length} file${
          files.length === 1 ? '' : 's'
        } loaded, ${skippedCount} skipped (not SVG)`,
        { duration: 5000 },
      );
    }

    // Cancel any in-flight optimization before wrapping new files.
    // abort() terminates the worker and rejects all pending requests,
    // so it must run before we send new wrapOriginal messages.
    this._optimizationVersion++;
    this._optimizationQueue = [];
    svgo.abort();

    this._fileCollection.clear();
    this._fileListUi.clear();
    this._cache.purge();

    const results = await Promise.allSettled(
      files.map(({ data, filename }) =>
        svgo.wrapOriginal(data).then((inputItem) => ({ inputItem, filename })),
      ),
    );

    for (const result of results) {
      if (result.status === 'fulfilled') {
        this._fileCollection.add(result.value.filename, result.value.inputItem);
      } else {
        this._handleError(new Error(`Load failed: ${result.reason.message}`));
      }
    }

    if (this._fileCollection.length > 0) {
      // _onActiveFileChange (triggered by the first add) already set
      // _inputItem, _inputFilename, and called _compressSvg for the active file.
      this._outputUi.reset();
      this._mainUi.activate();

      // Queue batch optimization for remaining (non-active) files
      this._queueOptimization();
    }

    this._mainMenuUi.allowHide = true;
    this._mainMenuUi.hide();
  }

  _onActiveFileChange(entry) {
    if (!entry) return;

    // Sync legacy state with new active file
    this._inputItem = entry.inputItem;
    this._inputFilename = entry.filename;
    this._activeDisplayName = entry.displayName;
    this._activeKeywords = entry.keywords;
    this._cache.purge();

    const settings = this._settingsUi.getSettings();

    if (entry.status === 'done' && entry.outputItem) {
      // File already optimized -- show cached results immediately
      if (settings.original) {
        this._updateForFile(entry.inputItem, {
          compress: settings.gzip,
        });
      } else {
        this._updateForFile(entry.outputItem, {
          compareToFile: entry.inputItem,
          compress: settings.gzip,
        });
      }
    } else {
      // File not yet optimized -- show original and reset output
      this._compressSvg(settings);
      this._outputUi.reset();
    }
  }

  _updateFileListVisibility() {
    if (this._fileCollection.length > 1) {
      this._fileListUi.show();
      this._downloadAllButtonUi.show();
      if (this._fileListContainer) {
        this._fileListContainer.classList.add('has-files');
      }
    } else {
      this._fileListUi.hide();
      this._downloadAllButtonUi.hide();
      if (this._fileListContainer) {
        this._fileListContainer.classList.remove('has-files');
      }
    }
  }

  _updateDownloadAllEnabled() {
    const anyOptimizing = this._fileCollection.files.some(
      (file) => file.status === 'optimizing' || file.status === 'pending',
    );
    this._downloadAllButtonUi.setEnabled(!anyOptimizing);
  }

  _clearAllFiles() {
    this._fileCollection.clear();
    this._fileListUi.clear();
    this._updateFileListVisibility();

    // Reset legacy single-file state
    this._inputItem = null;
    this._inputFilename = undefined;
    this._cache.purge();

    // Cancel any in-progress batch optimization
    this._optimizationQueue = [];
    this._optimizationVersion++;

    // Reset output and show main menu
    this._outputUi.reset();
    this._resultsUi.update({ size: 0, comparisonSize: 0 });
    this._mainMenuUi.show();
  }

  async _exportStyleguide() {
    const html = generateStyleguideExport(this._fileCollection.files);
    if (!html) {
      this._toastsUi.show('Nothing to export', { duration: 2000 });
      return;
    }

    try {
      await navigator.clipboard.writeText(html);
      this._toastsUi.show('Styleguide HTML copied to clipboard', {
        duration: 3000,
      });
    } catch {
      this._toastsUi.show('Failed to copy to clipboard', { duration: 2000 });
    }
  }

  _syncActiveFile(changes) {
    const activeFile = this._fileCollection.activeFile;
    if (activeFile) {
      this._fileCollection.update(activeFile.id, changes);
    }
  }

  _handleError(error) {
    this._toastsUi.show(error.message, { isError: true });
    console.error(error);
  }

  async _loadSettings() {
    const settings = await storage.get('settings');
    if (settings) this._settingsUi.setSettings(settings);
  }

  _saveSettings(settings) {
    // doesn't make sense to retain the "show original" option
    const { original, ...settingsToKeep } = settings;
    storage.set('settings', settingsToKeep);
  }

  async _compressSvg(settings) {
    if (!this._inputItem) return;

    const thisJobId = (this._latestCompressJobId = Math.random());

    await svgo.abort();

    if (thisJobId !== this._latestCompressJobId) {
      // while we've been waiting, there's been a newer call
      // to _compressSvg, we don't need to do anything
      return;
    }

    if (settings.original) {
      this._updateForFile(this._inputItem, {
        compress: settings.gzip,
      });
      return;
    }

    const cacheMatch = this._cache.match(settings.fingerprint);

    if (cacheMatch) {
      this._updateForFile(cacheMatch, {
        compareToFile: this._inputItem,
        compress: settings.gzip,
      });

      this._syncActiveFile({
        outputItem: cacheMatch,
        status: 'done',
        error: null,
      });

      return;
    }

    this._downloadButtonUi.working();

    try {
      const resultFile = await svgo.process(this._inputItem.text, settings);

      this._updateForFile(resultFile, {
        compareToFile: this._inputItem,
        compress: settings.gzip,
      });

      this._cache.add(settings.fingerprint, resultFile);

      this._syncActiveFile({
        outputItem: resultFile,
        status: 'done',
        error: null,
      });
    } catch (error) {
      if (error.name === 'AbortError') return;
      error.message = `Minifying error: ${error.message}`;
      this._handleError(error);

      this._syncActiveFile({ status: 'error', error: error.message });
    } finally {
      this._downloadButtonUi.done();
    }
  }

  _queueOptimization() {
    const activeFile = this._fileCollection.activeFile;
    const activeId = activeFile ? activeFile.id : null;

    // Build queue: active file first, then remaining pending/error files
    const pendingFiles = this._fileCollection.files.filter(
      (file) =>
        file.id !== activeId &&
        (file.status === 'pending' || file.status === 'error'),
    );

    this._optimizationQueue = [];
    if (activeId) {
      const activeEntry = this._fileCollection.getById(activeId);
      if (
        activeEntry &&
        (activeEntry.status === 'pending' || activeEntry.status === 'error')
      ) {
        this._optimizationQueue.push(activeId);
      }
    }

    for (const file of pendingFiles) {
      this._optimizationQueue.push(file.id);
    }

    if (!this._optimizing && this._optimizationQueue.length > 0) {
      this._processOptimizationQueue();
    }
  }

  async _processOptimizationQueue() {
    this._optimizing = true;
    const version = this._optimizationVersion;
    const settings = this._settingsUi.getSettings();

    while (this._optimizationQueue.length > 0) {
      // Check if settings changed (version incremented) -- abort if so
      if (version !== this._optimizationVersion) {
        break;
      }

      const fileId = this._optimizationQueue.shift();
      const entry = this._fileCollection.getById(fileId);

      // Skip if file was removed or already optimized
      if (!entry || entry.status === 'done') {
        continue;
      }

      this._fileCollection.update(fileId, { status: 'optimizing' });

      try {
        // eslint-disable-next-line no-await-in-loop
        const resultFile = await svgo.process(entry.inputItem.text, settings);

        // Check for cancellation after async work
        if (version !== this._optimizationVersion) {
          break;
        }

        this._fileCollection.update(fileId, {
          outputItem: resultFile,
          status: 'done',
          error: null,
        });

        // If this is the active file, update the UI display
        const activeFile = this._fileCollection.activeFile;
        if (activeFile && activeFile.id === fileId) {
          this._updateForFile(resultFile, {
            compareToFile: entry.inputItem,
            compress: settings.gzip,
          });
        }
      } catch (error) {
        // Check for cancellation
        if (version !== this._optimizationVersion) {
          break;
        }

        if (error.name === 'AbortError') {
          // Re-queue the file if it was aborted for a reason other than version change
          if (version === this._optimizationVersion) {
            this._fileCollection.update(fileId, {
              status: 'pending',
              error: null,
            });
          }

          continue;
        }

        this._fileCollection.update(fileId, {
          status: 'error',
          error: `Minifying error: ${error.message}`,
        });
      }
    }

    this._optimizing = false;
  }

  _getDownloadInfo(svgFile) {
    const settings = this._settingsUi.getSettings();
    const activeFile = this._fileCollection.activeFile;
    const downloadFilename = activeFile
      ? `${activeFile.displayName}.svg`
      : this._inputFilename;

    // If no svgFile provided, use the active file's outputItem (or inputItem)
    const baseSvgFile =
      svgFile ||
      (activeFile && (activeFile.outputItem || activeFile.inputItem));
    if (!baseSvgFile) return null;

    const file = settings.styleguideClasses
      ? new SvgFile(
          addStyleguideClasses(baseSvgFile.text, {
            includePreviewStyles: false,
          }),
          baseSvgFile.width,
          baseSvgFile.height,
        )
      : baseSvgFile;

    return { filename: downloadFilename, file };
  }

  async _updateForFile(svgFile, { compareToFile, compress }) {
    const settings = this._settingsUi.getSettings();
    let displayFile = svgFile;
    let copyText = svgFile.text;

    if (settings.styleguideClasses) {
      // Display version: classes + preview styles (for visual preview)
      const displayText = addStyleguideClasses(svgFile.text);
      displayFile = new SvgFile(displayText, svgFile.width, svgFile.height);

      // Clean version: classes only, no preview styles (for copy-to-clipboard)
      copyText = addStyleguideClasses(svgFile.text, {
        includePreviewStyles: false,
      });
    }

    // Build download info using shared helper
    const downloadInfo = this._getDownloadInfo(svgFile);

    this._outputUi.update(displayFile);
    this._downloadButtonUi.setDownload(
      downloadInfo.filename,
      downloadInfo.file,
    );
    this._copyButtonUi.setCopyText(copyText);
    this._copyBgButtonUi.setSvgText(svgFile.text);

    this._resultsUi.update({
      comparisonSize: compareToFile && (await compareToFile.size({ compress })),
      size: await svgFile.size({ compress }),
    });
  }
}
