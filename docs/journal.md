# Project journal

This journal records decisions and their reasons. Planned work and open questions
belong in [the roadmap](roadmap.md); current usage belongs in [the README](../README.md).

## 2026-10-03 — Name: Code Loupe

The roadmap records the choice of **Code Loupe**: a loupe suggests close inspection
of code and nods to Emerald. The full name also distinguishes the project from
existing tools called Loupe. The package and custom element use `code-loupe`.

## 2026-10-07 — Working conventions and naming

Added [AGENTS.md](../AGENTS.md) to document the architecture and the expectation of
focused pair-programming sessions. The roadmap remains the place for future work;
this journal keeps decision history separate from task status.

Renamed the implementation from Code Animator to Code Loupe, including the public
class (`CodeLoupe`), element (`<code-loupe>`), bundle (`code-loupe.js`), and viewer
preference keys. Existing embeds must use the new names; preferences saved under
the old keys do not carry over. This makes the proof of concept consistent with
the chosen project name before distribution work begins.

The current architectural foundation is retained: authored YAML steps become full
snapshots, which the player renders and animates. Live tracing is still planned,
not implemented. The detailed pair walkthrough remains a next step.

## 2026-10-07 — License: MIT

Selected the MIT License so other teachers can use, adapt, and distribute Code
Loupe with few restrictions. Added the license text and package metadata.

## 2026-10-07 — Live authoring playground

Added a separate playground page with a plain YAML textarea and the existing
player. Preview updates are delayed briefly while typing and restart at Step 0;
the editor retains invalid drafts and allows downloading them. Drafts are saved
locally when browser storage is available, with no backend or account required.

Added `loadLesson(yaml)` and `lessonerror` to the component so authoring tools can
reuse a player directly. The embeddable library build remains separate from the
demo/playground site build. A richer code editor can follow once we understand
which editing aids teachers need.

## 2026-10-07 — Sample corpus and Astro workspace

Split the repository into an independent player package and a static Astro site
using npm workspaces. The library, lesson pages, guide, and playground share that
player. Browser-dependent registration stays in client scripts; the site validates
lessons through the pure parser and snapshot builder at build time.

Each sample lives in `lessons/<language>/<slug>/` with one canonical YAML file and
Markdown metadata/teaching notes. Pages, gallery filters, and downloadable YAML
are generated from those sources. Seeded the corpus with input conversion, an
accumulator loop, and a conditional branch, all authored using existing actions.

Sample-specific playground drafts preserve experiments separately from published
lessons and from each other. Accounts, cloud storage, and publishing services
remain future decisions; this site produces ordinary static files.

The Astro checker requires the classic TypeScript compiler API, so the site uses
TypeScript 5.9 while the player keeps the existing TypeScript 7 compiler.

## 2026-10-07 — First function-call visual

Added an authored `add_one(value)` lesson and separate `call`/`return` steps.
Calls capture their caller line and expression, bind parameters, and create an
independent frame. Assignments belong to the active function; variable sources
look up locals then globals, with explicit global lookup for shadowed names.
Nested frames have unique identities even when their function names match.

Returns remove the active frame and show the result over the saved call expression.
The result replaces argument badges inside that expression while retaining values
elsewhere in the caller. Earlier snapshots preserve both suspended caller state
and completed locals, keeping backward stepping and scrubbing immediate.

Extracted the Call stack panel, its forward animations, pure scope helpers, and
shared variable rendering as the first visual modules. Globals stay in the
Variables panel; locals belong to their visible function frame. Lessons without
calls retain the simpler layout. Added Node/tsx regression tests for snapshot,
scope, nested-call, and return behavior. Closures and exception unwinding remain
future design work.

## 2026-10-07 — Nested-call comparison lesson and priorities

Added a second function lesson using the existing authored call/return model.
`double_after_bump()` pauses while `add_one()` runs; both frames use `value` and
`result` to demonstrate separate ownership. Two returns resume different caller
lines, with assignments deliberately shown after each return. Teaching notes
identify comparison points for scrubbing and backward stepping, and a corpus
regression test checks the intermediate scopes as well as the final output.

Moved the Reveal.js adapter to the backlog at the user's request. Expanding the
lesson corpus takes priority over slide integration for now.
