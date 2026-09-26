// Web Push helpers shared by the phone (subscribing) and the desktop (key
// generation). The desktop sends notifications itself, so no server is needed.

const b64url = (bytes) =>
  btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

export function base64UrlToUint8Array(s) {
  const pad = '='.repeat((4 - (s.length % 4)) % 4);
  const raw = atob((s + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

/** Generate a VAPID key pair (P-256) in the format the web-push library expects. */
export async function generateVapidKeys() {
  const kp = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const raw = await crypto.subtle.exportKey('raw', kp.publicKey); // 65 bytes, uncompressed point
  const jwk = await crypto.subtle.exportKey('jwk', kp.privateKey);
  return { publicKey: b64url(raw), privateKey: jwk.d, subject: 'mailto:lifetracker@example.com' };
}

/** A push payload the service worker understands. */
export function pushPayload(n) {
  return { title: n.title, body: n.body || '', tag: n.tag || n.kind || 'lifetracker', url: '/app/', kind: n.kind || 'assistant', at: Date.now() };
}
