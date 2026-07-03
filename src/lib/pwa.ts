const IOS_PWA_INSTALL_HINT =
  'On iPhone or iPad, add PushUS to your Home Screen first: tap Share, then Add to Home Screen. Open PushUS from that icon, then return here to turn on reminders.'

const ANDROID_PWA_INSTALL_HINT =
  'Install PushUS from the prompt below, or use Chrome menu → Install app. Reminders only work in the installed app — not in a normal browser tab.'

export function isIosDevice(): boolean {
  if (typeof navigator === 'undefined') {
    return false
  }

  const ua = navigator.userAgent
  const isClassicIos = /iPad|iPhone|iPod/.test(ua)
  const isIpadOsDesktopUa =
    navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1

  return isClassicIos || isIpadOsDesktopUa
}

export function isStandalonePwa(): boolean {
  if (typeof window === 'undefined') {
    return false
  }

  const navigatorWithStandalone = navigator as Navigator & { standalone?: boolean }
  if (navigatorWithStandalone.standalone) {
    return true
  }

  return window.matchMedia('(display-mode: standalone)').matches
}

export function needsIosHomeScreenInstall(): boolean {
  return isIosDevice() && !isStandalonePwa()
}

export function getIosPwaInstallHint(): string {
  return IOS_PWA_INSTALL_HINT
}

export function getAndroidPwaInstallHint(): string {
  return ANDROID_PWA_INSTALL_HINT
}

export function getPwaInstallHintForPush(platform: 'android' | 'ios' | 'other'): string {
  if (platform === 'ios') {
    return getIosPwaInstallHint()
  }

  if (platform === 'android') {
    return getAndroidPwaInstallHint()
  }

  return 'Install PushUS as an app on your device before turning on reminders.'
}
