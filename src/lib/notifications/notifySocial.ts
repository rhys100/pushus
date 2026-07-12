import { supabase } from '@/lib/supabase'

export type SocialNotificationType =
  | 'mate_request'
  | 'mate_accepted'
  | 'challenge_invite'
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
 *
 * Invoke `{ error }` and zero-push results are logged to the console so silent
 * Apple/FCM delivery failures are diagnosable in DevTools / remote logs.
 */
export function notifySocial(
  type: SocialNotificationType,
  targetId: string,
  extra?: { entryId?: string },
): void {
  if (!targetId) {
    return
  }

  void supabase.functions
    .invoke('send-social', {
      body: { type, target_id: targetId, entry_id: extra?.entryId },
    })
    .then(({ data, error }) => {
      if (error) {
        console.warn('[notifySocial]', type, error.message ?? error)
        return
      }
      const pushed =
        data && typeof data === 'object' && 'pushed' in data
          ? Number((data as { pushed: unknown }).pushed)
          : null
      if (pushed === 0) {
        console.warn('[notifySocial]', type, 'pushed 0', data)
      }
    })
    .catch((error: unknown) => {
      console.warn('[notifySocial]', type, error)
    })
}
