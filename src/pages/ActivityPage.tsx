import { useState } from 'react'
import { useActiveGroup } from '@/hooks/useActiveGroup'
import { useTabPageMeta } from '@/components/layout/TabPageMeta'
import { SegmentedControl } from '@/components/ui'
import { ActivityFeedSkeleton, GroupFeedPanel } from '@/components/feed/GroupFeedPanel'
import { RepHistoryPanel } from '@/components/feed/RepHistoryPanel'

type FeedSegment = 'group' | 'myLog'

const SEGMENT_OPTIONS = [
  { value: 'group' as const, label: 'Group' },
  { value: 'myLog' as const, label: 'My log' },
]

export function ActivityPage() {
  const { activeGroup, loading: groupLoading } = useActiveGroup()
  const [segment, setSegment] = useState<FeedSegment>('group')

  useTabPageMeta({
    // "Feed" matches the bottom-nav label; the segment subtitle disambiguates
    // the group stream vs your own log.
    title: 'Feed',
    subtitle: segment === 'group' ? 'Recent entries' : 'Your rep history',
  })

  if (groupLoading || !activeGroup) {
    return <ActivityFeedSkeleton />
  }

  return (
    <div className="space-y-4">
      <SegmentedControl
        options={SEGMENT_OPTIONS}
        value={segment}
        onChange={setSegment}
        ariaLabel="Feed view"
      />

      {segment === 'group' ? <GroupFeedPanel /> : <RepHistoryPanel />}
    </div>
  )
}
