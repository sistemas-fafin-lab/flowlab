# design-sync notes — Flow LAB Design System

## Repo shape
- **flowlab is a Vite + React + Tailwind APP, not a component library.** No published
  `dist`/`main`/`module`/`exports`, no Storybook. The sync runs the `package` shape in
  **synth-entry mode** via a hand-written barrel: `.design-sync/ds-entry.tsx`
  (set as `cfg.entry`). The barrel re-exports only the scoped primitives as NAMED exports.
- **Scope is deliberately narrow** (`cfg.componentSrcMap`): the genuinely reusable,
  presentational primitives. The ~70 other components are data-coupled feature screens
  (Supabase/router/env) — intentionally excluded. To add one, add it to BOTH
  `ds-entry.tsx` and `componentSrcMap` (they must agree).

## Component gotchas
- **PageLoadingSkeleton** — its `default` export is a registry OBJECT, not a component.
  We expose its reusable named atoms instead: `SkeletonCard`, `SkeletonListItem`,
  `SkeletonFilters`, `LoadingSpinner`. The app-page composites (`RequestManagementSkeleton`,
  `ProductListSkeleton`, …) are app-specific and excluded.
- **SignatureViewModal** uses `React.FC` but never `import React` — only builds under the
  automatic JSX runtime. `cfg.tsconfig: "tsconfig.json"` (which has `jsx: react-jsx`) is what
  makes esbuild use it. Do not remove `cfg.tsconfig`.
- The 5 dialog/toast primitives (`ConfirmDialog`, `InputDialog`, `Notification`, `DetailModal`,
  `SignatureViewModal`) are `fixed inset-0` overlays gated by an `isOpen`/`isVisible` prop →
  previews pass it `true`. They render fine in a multi-story grid solo, but validate's
  `[GRID_OVERFLOW]` (`escape`, fixed/portal content) always flags them once multiple stories
  share a card — use `cfg.overrides.<Name>: {"cardMode": "single", "primaryStory": "<Name>"}`,
  NOT `"column"` (column still stacks every story in one card and still escapes). Pick
  `primaryStory` as the most representative variant; the others still get authored/graded, just
  not shown on the default card face.
- **DetailModal's mount animation is framer-motion** (`motion.div` with `initial`/`animate`),
  unlike the other 4 overlays which are CSS-only (`animate-fade-in`/`animate-scale-in`). The
  preview wraps it in `<MotionConfig reducedMotion="always">` (see `previews/DetailModal.tsx`)
  — required for the capture harness (see "package-capture.mjs fork" below), harmless in
  production. Don't remove it even though the shipped component renders fine without it in a
  real browser — the capture harness doesn't.

## package-capture.mjs fork — frozen-clock + RAF bug (see `.design-sync/overrides/`)
- The stock capture harness freezes `page.clock` to a fixed timestamp (determinism for
  date-relative preview text) and reuses ONE Playwright `Page` across the `__dsCells` discovery
  navigation and every per-story `?story=` capture navigation. That combination hits a real
  Playwright/Chromium bug: **the second real content-bearing navigation on the same Page never
  fires its `requestAnimationFrame` callbacks**, so any RAF-driven mount animation (framer-motion's
  `initial`→`animate`) freezes at its pre-paint (usually invisible) state — confirmed by
  bisection: removing `setFixedTime` alone fixes it, and so does giving the second navigation a
  fresh `Page` while keeping the clock frozen. `document.fonts.ready`/image-decode/rAF-tick waits
  in `settle()` do NOT help — the DOM/textContent is correct throughout, only the compositor
  paint is stuck, so `package-validate.mjs`'s text-based render check never caught this either.
  **Fix**: the fork gives every navigation (discovery AND each per-story capture) its own fresh
  `Page` (see `freshPage()` in the override). This is package-capture.mjs-specific; validate and
  build never revisit the same rendered content twice in one page, so they don't need the fork.
- **This fork is NOT auto-applied by `resync.mjs`.** `package-build.mjs` checks
  `.design-sync/overrides/` for files named in `cfg.libOverrides` and prints `[OVERRIDE] using
  ...` — but that's just build-time config validation; `resync.mjs` calls `package-capture.mjs`
  via a path hardcoded to its own directory (`.ds-sync/`), not `.design-sync/overrides/`. Before
  running `resync.mjs` (or invoking capture directly for the driver's benefit), overlay the fix:
  ```sh
  cp .design-sync/overrides/package-capture.mjs .ds-sync/package-capture.mjs
  sed -i "s|from '../../.ds-sync/lib/sync-hashes.mjs'|from './lib/sync-hashes.mjs'|; \
          s|from '../../.ds-sync/storybook/http-serve.mjs'|from './storybook/http-serve.mjs'|" \
    .ds-sync/package-capture.mjs
  ```
  (The override's own relative imports are written for its home under `.design-sync/overrides/`
  — `../../.ds-sync/lib/...` — and need repointing to plain `./lib/...` when copied into
  `.ds-sync/`, same as any other forked script per the skill's Troubleshooting section.)
  Running `.design-sync/overrides/package-capture.mjs` directly (not via the driver) needs no
  sed — its own relative imports already resolve correctly from that location.

## Brand layer (CSS)
- Components style via **Tailwind utility classes**. `tailwind.config.js` sets
  `theme.extend = {}` — no custom design tokens, pure stock Tailwind palette. Custom animation
  utility classes live in `src/index.css` (`animate-fade-in`, `animate-scale-in`,
  `animate-slide-in-right`, `animate-bounce-in`, `hover-lift`, `glass`, `skeleton`, …) — a few
  more defined there (`animate-slide-up`, `focus-ring`, `animate-shimmer`, `transition-smooth`,
  `animate-slide-in-left`) aren't referenced by ANY file in `src/`, so Tailwind's content-scan
  purge drops them from the compiled stylesheet entirely — don't reference them in docs/previews,
  they won't actually be styled. (Verified by grepping the compiled `_ds_bundle.css` — see the
  conventions header validation step.)
- `src/index.css` is a Tailwind SOURCE file (`@tailwind` directives) — shipping it raw would
  render previews unstyled. So the brand layer is **compiled** before each build:

  ```sh
  ./node_modules/.bin/tailwindcss -i ./src/index.css -o ./.design-sync/.cache/compiled.css \
    --config ./tailwind.config.js
  ```

  `cfg.cssEntry` points at that compiled file. It is gitignored (under `.cache/`) and MUST be
  regenerated on every sync (see Re-sync risks).
- `darkMode: 'class'` → dark variants live behind `.dark`. Previews render light by default.
- `tailwind.config.js` `content` only globs `./index.html` and `./src/**/*.{js,ts,jsx,tsx}` —
  it does NOT include `.design-sync/previews/**`. Checked (grep) that every utility class used
  only inside the authored previews also appears somewhere in `src/`, so nothing is silently
  dropped today — but a future preview that invents a NEW wrapper class not already used in
  `src/` will render unstyled. Either reuse an existing `src/` class or add the previews glob to
  `tailwind.config.js`'s `content` array.
- No `fonts/` output — the compiled CSS references no custom `@font-face` families (system UI
  font stack only), so `cfg.extraFonts` was never needed and validate never printed
  `[FONT_MISSING]`.

## Build / install
- `node_modules` is already installed (npm; `package-lock.json`). Skip `npm ci` unless module
  resolution fails during the converter build.
- One-off build+validate (from repo root, after staging `.ds-sync/`):
  ```sh
  node .ds-sync/package-build.mjs --config .design-sync/config.json \
    --node-modules ./node_modules --entry ./.design-sync/ds-entry.tsx --out ./ds-bundle
  node .ds-sync/package-validate.mjs ./ds-bundle
  node .design-sync/overrides/package-capture.mjs --out ./ds-bundle   # NOT .ds-sync/package-capture.mjs — see the fork note above
  ```
- Full re-sync (driver) — needs the capture-fork overlay step (see above) done first, then:
  ```sh
  node .ds-sync/resync.mjs --config .design-sync/config.json --node-modules ./node_modules \
    --entry ./.design-sync/ds-entry.tsx --out ./ds-bundle
  ```
  (First sync / no remote project content yet → omit `--remote`. Re-syncs into a non-empty
  project → fetch `_ds_sync.json` first and pass `--remote .design-sync/.cache/remote-sync.json`.)

## Re-sync risks (watch-list for the next run)
- **Tailwind compile is a manual prerequisite.** `cfg.cssEntry` is a gitignored generated
  artifact; if it's missing/stale the brand layer ships wrong. Always re-run the tailwindcss
  compile command above BEFORE the converter (and before `resync.mjs`).
- **`package-capture.mjs` fork must be re-overlaid onto `.ds-sync/` every session** before
  running `resync.mjs` — re-staging `.ds-sync/` from the skill's bundled source (the normal
  first re-sync step) wipes it back to the buggy stock version. See "package-capture.mjs fork"
  above for the exact copy+sed command. Symptom if forgotten: overlay components (especially
  `DetailModal`) capture as blank/backdrop-only and would falsely clear/fail their grade.
- **Barrel ↔ componentSrcMap drift.** Any change to the scoped set must update both
  `.design-sync/ds-entry.tsx` and `cfg.componentSrcMap`.
- **`pkg` is aspirational.** There is no real importable package named `inventory-system`;
  the components live at `src/components/*`. `.prompt.md` import examples will read
  `from 'inventory-system'` — the real usage is documented in the conventions header.
- Component sources can change upstream (these are live app files) — re-grade after a rebuild.
- `.design-sync/conventions.md` is authored (not generated) — future syncs should validate its
  claims against the fresh build (grep classes/tokens/components) rather than rewrite it; see
  the base skill's "Author the conventions header" section for the re-validate flow.
- **`cfg.guidelinesGlob` is pinned to `["docs/DESIGN_SYSTEM_FLOWLAB.md"]`** — the default
  (`docs/*.md`) would sweep up the WHOLE repo's `docs/` folder, which is general project
  documentation (DB schema, messaging architecture, storage config, billing plans), not design
  guidelines. Only `DESIGN_SYSTEM_FLOWLAB.md` ("Guia de Identidade Visual") is actually
  design-relevant. If a new genuinely-design doc appears under `docs/`, add it explicitly to
  this array — don't widen back to a broad glob.
