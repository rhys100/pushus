import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

export type TabPageMeta = {
  title?: string
  subtitle?: string
  headerTrailing?: ReactNode
}

type TabPageMetaContextValue = {
  meta: TabPageMeta
  setMeta: (meta: TabPageMeta) => void
}

const TabPageMetaContext = createContext<TabPageMetaContextValue | null>(null)

export function TabPageMetaProvider({ children }: { children: ReactNode }) {
  const [meta, setMetaState] = useState<TabPageMeta>({})

  const setMeta = useCallback((next: TabPageMeta) => {
    setMetaState((prev) => {
      // Bail when nothing actually changed so an unchanged re-set doesn't push a
      // new context value and re-render every consumer.
      if (
        prev.title === next.title &&
        prev.subtitle === next.subtitle &&
        prev.headerTrailing === next.headerTrailing
      ) {
        return prev
      }
      return next
    })
  }, [])

  const value = useMemo(
    () => ({
      meta,
      setMeta,
    }),
    [meta, setMeta],
  )

  return (
    <TabPageMetaContext.Provider value={value}>{children}</TabPageMetaContext.Provider>
  )
}

export function useTabPageMetaContext(): TabPageMetaContextValue {
  const context = useContext(TabPageMetaContext)
  if (!context) {
    throw new Error('useTabPageMetaContext must be used within TabPageMetaProvider')
  }
  return context
}

export function useTabPageMeta(meta: TabPageMeta) {
  const { setMeta } = useTabPageMetaContext()

  useEffect(() => {
    setMeta(meta)
    return () => setMeta({})
  }, [meta.title, meta.subtitle, meta.headerTrailing, setMeta])
}
