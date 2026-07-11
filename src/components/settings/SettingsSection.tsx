import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

type SettingsSectionProps = {
  title: string
  children: ReactNode
  className?: string
}

/**
 * A titled group of setting cards. The uppercase header gives the Settings
 * page scannable structure (Account / Preferences / Training / …) instead of a
 * flat stack of equal-weight cards. Cards inside sit closer together than the
 * gap between sections, so related options read as a set.
 */
export function SettingsSection({ title, children, className }: SettingsSectionProps) {
  return (
    <section className={cn('space-y-2', className)}>
      <h2 className="px-1 text-2xs font-semibold uppercase tracking-wider text-text-muted">
        {title}
      </h2>
      <div className="space-y-3">{children}</div>
    </section>
  )
}
