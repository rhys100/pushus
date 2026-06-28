export type AppVersionPayload = {
  buildId: string
  version?: string
}

export function parseAppVersionPayload(json: unknown): AppVersionPayload | null {
  if (!json || typeof json !== 'object') {
    return null
  }

  const record = json as AppVersionPayload
  const buildId = record.buildId

  if (typeof buildId !== 'string' || !buildId.trim()) {
    return null
  }

  const version =
    typeof record.version === 'string' && record.version.trim() ? record.version.trim() : undefined

  return version ? { buildId: buildId.trim(), version } : { buildId: buildId.trim() }
}

export function isNewerBuild(liveBuildId: string, currentBuildId: string): boolean {
  if (!liveBuildId || !currentBuildId) {
    return false
  }

  if (liveBuildId === 'dev' || currentBuildId === 'dev') {
    return false
  }

  return liveBuildId !== currentBuildId
}
