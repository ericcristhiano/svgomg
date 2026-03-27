import { createNanoEvents } from 'nanoevents';
import { strToEl, escapeHTML, humanSize } from '../utils.js';

function truncateFilename(name, maxLength = 24) {
  if (name.length <= maxLength) return name;
  const ext = name.includes('.') ? name.slice(name.lastIndexOf('.')) : '';
  const base = name.slice(0, name.length - ext.length);
  const available = maxLength - ext.length - 1;
  return `${base.slice(0, available)}\u2026${ext}`;
}

function statusIcon(status) {
  if (status === 'optimizing') {
    return '<span class="file-list-status file-list-status-spinner"></span>';
  }

  if (status === 'done') {
    return '<span class="file-list-status file-list-status-done">\u2713</span>';
  }

  if (status === 'error') {
    return '<span class="file-list-status file-list-status-error">\u2717</span>';
  }

  return '<span class="file-list-status file-list-status-pending"></span>';
}

function savingsText(entry) {
  if (entry.status !== 'done' || !entry.inputItem || !entry.outputItem) {
    return '';
  }

  const inputSize = entry.inputItem.text.length;
  const outputSize = entry.outputItem.text.length;

  if (inputSize === 0) return '';

  const percent = Math.round((1 - outputSize / inputSize) * 100);
  return `\u2212${percent}%`;
}

function createItemEl(entry) {
  const displayName = escapeHTML(truncateFilename(entry.filename));
  const size = entry.inputItem ? humanSize(entry.inputItem.text.length) : '';
  const savings = savingsText(entry);
  const thumbHtml =
    entry.inputItem && entry.inputItem.url
      ? `<img src="${escapeHTML(entry.inputItem.url)}" alt="" />`
      : '';
  const safeFilename = escapeHTML(entry.filename);

  // prettier-ignore
  return strToEl(
    `<div class="file-list-item" data-id="${escapeHTML(entry.id)}">` +
      `<div class="file-list-item-thumb">${thumbHtml}</div>` +
      `<div class="file-list-item-info">` +
      `<span class="file-list-item-name" title="${safeFilename}">${displayName}</span>` +
      `<span class="file-list-item-size">${escapeHTML(size)}</span>` +
      `</div>` +
      `<div class="file-list-item-status">` +
      `${statusIcon(entry.status)}` +
      `<span class="file-list-item-savings">${escapeHTML(savings)}</span>` +
      `</div>` +
      `<button class="file-list-item-remove" type="button" aria-label="Remove">\u00D7</button>` +
      `</div>`
  );
}

export default class FileList {
  constructor() {
    this.emitter = createNanoEvents();
    this.container = strToEl('<div class="file-list" tabindex="0"></div>');
    this._clearAllBtn = strToEl(
      '<button class="file-list-clear-all" type="button">\u00D7 Clear All</button>',
    );
    this.container.append(this._clearAllBtn);
    this._items = new Map();
    this._activeId = null;

    this.container.addEventListener('click', (event) => {
      this._onClick(event);
    });
    this.container.addEventListener('keydown', (event) => {
      this._onKeyDown(event);
    });
  }

  addFile(entry) {
    const el = createItemEl(entry);
    this._items.set(entry.id, { entry, el });
    this.container.append(el);
  }

  removeFile(id) {
    const item = this._items.get(id);
    if (!item) return;
    item.el.remove();
    this._items.delete(id);

    if (this._activeId === id) {
      this._activeId = null;
    }
  }

  updateFile(id, entry) {
    const item = this._items.get(id);
    if (!item) return;

    const newEl = createItemEl(entry);

    if (id === this._activeId) {
      newEl.classList.add('active');
    }

    item.el.replaceWith(newEl);
    this._items.set(id, { entry, el: newEl });
  }

  setActive(id) {
    if (this._activeId) {
      const prev = this._items.get(this._activeId);
      if (prev) prev.el.classList.remove('active');
    }

    this._activeId = id;

    const current = this._items.get(id);
    if (current) current.el.classList.add('active');
  }

  clear() {
    for (const { el } of this._items.values()) {
      el.remove();
    }

    this._items.clear();
    this._activeId = null;
  }

  show() {
    this.container.classList.remove('hidden');
  }

  hide() {
    this.container.classList.add('hidden');
  }

  _getOrderedIds() {
    return [...this.container.querySelectorAll('.file-list-item')].map(
      (el) => el.dataset.id,
    );
  }

  _onKeyDown(event) {
    const { key } = event;
    if (
      key !== 'ArrowUp' &&
      key !== 'ArrowDown' &&
      key !== 'ArrowLeft' &&
      key !== 'ArrowRight'
    ) {
      return;
    }

    event.preventDefault();
    const ids = this._getOrderedIds();
    if (ids.length === 0) return;

    const currentIndex = this._activeId
      ? ids.indexOf(String(this._activeId))
      : -1;

    let nextIndex;
    if (key === 'ArrowUp' || key === 'ArrowLeft') {
      nextIndex = currentIndex <= 0 ? ids.length - 1 : currentIndex - 1;
    } else {
      nextIndex =
        currentIndex < 0 || currentIndex >= ids.length - 1
          ? 0
          : currentIndex + 1;
    }

    this.emitter.emit('activate', ids[nextIndex]);
  }

  _onClick(event) {
    if (event.target.closest('.file-list-clear-all')) {
      event.stopPropagation();
      this.emitter.emit('clearAll');
      return;
    }

    const removeBtn = event.target.closest('.file-list-item-remove');
    if (removeBtn) {
      const itemEl = removeBtn.closest('.file-list-item');
      if (itemEl) {
        event.stopPropagation();
        this.emitter.emit('remove', itemEl.dataset.id);
      }

      return;
    }

    const itemEl = event.target.closest('.file-list-item');
    if (itemEl) {
      this.emitter.emit('activate', itemEl.dataset.id);
    }
  }
}
