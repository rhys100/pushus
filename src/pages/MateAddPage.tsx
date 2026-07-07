import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { Button, Card, Skeleton } from '@/components/ui'
import { getErrorMessage } from '@/lib/errors'
import { useRedeemMateCode } from '@/hooks/useMates'

/** Landing page for shared mate links: /mates/add/:code */
export function MateAddPage() {
  const { code } = useParams<{ code: string }>()
  const navigate = useNavigate()
  const redeem = useRedeemMateCode()
  const attempted = useRef(false)
  const [result, setResult] = useState<
    | { state: 'working' }
    | { state: 'done'; name: string; emoji: string }
    | { state: 'error'; message: string }
  >({ state: 'working' })

  useEffect(() => {
    if (!code || attempted.current) return
    attempted.current = true

    redeem
      .mutateAsync(code)
      .then((mate) =>
        setResult({ state: 'done', name: mate.display_name, emoji: mate.avatar_emoji }),
      )
      .catch((error) =>
        setResult({ state: 'error', message: getErrorMessage(error, 'Invalid mate link.') }),
      )
  }, [code, redeem])

  return (
    <AppLayout title="Add a mate" showNav={false}>
      <div className="space-y-4 pb-8">
        {result.state === 'working' ? (
          <Skeleton className="h-28 w-full" />
        ) : result.state === 'done' ? (
          <Card padding="lg" className="space-y-3 text-center">
            <p className="text-4xl">{result.emoji}</p>
            <p className="text-lg font-bold text-text-primary">
              You and {result.name} are mates now
            </p>
            <p className="text-sm text-text-muted">
              Compare stats, nudge each other, and go head to head.
            </p>
            <Button fullWidth onClick={() => navigate('/mates')}>
              Open Mates
            </Button>
          </Card>
        ) : (
          <Card padding="lg" className="space-y-3 text-center">
            <p className="text-4xl">🤝</p>
            <p className="text-lg font-bold text-text-primary">That link didn&apos;t work</p>
            <p className="text-sm text-text-muted">{result.message}</p>
            <Button variant="secondary" fullWidth onClick={() => navigate('/mates')}>
              Back to Mates
            </Button>
          </Card>
        )}
      </div>
    </AppLayout>
  )
}
