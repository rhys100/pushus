import { Link } from 'react-router-dom'
import { format, isAfter, isBefore } from 'date-fns'
import { AppLayout } from '@/components/layout/AppLayout'
import { Badge, Card, EmptyState, Skeleton } from '@/components/ui'
import { useActiveGroup } from '@/hooks/useActiveGroup'
import { useCompetitions } from '@/hooks/useGamification'
import type { Competition } from '@/types/gamification'

function competitionStatus(competition: Competition, now = new Date()): 'upcoming' | 'active' | 'ended' {
  const starts = new Date(competition.starts_at)
  const ends = new Date(competition.ends_at)

  if (isBefore(now, starts)) {
    return 'upcoming'
  }

  if (isAfter(now, ends)) {
    return 'ended'
  }

  return 'active'
}

function statusVariant(status: ReturnType<typeof competitionStatus>) {
  if (status === 'active') {
    return 'success' as const
  }

  if (status === 'upcoming') {
    return 'accent' as const
  }

  return 'neutral' as const
}

function CompetitionCard({ competition }: { competition: Competition }) {
  const status = competitionStatus(competition)

  return (
    <Card padding="md" className="space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-text-primary">{competition.name}</p>
          <p className="text-xs capitalize text-text-muted">
            {competition.competition_kind} · {competition.challenge_type.replace('_', ' ')}
          </p>
        </div>
        <Badge variant={statusVariant(status)}>{status}</Badge>
      </div>
      <p className="text-xs text-text-muted">
        {format(new Date(competition.starts_at), 'd MMM')} –{' '}
        {format(new Date(competition.ends_at), 'd MMM yyyy')}
      </p>
      {competition.target_total ? (
        <p className="text-sm text-text-primary">
          Target: <span className="font-mono font-semibold">{competition.target_total}</span> reps
        </p>
      ) : null}
    </Card>
  )
}

export function ChallengesPage() {
  const { activeGroup, loading: groupLoading } = useActiveGroup()
  const { data: competitions = [], isLoading, error } = useCompetitions(activeGroup)

  const active = competitions.filter((item) => competitionStatus(item) === 'active')
  const upcoming = competitions.filter((item) => competitionStatus(item) === 'upcoming')
  const ended = competitions.filter((item) => competitionStatus(item) === 'ended')

  return (
    <AppLayout title="Challenges" subtitle={activeGroup?.name} showNav={false}>
      <div className="space-y-6 pb-8">
        {groupLoading || isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : error ? (
          <EmptyState
            title="Could not load challenges"
            description="Check your connection and try again."
          />
        ) : competitions.length === 0 ? (
          <EmptyState
            title="No challenges yet"
            description="Weekly and custom challenges will show here once your group admin creates them."
            icon={<span className="text-2xl">🏆</span>}
          />
        ) : (
          <>
            {active.length > 0 ? (
              <section className="space-y-3">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                  Active
                </h2>
                {active.map((competition) => (
                  <CompetitionCard key={competition.id} competition={competition} />
                ))}
              </section>
            ) : null}

            {upcoming.length > 0 ? (
              <section className="space-y-3">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                  Upcoming
                </h2>
                {upcoming.map((competition) => (
                  <CompetitionCard key={competition.id} competition={competition} />
                ))}
              </section>
            ) : null}

            {ended.length > 0 ? (
              <section className="space-y-3">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                  Past
                </h2>
                {ended.slice(0, 5).map((competition) => (
                  <CompetitionCard key={competition.id} competition={competition} />
                ))}
              </section>
            ) : null}
          </>
        )}

        <Card padding="md">
          <Link
            to="/settings/training"
            className="flex min-h-11 items-center justify-between text-sm text-text-primary hover:text-accent"
          >
            Set up your training plan
            <span aria-hidden="true">→</span>
          </Link>
        </Card>
      </div>
    </AppLayout>
  )
}
