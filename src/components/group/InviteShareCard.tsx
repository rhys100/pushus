import { useState } from 'react'
import { Button, Card, useToast } from '@/components/ui'
import { buildInviteMessage } from '@/lib/inviteMessage'
import { buildInviteLink } from '@/lib/postAuthRouting'
import { appConfig } from '@/lib/config'
import { selectHaptic } from '@/lib/haptics'
import { cn } from '@/lib/cn'

/** Button label that pops a ✓ the moment a copy lands. */
function CopyLabel({ copied, idle }: { copied: boolean; idle: string }) {
  return (
    <span key={String(copied)} className={copied ? 'motion-pop' : undefined}>
      {copied ? '✓ Copied' : idle}
    </span>
  )
}

type InviteShareCardProps = {
  inviteCode: string
  className?: string
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

export function InviteShareCard({ inviteCode, className }: InviteShareCardProps) {
  const { toast } = useToast()
  const inviteLink = buildInviteLink(inviteCode)
  const inviteMessage = buildInviteMessage(inviteLink)
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function'

  const [copiedLink, setCopiedLink] = useState(false)
  const [copiedCode, setCopiedCode] = useState(false)
  const [copiedMessage, setCopiedMessage] = useState(false)
  const [linkCopyFailed, setLinkCopyFailed] = useState(false)
  const [codeCopyFailed, setCodeCopyFailed] = useState(false)
  const [messageCopyFailed, setMessageCopyFailed] = useState(false)

  async function handleCopyLink() {
    const ok = await copyText(inviteLink)
    if (ok) {
      selectHaptic()
      setCopiedLink(true)
      setLinkCopyFailed(false)
      toast({ message: 'Invite link copied.', variant: 'success' })
      window.setTimeout(() => setCopiedLink(false), 2000)
      return
    }
    setLinkCopyFailed(true)
    toast({ message: 'Could not copy link. Select the text below.', variant: 'danger' })
  }

  async function handleCopyCode() {
    const ok = await copyText(inviteCode)
    if (ok) {
      selectHaptic()
      setCopiedCode(true)
      setCodeCopyFailed(false)
      toast({ message: 'Invite code copied.', variant: 'success' })
      window.setTimeout(() => setCopiedCode(false), 2000)
      return
    }
    setCodeCopyFailed(true)
    toast({ message: 'Could not copy code. Select the text below.', variant: 'danger' })
  }

  async function handleCopyMessage() {
    const ok = await copyText(inviteMessage)
    if (ok) {
      selectHaptic()
      setCopiedMessage(true)
      setMessageCopyFailed(false)
      toast({ message: 'Invite message copied. Paste it into SMS or chat.', variant: 'success' })
      window.setTimeout(() => setCopiedMessage(false), 2000)
      return
    }
    setMessageCopyFailed(true)
    toast({ message: 'Could not copy message. Select the text below.', variant: 'danger' })
  }

  async function handleShare() {
    if (!canShare) return
    try {
      await navigator.share({
        title: `Join my push-up group on ${appConfig.name}`,
        text: inviteMessage,
        url: inviteLink,
      })
      selectHaptic()
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return
      toast({ message: 'Could not open share sheet.', variant: 'danger' })
    }
  }

  return (
    <Card padding="md" className={cn('space-y-4', className)}>
      <div>
        <p className="text-sm font-medium text-text-primary">Invite your mates</p>
        <p className="mt-1 text-xs text-text-muted">
          Send this link to your mates. They&apos;ll sign in, set up a profile, and join your
          group.
        </p>
      </div>

      <div className="space-y-2">
        <p className="whitespace-pre-wrap rounded-[var(--radius-md)] border border-border bg-bg px-3 py-2 text-sm leading-relaxed text-text-primary">
          {inviteMessage}
        </p>
        {messageCopyFailed ? (
          <p className="select-all whitespace-pre-wrap rounded-[var(--radius-md)] bg-bg px-3 py-2 text-sm text-text-primary">
            {inviteMessage}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button variant="primary" className="min-h-11 flex-1" onClick={() => void handleCopyMessage()}>
          <CopyLabel copied={copiedMessage} idle="Copy invite message" />
        </Button>
        {canShare ? (
          <Button variant="secondary" className="min-h-11 flex-1" onClick={() => void handleShare()}>
            Share invite
          </Button>
        ) : null}
      </div>

      <details className="group rounded-[var(--radius-md)] border border-border/60">
        <summary className="cursor-pointer list-none px-3 py-2.5 text-sm font-medium text-text-muted transition-colors hover:text-text-primary [&::-webkit-details-marker]:hidden">
          <span className="flex items-center justify-between gap-2">
            More invite options
            <span
              className="text-xs text-text-muted transition-transform group-open:rotate-180"
              aria-hidden="true"
            >
              ▾
            </span>
          </span>
        </summary>

        <div className="space-y-4 border-t border-border/40 px-3 pb-3 pt-3">
          <div className="space-y-2">
            <p className="text-xs font-medium text-text-muted">Invite link</p>
            <code
              className={cn(
                'block w-full break-all rounded-[var(--radius-md)] border border-border bg-bg px-3 py-2',
                'font-mono text-sm text-accent',
              )}
            >
              {inviteLink}
            </code>
            {linkCopyFailed ? (
              <p className="select-all break-all rounded-[var(--radius-md)] bg-bg px-3 py-2 font-mono text-xs text-text-primary">
                {inviteLink}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <p className="text-xs font-medium text-text-muted">Invite code</p>
            <code
              className={cn(
                'block w-full rounded-[var(--radius-md)] border border-border bg-bg px-3 py-2',
                'font-mono text-lg tracking-widest text-accent',
              )}
            >
              {inviteCode}
            </code>
            {codeCopyFailed ? (
              <p className="select-all rounded-[var(--radius-md)] bg-bg px-3 py-2 font-mono text-lg tracking-widest text-text-primary">
                {inviteCode}
              </p>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" className="min-h-10 flex-1" onClick={() => void handleCopyLink()}>
              <CopyLabel copied={copiedLink} idle="Copy link" />
            </Button>
            <Button variant="secondary" className="min-h-10 flex-1" onClick={() => void handleCopyCode()}>
              <CopyLabel copied={copiedCode} idle="Copy code" />
            </Button>
          </div>
        </div>
      </details>
    </Card>
  )
}
