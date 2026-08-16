import { useCallback, useEffect, useSyncExternalStore } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import {
  classifyFlushError,
  pruneExpired,
  readQueue,
  removeQueued,
  replaceQueue,
  shouldKeepAfterFailure,
  type QueuedBank,
} from '@/lib/offlineBankQueue'

/**
 * There was no online/offline awareness anywhere in the app before this —
 * `navigator.onLine` appeared nowhere in src.
 */
export function isOnline(): boolean {
  return typeof navigator === 'undefined' || navigator.onLine !== false
}

function subscribeOnline(callback: () => void): () => void {
  window.addEventListener('online', callback)
  window.addEventListener('offline', callback)
  return () => {
    window.removeEventListener('online', callback)
    window.removeEventListener('offline', callback)
  }
}

export function useOnlineStatus(): boolean {
  return useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine !== false,
    // Server/prerender has no network state; assume online so nothing renders
    // an offline banner that then immediately disappears.
    () => true,
  )
}

// The queue lives in localStorage, so components need a nudge when it changes.
const listeners = new Set<() => void>()
let snapshot: QueuedBank[] = []

function emit(): void {
  snapshot = readQueue()
  listeners.forEach((listener) => listener())
}

function subscribeQueue(callback: () => void): () => void {
  listeners.add(callback)
  return () => {
    listeners.delete(callback)
  }
}

/** Call after any write so every consumer re-reads. */
export function notifyQueueChanged(): void {
  emit()
}

export function useOfflineBankQueue(): QueuedBank[] {
  useEffect(() => {
    // Prune on mount so an expired set never shows in a total it can't reach.
    snapshot = pruneExpired()
    listeners.forEach((listener) => listener())
  }, [])

  return useSyncExternalStore(
    subscribeQueue,
    () => snapshot,
    () => snapshot,
  )
}

/** Seed the module snapshot before first render so totals are right immediately. */
snapshot = typeof window === 'undefined' ? [] : readQueue()

export function useFlushOfflineBanks() {
  const queryClient = useQueryClient()

  return useCallback(async (): Promise<number> => {
    if (!isOnline()) {
      return 0
    }

    const queue = pruneExpired()
    if (queue.length === 0) {
      return 0
    }

    let flushed = 0
    const touchedGroups = new Set<string>()

    for (const item of queue) {
      try {
        const { error } = await supabase.rpc('bank_pushups', {
          p_group_id: item.groupId,
          p_count: item.count,
          p_is_max_checkin: item.isMaxCheckin,
          p_logged_for: item.loggedFor,
        })

        if (error) {
          throw error
        }

        removeQueued(item.id)
        touchedGroups.add(item.groupId)
        flushed += 1
      } catch (error) {
        const outcome = classifyFlushError(error)

        if (shouldKeepAfterFailure(item, outcome)) {
          // Count the attempt so a permanently failing item eventually stops.
          replaceQueue(
            readQueue().map((row) =>
              row.id === item.id ? { ...row, attempts: row.attempts + 1 } : row,
            ),
          )
        } else {
          removeQueued(item.id)
        }

        // A transport failure means the connection went away again — stop
        // rather than burning through the rest of the queue failing each one.
        if (outcome === 'retry') {
          break
        }
      }
    }

    notifyQueueChanged()

    if (flushed > 0) {
      for (const groupId of touchedGroups) {
        void queryClient.invalidateQueries({ queryKey: ['today'] })
        void queryClient.invalidateQueries({ queryKey: ['leaderboard'] })
        void queryClient.invalidateQueries({ queryKey: ['activityFeed', groupId] })
        void queryClient.invalidateQueries({ queryKey: ['repHistory'] })
      }
    }

    return flushed
  }, [queryClient])
}
