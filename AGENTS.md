# Working on Code Loupe

Code Loupe is an embeddable teaching tool that makes program execution visible.
Teachers author explanations; students step through them at their own pace.
The current player consumes authored YAML steps. It does not execute the displayed code.
Live tracing and trace-to-authored-lesson conversion are future work.

## Working style

- Develop through focused pair-programming sessions. Explain meaningful choices
  and keep changes small enough to discuss and review together.
- Follow the user's requested scope; roadmap entries are plans, not instructions
  to implement unrelated features.
- Preserve teacher control over pacing, emphasis, captions, and level of detail.
- Keep embedding simple and avoid introducing framework or backend dependencies
  without a concrete need.
- Keep accessibility, keyboard use, and reduced motion in mind when changing visuals.

## Architecture

This is an npm workspace monorepo:

- `packages/player/src/lesson.ts`: YAML lesson types and parsing.
- `packages/player/src/state.ts`: pure step-to-snapshot generation and semantic
  validation. Full snapshots make backward stepping and scrubbing lookups.
- `packages/player/src/code-loupe.ts`: `CodeLoupe`, the `<code-loupe>` web
  component; loading, rendering, animation, playback, and viewer preferences.
- `packages/player/src/values.ts`, `styles.ts`, `index.ts`: value formatting,
  component styles, and browser entry/registration.
- `packages/player/src/themes.ts`: DOM-independent starter palettes and syntax
  themes shared with the site. Keep regular Shiki theme names working.
- `packages/player/src/visuals/`: pure call-frame scope helpers, the Call stack
  panel and its animations, collection helpers/transitions, dictionary field
  and instance attribute/constructor helpers, and object identity helpers/panel.
  Variables hold references; list contents or scalar named fields live once in each
  snapshot's heap. Ordinary list values remain independent authored values.
  Keep browser panel imports out of the pure state path.
- `apps/site/`: Astro static gallery, sample pages, authoring guide, and playground.
  Import the browser player only in client scripts; its entry depends on DOM globals.
  Build-time validation uses `code-loupe/lesson` and `code-loupe/state` instead.
- `lessons/<language>/<slug>/`: each sample's canonical `lesson.yaml` and `index.md`
  metadata/teaching notes. Downloads and previews use that same YAML source.

Keep snapshot generation independent of the DOM and animation timing. Rendering
and animations consume snapshots; they must not determine lesson state. Future
tracers should feed the same player rather than create separate renderers.

## Commands and validation

Run commands at the repository root:

- `npm install`: install and link both workspaces.
- `npm run dev`: run the Astro sample site and playground at localhost:5173.
- `npm run typecheck`: check the player and Astro site.
- `npm test`: run snapshot, scope, call/return, and theme checks with Node and tsx.
- `npm run typecheck:browser`: check the browser suite and Playwright configuration.
- `npm run test:e2e`: build both outputs and run behavioral browser checks.
- `npm run verify`: unit tests, browser types, full build/type checks, and all browser/visual checks.
- `npm run test:docker`: run verification in the pinned CI-matched Playwright image.
- `npm run test:visual:update`: explicitly regenerate visual references in that image.
- `npm run build`: build both workspaces.
- `npm run build:player`: build `packages/player/dist/code-loupe.js` and its assets.
- `npm run build:site`: build the static site into `apps/site/dist/`.
- `npm run build:playground`: compatibility alias for the site build.

The site build validates sample metadata and runs all canonical lessons through
snapshot generation. Run the full build after workspace changes; use the relevant
workspace build for focused changes. Astro's checker uses TypeScript 5.9;
player checking uses its workspace-local TypeScript 7 compiler.

The checked-in Playwright suite lives in `tests/browser/`. Behavioral checks run
with full and reduced motion. Visual comparisons use reviewed PNG references
under `tests/browser/__screenshots__/`, generated in the pinned Playwright Docker
image. Run `npm run test:docker` for player/site changes; see `docs/testing.md` for
setup, focused commands, failure reports, and baseline updates. Never regenerate
references merely to hide a failure. Report completed checks and any checks not
completed. Extend the suite when introducing new player behavior.
Snapshot tests live in `packages/player/tests/state.test.ts`; run them after
changes to lesson actions, scope, or snapshot generation.
Theme checks in `packages/player/tests/themes.test.ts` cover palette contrast and
real syntax/literal highlighting. Run them when changing a preset; also verify
theme switching preserves the player's current step and playground draft.

## Documentation

- `README.md`: current usage, embedding API, and lesson format.
- `docs/roadmap.md`: ambitions, open questions, and implementation status.
- `docs/samples.md`: adding a canonical lesson to the comparison corpus.
- `docs/styling.md`: starter presets, site theme selection, and styling boundaries.
- `docs/testing.md`: verification pipeline, browser coverage, and visual baselines.
- `docs/journal.md`: brief dated decisions and rationale, not a log of every edit.

Update usage docs when changing the public API or lesson format. Update roadmap
checkboxes only when the corresponding work is complete. Record meaningful design
decisions in the journal without presenting tentative ideas as settled decisions.
