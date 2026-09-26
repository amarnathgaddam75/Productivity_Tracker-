import { initFirebase, isConfigValid, createTrackerStore } from '@lifetracker/shared';

export const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
};

export const emulatorHost = process.env.REACT_APP_FIREBASE_EMULATOR_HOST || '';
export const desktopDownloadUrl = process.env.REACT_APP_DESKTOP_DOWNLOAD_URL || '';

const effectiveConfig =
  emulatorHost
    ? { apiKey: 'demo-key', authDomain: 'demo-lifetracker.firebaseapp.com', projectId: 'demo-lifetracker', appId: 'demo-app' }
    : firebaseConfig;

export const configured = isConfigValid(effectiveConfig);
if (configured) initFirebase(effectiveConfig, { emulatorHost });

// Mobile notifications: in-app toast (rendered by the UI) + app icon badge +
// a short vibration. If the user granted permission and the app is in the
// background, also show a system notification through the service worker.
function deliver({ title, body }) {
  try {
    navigator.vibrate?.(120);
  } catch {
    /* not supported */
  }
  if (document.visibilityState === 'hidden' && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
    navigator.serviceWorker?.ready
      .then((reg) => reg.showNotification(title, { body, icon: `${process.env.PUBLIC_URL}/icon-192.png`, badge: `${process.env.PUBLIC_URL}/favicon.png`, tag: title }))
      .catch(() => {});
  }
}

function onBadge(count) {
  try {
    if (count) navigator.setAppBadge?.(count);
    else navigator.clearAppBadge?.();
  } catch {
    /* not supported */
  }
}

export const useStore = createTrackerStore({ deliver, onBadge });
