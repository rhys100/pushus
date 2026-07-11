import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('passwordless email template', () => {
  const config = readFileSync(resolve(process.cwd(), 'supabase/config.toml'), 'utf8')
  const template = readFileSync(
    resolve(process.cwd(), 'supabase/templates/magic_link.html'),
    'utf8',
  )
  const rolloutTemplate = readFileSync(
    resolve(process.cwd(), 'supabase/templates/magic_link_hybrid_rollout.html'),
    'utf8',
  )

  it('configures a six-digit OTP and the repository template', () => {
    expect(config).toContain('otp_length = 6')
    expect(config).toContain('[auth.email.template.magic_link]')
    expect(config).toContain('content_path = "./supabase/templates/magic_link.html"')
  })

  it('uses a code-only email so link scanners cannot consume the OTP', () => {
    expect(template).toContain('{{ .Token }}')
    expect(template).not.toContain('{{ .ConfirmationURL }}')
    expect(template).toContain('Home Screen app')
  })

  it('keeps a hybrid template for zero-downtime production rollout', () => {
    expect(rolloutTemplate).toContain('{{ .Token }}')
    expect(rolloutTemplate).toContain('{{ .ConfirmationURL }}')
  })
})
