import { useQuery } from '@tanstack/react-query'
import { endOfMonth, format, startOfMonth } from 'date-fns'
import { supabase } from '@/lib/supabase'
import type { Group } from '@/types/database'

export type DayRepSummary = {
  loggedFor: string
  totalReps: number
  setCount: number
}

export const repHistoryKeys = {
  all: ['repHistory'] as const,
  monthSummary: (groupId: string, userId: string, monthKey: string) =>
    ['repHistory', 'monthSummary', groupId, userId, monthKey] as const,
}

function monthKeyFromDate(date: Date): string {
  return format(date, 'yyyy-MM')
}

function monthDateRange(monthStart: Date): { start: string; end: string } {
  const start = format(startOfMonth(monthStart), 'yyyy-MM-dd')
  const end = format(endOfMonth(monthStart), 'yyyy-MM-dd')
  return { start, end }
}

async function fetchMonthRepSummary(
  groupId: string,
  userId: string,
  monthStart: Date,
): Promise<DayRepSummary[]> {
  const { start, end } = monthDateRange(monthStart)

  const { data, error } = await supabase
    .from('pushup_entries')
    .select('logged_for, count')
    .eq('group_id', groupId)
    .eq('user_id', userId)
    .gte('logged_for', start)
    .lte('logged_for', end)
    .is('deleted_at', null)
    .in('review_status', ['none', 'approved'])

  if (error) {
    throw error
  }

  const byDay = new Map<string, DayRepSummary>()

  for (const row of data ?? []) {
    const loggedFor = row.logged_for as string
    const count = row.count as number
    const existing = byDay.get(loggedFor)

    if (existing) {
      existing.totalReps += count
      existing.setCount += 1
    } else {
      byDay.set(loggedFor, {
        loggedFor,
        totalReps: count,
        setCount: 1,
      })
    }
  }

  return Array.from(byDay.values())
}

export function useRepHistorySummary(
  group: Group | null | undefined,
  userId: string | undefined,
  monthStart: Date,
) {
  const monthKey = monthKeyFromDate(monthStart)

  return useQuery({
    queryKey: repHistoryKeys.monthSummary(group?.id ?? '', userId ?? '', monthKey),
    queryFn: () => fetchMonthRepSummary(group!.id, userId!, monthStart),
    enabled: Boolean(group?.id && userId),
    staleTime: 60_000,
  })
}

export function aggregateRepSummaryByDate(
  summaries: DayRepSummary[],
): Map<string, DayRepSummary> {
  return new Map(summaries.map((summary) => [summary.loggedFor, summary]))
}
