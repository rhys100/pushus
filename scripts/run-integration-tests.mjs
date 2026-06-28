#!/usr/bin/env node
/**
 * Run RLS + billing integration tests against local Supabase.
 * Fails if Supabase is not running or env keys cannot be resolved.
 */
import { execSync, spawnSync } from 'node:child_process'

function loadSupabaseStatus() {
  try {
    const raw = execSync('npx supabase status -o json', {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    return JSON.parse(raw)
  } catch {
    console.error(
      'Integration tests require local Supabase.\n' +
        '  npx supabase start\n' +
        '  npx supabase db reset',
    )
    process.exit(1)
  }
}

const status = loadSupabaseStatus()

process.env.SUPABASE_URL = status.API_URL
process.env.SUPABASE_ANON_KEY = status.ANON_KEY
process.env.SUPABASE_SERVICE_ROLE_KEY = status.SERVICE_ROLE_KEY

if (
  !process.env.SUPABASE_URL ||
  !process.env.SUPABASE_ANON_KEY ||
  !process.env.SUPABASE_SERVICE_ROLE_KEY
) {
  console.error('Could not resolve Supabase keys from `supabase status`')
  process.exit(1)
}

console.log('Running integration tests against', process.env.SUPABASE_URL)

const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const steps = ['run test:rls', 'run test:billing']

for (const step of steps) {
  const result = spawnSync(npmCmd, step.split(' '), {
    stdio: 'inherit',
    env: process.env,
    shell: process.platform === 'win32',
  })
  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}

console.log('Integration tests passed.')
