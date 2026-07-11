import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { useToast } from '@/components/ui'
import { clearPendingMateCode, getPendingMateCode } from '@/lib/storage'
import { useRedeemMateCode } from '@/hooks/useMates'
import { useAuth } from '@/providers/AuthProvider'

/**
 * Redeem a mate code captured from a shared link before sign-in. MateAddPage
 * owns redemption while you're on it; this covers the round-trip case — you tap
 * a mate link signed out, sign in / onboard, and land somewhere else — by
 * redeeming the stored code in the background so the link isn't lost.
 */
export function usePendingMateRedeem(): void {
  const { session, profileOnboarded } = useAuth()
  const { toast } = useToast()
  const location = useLocation()
  const redeem = useRedeemMateCode()
  const done = useRef(false)

  useEffect(() => {
    if (done.current) {
      return
    }
    if (!session || !profileOnboarded) {
      return
    }
    // The /mates/add page handles its own redemption + confirmation UI.
    if (location.pathname.startsWith('/mates/add')) {
      return
    }

    const code = getPendingMateCode()
    if (!code) {
      return
    }

    done.current = true
    redeem
      .mutateAsync(code)
      .then((mate) => {
        clearPendingMateCode()
        toast({ message: `You're now mates with ${mate.display_name}. 💪`, variant: 'success' })
      })
      .catch(() => {
        // Invalid / expired / transient — clear so it can't loop; the visitor
        // can always re-open the link.
        clearPendingMateCode()
      })
  }, [session, profileOnboarded, location.pathname, redeem, toast])
}
