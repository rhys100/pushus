/*
 * Last-resort PWA boot recovery.
 *
 * This is a classic, blocking script so it still runs when the Vite module
 * bundle is missing, has the wrong MIME type, or throws before React mounts.
 */
;(function () {
  var REPAIR_KEY_PREFIX = 'pushus-boot-repair-'
  var CHECK_DELAY_MS = 3000
  var CACHE_CLEAR_TIMEOUT_MS = 2500

  function getBuildId() {
    var meta = document.querySelector('meta[name="pushus-build-id"]')
    return (meta && meta.getAttribute('content')) || 'unknown'
  }

  function getRepairKey() {
    return REPAIR_KEY_PREFIX + getBuildId()
  }

  function getAttempts() {
    try {
      return parseInt(sessionStorage.getItem(getRepairKey()) || '0', 10) || 0
    } catch (_error) {
      return 0
    }
  }

  function setAttempts(value) {
    try {
      sessionStorage.setItem(getRepairKey(), String(value))
    } catch (_error) {
      // Storage can be unavailable in iOS private mode.
    }
  }

  function clearAttempts() {
    try {
      sessionStorage.removeItem(getRepairKey())
    } catch (_error) {
      // ignore
    }
  }

  function buildFreshUrl() {
    var url = new URL(window.location.href)
    url.searchParams.delete('_bootRepair')
    url.searchParams.delete('_v')
    url.searchParams.set('_fresh', String(Date.now()))
    return url.toString()
  }

  function clearRuntimeCaches() {
    var tasks = []

    if ('serviceWorker' in navigator) {
      tasks.push(
        navigator.serviceWorker.getRegistrations().then(function (registrations) {
          return Promise.all(
            registrations.map(function (registration) {
              return registration.unregister()
            }),
          )
        }),
      )
    }

    if ('caches' in window) {
      tasks.push(
        window.caches.keys().then(function (keys) {
          return Promise.all(
            keys.map(function (key) {
              return window.caches.delete(key)
            }),
          )
        }),
      )
    }

    if (!tasks.length) {
      return Promise.resolve()
    }

    return Promise.all(tasks).catch(function () {
      // Best-effort only — still navigate even if cleanup fails.
    })
  }

  function reloadFresh() {
    var target = buildFreshUrl()
    var navigated = false

    function go() {
      if (navigated) return
      navigated = true
      window.location.replace(target)
    }

    clearRuntimeCaches().finally(go)
    window.setTimeout(go, CACHE_CLEAR_TIMEOUT_MS)
  }

  function showRecoveryScreen(root) {
    root.innerHTML =
      '<main style="min-height:100dvh;display:flex;align-items:center;justify-content:center;' +
      'box-sizing:border-box;padding:24px;background:#0a0a0d;color:#f4f4f7;' +
      'font-family:system-ui,-apple-system,sans-serif;text-align:center">' +
      '<div style="width:100%;max-width:340px">' +
      '<div aria-hidden="true" style="font-size:40px;margin-bottom:12px">⚡</div>' +
      '<h1 style="font-size:20px;margin:0 0 8px">PushUS needs a fresh start</h1>' +
      '<p style="font-size:14px;line-height:1.5;color:#a6a6b0;margin:0 0 18px">' +
      'The app update did not finish loading. Clear cached files and reload now. Your banked reps are safe.</p>' +
      '<button id="pushus-boot-reload" type="button" style="width:100%;min-height:48px;' +
      'border:0;border-radius:12px;background:#863bff;color:white;font:600 15px system-ui;' +
      'padding:12px 16px">Clear cache and reload</button>' +
      '<p style="font-size:12px;line-height:1.5;color:#777784;margin:16px 0 0">' +
      'On desktop, you can also hard refresh with Ctrl+Shift+R (Cmd+Shift+R on Mac). ' +
      'On iPhone, remove every PushUS Home Screen icon, then add it again from Safari.</p>' +
      '</div></main>'

    var button = document.getElementById('pushus-boot-reload')
    if (button) {
      button.addEventListener('click', function () {
        setAttempts(0)
        reloadFresh()
      })
    }
  }

  function checkBoot() {
    var root = document.getElementById('root')
    if (!root) return

    if (root.childElementCount > 0) {
      clearAttempts()
      return
    }

    var attempts = getAttempts()
    if (attempts < 1) {
      setAttempts(attempts + 1)
      reloadFresh()
      return
    }

    showRecoveryScreen(root)
  }

  window.addEventListener('DOMContentLoaded', function () {
    window.setTimeout(checkBoot, CHECK_DELAY_MS)
  })
})()
