# PushUS design tokens

Dark-first design system for a premium mobile fitness feel.

Tokens live in `src/styles/tokens.css` and are consumed via Tailwind + CSS variables.

## Colour direction (bootstrap default)

- **Background:** dark navy (`#0B1220` range)
- **Accent:** high-energy coral-orange (`#FF6B35`) — document if changed at bootstrap
- **Semantic:** success, warning, danger for streaks, billing banners, errors

## Token categories

| Category | Examples |
|----------|----------|
| Colour | `--color-bg`, `--color-surface`, `--color-accent`, `--color-text` |
| Spacing | `--space-1` … `--space-8` (4px grid) |
| Radius | `--radius-sm`, `--radius-md`, `--radius-lg`, `--radius-full` |
| Typography | `--font-display`, `--font-mono`, `--text-hero` (logger count) |
| Motion | `--duration-fast`, `--duration-normal`, `--ease-out` |

## Mobile layout contract

Shared constants in `src/lib/layout.ts`:

| Constant | Use |
|----------|-----|
| `PAGE_BOTTOM_PADDING` | Long-scroll pages without bottom nav (Settings, About) |
| `PAGE_BOTTOM_PADDING_WITH_NAV` | Standard tab pages |
| `TODAY_BOTTOM_CHROME` | Today page: nav + bank CTA + hint + safe area |
| `TODAY_CONTENT_PADDING` | Main scroll padding on Today |

Rules:

- Bottom nav stays fixed; page headers scroll with content (not sticky)
- Pages with a fixed CTA reserve CTA height + gap in flow and in main padding
- No fixed element may cover interactive content
- Long URLs use `break-all` inside cards
- Minimum 44px touch targets (`min-h-11`, `--bank-cta-height`)

## Mobile quality bar

- Minimum 44px touch targets
- Safe-area insets for iOS home indicator
- Bottom nav must not collide with system UI
- `touch-action: none` on circular logger during drag

## Main CTA

The primary action label is exactly **Bank Push-ups** (not "Bank PushUS").

See the implementation plan section 3 for full UX quality rules.
