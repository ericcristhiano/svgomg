import JSZip from 'jszip';
import { createNanoEvents } from 'nanoevents';
import { strToEl } from '../utils.js';
import Spinner from './spinner.js';

export default class DownloadAllButton {
  constructor() {
    this.emitter = createNanoEvents();

    // prettier-ignore
    this.container = strToEl(
      '<button class="download-all-btn" title="Download all as ZIP">' +
        '<svg viewBox="0 0 24 24" class="download-all-icon">' +
          '<path d="M19 12v7H5v-7H3v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7h-2z"/>' +
          '<path d="M13 3h-2v9.29l-2.64-2.65-1.42 1.42L12 16.12l5.06-5.06-1.42-1.42L13 12.29V3z"/>' +
        '</svg>' +
      '</button>'
    );

    this._spinner = new Spinner();
    this._iconEl = this.container.querySelector('.download-all-icon');
    this._generating = false;

    this.container.style.display = 'none';

    this.container.addEventListener('click', () => this.emitter.emit('click'));
  }

  show() {
    this.container.style.display = '';
  }

  hide() {
    this.container.style.display = 'none';
  }

  setEnabled(enabled) {
    this.container.disabled = !enabled;
  }

  async download(files) {
    if (this._generating || !files || files.length === 0) return;

    this._generating = true;
    this._showSpinner();

    try {
      const zip = new JSZip();

      for (const entry of files) {
        const svgFile = entry.outputItem || entry.inputItem;
        if (svgFile) {
          zip.file(entry.filename, svgFile.text);
        }
      }

      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);

      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'optimized-svgs.zip';
      document.body.append(anchor);
      anchor.click();
      anchor.remove();

      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to generate zip:', error);
    } finally {
      this._generating = false;
      this._hideSpinner();
    }
  }

  _showSpinner() {
    this._iconEl.style.display = 'none';
    this.container.append(this._spinner.container);
    this._spinner.show(0);
  }

  _hideSpinner() {
    this._spinner.hide();
    this._iconEl.style.display = '';
  }
}
