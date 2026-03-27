import { escapeHTML } from './utils.js';

export function generateStyleguideExport(files) {
  return files
    .map((entry) => {
      const name = escapeHTML(entry.displayName);
      const keywords = escapeHTML(entry.keywords.join(', '));
      return `<a href="#" class="ca-icon__grid-cell js-element-cell js-icon-cell" data-search-keywords="${keywords}" id="${name}">{% include "frontend/icons/${name}.html" %}</a>`;
    })
    .join('\n');
}
