import { describe, it, expect } from 'vitest';
import { SyncQueue } from '../src/sync.js';
import { resolve, applyRemoteChanges, shouldWrite } from '../src/merge.js';

function fakeServer() {
  const docs = {};
  let online = true;
  return {
    docs,
    setOnline: (v) => (online = v),
    isOnline: () => online,
    adapter: {
      async write(path, data) {
        if (!online) throw Object.assign(new Error('offline'), { code: 'unavailable' });
        if (!shouldWrite(docs[path], data)) return 'stale';
        docs[path] = data;
        return 'written';
      },
    },
  };
}

describe('last-write-wins merge', () => {
  it('keeps newer pending local edits and otherwise takes remote', () => {
    const local = { id: 'a', v: 'local', updatedAt: 20 };
    const remote = { id: 'a', v: 'remote', updatedAt: 10 };
    expect(resolve(local, remote, 20)).toBe(local);
    expect(resolve(local, remote, undefined)).toBe(remote);
    expect(resolve(local, { ...remote, updatedAt: 30 }, 20).v).toBe('remote');
  });

  it('applies remote change batches', () => {
    const local = { a: { id: 'a', updatedAt: 1 }, b: { id: 'b', updatedAt: 1 } };
    const next = applyRemoteChanges(
      local,
      [
        { id: 'a', type: 'modified', data: { updatedAt: 5, title: 'x' } },
        { id: 'b', type: 'removed' },
        { id: 'c', type: 'added', data: { updatedAt: 2 } },
      ],
      () => undefined,
    );
    expect(next.a.title).toBe('x');
    expect(next.b).toBeUndefined();
    expect(next.c.id).toBe('c');
    expect(applyRemoteChanges(local, [{ id: 'a', type: 'modified', data: { updatedAt: 0 } }], () => 9)).toBe(local);
  });
});

describe('SyncQueue', () => {
  it('queues while offline, coalesces edits and flushes on reconnect', async () => {
    const server = fakeServer();
    server.setOnline(false);
    const statuses = [];
    const q = new SyncQueue({ uid: 'u1', adapter: server.adapter, isOnline: server.isOnline, onStatus: (s) => statuses.push(s.status) });
    q.enqueue('tasks/a', { title: 'one', updatedAt: 1 });
    q.enqueue('tasks/a', { title: 'two', updatedAt: 2 });
    q.enqueue('tasks/b', { title: 'b', updatedAt: 3 });
    await q.flush();
    expect(q.pending).toBe(2);
    expect(statuses).toContain('offline');

    // Survives a "restart": a new queue for the same user reloads from storage.
    const q2 = new SyncQueue({ uid: 'u1', adapter: server.adapter, isOnline: server.isOnline });
    expect(q2.pending).toBe(2);
    q.stop();

    server.setOnline(true);
    await q2.flush();
    expect(q2.pending).toBe(0);
    expect(server.docs['tasks/a'].title).toBe('two');
    expect(server.docs['tasks/b'].title).toBe('b');
    q2.stop();
  });

  it('does not overwrite a newer server copy (LWW)', async () => {
    const server = fakeServer();
    server.docs['tasks/a'] = { title: 'from phone', updatedAt: 100 };
    const q = new SyncQueue({ uid: 'u2', adapter: server.adapter, isOnline: server.isOnline });
    q.enqueue('tasks/a', { title: 'old desktop edit', updatedAt: 50 });
    await q.flush();
    expect(server.docs['tasks/a'].title).toBe('from phone');
    expect(q.pending).toBe(0);
    q.stop();
  });

  it('drops writes the server permanently rejects', async () => {
    const q = new SyncQueue({
      uid: 'u3',
      isOnline: () => true,
      adapter: { write: async () => { throw Object.assign(new Error('nope'), { code: 'permission-denied' }); } },
    });
    const warn = console.warn;
    console.warn = () => {};
    q.enqueue('tasks/a', { updatedAt: 1 });
    await q.flush();
    console.warn = warn;
    expect(q.pending).toBe(0);
    q.stop();
  });
});
