# AGENTS.md

## Learned User Preferences

- Preview redesigns under versioned subdirectory URLs (e.g. `/v2/`, `/v3/`) before any cutover; keep the live root homepage untouched until explicit approval.
- After explicit approval, promote the approved versioned preview to root `/` and keep the prior homepage available under `/v1/` (or the matching version folder).
- Commit and push directly to `origin/master` — Hostinger auto-deploys on push via webhook.
- Follow the museum-archive art direction: restrained, scholarly, never neon/cyberpunk; oil-slick iridescence (petroleum/emerald/bronze/violet) only as subtle accents on borders, hovers, and glass; context/disclaimer panels use warm archival inset styling (`--panel-soft`, muted rust left rule), not cold grey or alarmist warning boxes.
- Use DIN 1451 Engschrift for display/headings/nav/kickers/CTAs and DIN 1451 Mittelschrift for body/prose; prefer self-hosting real woff2 fonts over CDN fallbacks.
- Keep header text solid deep oxblood/cadmium red (e.g. `#5C1518` or v5 hero `#8F2A1D`) — no iridescent/chromatic text-shadow rims on headings.
- The edge-aura viewport glow must hug the top edge (`inset: 0`, `topEdgeFade: 0`) with no gap under browser chrome, tuned to the archive palette rather than bright neon.
- Avoid inventing finished content or reference photos; use "forthcoming / active file" language when real material is missing; when Alexandria supplies finished prose or blog subheaders, keep them intact with exact wording and German umlauts — never let AI rewrite published poems or prose; keep captions free of mojibake/odd non-ASCII and preserve intentional label spacing.
- Bump cache-bust query params on `index.html` for CSS/JS whenever assets change.
- At half-width/narrow viewports, prevent large display headings and nav marks from clipping or overflowing; prefer reference photos larger and less aggressively cropped; keep blog media sets post-specific (e.g. prose vs interview) and never merge assets meant for separate posts.
- Visitor comments belong on Field Notes posts only — require email, use Cloudflare Turnstile, moderate via dashboard.
- Footer Venmo QR: keep a white background on the QR image for scannability; render "Support my art" and the handle as real centered page text, not baked into the image.

## Learned Workspace Facts

- `youarestillinsideit.com` is an archival art site centered on the Eastern Front and Stalingrad (the "Lethe" series); contact via `feldpost@youarestillinsideit.com`, Instagram `@__stalingrad_`.
- GitHub repo is `multidimensionalinteractive/lethe-site`; local working copy is `C:\Users\matth\OneDrive\Documents\lethe-site-git`; hosted on Hostinger (auto-deploys from `master` push).
- Live homepage at root `/` is the v5 redesign; prior homepage preserved at `/v1/`. Other previews: `/v2/` (museum-archive), `/v3/` (continuous-scroll), `/v4/` (archive-remnant), `/v5/` (preview mirror of the live redesign).
- Legacy root CSS/JS for Dispatches and Field Observations live as `styles-v1.css` / `script-v1.js` at repo root so those sections keep the pre-v5 look.
- Git tags `pre-museum-redesign`, `pre-v4-redesign`, `pre-v5-redesign`, `pre-v5-homepage-cutover`, and branch `archive/v1-live` on origin serve as revert points.
- v2 design tokens: archival charcoal `#161616`, oxidized rust `#8F3428`, museum paper `#F2EEE5`, iridescent accents (petroleum/emerald/bronze/violet), DIN 1451 fonts self-hosted under `v2/fonts/`.
- `edge-aura` (edge-aura.js.org) is loaded as an ESM from esm.sh via `v2/edge-aura-init.js`.
- Private dashboard CMS lives at `/dashboard/` on the live site (access-code unlock) and talks to the `mdi.io/lethe-dashboard` API for entry editing, comment moderation, and newsletter compose/send (double opt-in top signup strip on homepage); code under `dashboard/` and `server/lethe-dashboard/`, separate from the public site.
- Site redesign art direction and Field Notes/prose content are authored by the user's girlfriend, Alexandria.
- Live homepage includes a verbatim "A note on context" panel after THE WORK and before WORKS; footer has a centered "Support my art" Venmo block (`@Stalingrad_` / Ostfront Artist) with `assets/venmo-qr.png`.
- On the live/v5 homepage, the hero uses a photographic (non-map) background; the Stalingrad map appears as a lower-section background with a darker overlay so overlaid text pops.
- Field Observations hosts Field Archive prose (e.g. `field-observations/the-interior-front/` — August 1942 elegy); the interview is a separate post/section with its own media set; Field Notes posts support moderated visitor comments (email required, Turnstile).
