export type AppAccessStatus = {
  allowed: boolean
  private_beta_enabled: boolean
  can_create_group: boolean
  has_group_access: boolean
  is_allowlisted: boolean
}

export const defaultAppAccess: AppAccessStatus = {
  allowed: true,
  private_beta_enabled: false,
  can_create_group: true,
  has_group_access: false,
  is_allowlisted: false,
}

/** Fail-closed when the server returns an explicit blocked payload. */
export const deniedAppAccess: AppAccessStatus = {
  allowed: false,
  private_beta_enabled: true,
  can_create_group: false,
  has_group_access: false,
  is_allowlisted: false,
}

export function parseAppAccess(data: unknown): AppAccessStatus {
  if (!data || typeof data !== 'object') return deniedAppAccess
  const row = data as Record<string, unknown>
  return {
    allowed: row.allowed === true,
    private_beta_enabled: row.private_beta_enabled === true,
    can_create_group: row.can_create_group === true,
    has_group_access: row.has_group_access === true,
    is_allowlisted: row.is_allowlisted === true,
  }
}
