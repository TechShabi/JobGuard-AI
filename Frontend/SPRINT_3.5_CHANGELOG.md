# Sprint 3.5 — Product UI Consistency & Premium SaaS Polish

Changelog. No architecture, routing, API, backend, or business-logic changes were made — this was a polish/consistency pass on `scam-detector-frontend` only, built on top of the design-token system already established in Sprint 3.

---

## 1. Color system consistency

The project already had a full semantic color-token system in `src/index.css`
(`--cyan`, `--purple`, `--fuchsia`, `--indigo`, `--green`, `--orange`, `--amber`,
`--red`, each with light/dark theme values). The problem wasn't a missing
system — it was pages bypassing it with literal hex values that happened to
match the tokens' *light-theme* value, which meant they silently stopped
adapting in dark mode.

- Replaced **~165 hardcoded hex color values** with their matching `var(--token)`
  across `Scanner.jsx` (45), `Dashboard.jsx` (10), `PricingPage.jsx`,
  `Community.jsx`, `Profile.jsx`, `Register.jsx`, `ResumeReview.jsx`,
  `InterviewPreparation.jsx`, `VerifyDescription.jsx`, `VerifyImage.jsx`,
  `publicLayout.jsx`, `Navbar.jsx`, `ResultPrimitives.jsx`,
  `VerificationResultPanel.jsx`, `UpgradeModal.jsx`.
- Converted raw Tailwind palette utilities (`text-cyan-500`, `bg-red-500`,
  `from-purple-500 to-cyan-500`, `ring-cyan-500/20`, `shadow-cyan-500/20`, etc.)
  to the equivalent `[var(--token)]` arbitrary-value classes, for the same
  reason — Tailwind's built-in palette doesn't know about the app's
  `data-theme` toggle.
- Added `--plan-starter-bg` / `--plan-plus-bg` / `--plan-pro-bg` tokens
  (light + dark) and removed the duplicate `PLAN_ICON_BG_LIGHT` /
  `PLAN_ICON_BG_DARK` JS lookup tables in `PricingPage.jsx` that had to be
  hand-kept in sync — one theme-aware token per plan now.
- Detokenized `.pricing-scan-count` and `.pricing-val-*` colors the same way,
  which let five redundant `[data-theme="dark"]` override blocks be deleted.
- Left three categories of color alone, on purpose (documented under
  "Left for Sprint 4" below): neutral white/black surface colors, ~15 gradient
  stops that use non-brand Tailwind hues (blue-600, pink-600, red-600), and
  the `.pricing-compare-th.go-col` gradient.

**Left intentionally unconverted (documented, not silently skipped):** a
handful of gradient stops using Tailwind hues with no existing brand token
(`blue-600`, `pink-600`, `red-600` in `HowItWorks.jsx`, `VerifyDescription.jsx`,
`Dashboard.jsx`). These are still within the app's cyan/purple/fuchsia/indigo
hue family, not truly random colors — converting them cleanly would mean
inventing several new gradient tokens and touching ~15 more call sites, which
felt like more risk than value for this pass.

## 2. Button system

Added the missing tiers to the button hierarchy — `.btn-primary` and
`.btn-secondary` already existed and were left untouched:

- **`.btn-danger`** — solid, for high-emphasis destructive actions.
- **`.btn-danger-ghost`** — low-emphasis destructive actions sitting in a toolbar.
- **`.btn-link`** — inline text actions ("Learn More", "Sign in").
- **`.btn-icon` / `.btn-icon-sm`** — icon-only square controls (close, delete-row).
- **Shared states added across every tier for the first time:**
  `:focus-visible` (keyboard outline), `:active` (press feedback),
  `:disabled` (0.5 opacity, `cursor: not-allowed`, no hover transform), and
  a `[data-loading="true"]` spinner state (pair with `aria-busy="true"` in
  markup) that swaps button text for a centered spinner without changing
  the button's dimensions.

Fixed three real hierarchy mismatches found in the audit:
- **Profile → Logout** was styled as neutral `.btn-secondary`. Logout is
  explicitly a Danger-tier action per the brief; recolored to the logout
  red/border tokens while keeping the same pill shape and size (a full
  solid `.btn-danger` felt too alarming for a routine, reversible action —
  documented as a judgment call, easy to revisit).
- **History → delete entry** was `.btn-ghost` (neutral). Switched to
  `.btn-icon` with red coloring.
- **Dashboard → delete scan** had ~10 lines of hand-rolled inline styles
  duplicating what the new `.btn-icon` class now provides. Replaced, and
  added a proper `aria-label` (it only had a `title` before).
- `.dashboard-logout` (used for the main Sign Out button) was already
  correctly on the danger palette — just missing `:focus-visible` and
  `:disabled`, which were added.

## 3. Terminology consistency

`HomePage.jsx` had four user-facing instances of "Career Context" / "Smart
Career Context" / "Current Career Context" — inconsistent with the brief's
canonical example ("Current Career Focus"). Renamed all four to "Career
Focus" / "Smart Career Focus" / "Current Career Focus". Everywhere else,
"Career Session" terminology was already fully consistent (Pricing, Profile,
`AuthContext.jsx` upgrade-prompt copy) — no "credits" or "tokens" leaking to
users anywhere.

## 4. Pricing & Profile — no more raw session numbers

- Added a shared `SESSION_TIER_LABEL` map (`starter → "Limited Career
  Sessions"`, `plus → "More Career Sessions"`, `pro → "Maximum Career
  Sessions"`), defined once in `PricingPage.jsx` and mirrored in
  `Profile.jsx`.
- **Pricing cards:** the per-plan session row (`⚡ Every month`) now shows
  the tier label instead of `` `${plan.sessionsPerCycle} Sessions` `` or
  `"Unlimited"`.
- **Pricing comparison table:** the "Career Sessions / month" row's `20`,
  `150`, and `"Unlimited"` literals are now the same three tier labels
  (row relabeled "Career Session Allowance" to read correctly with the new
  values).
- **Profile usage widget:** replaced `"{used} used · {remaining} remaining
  of {limit}"` with the tier label. The progress bar stays — it's a visual
  proportion, not a number in text, so it still gives a sense of usage
  without exposing a count. Removed the now-unused `sessionsRemaining` /
  `sessionsLimit` display locals.
- `.pricing-scan-row` and `.pricing-scan-count` were sized for short text
  like "150 Sessions"; added `flex-wrap` / `white-space: normal` so the
  longer tier phrases wrap cleanly instead of overflowing the card.

## 5. Dead code / visual debt removed

- **`src/utility/scanManager.js`** and **`src/utity/scanManager.js`** — two
  duplicate, typo-named directories (`utility` and `utity`, alongside the
  real `utils`), each holding a `scanManager.js` with **zero references
  anywhere in the codebase** (verified with a full-project grep before
  removal). Removed both.
- A ~35-line block of fully commented-out dead code (`FeaturesLink`) in
  `Navbar.jsx`.
- Five redundant `[data-theme="dark"]` color-override blocks in
  `index.css`'s pricing styles, now handled automatically by the
  theme-aware tokens they duplicated.

**Found but intentionally left in place** (lower confidence, higher blast
radius — flagged for Sprint 4 instead of removed):
- `src/services/api.service.js` — **0 bytes**, empty, unused (superseded by
  `api.js`). Safe to delete; left as a documented recommendation rather than
  removed unreviewed.
- `src/components/common/RoleSearch.jsx` — a real, non-trivial component
  (~4.4 KB) with zero import references anywhere in `src/`, likely
  superseded by `HybridAutocomplete.jsx` / `SkillsAutocomplete.jsx`. Worth a
  deliberate look before deleting a full component, so it's flagged rather
  than removed in this pass.

## 6. Accessibility touch-ups

- Added `aria-label`s to two icon-only delete buttons (Dashboard, History)
  that previously relied on `title` alone.
- `:focus-visible` outlines added across every button tier (previously only
  present on whichever elements happened to inherit a browser default).

## 7. What did *not* change

Per the brief's non-negotiable rules: no architecture, routing, API,
backend, or business-logic changes. No component was rewritten from
scratch — every change is either a class-name swap, a token substitution,
or an additive CSS rule. `.btn-primary`, `.btn-secondary`, `.btn-ghost`,
`.badge`, `.form-input`, `.tool-card` / `.input-panel`, `.result-panel`, and
`.dash-empty` were already a coherent shared system from the prior sprint
and were left as-is.

---

## Build verification

**`npm install` could not be run in this environment** — the sandbox's
network egress is restricted to a fixed allow-list and `registry.npmjs.org`
isn't on it (`403 host_not_allowed`). No `node_modules` directory exists to
fall back on. This is an environment limitation, not a project issue —
`package.json` / `package-lock.json` are untouched, so `npm install && npm
run build` should succeed in a normal environment exactly as it did before
this sprint.

As the closest available substitute, two static verifications were run
against every file in `src/` (40 files):

1. **Full-project syntax/AST validation** — `tsc --noEmit --allowJs --jsx
   react-jsx --noResolve` across every `.js`/`.jsx` file in `src/`
   (`--noResolve` parses each file standalone without needing installed
   dependencies, so it can't validate imports, but it does fully validate
   JS/JSX syntax — mismatched braces, broken tags, incomplete edits).
   **Result: zero errors.**
2. **CSS brace balance** on `index.css` after all manual edits: 1,139 open
   braces / 1,139 close braces. **Balanced.**
3. Every new `var(--token)` reference introduced this sprint was checked
   against its definition in `index.css` to confirm it resolves (light +
   dark).

If you can run `npm install && npm run build` locally or in CI, that's the
real confirmation — everything here points to it passing, but I want to be
upfront that I couldn't execute it myself in this sandbox.

## Dark mode / light mode / responsive

No browser or screenshot tool is available in this environment, so this
wasn't verified visually. What *is* true: the color pass converts static
hex values to tokens specifically because they were **not** adapting to
dark mode before — that was the concrete bug, and it's now fixed at the
source (the token itself carries the light/dark distinction, rather than
each call site needing its own override). Existing responsive classes and
breakpoints were left untouched. A real pass in a browser across
breakpoints and both themes is the honest next step before shipping —
flagged below.

---

## Left for Sprint 4 / recommended before shipping

1. **Run the actual build.** `npm install && npm run build` in an
   environment with registry access — this is the one item on the original
   checklist I genuinely could not do myself.
2. **Visual QA pass** — dark/light mode and mobile/tablet/desktop
   breakpoints, in a real browser, across all 16 pages. Everything in this
   sprint was verified statically (syntax, token resolution); nothing was
   verified visually.
3. **Icon size normalization.** The design system defines `--icon-sm: 14px`,
   `--icon-md: 18px`, `--icon-lg: 24px`, `--icon-xl: 32px`, but the app
   actually uses 14 different `size=` values on `lucide-react` icons (12,
   13, 15, 16, 20, 22, 28, 30, 36, 40 all appear, alongside the four
   canonical sizes). Normalizing ~250 individual icon call sites to the
   4-value scale is real, valuable work — it just needs visual QA per
   change to confirm nothing misaligns with surrounding text/padding, which
   wasn't safe to do blind in this pass.
4. **~15 remaining gradient stops** using non-brand Tailwind hues (see
   §1 above) — convert once new gradient tokens are agreed on.
5. **Delete `api.service.js` (empty, unused) and evaluate `RoleSearch.jsx`**
   (unused, real component) — see §5.
6. **A full card/form/modal/badge/table/empty-state audit** at the depth the
   original brief describes (every modal, every tooltip, every breakpoint)
   is a multi-day effort on a 9,000+ line frontend; this sprint covered the
   color system, button hierarchy, terminology, and pricing/profile wording
   in depth, plus spot-fixes elsewhere, but didn't re-review every single
   card/modal/table instance individually.
