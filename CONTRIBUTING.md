# Contributing to PushUS

Thanks for your interest in PushUS. This project is open source under **AGPL-3.0-only**.

## Licence

By contributing code, documentation, or other materials, you agree that your contributions are licensed under the same licence as the project: **AGPL-3.0-only**.

There is **no Contributor Licence Agreement (CLA)**.

## Before you start

1. Read [README.md](README.md) and [docs/security.md](docs/security.md).
2. Check open issues or discuss larger changes before investing significant time.
3. Do **not** commit secrets, `.env` files, API keys, or service role keys.

## Development setup

```bash
npm install
cp .env.example .env
# Add your Supabase URL and anon key only — never the service role key in frontend .env
supabase start
npm run dev
```

## Code guidelines

- Match existing style and naming in the area you edit.
- Keep changes focused — one slice or fix at a time.
- RLS and write RPCs must enforce permissions server-side; frontend checks are UX only.
- Use Australian English in user-facing copy where practical.

## Tests

Run relevant tests before opening a PR:

```bash
npm run test
npm run test:rls      # required for changes touching RLS or group data access
npm run test:billing  # required for Slice 1B billing changes only
```

## Pull requests

- Describe what changed and why.
- Note any migration or env var changes.
- Include screenshots for UI changes (mobile width preferred).
- Confirm you have not included secrets.

## Security issues

Do not open public issues for security vulnerabilities. Contact the maintainers privately with details and reproduction steps.

## Questions

Open a GitHub issue for bugs and feature discussions aligned with the project roadmap.
