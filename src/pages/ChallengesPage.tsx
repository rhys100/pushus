import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import { AppLayout } from '@/components/layout/AppLayout'
import { BackLink, Badge, Button, Card, EmptyState, Skeleton, useToast } from '@/components/ui'
import {
  CHALLENGE_FORMAT_OPTIONS,
  CHALLENGE_TYPE_OPTIONS,
  INTENSITY_OPTIONS,
  challengeStatus,
  isBeginnerWarningIntensity,
  statusVariant,
  type ChallengeFormat,
} from '@/lib/challenges'
import { getErrorMessage } from '@/lib/errors'
import { successHaptic, tapHaptic } from '@/lib/haptics'
import { cn } from '@/lib/cn'
import { useActiveGroup } from '@/hooks/useActiveGroup'
import { useCompetitions } from '@/hooks/useGamification'
import { useCreateChallenge } from '@/hooks/useChallenges'
import { useAuth } from '@/providers/AuthProvider'
import type { Competition, CompetitionIntensity } from '@/types/gamification'

function CompetitionCard({ competition }: { competition: Competition }) {
  const status = challengeStatus(competition)

  return (
    <Link
      to={`/challenges/${competition.id}`}
      className="block rounded-[var(--radius-lg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
    >
      <Card padding="md" className="space-y-2 transition-colors hover:border-accent/30">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-semibold text-text-primary">{competition.name}</p>
            <p className="text-xs capitalize text-text-muted">
              {competition.challenge_type.replace('_', ' ')} · {competition.intensity}
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
            Target:{' '}
            <span className="font-mono font-semibold">
              {competition.target_total.toLocaleString()}
            </span>{' '}
            reps
          </p>
        ) : null}
      </Card>
    </Link>
  )
}

const selectClass =
  'w-full rounded-[var(--radius-md)] border border-border bg-bg px-3 py-2 text-sm text-text-primary'
const inputClass =
  'w-full rounded-[var(--radius-md)] border border-border bg-bg px-3 py-2 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50'

function CreateChallengeForm({ onDone }: { onDone: () => void }) {
  const { user } = useAuth()
  const { toast } = useToast()
  const { activeGroup } = useActiveGroup()
  const navigate = useNavigate()
  const createMutation = useCreateChallenge(activeGroup, user?.id)

  const [name, setName] = useState('')
  const [formatValue, setFormatValue] = useState<ChallengeFormat>('seven_day')
  const [challengeType, setChallengeType] = useState<'leaderboard' | 'total_target' | 'team_total'>(
    'leaderboard',
  )
  const [intensity, setIntensity] = useState<CompetitionIntensity>('moderate')
  // Pop only rewards a tap — the default pill mounts still.
  const [intensityInteracted, setIntensityInteracted] = useState(false)
  const [targetTotal, setTargetTotal] = useState('')
  const [teamA, setTeamA] = useState('Team A')
  const [teamB, setTeamB] = useState('Team B')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')

  const needsTarget = challengeType === 'total_target'
  const needsTeams = challengeType === 'team_total'
  const needsDates = formatValue === 'custom'
  const showWarning = isBeginnerWarningIntensity(intensity)

  const missing = !name.trim()
    ? 'Give it a name to fire it off.'
    : needsTarget && !(Number(targetTotal) > 0)
      ? 'Set the group rep target.'
      : needsDates && (!customStart || !customEnd)
        ? 'Pick start and end dates.'
        : needsDates && customStart > customEnd
          ? 'The end date is before the start.'
          : null
  const valid = missing === null

  async function handleCreate() {
    try {
      const competition = await createMutation.mutateAsync({
        name,
        format: formatValue,
        challengeType,
        intensity,
        targetTotal: needsTarget ? Number(targetTotal) : undefined,
        teamNames: needsTeams ? [teamA, teamB] : undefined,
        customStartIso: needsDates ? customStart : undefined,
        customEndIso: needsDates ? customEnd : undefined,
      })

      successHaptic()
      toast({ message: 'Challenge created. Rally the troops.', variant: 'success' })
      onDone()
      navigate(`/challenges/${competition.id}`)
    } catch (error) {
      toast({ message: getErrorMessage(error, 'Could not create challenge.'), variant: 'danger' })
    }
  }

  return (
    <Card padding="md" className="motion-rise space-y-3">
      <p className="text-sm font-semibold text-text-primary">New challenge</p>

      <label className="block space-y-1">
        <span className="text-xs font-medium text-text-muted">Name</span>
        <input
          type="text"
          maxLength={60}
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Weekend Warrior"
          className={inputClass}
        />
      </label>

      <label className="block space-y-1">
        <span className="text-xs font-medium text-text-muted">Format</span>
        <select
          className={selectClass}
          value={formatValue}
          onChange={(event) => setFormatValue(event.target.value as ChallengeFormat)}
        >
          {CHALLENGE_FORMAT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label} — {option.description}
            </option>
          ))}
        </select>
      </label>

      {needsDates ? (
        <div className="grid grid-cols-2 gap-3">
          <label className="block space-y-1">
            <span className="text-xs font-medium text-text-muted">Starts</span>
            <input
              type="date"
              value={customStart}
              onChange={(event) => setCustomStart(event.target.value)}
              className={inputClass}
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-medium text-text-muted">Ends (inclusive)</span>
            <input
              type="date"
              value={customEnd}
              onChange={(event) => setCustomEnd(event.target.value)}
              className={inputClass}
            />
          </label>
        </div>
      ) : null}

      <label className="block space-y-1">
        <span className="text-xs font-medium text-text-muted">Type</span>
        <select
          className={selectClass}
          value={challengeType}
          onChange={(event) =>
            setChallengeType(event.target.value as 'leaderboard' | 'total_target' | 'team_total')
          }
        >
          {CHALLENGE_TYPE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label} — {option.description}
            </option>
          ))}
        </select>
      </label>

      {needsTarget ? (
        <label className="block space-y-1">
          <span className="text-xs font-medium text-text-muted">Group target (total reps)</span>
          <input
            type="number"
            min={1}
            inputMode="numeric"
            value={targetTotal}
            onChange={(event) => setTargetTotal(event.target.value)}
            placeholder="1000"
            className={inputClass}
          />
        </label>
      ) : null}

      {needsTeams ? (
        <div className="grid grid-cols-2 gap-3">
          <label className="block space-y-1">
            <span className="text-xs font-medium text-text-muted">Team 1</span>
            <input
              type="text"
              maxLength={30}
              value={teamA}
              onChange={(event) => setTeamA(event.target.value)}
              className={inputClass}
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-medium text-text-muted">Team 2</span>
            <input
              type="text"
              maxLength={30}
              value={teamB}
              onChange={(event) => setTeamB(event.target.value)}
              className={inputClass}
            />
          </label>
        </div>
      ) : null}

      <div className="space-y-1">
        <span id="intensity-label" className="text-xs font-medium text-text-muted">
          Intensity
        </span>
        <div role="group" aria-labelledby="intensity-label" className="grid grid-cols-4 gap-1.5">
          {INTENSITY_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={intensity === option.value}
              onClick={() => {
                tapHaptic()
                setIntensityInteracted(true)
                setIntensity(option.value)
              }}
              className={cn(
                'min-h-10 whitespace-nowrap rounded-[var(--radius-md)] border px-1 py-1.5 text-sm font-medium',
                'transition-[color,background-color,border-color,transform] duration-[var(--duration-fast)] active:scale-95',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/50',
                intensity === option.value
                  ? cn('border-accent bg-accent-muted text-text-primary', intensityInteracted && 'motion-pop')
                  : 'border-border bg-bg text-text-muted hover:border-accent/30',
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
        {showWarning ? (
          <p className="text-xs text-warning">
            Beginners get a heads-up before joining {intensity} challenges.
          </p>
        ) : null}
      </div>

      {missing ? <p className="text-xs text-text-muted">{missing}</p> : null}

      <div className="flex gap-2">
        <Button
          className="min-h-10 flex-1 whitespace-nowrap px-3"
          disabled={!valid}
          loading={createMutation.isPending}
          onClick={() => void handleCreate()}
        >
          Create challenge
        </Button>
        <Button
          variant="secondary"
          className="min-h-10 flex-1 whitespace-nowrap px-3"
          disabled={createMutation.isPending}
          onClick={onDone}
        >
          Cancel
        </Button>
      </div>
    </Card>
  )
}

export function ChallengesPage() {
  const { activeGroup, role, loading: groupLoading } = useActiveGroup()
  const { data: competitions = [], isLoading, error, refetch } = useCompetitions(activeGroup)
  const [creating, setCreating] = useState(false)
  const [showAllEnded, setShowAllEnded] = useState(false)

  const isAdmin = role === 'owner' || role === 'admin'
  const active = competitions.filter((item) => challengeStatus(item) === 'active')
  const upcoming = competitions.filter((item) => challengeStatus(item) === 'upcoming')
  const ended = competitions.filter((item) => challengeStatus(item) === 'ended')

  return (
    <AppLayout
      title="Challenges"
      subtitle={activeGroup?.name}
      showNav={false}
      headerLeading={<BackLink to="/group" label="Group" />}
    >
      <div className="motion-stagger space-y-6 pb-8">
        {isAdmin && !creating ? (
          <Button fullWidth onClick={() => setCreating(true)}>
            New challenge
          </Button>
        ) : null}

        {creating ? <CreateChallengeForm onDone={() => setCreating(false)} /> : null}

        {groupLoading || isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : error ? (
          <EmptyState
            title="Could not load challenges"
            description="Check your connection and try again."
            actionLabel="Try again"
            onAction={() => void refetch()}
          />
        ) : competitions.length === 0 ? (
          <EmptyState
            title="No challenges yet"
            description={
              isAdmin
                ? 'Create the first one — a weekend battle is a good start.'
                : 'Challenges will show here once your group admin creates them.'
            }
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
                {(showAllEnded ? ended : ended.slice(0, 5)).map((competition) => (
                  <CompetitionCard key={competition.id} competition={competition} />
                ))}
                {ended.length > 5 && !showAllEnded ? (
                  <button
                    type="button"
                    onClick={() => setShowAllEnded(true)}
                    className="min-h-11 w-full rounded-[var(--radius-md)] text-sm font-medium text-text-muted transition-colors hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
                  >
                    Show all {ended.length} past challenges
                  </button>
                ) : null}
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
