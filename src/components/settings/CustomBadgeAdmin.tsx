import { useEffect, useState } from 'react'
import { Button, Card, Skeleton, useToast } from '@/components/ui'
import { cn } from '@/lib/cn'
import { getErrorMessage } from '@/lib/errors'
import { formatMemberListName } from '@/lib/memberDisplayName'
import { useActiveGroup } from '@/hooks/useActiveGroup'
import { useGroupMembers } from '@/hooks/useGroupMembers'
import {
  useAwardBadge,
  useCreateCustomBadge,
  useDeleteCustomBadge,
  useGroupCustomBadges,
} from '@/hooks/useCustomBadges'
import { useAuth } from '@/providers/AuthProvider'

const BADGE_EMOJIS = ['🎖️', '🏅', '🥇', '💩', '🐐', '🔥', '😤', '🧱', '🦍', '🤡', '👑', '🫡']
const inputClass =
  'w-full rounded-[var(--radius-md)] border border-border bg-bg px-3 py-2 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50'

/** Owner/admin only: create banter badges and award them to members. */
export function CustomBadgeAdmin() {
  const { user } = useAuth()
  const { toast } = useToast()
  const { activeGroup } = useActiveGroup()
  const groupId = activeGroup?.id
  const { data: badges = [], isLoading } = useGroupCustomBadges(groupId)
  const { data: members = [] } = useGroupMembers(groupId)
  const createBadge = useCreateCustomBadge(groupId, user?.id)
  const deleteBadge = useDeleteCustomBadge(groupId)
  const awardBadge = useAwardBadge(groupId, user?.id)

  const [name, setName] = useState('')
  const [emoji, setEmoji] = useState(BADGE_EMOJIS[0])
  const [awardBadgeId, setAwardBadgeId] = useState('')
  const [awardMemberId, setAwardMemberId] = useState('')
  // Deleting a badge is permanent — arm-to-confirm first, auto-disarm after 4s.
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  useEffect(() => {
    if (!confirmDeleteId) return
    const timer = window.setTimeout(() => setConfirmDeleteId(null), 4000)
    return () => window.clearTimeout(timer)
  }, [confirmDeleteId])

  async function handleCreate() {
    if (!name.trim()) return
    try {
      await createBadge.mutateAsync({ name, icon_emoji: emoji })
      setName('')
      toast({ message: 'Badge created.', variant: 'success' })
    } catch (error) {
      toast({ message: getErrorMessage(error, 'Could not create badge.'), variant: 'danger' })
    }
  }

  async function handleAward() {
    if (!awardBadgeId || !awardMemberId) return
    try {
      await awardBadge.mutateAsync({ badgeId: awardBadgeId, memberId: awardMemberId })
      setAwardMemberId('')
      toast({ message: 'Badge awarded 🎉', variant: 'success' })
    } catch (error) {
      toast({ message: getErrorMessage(error, 'Could not award badge.'), variant: 'danger' })
    }
  }

  async function handleDelete(badgeId: string) {
    if (confirmDeleteId !== badgeId) {
      setConfirmDeleteId(badgeId)
      return
    }

    setConfirmDeleteId(null)
    try {
      await deleteBadge.mutateAsync(badgeId)
      toast({ message: 'Badge deleted.', variant: 'success' })
    } catch (error) {
      toast({ message: getErrorMessage(error, 'Could not delete badge.'), variant: 'danger' })
    }
  }

  return (
    <Card padding="md" className="space-y-3">
      <div>
        <p className="text-sm font-medium text-text-primary">Banter badges</p>
        <p className="mt-1 text-xs text-text-muted">
          Make up your own group badges and hand them out. Purely for fun.
        </p>
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap gap-1.5">
          {BADGE_EMOJIS.map((option) => (
            <button
              key={option}
              type="button"
              aria-label={`Icon ${option}`}
              aria-pressed={emoji === option}
              onClick={() => setEmoji(option)}
              className={cn(
                'flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)] border text-lg transition-colors',
                emoji === option
                  ? 'border-accent bg-accent-muted'
                  : 'border-border bg-bg hover:border-accent/30',
              )}
            >
              {option}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            maxLength={40}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Badge name (e.g. Skipped Leg Day)"
            className={inputClass}
          />
          <Button
            className="min-h-10 shrink-0 px-3 text-sm"
            disabled={!name.trim()}
            loading={createBadge.isPending}
            onClick={() => void handleCreate()}
          >
            Add
          </Button>
        </div>
      </div>

      {isLoading ? (
        <Skeleton className="h-10 w-full" />
      ) : badges.length > 0 ? (
        <div className="space-y-2 border-t border-border pt-3">
          <ul className="space-y-1.5">
            {badges.map((badge) => (
              <li key={badge.id} className="flex items-center gap-2 text-sm">
                <span className="text-lg">{badge.icon_emoji}</span>
                <span className="flex-1 truncate text-text-primary">{badge.name}</span>
                <button
                  type="button"
                  aria-label={
                    confirmDeleteId === badge.id
                      ? `Confirm delete ${badge.name}`
                      : `Delete ${badge.name}`
                  }
                  className={cn(
                    'rounded-[var(--radius-sm)] px-1 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50',
                    confirmDeleteId === badge.id
                      ? 'font-semibold text-danger'
                      : 'text-text-muted hover:text-danger',
                  )}
                  onClick={() => void handleDelete(badge.id)}
                >
                  {confirmDeleteId === badge.id ? 'Confirm?' : 'Delete'}
                </button>
              </li>
            ))}
          </ul>

          <div className="grid grid-cols-2 gap-2 pt-1">
            <select
              className={inputClass}
              value={awardBadgeId}
              onChange={(event) => setAwardBadgeId(event.target.value)}
              aria-label="Badge to award"
            >
              <option value="">Pick a badge…</option>
              {badges.map((badge) => (
                <option key={badge.id} value={badge.id}>
                  {badge.icon_emoji} {badge.name}
                </option>
              ))}
            </select>
            <select
              className={inputClass}
              value={awardMemberId}
              onChange={(event) => setAwardMemberId(event.target.value)}
              aria-label="Member to award"
            >
              <option value="">Pick a mate…</option>
              {members
                .filter((member) => member.profiles)
                .map((member) => (
                  <option key={member.user_id} value={member.user_id}>
                    {formatMemberListName(member.profiles!, member.viewer_alias)}
                  </option>
                ))}
            </select>
          </div>
          <Button
            fullWidth
            className="min-h-10 text-sm"
            disabled={!awardBadgeId || !awardMemberId}
            loading={awardBadge.isPending}
            onClick={() => void handleAward()}
          >
            Award badge
          </Button>
        </div>
      ) : null}
    </Card>
  )
}
