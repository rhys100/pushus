#!/usr/bin/env node
/**
 * Push the hosted Supabase Magic Link (OTP) email template from the repo.
 *
 * Requires a personal access token from:
 * https://supabase.com/dashboard/account/tokens
 *
 * Usage:
 *   SUPABASE_ACCESS_TOKEN=... npm run auth:push-email-template
 *   SUPABASE_ACCESS_TOKEN=... npm run auth:push-email-template -- --template hybrid
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = process.cwd()
const DEFAULT_PROJECT_REF = 'zcwvvhuihqlldnbwhivl'
const SUBJECT = 'Your PushUS sign-in code'

const TEMPLATE_FILES = {
  magic_link: {
    html: 'supabase/templates/magic_link.html',
    text: 'supabase/templates/magic_link.txt',
  },
  hybrid: {
    html: 'supabase/templates/magic_link_hybrid_rollout.html',
    text: null,
  },
}

function readProjectRef() {
  const fromEnv = process.env.SUPABASE_PROJECT_REF?.trim()
  if (fromEnv) return fromEnv

  const config = readFileSync(resolve(root, 'supabase/config.toml'), 'utf8')
  const match = config.match(/\[remotes\.production\][\s\S]*?project_id\s*=\s*"([^"]+)"/)
  return match?.[1] ?? DEFAULT_PROJECT_REF
}

function parseTemplateArg() {
  const idx = process.argv.indexOf('--template')
  const value = idx === -1 ? 'magic_link' : process.argv[idx + 1]
  if (!value || !(value in TEMPLATE_FILES)) {
    console.error('Usage: npm run auth:push-email-template -- [--template magic_link|hybrid]')
    process.exit(1)
  }
  return value
}

function readTemplateFile(relativePath) {
  return readFileSync(resolve(root, relativePath), 'utf8').trim()
}

async function main() {
  const token = process.env.SUPABASE_ACCESS_TOKEN?.trim()
  if (!token) {
    console.error(
      'Missing SUPABASE_ACCESS_TOKEN.\n' +
        'Create one at https://supabase.com/dashboard/account/tokens then run:\n' +
        '  SUPABASE_ACCESS_TOKEN=... npm run auth:push-email-template',
    )
    process.exit(1)
  }

  const templateKey = parseTemplateArg()
  const files = TEMPLATE_FILES[templateKey]
  const projectRef = readProjectRef()
  const html = readTemplateFile(files.html)
  const text = files.text ? readTemplateFile(files.text) : null

  const payload = {
    mailer_subjects_magic_link: SUBJECT,
    mailer_templates_magic_link_content: html,
  }

  const url = `https://api.supabase.com/v1/projects/${projectRef}/config/auth`
  const response = await fetch(url, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const body = await response.text()
    console.error(`Supabase config update failed (${response.status}):`, body)
    process.exit(1)
  }

  console.log(`Updated hosted Magic Link template on ${projectRef}`)
  console.log(`  subject: ${SUBJECT}`)
  console.log(`  template: ${files.html}`)
  if (text) {
    console.log('')
    console.log('Plain-text companion (paste into dashboard Text tab if shown):')
    console.log('---')
    console.log(text)
    console.log('---')
    console.log(
      'Note: the Management API only stores the HTML body. Supabase derives plain text for most clients.',
    )
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
