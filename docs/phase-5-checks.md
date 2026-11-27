# Phase 5 checks (2026-11-27)

## Lighthouse 13.6.0, production build (`next build && next start`)

| | Performance | Accessibility | Best practices | SEO |
|---|---|---|---|---|
| Mobile (simulated slow 4G) | 59 (was 46) | 100 (was 97) | 100 | 100 |
| Desktop | 85 | 100 (was 97) | 100 | 100 |

What changed:

- **Map layouts are worked out ahead of time.** Each profile has exactly one map
  shape, whatever the traveller has done (checked for every amount of progress),
  so `npm run layouts` runs ELK at build time and saves the three layouts
  (10 KB). The browser no longer downloads ELK (1.4 MB, 427 KB compressed).
  Blocking time on mobile fell from 1,870 ms to 660 ms. A test fails if the data
  changes and the layouts were not regenerated; any unknown shape still falls
  back to ELK in the browser.
- **The graph engine is preloaded.** Relate's WASM now starts downloading at
  69 ms instead of 369 ms.
- **Contrast.** Terracotta, olive and grey text were darkened slightly so every
  text colour passes 4.5:1 on every background in the palette (worst case 4.61).
- **Station names.** Each map station's accessible name now starts with the
  words printed on it, for voice control (WCAG 2.5.3).

What is left, honestly: mobile LCP is about 16 s on Lighthouse's simulated slow
4G because the map needs the Relate engine first, which is 6.8 MB (2.4 MB
gzipped). It downloads once and is then cached. On desktop LCP is 2.7 s.
Lighthouse's experimental "label and name mismatch" check (weight 0) still lists
the stations because it counts hidden decorative text.

## Smoke test (Playwright, installed Chrome)

`npm run test:e2e`: 3 journeys × desktop (1440 px) and phone (375 px, mobile
emulation), 6/6 pass. Found and fixed one real bug: on phones, opening
"How we know" let long Cypher lines widen the whole page to 1,475 px. The test
now checks that the page is never wider than the screen.

A sweep of every view at 375 px with all "details" panels open found no other
sideways overflow.

## MCP

`npm run mcp:build` builds `mcp/paperwork-path.rl` with Relate's native Node
client and checks seven answers against it (same as in the browser). Serving it
with `relate serve --mcp stdio` follows the official docs but has not been run
here, because the Relate CLI is not installed. See [mcp.md](mcp.md).
