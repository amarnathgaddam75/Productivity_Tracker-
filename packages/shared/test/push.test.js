import { describe, it, expect } from 'vitest';
import { generateVapidKeys, base64UrlToUint8Array } from '../src/push.js';
import webpush from 'web-push';

describe('web push keys', () => {
  it('generates VAPID keys the web-push library accepts', async () => {
    const k = await generateVapidKeys();
    expect(base64UrlToUint8Array(k.publicKey)).toHaveLength(65);
    expect(base64UrlToUint8Array(k.privateKey)).toHaveLength(32);
    expect(() => webpush.setVapidDetails(k.subject, k.publicKey, k.privateKey)).not.toThrow();
    const headers = webpush.getVapidHeaders('https://fcm.googleapis.com', k.subject, k.publicKey, k.privateKey, 'aes128gcm');
    expect(headers.Authorization).toMatch(/^vapid t=/);
  });
});
