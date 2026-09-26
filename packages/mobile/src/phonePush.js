import { generateVapidKeys, base64UrlToUint8Array, storage } from '@lifetracker/shared';

function platformName() {
  const ua = navigator.userAgent;
  if (/iphone|ipad|ipod/i.test(ua)) return 'iPhone';
  if (/android/i.test(ua)) return 'Android';
  return 'Browser';
}

export function pushSupport() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || typeof Notification === 'undefined') {
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    return { ok: false, reason: ios ? 'On iPhone, first add LifeTracker to your Home Screen (Share → Add to Home Screen) and open it from there.' : 'This browser does not support push notifications.' };
  }
  return { ok: true };
}

/**
 * Subscribe this phone to notifications sent by the desktop assistant and
 * register it in Firestore. Creates the user's key pair on first use.
 */
export async function enablePhonePush(useStore) {
  const support = pushSupport();
  if (!support.ok) throw new Error(support.reason);
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') throw new Error('Notifications are blocked. Allow them for this site in your browser settings.');

  const s = useStore.getState();
  if (!s.pushKeysLoaded) throw new Error('Still syncing — try again in a moment (you need to be online).');
  let keys = s.pushKeys;
  if (!keys?.publicKey) {
    keys = await generateVapidKeys();
    s.savePushKeys(keys);
  }
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  const wanted = base64UrlToUint8Array(keys.publicKey);
  if (sub) {
    const current = sub.options?.applicationServerKey ? new Uint8Array(sub.options.applicationServerKey) : null;
    if (!current || current.length !== wanted.length || current.some((b, i) => b !== wanted[i])) {
      await sub.unsubscribe();
      sub = null;
    }
  }
  sub = sub || (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: wanted }));
  const json = sub.toJSON();
  const id = storage.get('lt:deviceId') || Math.random().toString(36).slice(2, 10);
  s.saveDevice(id, { endpoint: json.endpoint, keys: { p256dh: json.keys.p256dh, auth: json.keys.auth }, platform: platformName(), userAgent: navigator.userAgent.slice(0, 200) });
  return id;
}

export async function disablePhonePush(useStore) {
  const reg = await navigator.serviceWorker?.ready;
  const sub = await reg?.pushManager.getSubscription();
  await sub?.unsubscribe();
  const id = storage.get('lt:deviceId');
  if (id) useStore.getState().removeDevice(id);
}

export function thisDeviceRegistered(devices) {
  const id = storage.get('lt:deviceId');
  return Boolean(id && devices?.[id] && !devices[id].deleted);
}
