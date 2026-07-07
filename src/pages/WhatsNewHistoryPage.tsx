import { format, parseISO } from 'date-fns'
import { AppLayout } from '@/components/layout/AppLayout'
import { ActivityIcon, Badge, Card } from '@/components/ui'
import { APP_VERSION } from '@/lib/appVersionLabel'
import { NEWS_ITEMS, WHATS_NEW_SIGNOFF, type NewsItem } from '@/lib/whatsNew'

type NewsGroup = {
  date: string
  version: string | null
  items: NewsItem[]
}

/** Group the catalog by launch date (newest first, matching NEWS_ITEMS order). */
function groupNewsByDate(items: NewsItem[]): NewsGroup[] {
  const groups: NewsGroup[] = []

  for (const item of items) {
    const current = groups[groups.length - 1]

    if (current && current.date === item.date) {
      current.items.push(item)

      if (!current.version && item.version) {
        current.version = item.version
      }
    } else {
      groups.push({ date: item.date, version: item.version ?? null, items: [item] })
    }
  }

  return groups
}

/** Settings → What's new: every launch announcement, newest first. */
export function WhatsNewHistoryPage() {
  const groups = groupNewsByDate(NEWS_ITEMS)

  return (
    <AppLayout title="What's new" subtitle="Feature launches and release notes" showNav>
      <div className="space-y-4 pb-4">
        <p className="text-xs text-text-muted">
          You&apos;re on{' '}
          <span className="font-mono font-semibold text-text-primary">
            {APP_VERSION !== '0.0.0' ? `v${APP_VERSION}` : 'a dev build'}
          </span>
          . New launches pop up once when you come back to the app — everything lives
          here after that.
        </p>

        {groups.map((group) => (
          <Card key={group.date} padding="md" className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                {format(parseISO(`${group.date}T12:00:00`), 'd MMMM yyyy')}
              </p>
              {group.version ? <Badge variant="neutral">v{group.version}</Badge> : null}
            </div>

            <ul className="space-y-4">
              {group.items.map((item) => (
                <li key={item.id} className="flex gap-3">
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-sm)] border border-border bg-bg text-accent">
                    <ActivityIcon icon={item.emoji} className="h-4 w-4 text-base" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-text-primary">{item.title}</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-text-muted">
                      {item.body}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        ))}

        <p className="text-right text-xs font-medium italic text-text-muted">
          {WHATS_NEW_SIGNOFF}
        </p>
      </div>
    </AppLayout>
  )
}

export default WhatsNewHistoryPage
