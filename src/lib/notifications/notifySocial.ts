import { supabase } from '@/lib/supabase'

export type SocialNotificationType =
  | 'mate_request'
  | 'mate_accepted'
  | 'challenge_invite'
  | 'challenge_accepted'
  | 'reaction'
  | 'group_challenge'

/**
 * Best-effort social push (mate request / accepted / 1v1 invite / reaction /
 * group challenge created). Fire-and-forget on purpose: the underlying action
 * already succeeded, so a push-delivery hiccup must never surface to the user
 * or block the UI. The edge function re-verifies the relationship and respects
 * the recipient's opt-out, so calling this is always safe.
 *
 * For `group_challenge`, `targetId` is the competition id — the edge function
 * fans out to every other active group member.
 */
export function notifySocial(
  type: SocialNotificationType,
  targetId: string,
  extra?: { entryId?: string },
): void {
  if (!targetId) {
    return
  }

  // Best-effort only — the action itself is unaffected. But `functions.invoke`
  // resolves (doesn't reject) with `{ error }` on most HTTP failures, so a plain
  // `.catch()` never sees them. Inspect the resolved error too, and log both
  // paths so a broken push is diagnosable in the field instead of silent.
  void supabase.functions
    .invoke('send-social', {
      body: { type, target_id: targetId, entry_id: extra?.entryId },
    })
    .then(({ error }) => {
      if (error) console.warn('[notifySocial]', type, error)
    })
    .catch((error) => {
      console.warn('[notifySocial]', type, error)
    })
}
