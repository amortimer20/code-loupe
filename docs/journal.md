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

## 2026-10-07 — Starter themes and Phosphor-inspired site

Added Paper, Midnight, and Terminal as coordinated player/site presets. The site's
header picker remembers a browser-local choice, with Midnight as its default.
Independent embeds keep their own theme attribute and the existing dark-plus
default. Regular Shiki themes remain supported. Theme changes pause playback,
re-highlight the current lesson, and preserve its step and any directly loaded
draft rather than fetching or restarting it.

Read Phosphor's local theme design and implementation as the design reference.
Its square panes, thin dividers, surface hierarchy, and typography guide the site;
these three palettes are original starter presets rather than ports of Phosphor's
Omarchy-inspired themes. Removed rounded corners from the site and player and
disabled code ligatures. No fonts or CRT effects were added.

The presets share a small DOM-independent data module and have automated contrast
and syntax checks. A supported host-provided theming API for Phosphor embeds is
future work. Also backlogged a responsive design session for lesson-specific
layout needs, including constrained embed heights, deeper stacks, collections,
and resizable panes; the existing narrow-width stacking remains in place.

## 2026-10-07 — Browser and visual regression pipeline

Replaced temporary browser scripts with a checked-in Playwright suite that tests
the built static site and independent player bundle. Behavioral checks run with
normal and reduced motion; eleven reviewed screenshot references cover the three
starter themes, nested locals and both returns, the gallery, and a narrow player.
Pinned Playwright 1.63.0 and its matching official Ubuntu Noble Docker image so
local reference generation and CI comparisons use the same browser/font environment.

Added GitHub Actions for lockfile installation, unit tests, browser-test types,
production builds/type checks/corpus validation, and all browser/visual tests.
Failure reports retain traces and screenshots. Normal runs fail on missing
baselines; updates require an explicit command and review. A retried flaky test
still fails CI. `npm run test:docker` runs the complete pipeline locally.

The new scrub regression test exposed an existing ordering bug: pausing playback
re-rendered controls and replaced the slider's incoming value before it was read.
Capture the requested step before pausing, so input events actually scrub to the
requested snapshot. The browser suite retains coverage for the fix.

## 2026-10-07 — Focus lesson, first short-screen iteration

Added a viewport-sized Focus lesson view to sample pages. The existing inline
dialog becomes modal without moving or reconnecting the player, so entering and
leaving preserve the current step and frames. Escape and the exit button restore
the inline view, page position, and focus. Native modal behavior keeps background
controls out of the tab order while viewing the lesson.

Added an opt-in `fit` attribute for hosts that supply a definite player height.
Code and data panes scroll internally; captions, console, and controls occupy
the remaining fixed regions. The code pane keeps the active line visible with
space for value badges. Normal players retain their natural height. This first
iteration keeps the existing font size and code-row spacing so we can evaluate
the focused layout before adding compact density settings.

## 2026-10-08 — List iteration and indexed cells

Added a Python lesson that sums `[2, 4, 6]` while distinguishing indices from
values. Flat lists are snapshot values and render as indexed cells in global
and local variable rows. An authored `select` action marks the current cell;
`select: null` shows exhaustion. Indexed badge sources identify the cell from
which a value travels. As with existing sources, the teacher supplies the badge
value and controls the pacing.

Keep selection in pure snapshots so backward stepping and scrubbing restore it.
Resolve collection names with the existing local/global scope rules and clear
selection on reassignment or return from its owning frame. Clone flat list values
across snapshots and value transfers. This iteration does not claim mutation,
aliasing, nested collections, or iterator execution; those require separate
semantics and teaching examples.

Replaced the sample page's separate Focus lesson action and exit bar with a
four-corner fullscreen toggle inside the player card. The same button changes
to the inward-corner icon on entry; its accessible label and tooltip describe
the current action. Keep the viewport-sized dialog behavior and the player's
own title. A small optional `viewer-actions` slot lets the host supply this control
without making the embeddable player depend on the sample site's dialog.

## 2026-10-08 — Updating one list element

Added `update: { var, index, value }` with an optional `from: badge` in place of
an explicit value. It replaces one existing element without resizing the list,
preserves an authored selection, and follows local/global lookup rules. A badge
can travel into the cell, which briefly highlights on forward playback. Reduced
motion, backward stepping, and scrubbing use the same stored snapshots immediately.

The new lesson changes `[2, 4, 6]` to `[2, 10, 6]`, separating target selection,
replacement, and printing. Copy the list on update to keep earlier snapshots
and independently stored values intact. Shared references and object identity
still need a distinct model; this action does not implement Python aliasing.
