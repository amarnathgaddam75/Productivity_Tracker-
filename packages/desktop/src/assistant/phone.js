// Send notifications to the user's phones straight from this desktop
// (Web Push via the Electron main process — no server involved).

import { pushPayload } from '@lifetracker/shared';
import { useStore } from '../config.js';

export async function pushToPhones(n) {
  const bridge = typeof window !== 'undefined' ? window.desktop : undefined;
  if (!bridge?.sendPush) return [];
  const s = useStore.getState();
  if (!s.settings.pushToPhone || !s.pushKeys?.publicKey) return [];
  const devices = Object.values(s.devices || {}).filter((d) => d.endpoint && !d.deleted);
  if (!devices.length) return [];
  try {
    const results = await bridge.sendPush(
      devices.map((d) => ({ id: d.id, endpoint: d.endpoint, keys: d.keys })),
      pushPayload(n),
      { publicKey: s.pushKeys.publicKey, privateKey: s.pushKeys.privateKey, subject: s.pushKeys.subject },
    );
    // Phones that uninstalled the app / revoked permission: forget them.
    results.filter((r) => r.gone).forEach((r) => s.removeDevice(r.id));
    return results;
  } catch (err) {
    console.warn('[push] failed', err);
    return [];
  }
}
