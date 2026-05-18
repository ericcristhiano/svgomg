import { createNanoEvents } from 'nanoevents';
import FloatingActionButton from './floating-action-button.js';

export default class ExportButton extends FloatingActionButton {
  constructor() {
    const title = 'Export styleguide HTML';

    super({
      title,
      iconSvg:
        // prettier-ignore
        '<svg aria-hidden="true" class="icon" viewBox="0 0 24 24">' +
          '<path d="M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0l4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z"/>' +
        '</svg>',
    });

    this.emitter = createNanoEvents();
    this._files = [];
    this._updateVisibility();

    this.container.addEventListener('click', () => this.emitter.emit('click'));
  }

  onClick(event) {
    super.onClick(event);
  }

  setFiles(files) {
    this._files = files || [];
    this._updateVisibility();
  }

  generateExport() {
    if (this._files.length === 0) return '';

    const lines = this._files.map((entry) => {
      const { displayName } = entry;
      const keywordsStr = entry.keywords.join(', ');

      return (
        '<a href="#" class="ca-icon__grid-cell js-element-cell js-icon-cell"' +
        ` data-search-keywords="${keywordsStr}"` +
        ` id="${displayName}">` +
        `{% include "frontend/icons/${displayName}.html" %}</a>`
      );
    });

    return lines.join('\n');
  }

  _updateVisibility() {
    this.container.style.display = this._files.length > 0 ? '' : 'none';
  }
}
