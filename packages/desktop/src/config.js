import { initFirebase, isConfigValid, createTrackerStore } from '@lifetracker/shared';

export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const emulatorHost = import.meta.env.VITE_FIREBASE_EMULATOR_HOST || '';
export const mobileUrl = import.meta.env.VITE_MOBILE_URL || '';

// Emulator runs always use the demo project (matches `npm run emulators`).
const effectiveConfig =
  emulatorHost
    ? { apiKey: 'demo-key', authDomain: 'demo-lifetracker.firebaseapp.com', projectId: 'demo-lifetracker', appId: 'demo-app' }
    : firebaseConfig;

export const configured = isConfigValid(effectiveConfig);
if (configured) initFirebase(effectiveConfig, { emulatorHost });

// ---- platform hooks -------------------------------------------------------

const bridge = typeof window !== 'undefined' ? window.desktop : undefined;
export const isElectron = Boolean(bridge?.isDesktop);

function deliver({ title, body }) {
  if (bridge) {
    bridge.notify(title, body);
    return;
  }
  // Browser fallback (running the desktop UI in a regular browser tab).
  if (typeof Notification !== 'undefined' && Notification.permission === 'granted' && document.hidden) {
    try {
      new Notification(title, { body, icon: './icon.png' });
    } catch {
      /* some browsers only allow notifications from a service worker */
    }
  }
}

function onBadge(count) {
  bridge?.setBadge(count);
  document.title = count ? `(${count}) LifeTracker` : 'LifeTracker';
}

export const useStore = createTrackerStore({ deliver, onBadge });
