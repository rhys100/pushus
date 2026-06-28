/** App config from public env vars only */
export const appConfig = {
  url: import.meta.env.VITE_APP_URL?.replace(/\/$/, '') ?? '',
  name: import.meta.env.VITE_APP_NAME ?? 'PushUS',
  deploymentName: import.meta.env.VITE_DEPLOYMENT_NAME ?? 'PushUS',
  sourceRepoUrl: import.meta.env.VITE_SOURCE_REPO_URL ?? '',
  isModifiedFork: import.meta.env.VITE_IS_MODIFIED_FORK === 'true',
  billingEnabled: import.meta.env.VITE_BILLING_ENABLED === 'true',
  googleAuthEnabled: import.meta.env.VITE_GOOGLE_AUTH_ENABLED === 'true',
} as const
