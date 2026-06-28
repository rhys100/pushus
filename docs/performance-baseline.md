# Performance baseline (pre-optimisation)

Recorded before mobile performance pass implementation.

## Bundle sizes (production build)

| Asset | Raw | Gzip |
|-------|-----|------|
| index-B__fuLJI.js (main) | 334.36 kB | 101.20 kB |
| TodayPage-CIt653rC.js | 18.01 kB | 5.95 kB |
| GroupPage-DqIoO-8i.js | 10.25 kB | 3.29 kB |
| ActivityPage-BrF4sOgs.js | 8.67 kB | 3.31 kB |
| LeaderboardPage-DxXWfsId.js | 4.50 kB | 2.05 kB |
| index-DduQ_e7p.css | 23.78 kB | 5.49 kB |

## Known bottlenecks (static analysis)

- Full-page re-render at ~60fps during drag (angle state in TodayPage)
- onSettled invalidates today queries after every bank/undo despite optimistic updates
- AppLayout remounts on every tab switch
- Today lazy-loaded with Suspense spinner
- Broad cache invalidation in GroupProvider and activity reactions
- Group members refetchOnMount always
- SVG glow filter during drag
