// Registers the service worker in production builds. Emits an
// "lt:update-ready" event when a new version is waiting so the UI can offer a refresh.

export function register() {
  if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    const swUrl = `${process.env.PUBLIC_URL}/service-worker.js`;
    navigator.serviceWorker
      .register(swUrl)
      .then((registration) => {
        registration.onupdatefound = () => {
          const worker = registration.installing;
          if (!worker) return;
          worker.onstatechange = () => {
            if (worker.state === 'installed' && navigator.serviceWorker.controller) {
              window.dispatchEvent(new CustomEvent('lt:update-ready', { detail: registration }));
            }
          };
        };
      })
      .catch((err) => console.warn('Service worker registration failed', err));
  });
}

export function applyUpdate(registration) {
  registration?.waiting?.postMessage({ type: 'SKIP_WAITING' });
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!reloaded) {
      reloaded = true;
      window.location.reload();
    }
  });
}
