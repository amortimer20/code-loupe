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

- `src/lesson.ts`: YAML lesson types and parsing.
- `src/state.ts`: pure step-to-snapshot generation and semantic validation.
  Every snapshot describes the full state; backward stepping and scrubbing are lookups.
- `src/code-loupe.ts`: `CodeLoupe`, the `<code-loupe>` web component; loading,
  rendering, animation, playback, and viewer preferences. Uses Shadow DOM.
- `src/values.ts`: language-specific literal formatting and type inference.
- `src/styles.ts`: player styles and responsive layout.
- `src/index.ts`: public exports and custom-element registration.
- `playground.html`, `src/playground.ts`, `src/playground.css`: live YAML authoring,
  draft persistence, preview, and download. Kept out of the embeddable library entry.
- `public/lessons/numeric-input.yaml`: example authored Python lesson.

Keep snapshot generation independent of the DOM and animation timing. Rendering
and animations consume snapshots; they must not determine lesson state. Future
tracers should feed the same player rather than create separate renderers.

## Commands and validation

- `npm install`: install dependencies.
- `npm run dev`: run the demo with Vite.
- `npm run typecheck`: check TypeScript.
- `npm run build`: check TypeScript and build the embeddable ES module,
  `dist/code-loupe.js`.
- `npm run build:playground`: check TypeScript and build the demo and playground
  site into `dist/playground/`. Run after the library build if producing both outputs,
  since the library build clears `dist/`.

There is currently no automated test suite. Run the build for source or build
configuration changes. For player changes, also check the demo's relevant behavior,
including backward stepping, scrubbing, and reduced motion when applicable.
Report what was checked and any checks that could not be completed.

## Documentation

- `README.md`: current usage, embedding API, and lesson format.
- `docs/roadmap.md`: ambitions, open questions, and implementation status.
- `docs/journal.md`: brief dated decisions and rationale, not a log of every edit.

Update usage docs when changing the public API or lesson format. Update roadmap
checkboxes only when the corresponding work is complete. Record meaningful design
decisions in the journal without presenting tentative ideas as settled decisions.
