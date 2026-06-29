import { useEffect } from 'react'
import { formatDocumentTitle } from '@/lib/documentTitle'

export function useDocumentTitle(pageTitle?: string) {
  useEffect(() => {
    const previousTitle = document.title
    document.title = formatDocumentTitle(pageTitle)
    return () => {
      document.title = previousTitle
    }
  }, [pageTitle])
}
