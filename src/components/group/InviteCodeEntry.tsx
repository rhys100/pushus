import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui'
import { normalizeInviteCode } from '@/lib/postAuthRouting'
import { cn } from '@/lib/cn'

type InviteCodeEntryProps = {
  id?: string
  label?: string
  helperText?: string
  submitLabel?: string
  className?: string
}

export function InviteCodeEntry({
  id = 'inviteCode',
  label = 'Got an invite code? Enter it here.',
  helperText,
  submitLabel = 'Continue',
  className,
}: InviteCodeEntryProps) {
  const navigate = useNavigate()
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const errorId = `${id}-error`

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    const normalized = normalizeInviteCode(code)
    if (!normalized) {
      setError('Enter a valid invite code from your group admin.')
      return
    }
    setError(null)
    navigate(`/join/${normalized}`)
  }

  return (
    <form onSubmit={handleSubmit} className={cn('space-y-2', className)}>
      <label htmlFor={id} className="text-sm font-medium text-text-primary">
        {label}
      </label>
      {helperText ? <p className="text-xs text-text-muted">{helperText}</p> : null}
      <input
        id={id}
        type="text"
        autoComplete="off"
        autoCapitalize="none"
        autoCorrect="off"
        inputMode="text"
        enterKeyHint="go"
        spellCheck={false}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        value={code}
        onChange={(e) => {
          setCode(e.target.value)
          if (error) setError(null)
        }}
        placeholder="d95d7fba"
        className={cn(
          'w-full rounded-[var(--radius-md)] border border-border bg-bg px-4 py-3',
          'font-mono text-sm text-text-primary placeholder:text-text-muted',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50',
        )}
      />
      {error ? (
        <p id={errorId} role="alert" className="text-xs text-danger">
          {error}
        </p>
      ) : null}
      <Button type="submit" variant="secondary" fullWidth>
        {submitLabel}
      </Button>
    </form>
  )
}
