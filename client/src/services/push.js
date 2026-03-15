/**
 * Robin Web Push client helpers.
 *
 * Usage:
 *   import { subscribeToPush, unsubscribeFromPush, getPushStatus } from './push';
 */

/** Convert a base64url VAPID public key to a Uint8Array for the browser API */
function urlB64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

/** Register the service worker (idempotent — safe to call on every login) */
export async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return null;
  try {
    const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    await navigator.serviceWorker.ready;
    return reg;
  } catch (err) {
    console.warn('SW registration failed:', err.message);
    return null;
  }
}

/**
 * Subscribe this browser to push notifications.
 * Returns true on success, false if the user denied permission or server rejected.
 */
export async function subscribeToPush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    throw new Error('Push notifications are not supported in this browser');
  }

  // Fetch VAPID public key from server
  const keyRes = await fetch('/api/push/vapid-public-key', { credentials: 'include' });
  if (!keyRes.ok) throw new Error('Push notifications not configured on the server');
  const { key } = await keyRes.json();

  const reg = await registerServiceWorker();
  if (!reg) throw new Error('Service worker registration failed');

  // Request notification permission
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Notification permission denied');

  // Create or retrieve the push subscription for this browser
  const subscription = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlB64ToUint8Array(key),
  });

  // Send subscription to server
  const res = await fetch('/api/push/subscribe', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(subscription.toJSON()),
  });
  if (!res.ok) throw new Error('Failed to save push subscription');

  return true;
}

/** Unsubscribe this browser from push notifications */
export async function unsubscribeFromPush() {
  if (!('serviceWorker' in navigator)) return;

  const reg = await navigator.serviceWorker.getRegistration('/');
  if (!reg) return;

  const subscription = await reg.pushManager.getSubscription();
  if (subscription) {
    // Tell the server first
    await fetch('/api/push/unsubscribe', {
      method: 'DELETE',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint: subscription.endpoint }),
    }).catch(() => {});
    await subscription.unsubscribe();
  }
}

/** Check whether this browser is currently subscribed */
export async function isThisBrowserSubscribed() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false;
  const reg = await navigator.serviceWorker.getRegistration('/');
  if (!reg) return false;
  const sub = await reg.pushManager.getSubscription();
  return !!sub;
}

/** Whether the browser supports push at all */
export function isPushSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

/** Current browser notification permission: 'granted' | 'denied' | 'default' */
export function getNotificationPermission() {
  if (!('Notification' in window)) return 'denied';
  return Notification.permission;
}
