// Offline-first sync queue.
//
// Every local write is applied to the UI immediately (optimistic) and recorded
// here, keyed by document path, so repeated edits to the same document
// coalesce into one pending write. The queue lives in localStorage and survives
// restarts. When online it is flushed through a backend adapter that performs
// a last-write-wins conditional write (see firestore.js).

import { storage } from './storage.js';

const RETRY_BASE_MS = 2000;
const RETRY_MAX_MS = 60000;

export class SyncQueue {
  /**
   * @param {object} opts
   * @param {string} opts.uid
   * @param {{ write(path: string, data: object): Promise<'written'|'stale'> }} opts.adapter
   * @param {() => boolean} [opts.isOnline]
   * @param {(state: {status: string, pending: number, error?: string}) => void} [opts.onStatus]
   */
  constructor({ uid, adapter, isOnline, onStatus }) {
    this.key = `lt:queue:${uid}`;
    this.adapter = adapter;
    this.isOnline = isOnline || (() => (typeof navigator === 'undefined' || navigator.onLine !== false));
    this.onStatus = onStatus || (() => {});
    this.ops = storage.get(this.key, {}) || {};
    this.flushing = null;
    this.retryTimer = null;
    this.retryDelay = RETRY_BASE_MS;
    this.stopped = false;
  }

  get pending() {
    return Object.keys(this.ops).length;
  }

  /** updatedAt of the unsynced write for `path`, if any. */
  pendingUpdatedAt(path) {
    return this.ops[path]?.updatedAt;
  }

  enqueue(path, data) {
    this.ops[path] = { path, data, updatedAt: data.updatedAt ?? Date.now() };
    this.persist();
    this.emit();
    this.flush();
  }

  persist() {
    storage.set(this.key, this.ops);
  }

  emit(status, error) {
    const s = status || (this.pending ? (this.isOnline() ? 'pending' : 'offline') : 'synced');
    this.onStatus({ status: s, pending: this.pending, error });
  }

  /** Push every queued write. Safe to call often; concurrent calls share one run. */
  flush() {
    if (this.stopped) return Promise.resolve();
    if (this.flushing) {
      this.flushAgain = true;
      return this.flushing;
    }
    if (!this.pending) {
      this.emit();
      return Promise.resolve();
    }
    if (!this.isOnline()) {
      this.emit('offline');
      return Promise.resolve();
    }
    this.flushing = this.run().finally(() => {
      this.flushing = null;
      if (this.flushAgain) {
        this.flushAgain = false;
        this.flush();
      }
    });
    return this.flushing;
  }

  async run() {
    this.emit('syncing');
    // Oldest first so causally related writes land in order.
    const ops = Object.values(this.ops).sort((a, b) => a.updatedAt - b.updatedAt);
    for (const op of ops) {
      if (this.stopped) return;
      try {
        await this.adapter.write(op.path, op.data);
        // Only drop the entry if it wasn't replaced by a newer edit meanwhile.
        if (this.ops[op.path]?.updatedAt === op.updatedAt) {
          delete this.ops[op.path];
          this.persist();
        }
      } catch (err) {
        if (isPermanent(err)) {
          console.warn('[sync] dropping write rejected by server', op.path, err);
          delete this.ops[op.path];
          this.persist();
          continue;
        }
        this.emit(this.isOnline() ? 'error' : 'offline', err?.message || String(err));
        this.scheduleRetry();
        return;
      }
    }
    this.retryDelay = RETRY_BASE_MS;
    this.emit();
  }

  scheduleRetry() {
    clearTimeout(this.retryTimer);
    this.retryTimer = setTimeout(() => this.flush(), this.retryDelay);
    this.retryDelay = Math.min(this.retryDelay * 2, RETRY_MAX_MS);
  }

  stop() {
    this.stopped = true;
    clearTimeout(this.retryTimer);
  }
}

function isPermanent(err) {
  const code = err?.code || '';
  return code === 'permission-denied' || code === 'invalid-argument';
}
