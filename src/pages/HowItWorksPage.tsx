import type { ReactNode } from 'react'
import { AppLayout } from '@/components/layout/AppLayout'
import { Card } from '@/components/ui'
import { cn } from '@/lib/cn'
import { appConfig } from '@/lib/config'

type Rule = {
  emoji: string
  title: string
  body: ReactNode
  /** Highlight the card (used for the beginner explainer). */
  highlight?: boolean
}

const RULES: Rule[] = [
  {
    emoji: '🌱',
    title: 'New here? Reps & sets in 20 seconds',
    highlight: true,
    body: (
      <>
        <p>
          Don&apos;t worry about gym jargon — it&apos;s simpler than it sounds:
        </p>
        <ul className="mt-1.5 space-y-1">
          <li>
            A <strong className="font-semibold text-text-primary">rep</strong> is one push-up.
          </li>
          <li>
            A <strong className="font-semibold text-text-primary">set</strong> is a bunch of
            push-ups you do in one go, then rest.
          </li>
          <li>
            So &ldquo;<strong className="font-semibold text-text-primary">2 sets of 8</strong>&rdquo;
            means: do 8 push-ups, rest a few minutes (or come back later), then do 8 more — 16 in
            total.
          </li>
        </ul>
        <p className="mt-1.5">
          You don&apos;t have to do them all at once — spread your sets through the day. And when you
          log, just enter the <strong className="font-semibold text-text-primary">number of
          push-ups you actually did</strong> in that set. The app adds them up for you. That&apos;s
          it.
        </p>
      </>
    ),
  },
  {
    emoji: '🤝',
    title: 'Honour system',
    body: 'No photos, no video, no proof. You log your own push-ups and everyone trusts each other. Be honest — the streaks and leaderboards only mean something if the reps are real.',
  },
  {
    emoji: '⭕',
    title: 'Banking a set',
    body: 'Drag around the ring to dial in how many push-ups you just did (one full circle = 10), or tap +10, then hit Bank. Each bank saves one set. Banked the wrong number? Undo it from the toast, or edit it later in My log.',
  },
  {
    emoji: '📅',
    title: 'Log today and yesterday',
    body: 'Forgot to log yesterday? You can still add it. Open My log (in the Feed tab), tap yesterday on the calendar, and add the set. You can log and edit today and yesterday — older days are locked in so everyone’s scores stay fair.',
  },
  {
    emoji: '✏️',
    title: 'Fixing mistakes',
    body: "You can edit your own sets for today and yesterday, and delete today's. Once a day is older than yesterday it's locked and can't be changed. (Group admins can still fix dodgy entries.)",
  },
  {
    emoji: '🎯',
    title: 'Do you need a plan?',
    body: 'No. You can just bank push-ups whenever you feel like it. If you want structure, set up a training plan and the app suggests a daily target (like "3 sets of 8") and eases you up week by week — but the plan is only a suggestion, never a rule.',
  },
  {
    emoji: '⭐',
    title: 'XP — 1 push-up, 1 XP',
    body: 'Every push-up you bank is worth exactly 1 XP, and you’ll see it add up each time you bank. No bonus multipliers for big sets — a set of 50 is 50 XP whether you do it in one go or five. Big single sets get their own glory on the leaderboard instead.',
  },
  {
    emoji: '🔥',
    title: 'Streaks',
    body: "The flame next to your name is your streak — the number of days in a row you’ve logged. Bank at least one set each day to keep it alive. Your group’s rest days are protected automatically, so a rest day never breaks it. Forgot to log yesterday? If it would break your streak, you can spend one streak freeze (one per week) to protect that day — look for “Protect yesterday” on the Achievements page.",
  },
  {
    emoji: '🏅',
    title: 'Badges',
    body: 'Badges unlock automatically as you hit milestones — your first bank, big single sets, big days, lifetime totals (1,000 / 10,000 / 100,000 club), streaks, and early-bird / night-owl sets. Find them on the Achievements page from your Group.',
  },
  {
    emoji: '🏆',
    title: 'The board',
    body: 'The board ranks your group — 1st, 2nd, 3rd — by total reps, biggest single set, and most improved, over the day, week, and month. Prefer to keep your numbers private? You can hide your totals from the board in Settings.',
  },
  {
    emoji: '💪',
    title: 'Reactions, mates & challenges',
    body: 'React to sets in the feed (💪 🔥 😂 👏 😤), add mates to compare and nudge each other on, and join group challenges. All optional — the daily bank is the heart of it.',
  },
  {
    emoji: '😴',
    title: 'Injured or away',
    body: 'Going on holiday or nursing a niggle? Set yourself injured or away in Settings. That pauses your reminders and training plan and protects your streak while you’re out — logging still works whenever you want.',
  },
]

/** Settings → How it works: onboarding + the rules of the app, in plain language. */
export function HowItWorksPage() {
  return (
    <AppLayout title={`How ${appConfig.name} works`} subtitle="The rules, in plain language" showNav>
      <div className="space-y-3 pb-6">
        <p className="text-sm leading-relaxed text-text-muted">
          {appConfig.name} is a group push-up challenge. Bank your sets, keep your streak, and climb
          the board with your mates. New to working out? Start with the first card — it explains
          everything you need.
        </p>

        {RULES.map((rule) => (
          <Card
            key={rule.title}
            padding="md"
            className={cn(
              'flex gap-3',
              rule.highlight && 'border-accent/60 bg-accent-muted/20',
            )}
          >
            <span
              aria-hidden="true"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-bg text-lg"
            >
              {rule.emoji}
            </span>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-text-primary">{rule.title}</h2>
              <div className="mt-0.5 space-y-1 text-xs leading-relaxed text-text-muted">
                {typeof rule.body === 'string' ? <p>{rule.body}</p> : rule.body}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </AppLayout>
  )
}

export default HowItWorksPage
