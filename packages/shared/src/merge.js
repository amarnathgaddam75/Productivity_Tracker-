// Last-write-wins conflict resolution. Every document carries `updatedAt`
// (epoch ms of the last local edit); the newest edit wins everywhere.

/**
 * Decide which version of a document to keep when a remote snapshot arrives.
 * @param {object|undefined} local  current local copy
 * @param {object|undefined} remote incoming server copy (undefined = removed)
 * @param {number|undefined} pendingUpdatedAt updatedAt of an unsynced local write
 */
export function resolve(local, remote, pendingUpdatedAt) {
  if (pendingUpdatedAt != null) {
    const remoteAt = remote?.updatedAt ?? -Infinity;
    if (pendingUpdatedAt > remoteAt) return local;
  }
  return remote;
}

/**
 * Apply a batch of remote changes to a map of local docs.
 * @param {Record<string, object>} localDocs
 * @param {Array<{id: string, type: 'added'|'modified'|'removed', data?: object}>} changes
 * @param {(id: string) => number|undefined} pendingFor
 * @returns {Record<string, object>} new map (same reference if nothing changed)
 */
export function applyRemoteChanges(localDocs, changes, pendingFor) {
  let next = localDocs;
  for (const c of changes) {
    const local = localDocs[c.id];
    const remote = c.type === 'removed' ? undefined : { ...c.data, id: c.id };
    const winner = resolve(local, remote, pendingFor(c.id));
    if (winner === local) continue;
    if (next === localDocs) next = { ...localDocs };
    if (winner === undefined) delete next[c.id];
    else next[c.id] = winner;
  }
  return next;
}

/** Server-side guard used inside the transaction: should `incoming` overwrite `existing`? */
export function shouldWrite(existing, incoming) {
  if (!existing) return true;
  return (incoming.updatedAt ?? 0) >= (existing.updatedAt ?? 0);
}
