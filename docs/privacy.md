# PushUS privacy

PushUS is built for **private groups of mates**, not public social networks.

## What we collect

- **Auth:** Email address (via Supabase Auth) for login
- **Profile:** Display name, optional single-letter initial, optional emoji/colour, timezone preference
- **Personal mate labels:** Optional names you set for group members — visible only to you, on the Members list
- **Group data:** Pushup entries, reactions, group membership — scoped to groups you join
- **Billing (Cloud only, Slice 1B):** Stripe customer/subscription metadata linked to group owner

## Friend connections

Friend connections are **not implemented** in beta. If added later, they will require:

- explicit consent for each connection
- privacy controls and block/remove
- a full RLS review (friend graph separate from group membership)
- no public user discovery by default

See [product-roadmap.md](./product-roadmap.md) and [product-decisions.md](./product-decisions.md).

## What we do not do

- No public user discovery or global leaderboard
- No private messaging in early versions
- No selling personal data
- No advertising trackers in the core app

## Data location

Self-hosters control their own Supabase project and region. Cloud deployment region is chosen by the operator.

## Your responsibilities (self-hosting)

If you self-host PushUS, you are the data controller for your instance. Configure Supabase Auth, backups, and retention to match your jurisdiction and group expectations.

## Contact

Document your instance admin contact in your deployment README or About page.
