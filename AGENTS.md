# AGENTS.md

## Learned User Preferences

- Preview redesigns under versioned subdirectory URLs (e.g. `/v2/`, `/v3/`) before any cutover; keep the live root homepage untouched until explicit approval.
- Commit and push directly to `origin/master` — Hostinger auto-deploys on push via webhook.
- Follow the museum-archive art direction: restrained, scholarly, never neon/cyberpunk; oil-slick iridescence (petroleum/emerald/bronze/violet) only as subtle accents on borders, hovers, and glass.
- Use DIN 1451 Engschrift for display/headings/nav/kickers/CTAs and DIN 1451 Mittelschrift for body/prose; prefer self-hosting real woff2 fonts over CDN fallbacks.
- Keep header text solid deep oxblood/cadmium red (e.g. `#5C1518`) — no iridescent/chromatic text-shadow rims on headings.
- The edge-aura viewport glow must hug the top edge (`inset: 0`, `topEdgeFade: 0`) with no gap under browser chrome, tuned to the archive palette rather than bright neon.
- Avoid inventing finished content; use "forthcoming / active file" language when real material is missing.
- Bump cache-bust query params on `index.html` for CSS/JS whenever assets change.

## Learned Workspace Facts

- `youarestillinsideit.com` is an archival art site centered on the Eastern Front and Stalingrad (the "Lethe" series); contact via `feldpost@youarestillinsideit.com`, Instagram `@__stalingrad_`.
- GitHub repo is `multidimensionalinteractive/lethe-site`; local working copy is `C:\Users\matth\OneDrive\Documents\lethe-site-git`; hosted on Hostinger (auto-deploys from `master` push).
- Site versions live side by side: root `/` (v1 live), `/v2/` (museum-archive redesign), `/v3/` (continuous-scroll redesign), and `/v4/` (planned archive-remnant redesign).
- Git tag `pre-museum-redesign` and branch `archive/v1-live` on origin serve as the pre-redesign revert point.
- v2 design tokens: archival charcoal `#161616`, oxidized rust `#8F3428`, museum paper `#F2EEE5`, iridescent accents (petroleum/emerald/bronze/violet), DIN 1451 fonts self-hosted under `v2/fonts/`.
- `edge-aura` (edge-aura.js.org) is loaded as an ESM from esm.sh via `v2/edge-aura-init.js`.
- The repo contains a private dashboard area (`dashboard/`, `server/lethe-dashboard/`) separate from the public site.
- Site redesign art direction is authored by the user's girlfriend, Alexandria.
