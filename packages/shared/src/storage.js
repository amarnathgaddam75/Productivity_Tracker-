// Safe localStorage wrapper: falls back to memory when storage is unavailable
// (private mode, quota exceeded, tests running in Node).

const memory = new Map();

function backend() {
  try {
    if (typeof localStorage !== 'undefined') return localStorage;
  } catch {
    /* access can throw in sandboxed contexts */
  }
  return null;
}

export const storage = {
  get(key, fallback = null) {
    try {
      const raw = backend() ? backend().getItem(key) : memory.get(key);
      return raw == null ? fallback : JSON.parse(raw);
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    const raw = JSON.stringify(value);
    try {
      if (backend()) backend().setItem(key, raw);
      else memory.set(key, raw);
    } catch {
      memory.set(key, raw);
    }
  },
  remove(key) {
    try {
      if (backend()) backend().removeItem(key);
    } catch {
      /* ignore */
    }
    memory.delete(key);
  },
};
