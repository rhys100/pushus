# PushUS billing

**Status:** Slice 1B implemented.

PushUS Cloud uses group-level Stripe billing. PushUS Community does not require Stripe.

## Source of truth

| Layer | Purpose |
|-------|---------|
| **Database** | Write permissions, deployment mode (`deployment_settings`, subscriptions) |
| **Frontend env** | UI visibility and price labels only (`VITE_*`) |

`can_group_write(group_id)` must **never** read frontend environment variables.

## Community vs Cloud

- **Community:** `deployment_settings.billing_enabled = false`; new groups get `billing_status = exempt`
- **Cloud:** Stripe Checkout + webhooks; new groups start `billing_status = incomplete` until subscription activates

Community seed is inserted by migration `0003_billing.sql` (`deployment_mode = community`, `billing_enabled = false`).

## Database (Slice 1B)

Migration: `supabase/migrations/0003_billing.sql`

Tables:

- `deployment_settings` — singleton; service role write; public read via `deployment_settings_public` or `get_deployment_settings()`
- `billing_customers` — owner read; service role write
- `group_subscriptions` — owner read; service role write
- `billing_events` — webhook idempotency; service role only
- `subscription_overrides` — owner read; service role write

Helpers:

- `group_billing_status(group_id)` — resolved status for UI/RPC
- `can_group_write(group_id)` — write gate using deployment settings, subscriptions, overrides, and grace

Grace uses `deployment_settings.default_billing_grace_days` (default 7) from `group_subscriptions.past_due_since`.

## Stripe in Supabase Edge Functions (Deno)

Supabase Edge Functions run on Deno, not Node. Use the ESM npm specifier:

```typescript
import Stripe from 'npm:stripe@17.3.1'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2024-11-20.acacia',
  httpClient: Stripe.createFetchHttpClient(),
})
```

Do **not** use `require('stripe')` or copy Node-only setup guides into Edge Functions.

Webhook signature verification must use the **raw request body**:

```typescript
const rawBody = await req.text()
const event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret)
```

## Edge Functions

| Function | Auth | Purpose |
|----------|------|---------|
| `create-checkout-session` | User JWT | Owner checkout for incomplete/resume groups |
| `create-customer-portal-session` | User JWT | Owner Stripe Customer Portal |
| `stripe-webhook` | Stripe signature | Idempotent subscription sync |

Edge Function secrets (never in frontend):

```
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
STRIPE_MONTHLY_PRICE_ID
STRIPE_YEARLY_PRICE_ID
STRIPE_CUSTOMER_PORTAL_RETURN_URL
APP_BASE_URL
```

## Frontend env (UI only)

```
VITE_BILLING_ENABLED=false
VITE_BILLING_PROVIDER=stripe
VITE_STRIPE_PUBLISHABLE_KEY=
VITE_MONTHLY_PRICE_LABEL=A$12/month
VITE_YEARLY_PRICE_LABEL=A$99/year
VITE_TRIAL_DAYS=45
```

Route: `/group/billing` (owner only, when `VITE_BILLING_ENABLED=true`).

## Tests

```bash
npm run test:billing
```

Requires local Supabase env:

```
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

Tests skip gracefully when env is missing.

## Tax

Default pricing: A$12/month, A$99/year per group. Configure GST/tax in Stripe before real launch. App logic stays tax-neutral.
