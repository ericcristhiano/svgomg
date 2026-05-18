import { createNanoEvents } from 'nanoevents';

let _nextId = 1;

export default class SvgFileCollection {
  constructor() {
    this.emitter = createNanoEvents();
    this._files = [];
    this._activeId = null;
  }

  get files() {
    return this._files;
  }

  get length() {
    return this._files.length;
  }

  get activeFile() {
    if (this._activeId === null) return null;
    return this._files.find((entry) => entry.id === this._activeId) || null;
  }

  add(filename, inputItem) {
    const id = _nextId++;
    const displayName = filename.endsWith('.svg')
      ? filename.slice(0, -4)
      : filename;
    const entry = {
      id,
      filename,
      inputItem,
      outputItem: null,
      status: 'pending',
      error: null,
      displayName,
      keywords: [],
    };

    this._files.push(entry);
    this.emitter.emit('add', entry);

    // Auto-activate the first file added
    if (this._files.length === 1) {
      this.setActive(id);
    }

    return entry;
  }

  remove(id) {
    const index = this._files.findIndex((entry) => entry.id === id);
    if (index === -1) return;

    const [removed] = this._files.splice(index, 1);

    // Release SVG object URLs
    if (removed.inputItem) removed.inputItem.release();
    if (removed.outputItem) removed.outputItem.release();

    this.emitter.emit('remove', removed);

    // If the removed file was active, activate the nearest neighbor
    if (this._activeId === id) {
      if (this._files.length > 0) {
        const newIndex = Math.min(index, this._files.length - 1);
        this.setActive(this._files[newIndex].id);
      } else {
        this._activeId = null;
        this.emitter.emit('active-change', null);
      }
    }
  }

  update(id, changes) {
    const entry = this._files.find((file) => file.id === id);
    if (!entry) return;

    Object.assign(entry, changes);
    this.emitter.emit('change', entry);
  }

  updateMetadata(id, { displayName, keywords }) {
    const entry = this._files.find((file) => file.id === id);
    if (!entry) return;

    if (displayName !== undefined) entry.displayName = displayName;
    if (keywords !== undefined) entry.keywords = keywords;

    this.emitter.emit('change', entry);
  }

  setActive(id) {
    if (this._activeId === id) return;

    const entry = this._files.find((file) => file.id === id);
    if (!entry) return;

    this._activeId = id;
    this.emitter.emit('active-change', entry);
  }

  getById(id) {
    return this._files.find((entry) => entry.id === id) || null;
  }

  clear() {
    // Release all SVG object URLs
    for (const entry of this._files) {
      if (entry.inputItem) entry.inputItem.release();
      if (entry.outputItem) entry.outputItem.release();
    }

    this._files = [];
    this._activeId = null;
    this.emitter.emit('active-change', null);
  }
}
