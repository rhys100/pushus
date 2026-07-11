import { Card } from '@/components/ui'

export function ConfigErrorScreen() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-bg px-[max(1rem,env(safe-area-inset-left))] py-[max(2rem,env(safe-area-inset-top))]">
      <Card className="w-full max-w-md space-y-4 p-6">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-accent">Setup required</p>
          <h1 className="text-xl font-semibold text-text-primary">PushUS needs Supabase env vars</h1>
          <p className="text-sm text-text-muted">
            The app cannot start because <code className="text-text-primary">VITE_SUPABASE_URL</code>{' '}
            and <code className="text-text-primary">VITE_SUPABASE_ANON_KEY</code> are missing.
          </p>
        </div>

        <ol className="list-decimal space-y-2 pl-5 text-sm text-text-muted">
          <li>Copy <code className="text-text-primary">.env.example</code> to <code className="text-text-primary">.env</code></li>
          <li>Add your Supabase project URL and anon key</li>
          <li>Restart the dev server</li>
        </ol>

        <p className="text-xs text-text-muted">
          For smoke tests only, you can run{' '}
          <code className="text-text-primary">npm run dev -- --mode e2e</code> to load{' '}
          <code className="text-text-primary">.env.e2e</code>.
        </p>
      </Card>
    </div>
  )
}
