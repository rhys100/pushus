import type { PwaInstallStatus } from '@/lib/pwaInstallStatus'
import { needsPwaInstallForPush, readPwaInstallPlatform } from '@/lib/pwaInstallStatus'
import { needsIosHomeScreenInstall } from '@/lib/pwa'
import { supabase } from '@/lib/supabase'

export type PushSupportStatus =
  | 'supported'
  | 'unsupported'
  | 'missing_vapid_key'
  | 'ios_needs_install'
  | 'needs_pwa_install'

export type PushPermissionStatus = NotificationPermission | 'unsupported'

export class PushRegistrationError extends Error {
  constructor(
    message: string,
    readonly code:
      | 'unsupported'
      | 'permission_denied'
      | 'missing_vapid_key'
      | 'not_authenticated'
      | 'save_failed'
      | 'needs_pwa_install',
  ) {
    super(message)
    this.name = 'PushRegistrationError'
  }
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const output = new Uint8Array(rawData.length)

  for (let index = 0; index < rawData.length; index += 1) {
    output[index] = rawData.charCodeAt(index)
  }

  return output
}

export function getPushSupportStatus(): PushSupportStatus {
  if (needsIosHomeScreenInstall()) {
    return 'ios_needs_install'
  }

  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return 'unsupported'
  }

  const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY
  if (!vapidKey || !vapidKey.trim()) {
    return 'missing_vapid_key'
  }

  return 'supported'
}

export function resolvePushSupportStatus(
  installStatus: PwaInstallStatus | null,
): PushSupportStatus {
  const base = getPushSupportStatus()

  if (base === 'unsupported' || base === 'missing_vapid_key') {
    return base
  }

  if (base === 'ios_needs_install' || needsPwaInstallForPush(installStatus, readPwaInstallPlatform())) {
    return 'needs_pwa_install'
  }

  return 'supported'
}

export function pushSupportAllowsEnable(status: PushSupportStatus): boolean {
  return status === 'supported'
}

export function getPushPermissionStatus(): PushPermissionStatus {
  if (!('Notification' in window)) {
    return 'unsupported'
  }

  return Notification.permission
}

export async function registerAppServiceWorker(): Promise<ServiceWorkerRegistration> {
  if (!('serviceWorker' in navigator)) {
    throw new PushRegistrationError(
      'Service workers are not supported in this browser.',
      'unsupported',
    )
  }

  const registration = await navigator.serviceWorker.register('/sw.js', {
    scope: '/',
  })

  await navigator.serviceWorker.ready
  return registration
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration> {
  const support = getPushSupportStatus()
  if (support === 'unsupported') {
    throw new PushRegistrationError(
      'Push notifications are not supported in this browser.',
      'unsupported',
    )
  }

  if (support === 'missing_vapid_key') {
    throw new PushRegistrationError(
      'Push is not configured on this deployment (missing VAPID public key).',
      'missing_vapid_key',
    )
  }

  return registerAppServiceWorker()
}

export async function subscribeToPush(
  registration: ServiceWorkerRegistration,
): Promise<PushSubscription> {
  const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY?.trim()
  if (!vapidKey) {
    throw new PushRegistrationError(
      'Push is not configured on this deployment (missing VAPID public key).',
      'missing_vapid_key',
    )
  }

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    throw new PushRegistrationError(
      'Notification permission was not granted.',
      'permission_denied',
    )
  }

  const existing = await registration.pushManager.getSubscription()
  if (existing) {
    return existing
  }

  return registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidKey),
  })
}

export async function savePushSubscription(
  userId: string,
  subscription: PushSubscription,
): Promise<void> {
  const json = subscription.toJSON()
  const endpoint = json.endpoint
  const p256dh = json.keys?.p256dh
  const auth = json.keys?.auth

  if (!endpoint || !p256dh || !auth) {
    throw new PushRegistrationError(
      'Browser returned an invalid push subscription.',
      'save_failed',
    )
  }

  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      user_id: userId,
      endpoint,
      p256dh,
      auth,
      user_agent: navigator.userAgent,
      enabled: true,
    },
    { onConflict: 'user_id,endpoint' },
  )

  if (error) {
    throw new PushRegistrationError(
      error.message || 'Failed to save push subscription.',
      'save_failed',
    )
  }
}

export async function getExistingPushSubscription(): Promise<PushSubscription | null> {
  if (!('serviceWorker' in navigator)) {
    return null
  }

  const registration = await navigator.serviceWorker.getRegistration('/')
  if (!registration) {
    return null
  }

  return registration.pushManager.getSubscription()
}

export async function registerPushForUser(userId: string): Promise<void> {
  if (!userId) {
    throw new PushRegistrationError('You must be signed in.', 'not_authenticated')
  }

  const registration = await registerServiceWorker()
  const subscription = await subscribeToPush(registration)
  await savePushSubscription(userId, subscription)
}

/** Reuse browser subscription when permission is already granted (no permission prompt). */
export async function ensurePushSubscriptionForUser(userId: string): Promise<void> {
  if (!userId) {
    throw new PushRegistrationError('You must be signed in.', 'not_authenticated')
  }

  if (getPushPermissionStatus() === 'granted') {
    const existing = await getExistingPushSubscription()
    if (existing) {
      await savePushSubscription(userId, existing)
      return
    }
  }

  await registerPushForUser(userId)
}

export async function unregisterPushForUser(userId: string): Promise<void> {
  if (!('serviceWorker' in navigator)) {
    return
  }

  const registration = await navigator.serviceWorker.getRegistration('/')
  const subscription = await registration?.pushManager.getSubscription()

  if (subscription) {
    const endpoint = subscription.endpoint
    await subscription.unsubscribe()

    if (endpoint) {
      await supabase
        .from('push_subscriptions')
        .update({ enabled: false })
        .eq('user_id', userId)
        .eq('endpoint', endpoint)
    }
  }
}
