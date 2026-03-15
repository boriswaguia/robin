import webpush from 'web-push';
import prisma from './db.js';

let configured = false;

/**
 * Configure VAPID credentials for Web Push.
 * Call once at server startup if VAPID keys are present in env.
 */
export function configurePush() {
  const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_EMAIL } = process.env;
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    console.warn('Push notifications disabled — set VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, and VAPID_EMAIL in .env');
    return;
  }
  webpush.setVapidDetails(
    VAPID_EMAIL || 'mailto:admin@robin.app',
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY,
  );
  configured = true;
  console.log('Web Push configured ✓');
}

export function isPushConfigured() {
  return configured;
}

export function getVapidPublicKey() {
  return process.env.VAPID_PUBLIC_KEY || null;
}

/**
 * Send a push notification to all devices for a given user.
 * Automatically removes expired/invalid subscriptions (HTTP 410).
 */
export async function sendPushToUser(userId, payload) {
  if (!configured) return;

  const subs = await prisma.pushSubscription.findMany({ where: { userId } });
  if (subs.length === 0) return;

  const json = JSON.stringify(payload);

  await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          json,
        );
      } catch (err) {
        // 410 Gone or 404 = subscription expired / user revoked browser permission
        if (err.statusCode === 410 || err.statusCode === 404) {
          await prisma.pushSubscription.deleteMany({
            where: { userId, endpoint: sub.endpoint },
          }).catch(() => {});
        }
        // Other errors are transient — leave subscription intact
      }
    }),
  );
}
