import { afterEach, describe, expect, it } from 'vitest'
import {
  getBottomDockPromptVisible,
  getDockPromptReserve,
  getInstallOpenAppDockVisible,
  setBottomDockPromptVisible,
} from '@/lib/pwaInstallDockVisibility'

describe('pwaInstallDockVisibility', () => {
  afterEach(() => {
    setBottomDockPromptVisible('install', false)
    setBottomDockPromptVisible('open-app', false)
    setBottomDockPromptVisible('push', false)
  })

  it('tracks install and open-app separately from push', () => {
    setBottomDockPromptVisible('push', true)
    expect(getBottomDockPromptVisible()).toBe(true)
    expect(getInstallOpenAppDockVisible()).toBe(false)

    setBottomDockPromptVisible('open-app', true)
    expect(getInstallOpenAppDockVisible()).toBe(true)
  })

  it('reserves scroll space when any dock prompt is visible', () => {
    expect(getDockPromptReserve()).toBe('0px')

    setBottomDockPromptVisible('push', true)
    expect(getDockPromptReserve()).toBe('9.5rem')

    setBottomDockPromptVisible('push', false)
    expect(getDockPromptReserve()).toBe('0px')
  })
})
