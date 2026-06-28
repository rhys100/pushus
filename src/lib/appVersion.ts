export type AppVersionPayload = {
  buildId: string
}

export function parseAppVersionPayload(json: unknown): AppVersionPayload | null {
  if (!json || typeof json !== 'object') {
    return null
  }

  const buildId = (json as AppVersionPayload).buildId

  if (typeof buildId !== 'string' || !buildId.trim()) {
    return null
  }

  return { buildId: buildId.trim() }
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
