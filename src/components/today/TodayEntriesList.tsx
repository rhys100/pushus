import { getGroupLocalDateString } from '@/hooks/useTodayData'
import { DayEntriesList, type DayEntriesListProps } from '@/components/today/DayEntriesList'

export type TodayEntriesListProps = Omit<
  DayEntriesListProps,
  'selectedDate' | 'todayDate'
> & {
  group: DayEntriesListProps['group']
}

/** @deprecated Use DayEntriesList with selectedDate */
export function TodayEntriesList(props: TodayEntriesListProps) {
  const todayDate = getGroupLocalDateString(props.group.timezone)

  return (
    <DayEntriesList
      {...props}
      selectedDate={todayDate}
      todayDate={todayDate}
    />
  )
}
