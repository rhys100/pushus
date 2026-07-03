import { execSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

function readAppVersion(): string {
  try {
    const pkg = JSON.parse(
      readFileSync(path.resolve(__dirname, 'package.json'), 'utf8'),
    ) as { version?: string }
    return typeof pkg.version === 'string' ? pkg.version : '0.0.0'
  } catch {
    return '0.0.0'
  }
}

function getBuildId(): string {
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim()
  } catch {
    return String(Date.now())
  }
}

function appVersionPlugin(buildId: string, version: string, appUrl: string): Plugin {
  const bootstrapScript = `(function(){if(typeof fetch==="undefined")return;var m=document.querySelector('meta[name="pushus-build-id"]');if(!m)return;var c=m.getAttribute("content");if(!c||c==="dev")return;try{var u0=new URL(location.href);var requested=u0.searchParams.get("_v");if(requested){u0.searchParams.delete("_v");history.replaceState({},"",u0.toString());if(requested===c){sessionStorage.removeItem("pushus-reload-attempts-"+requested);return}}}catch(e){}fetch("/version.json?t="+Date.now(),{cache:"no-store"}).then(function(r){return r.ok?r.json():null}).then(function(p){if(!p||!p.buildId||p.buildId===c)return;var attemptsKey="pushus-reload-attempts-"+p.buildId;var attempts=0;try{attempts=parseInt(sessionStorage.getItem(attemptsKey)||"0",10)||0}catch(e){}if(attempts>=3)return;try{sessionStorage.setItem(attemptsKey,String(attempts+1))}catch(e){}function go(){var u=new URL(location.href);u.searchParams.set("_v",p.buildId);location.replace(u.toString())}if("serviceWorker" in navigator){navigator.serviceWorker.getRegistrations().then(function(rs){return Promise.all(rs.map(function(r){return typeof r.update==="function"?r.update().catch(function(){}):Promise.resolve()}))}).finally(go)}else go()}).catch(function(){})})();`

  return {
    name: 'app-version',
    transformIndexHtml(html) {
      const withAppUrl = html.replaceAll('__PUSHUS_APP_URL__', appUrl)
      return withAppUrl.replace(
        '<head>',
        `<head>\n    <meta name="pushus-build-id" content="${buildId}" />\n    <script>${bootstrapScript}</script>`,
      )
    },
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'version.json',
        source: `${JSON.stringify({ version, buildId }, null, 2)}\n`,
      })
    },
  }
}

function pwaManifestPlugin(appUrl: string): Plugin {
  const manifestPaths = new Set(['/manifest.json', '/manifest.webmanifest'])

  function manifestJson(origin: string): string {
    const manifestUrl = `${origin.replace(/\/$/, '')}/manifest.json`
    const manifestPath = path.resolve(__dirname, 'public/manifest.json')
    const base = JSON.parse(readFileSync(manifestPath, 'utf8')) as Record<string, unknown>
    base.related_applications = [{ platform: 'webapp', url: manifestUrl, id: '/' }]
    return `${JSON.stringify(base, null, 2)}\n`
  }

  return {
    name: 'pwa-manifest',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const urlPath = req.url?.split('?')[0]
        if (!urlPath || !manifestPaths.has(urlPath)) {
          next()
          return
        }

        const host = req.headers.host ?? 'localhost:5173'
        const proto = req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http'
        const origin = host.includes('localhost') ? `${proto}://${host}` : appUrl
        const body = manifestJson(origin)

        res.statusCode = 200
        res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8')
        res.setHeader('Cache-Control', 'no-cache, must-revalidate')
        res.end(body)
      })
    },
    writeBundle(options) {
      const outDir = options.dir ?? path.resolve(__dirname, 'dist')
      const body = manifestJson(appUrl)
      writeFileSync(path.join(outDir, 'manifest.json'), body)
      writeFileSync(path.join(outDir, 'manifest.webmanifest'), body)
    },
  }
}

export default defineConfig(({ mode }) => {
  const buildId = mode === 'development' ? 'dev' : getBuildId()
  const appVersion = readAppVersion()
  const appUrl = (process.env.VITE_APP_URL ?? 'https://www.pushus.app').replace(/\/$/, '')

  return {
    plugins: [react(), appVersionPlugin(buildId, appVersion, appUrl), pwaManifestPlugin(appUrl)],
    define: {
      __APP_BUILD_ID__: JSON.stringify(buildId),
      __APP_VERSION__: JSON.stringify(appVersion),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) {
              return undefined
            }

            if (id.includes('react-dom') || id.includes('/react/')) {
              return 'vendor-react'
            }

            if (id.includes('@tanstack/react-query')) {
              return 'vendor-query'
            }

            if (id.includes('@supabase/supabase-js')) {
              return 'vendor-supabase'
            }

            if (id.includes('date-fns')) {
              return 'vendor-date'
            }

            return undefined
          },
        },
      },
    },
  }
})
