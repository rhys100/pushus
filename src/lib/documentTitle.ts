import { appConfig } from '@/lib/config'

export function formatDocumentTitle(
  pageTitle?: string,
  appName: string = appConfig.name,
): string {
  return pageTitle ? `${pageTitle} · ${appName}` : appName
}

export function resolveAppLayoutDocumentTitle(
  title: string | null | undefined,
  activeGroupName: string | undefined,
  isTodayRoute: boolean,
): string | undefined {
  if (isTodayRoute) {
    return activeGroupName ?? 'Today'
  }
  if (title === null) {
    return undefined
  }
  return title ?? activeGroupName ?? undefined
}
