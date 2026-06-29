export type ProfileNameFields = {
  display_name: string
  name_initial?: string | null
}

export function formatProfileName({ display_name, name_initial }: ProfileNameFields): string {
  const trimmed = display_name.trim()
  const initial = name_initial?.trim().toUpperCase()

  if (initial && /^[A-Z]$/.test(initial)) {
    return `${trimmed} ${initial}`
  }

  return trimmed
}

/** Members list: optional viewer alias overrides formatted profile name. */
export function formatMemberListName(
  profile: ProfileNameFields,
  viewerAlias?: string | null,
): string {
  const canonical = profile.display_name.trim()
  const alias = viewerAlias?.trim()

  if (alias) {
    return `${alias} (${canonical})`
  }

  return formatProfileName(profile)
}
