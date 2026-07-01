import { test, expect } from 'vitest'
import { shouldShowPushNotificationPrompt } from '@/lib/pushNotificationPrompt'

const baseInput = {
  pathname: '/leaderboard',
  isAuthenticated: true,
  profileOnboarded: true,
  appAccessAllowed: true,
  pushSupport: 'supported' as const,
  pushPermission: 'default' as const,
  pushEnabled: false,
  promptDismissed: false,
}

test('shows prompt when all conditions pass', () => {
  expect(shouldShowPushNotificationPrompt(baseInput)).toBe(true)
})

test('hides prompt when not authenticated', () => {
  expect(
    shouldShowPushNotificationPrompt({ ...baseInput, isAuthenticated: false }),
  ).toBe(false)
})

test('hides prompt when profile not onboarded', () => {
  expect(
    shouldShowPushNotificationPrompt({ ...baseInput, profileOnboarded: false }),
  ).toBe(false)
})

test('hides prompt when app access blocked', () => {
  expect(
    shouldShowPushNotificationPrompt({ ...baseInput, appAccessAllowed: false }),
  ).toBe(false)
})

test('hides prompt when push unsupported', () => {
  expect(
    shouldShowPushNotificationPrompt({ ...baseInput, pushSupport: 'unsupported' }),
  ).toBe(false)
})

test('shows prompt when iOS needs home screen install', () => {
  expect(
    shouldShowPushNotificationPrompt({ ...baseInput, pushSupport: 'ios_needs_install' }),
  ).toBe(true)
})

test('hides prompt when reminders already enabled', () => {
  expect(
    shouldShowPushNotificationPrompt({ ...baseInput, pushEnabled: true }),
  ).toBe(false)
})

test('shows prompt when permission granted but reminders not enabled', () => {
  expect(
    shouldShowPushNotificationPrompt({
      ...baseInput,
      pushPermission: 'granted',
      pushEnabled: false,
    }),
  ).toBe(true)
})

test('hides prompt when permission denied', () => {
  expect(
    shouldShowPushNotificationPrompt({ ...baseInput, pushPermission: 'denied' }),
  ).toBe(false)
})

test('hides prompt when dismissed', () => {
  expect(
    shouldShowPushNotificationPrompt({ ...baseInput, promptDismissed: true }),
  ).toBe(false)
})

test('hides prompt on excluded routes', () => {
  expect(
    shouldShowPushNotificationPrompt({ ...baseInput, pathname: '/login' }),
  ).toBe(false)
  expect(
    shouldShowPushNotificationPrompt({ ...baseInput, pathname: '/auth/callback' }),
  ).toBe(false)
  expect(
    shouldShowPushNotificationPrompt({ ...baseInput, pathname: '/onboarding/profile' }),
  ).toBe(false)
  expect(
    shouldShowPushNotificationPrompt({ ...baseInput, pathname: '/today' }),
  ).toBe(false)
  expect(
    shouldShowPushNotificationPrompt({ ...baseInput, pathname: '/settings/training' }),
  ).toBe(false)
})

test('shows prompt on settings when reminders not enabled', () => {
  expect(
    shouldShowPushNotificationPrompt({ ...baseInput, pathname: '/settings' }),
  ).toBe(true)
})

test('shows prompt on leaderboard when reminders not enabled', () => {
  expect(
    shouldShowPushNotificationPrompt({ ...baseInput, pathname: '/leaderboard' }),
  ).toBe(true)
})
