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
- `npm run build`: build both workspaces.
- `npm run build:player`: build `packages/player/dist/code-loupe.js` and its assets.
- `npm run build:site`: build the static site into `apps/site/dist/`.
- `npm run build:playground`: compatibility alias for the site build.

The site build validates sample metadata and runs all canonical lessons through
snapshot generation. Run the full build after workspace changes; use the relevant
workspace build for focused changes. Astro's checker uses TypeScript 5.9;
player checking uses its workspace-local TypeScript 7 compiler.

There is currently no checked-in automated browser test suite. For player/site
changes, also check relevant browser behavior, including backward stepping,
scrubbing, reduced motion, gallery filters, downloads, and sample-to-playground
loading when applicable. Report completed checks and any checks not completed.

## Documentation

- `README.md`: current usage, embedding API, and lesson format.
- `docs/roadmap.md`: ambitions, open questions, and implementation status.
- `docs/samples.md`: adding a canonical lesson to the comparison corpus.
- `docs/journal.md`: brief dated decisions and rationale, not a log of every edit.

Update usage docs when changing the public API or lesson format. Update roadmap
checkboxes only when the corresponding work is complete. Record meaningful design
decisions in the journal without presenting tentative ideas as settled decisions.
