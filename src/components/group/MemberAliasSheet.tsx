import { useEffect, useState } from 'react'
import { cn } from '@/lib/cn'
import {
  formatMemberListName,
  formatProfileName,
  type ProfileNameFields,
} from '@/lib/memberDisplayName'
import { Button } from '@/components/ui/Button'

export type MemberAliasSheetProps = {
  open: boolean
  saving?: boolean
  profile: ProfileNameFields
  currentAlias?: string | null
  onSave: (alias: string) => void
  onClear: () => void
  onClose: () => void
  className?: string
}

export function MemberAliasSheet({
  open,
  saving = false,
  profile,
  currentAlias,
  onSave,
  onClear,
  onClose,
  className,
}: MemberAliasSheetProps) {
  const [aliasInput, setAliasInput] = useState('')

  useEffect(() => {
    if (!open) return
    setAliasInput(currentAlias?.trim() ?? '')
  }, [open, currentAlias])

  if (!open) {
    return null
  }

  const trimmed = aliasInput.trim()
  const preview = trimmed
    ? formatMemberListName(profile, trimmed)
    : formatProfileName(profile)
  const hasSavedAlias = Boolean(currentAlias?.trim())

  return (
    <div
      className={cn('fixed inset-x-0 z-[45] bottom-[var(--bottom-nav-height)]', className)}
      role="dialog"
      aria-label="Rename mate"
      aria-modal="true"
    >
      <button
        type="button"
        className="dock-scrim"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="dock-panel px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
        <p className="text-sm font-semibold text-text-primary">Name this mate</p>
        <p className="mt-1 text-xs text-text-muted">
          Only you see this label. Their account name stays{' '}
          <span className="font-medium text-text-primary">{profile.display_name.trim()}</span>.
        </p>

        <label htmlFor="memberAlias" className="mt-3 block text-xs font-medium text-text-muted">
          Your label
        </label>
        <input
          id="memberAlias"
          type="text"
          maxLength={40}
          value={aliasInput}
          disabled={saving}
          placeholder="Michael M"
          onChange={(event) => setAliasInput(event.target.value)}
          className={cn(
            'mt-1 w-full rounded-[var(--radius-md)] border border-border bg-bg px-3 py-2.5',
            'text-sm text-text-primary placeholder:text-text-muted',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50',
          )}
        />

        <p className="mt-2 text-xs text-text-muted">
          Preview: <span className="font-medium text-text-primary">{preview}</span>
        </p>

        <div className="mt-3 flex gap-2">
          <Button
            type="button"
            className="min-h-10 flex-1"
            loading={saving}
            disabled={saving || !trimmed}
            onClick={() => onSave(trimmed)}
          >
            Save
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="min-h-10 flex-1"
            disabled={saving}
            onClick={onClose}
          >
            Cancel
          </Button>
        </div>

        {hasSavedAlias ? (
          <Button
            type="button"
            variant="ghost"
            className="mt-2 min-h-10 w-full text-sm text-danger"
            disabled={saving}
            onClick={onClear}
          >
            Clear your label
          </Button>
        ) : null}
      </div>
    </div>
  )
}
