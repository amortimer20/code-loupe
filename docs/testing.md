# Testing Code Loupe

The pipeline tests the authored model and the built browser outputs. It does not
execute the Python displayed in a lesson.

## Checks

| Layer | Coverage |
| --- | --- |
| Node tests | Lesson-schema validity, authored-type property coverage, corpus/schema compatibility and invalid action shapes; snapshot generation, invalid transitions, scope/shadowing, nested calls, list values/selection/indices, shared-list identity/rebinding, preserved earlier snapshots, and corpus outcomes |
| Rendered-DOM baselines | A hash of the player's complete rendered DOM and palette at the first and last step of every canonical lesson, for each starter preset (fresh load) and a regular Shiki theme (live switch), in the Docker visual project. Characterizes loading, highlighting, literal coloring, and palette application |
| Animation timeline baselines | For every forward step of all 24 canonical lessons, each Web Animation the player creates (target, keyframes, delay, duration, easing), compared with checked-in JSON in the Docker visual project. Refactors of the animation code must reproduce them |
| Corpus snapshot fixture | Complete snapshots of all 24 canonical lessons, compared per lesson against `packages/player/tests/fixtures/corpus-snapshots.json`. Behavior-preserving refactors of snapshot generation must leave it unchanged |
| Theme tests | Text/syntax contrast on preset surfaces and real Python/JavaScript/literal highlighting |
| Type checks and builds | Player and site code, browser tests/configuration, canonical lesson metadata and semantic validation, independent player bundle and static site |
| Playwright behavior | Gallery filters, all samples' outcomes and downloads, draft restoration/isolation, invalid draft recovery/download, nested frames, both returns, backward stepping, scrubbing, keyboard navigation, autoplay, animations, theme/draft/load races, storage failure, and narrow layouts |
| Screenshot comparisons | Paper/Midnight/Terminal at nested locals, both return destinations, indexed list selection, and shared-list aliasing; Light/Dark gallery and Builder, narrow nested-call player, and focused player on a short laptop |

Behavioral tests run in separate Chromium projects for normal motion and OS
reduced motion. Each test starts with a fresh browser context and checks for
unexpected JavaScript exceptions. Tests wait for player readiness, assertions,
and actual Web Animations to finish rather than sleeping for guessed durations.
Focus-view tests cover 1280×600 and 390×600 viewports, execution following,
reachable controls, step/frame preservation, both exit paths, no source refetch,
and a bounded independent embed without a title.
List checks cover iteration bindings, selection restoration, themed literals,
empty/mixed lists in local and global scopes, and laptop/narrow Focus views.
Element-update checks cover unchanged neighbors/length, valid scalar replacement,
scope resolution, invalid operations, cell-only animation, reduced motion,
backward stepping/scrubbing, and a list-valued print badge.
Append/removal checks cover empty lists, boundary deletions, shifted selection,
local/global scope, invalid operations, forward transitions, restored lengths
and indices, reduced motion, and laptop/narrow fullscreen views.
Reference checks cover one object shared by two bindings, mutations through
aliases, rebinding, distinct objects, local/global references, restored identities,
selection through another alias, independent copies with contrasting console
outputs, and bounded data-pane following across two object cards.
Introductory checks cover gallery ordering, lessons without variables, the active
line before output, an integer expression badge before printing, and backward
restoration of the empty console and intermediate badge.
The remaining introductory checks cover one binding reused on reassignment,
old-value reads before assignment, restored bindings, integer versus string
badges, and preservation of the first console line when undoing the second.
Control-flow checks cover True/False Boolean badges, repeated while-condition
checks, counter assignment boundaries, backward line jumps, restoration of
console history, and skipping the body after the final false condition.
Dictionary checks cover named scalar fields and type tags, one-field animation,
unchanged neighbors/identity, backward stepping and scrubbing, theme switching,
local/global aliases and rebinding, empty dictionaries, invalid keys/nested
values, quoted and reserved-looking keys, and bounded field following.
Instance checks cover empty allocation, self binding and local parameters,
new/replaced scalar attributes, constructor completion versus initializer None,
reference-result assignment, restored frames and missing attributes, invalid
constructor bindings/operations, themes, and short/narrow fullscreen layouts.
Two-instance checks compare sequential initializer self bindings, construction
results and global identities, independent attribute values, reversed writes and
returns, scrubbed construction states, contrasting outputs, and bounded following
of the correct card in short/narrow fullscreen layouts.
Method checks cover receiver/self identity, local parameters, mutation through
self, unchanged second-instance state, None completion without a global binding
or output, restored locals and attributes, discarded results, theme switching,
scrubbing, and visible attribute/active-line following on short/narrow screens.
Error checks cover pre-execution syntax locations, preserved runtime state and
output, absent assignment results, diagnostic targets/occurrences, terminal-step
validation, preserved frames/heap without unwinding, backward restoration,
scrubbing, autoplay pausing, theme switching, safe text rendering, distinction
from load errors, and short/narrow fullscreen visibility.

Source-editor checks cover YAML highlighting, indentation, completion and hover
from the local schema, actionable syntax/shape/semantic problems, undo and keyboard
exit, theme selection preservation, exact CRLF downloads, narrow screens, and the
plain-editor fallback when its enhancement cannot load. Canonical draft tests edit
through the visible editor and verify saved/restored text for every sample.

Site document tests run through `npm test` alongside the player suite. They cover
exact no-edit corpus round trips, preserved advanced fields/comments/code/type tags,
typed scalar values, prefix-state reads, stale/unsafe edits, and lesson creation.
Builder browser checks create the arithmetic and naming-value lessons through
forms using the real player, then verify export/restore, shared undo/redo, theme
preservation, incomplete/stale forms, advanced captions, invalid source, fallback
editing, and narrow layouts with full and reduced motion. Form edits are applied
transactions, and source edits use the same history.

Monaco is pinned to 0.52.2 because the current `monaco-yaml` worker manager uses
the pre-0.53 worker API. Keep the shared version override when updating dependencies
until completion/hover/diagnostics work on a newer release. Vite replaces Monaco's
embedded sanitizer with the maintained `dompurify` package; verify hover rendering
and dependency advisories when changing that integration.

The test server serves `apps/site/dist/` plus `packages/player/dist/` and an
independent embedding fixture. That verifies both production outputs; test-only
routes are not part of the published site. Its port is 4321, and an occupied port
fails rather than silently testing an old server.

## Local commands

Install dependencies at the repo root first:

```sh
npm ci
npm test                     # fast model and palette checks
npm run typecheck:browser     # browser suite and config
npx playwright install chromium
npm run test:e2e              # builds, then both behavioral projects
```

With Docker available, run the complete pipeline in the same environment used by CI:

```sh
npm run test:docker
```

The helper mounts this checkout and uses its installed dependencies. It runs as
your user so generated artifacts remain editable. The canonical environment is
the official `mcr.microsoft.com/playwright:v1.63.0-noble` image, matched to the
exact `@playwright/test` dependency. Linux-installed dependencies are required
for this bind-mounted helper; CI installs them fresh inside its container.

`npm run verify` runs the same checks directly on the host. Pixel comparisons
need the canonical Docker environment: another OS, system font set, or browser
version may render differently. Use `test:e2e` for portable behavioral checks.
This follows [Playwright's screenshot guidance](https://playwright.dev/docs/test-snapshots).

After an existing successful build, focused checks avoid rebuilding:

```sh
npm run test:browser:built -- --project=chromium-reduced --grep "nested calls"
npm run test:browser:built -- --project=chromium --grep "standalone"
npx playwright show-report
```

## Accessibility checks

`tests/browser/accessibility.spec.ts` checks control tab order, native slider
and speed-selector keys, player shortcuts, keyboard fullscreen entry/exit,
focus behavior, relevant list-cell names (including aliases, locals, and orphans),
and live-region text. Combined-step cases cover same-step rebindings, every
affected binding, duplicate list summaries, and backward restoration. Mutation checks verify that theme and resize renders do
not repeat unchanged step announcements. These tests run with full and reduced
motion; pure helper tests cover recursion, backward snapshots, and diagnostic
summaries.

These automated checks inspect DOM/accessibility semantics, not spoken output.
Manual testing with NVDA, VoiceOver, and other assistive technology remains open,
including announcement usefulness during autoplay and long lessons. See
[W3C status-message guidance](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)
for the distinction between announcing updates and moving focus.

## Visual references

References are checked into `tests/browser/__screenshots__/`. Missing or changed
references fail ordinary verification; CI never creates or accepts new baselines.
Use the explicit update command for intentional visual changes:

```sh
npm run test:visual:update
```

This rebuilds and captures the visual project in the canonical Docker image.
Review every changed image against the intended design, then run
`npm run test:docker` without updating references. Commit reviewed PNGs alongside
the code that changed their appearance. Do not update images to make an unexplained
failure disappear. When upgrading Playwright, update its exact dependency and
the CI image together, then regenerate and review references in the new image.

The set contains forty-one PNGs, including indexed list selection, aliasing,
and dictionary fields in all three presets
and element update, list print badge, append, removal, separate copies, and a
false while-loop condition, initializer self binding, and constructor reference
result, independent instance attributes, and a method's self binding and None
result in Midnight, plus syntax/runtime diagnostics in all three presets.
Desktop captures use 1280×960, the narrow
case uses 390×844, and the focused laptop uses 1280×600. Visual tests disable animations and move the pointer away from
controls. Comparisons permit no differing pixels beyond Playwright's default
per-pixel color threshold; they do not use a broad percentage tolerance.

## CI and failure evidence

`.github/workflows/ci.yml` runs on pushes, pull requests, and manual dispatch.
It uses Node 24 and the pinned Playwright image, installs from the lockfile with
`npm ci`, and runs `npm run verify`. Repository permissions are read-only.

CI permits one retry for diagnostics, but a flaky test still fails the job.
Focused `.only` tests are forbidden in CI. The job uploads `playwright-report/`
and `test-results/` for 14 days, including traces, failure screenshots, and
expected/actual/diff images when a visual comparison fails. These generated
reports are ignored by Git; baseline PNGs are not.

## Remaining gaps

This is an initial Chromium suite, not a cross-browser certification. Firefox,
WebKit, a full screen-reader/accessibility audit, real projector checks, and
very large or deep lessons remain future coverage. Screenshot comparisons check
still states; animation behavior is covered separately by functional tests.


Preview-picking checks use real mouse drags across syntax-highlighted text spans,
including reversed selections and repeated expressions. They cover explicit
activation/cancellation, cross-line rejection, preserved pending values/captions,
advanced-action preservation, and saved target edits through shared undo. Pure
offset tests include overlapping matches, Unicode prefixes, trimming and invalid
selections. These run alongside the desktop pane and resize checks.

Hover/following checks verify picker-only line cues, manual preview navigation,
autoplay card selection/reveal, retained keyboard focus and pending forms/new
cards. Language checks verify catalog choices and imported aliases; pure ordering
checks retain unknown imported names. These run with both motion preferences.


Site appearance checks cover independent Light/Dark and lesson preferences,
migration from the old shared palette, system defaults, blocked storage, narrow
layouts, text contrast, and retained pending forms/source/preview state. YAML
selection survives a site appearance change. Gallery and short-laptop Builder
references cover both appearances; player colors and rendering stay independent of site appearance.

Player-only dictionary/list-selection/error/narrow captures set a matching page backdrop during
capture: fractional element bounds can include one outside pixel row. This keeps
those comparisons independent of site appearance without altering player pixels
or existing player reference pixels. Full-page site captures use the actual site
surfaces. The narrow sample capture was refreshed for the new header geometry;
other player references remain unchanged.


Step-organization checks cover unsaved positional insertion/cancellation, whole-
lesson dependency validation, stale insertion positions, shifted pending forms,
saved/advanced duplication, invalid repeated calls, and shared Undo/Redo. Pure
checks duplicate every corpus step without changing its authored fields and
preserve attached comments and explicit float spelling. Browser cases run with
both motion preferences.


Movement checks cover corpus node permutations, comments/quotes/float spelling,
bounds and stale-source guards, two adjacent pending forms, selected-card/preview
alignment through Undo/Redo, repeated keyboard moves and boundary focus, invalid
advanced calls, disabled moves during pending insertion, and the plain-editor
fallback at narrow widths. Browser cases run in both motion modes; this slice
changes no screenshot references.

Focused movement controls stay visible within short-laptop editor panes. Identical
JSON steps with different attached comments retain both pending forms through
moves/Undo; identical saved YAML with pending edits requires Save before swapping.


Input/conversion form checks rebuild the numeric-input lesson with identical
snapshots, retain input as text, preserve empty/whitespace responses, require prior
input/badges, and cover typed conversion results and optional/repeated targets.
Browser tests author all nine steps, exercise conversion expression picking,
pending invalid values/view switching, shared Undo/Redo and restoration, plus
canonical input forms in the narrow plain-editor fallback. Both motion modes run.
No player, lesson-file, or screenshot-reference change is expected from these forms.


List-builder checks rebuild list-iteration and list-update with identical
snapshots, preserve exact no-edit corpus drafts and list-item comments, distinguish
scalar item types, cover empty lists and source refreshes, and guard unsupported
nested/scoped forms. Browser cases run with both motion preferences and exercise
canonical selections/updates, backward playback, dependent output repair, shared
Undo, invalid pending rows and narrow plain-editor fallback. No screenshot
reference changes are expected.


Builder-control checks cover header collapse/reopening with keyboard and pointer,
pending edits and list rows, selected headers during collapsed preview following,
view switching, the grouped icon picker's accessible label and cancellation,
narrow layout, and danger styling/undo in both site appearances. The Light/Dark
Builder references intentionally change for the grouped picker and danger button.


Action-row checks verify Save/Discard/Delete alignment at desktop and narrow
widths, pending-edit discard, deletion undo, and shared controls on advanced cards.


Append/removal form checks rebuild both canonical lessons with identical
snapshots, cover typed scalars and empty-list transitions, missing badges and
invalid targets, indexed selection restoration, preserved comments and no-edit
corpus drafts, and unsupported scoped/nested forms. Browser checks cover caption
edits without changing actions, backward playback, Undo/Redo, reload, and a narrow
plain-editor empty-list round trip with invalid pending values. Both motion modes
run against existing screenshot references.


Builder polish checks cover semantic-error card markers and focus/navigation from
YAML, source-read repair without losing other pending edits, syntax fallback,
meaningful pending counts for steps/details/new cards, no-op/revert cleanup, native
leave cancellation and clean departure after Save, typed summaries and source
previews, list-reference badge contents, and action-specific hints. Both motion
modes and narrow layouts run against existing visual references.

The isolated math prototype checks arithmetic grouping, operation/simplification
steps on both equation sides, exact backward restoration, example switching,
keyboard boundaries, spoken labels/status updates, shared viewer palettes, and
short/narrow fullscreen alignment. Its starting expression remains readable without
JavaScript. Both motion modes run; reviewed code screenshot references stay
unchanged. Math review screenshots are test artifacts, not new baselines.

Math replacement checks inspect actual animated result movement and an anchored
unchanged prefix, then verify the final authored state. They cover interruption
by backward navigation, scrubbing, example changes, resize, and motion settings;
reduced motion skips overlays and restores the same mathematical states.

Math/code parity checks cover visible but inactive Step 0, fixed player height
through all steps, unknown/solved/backward variable states, palette preservation,
autoplay completion and pause, speed changes during motion, and a working motion
toggle with explicit preference overriding the system default. Both arithmetic
calculations have motion checks; native slider keys retain their own behavior.

The first math quality pass captures operation, emerging result, landing, and
finished frames at 1×/0.5× and desktop/narrow widths. Checks compare coordinates
within the player (element screenshots can scroll the page), unchanged prefixes,
constant result dimensions, final handoff bounds, and natural text widths.
Frame review complements behavioral tests; it does not establish that all math
transitions are polished. Existing visual references remain unchanged.

Remaining math quality checks cover both arithmetic examples, retained-term
movement, paired algebra operations, additive cancellation/+0 dwell, concurrent
division results, and exact glyph bounds at the final handoff. They capture
normal/slow frames at desktop/narrow widths, verify a stable equals sign and
deferred solved-variable display, and interrupt cancellation with navigation
and resize. Theme changes settle motion without stale highlight colors. Math
review captures remain ignored artifacts; code visual references are unchanged.

## Corpus snapshot fixture

`packages/player/tests/corpus-snapshots.test.ts` records every canonical lesson's
full snapshots and fails, naming the lesson, if snapshot generation changes. It is
the safety net for refactors of `state.ts` and its helpers. Regenerate it only for
an intentional state change, then review the JSON diff like any other result:

```sh
UPDATE_CORPUS_SNAPSHOTS=1 npm test --workspace code-loupe
```

Adding or editing a canonical lesson also changes the fixture; regenerate it in
the same commit. Never regenerate it to make an unexplained failure pass.

## Animation timeline baselines

Screenshots show still states, so `tests/browser/animation-timeline.visual.spec.ts`
records the animations themselves. It steps forward through every canonical lesson,
reads `getAnimations()` in the same task as each step, and compares the target,
keyframes, delay, duration, easing, and fill of each animation with a baseline in
`tests/browser/__screenshots__/animation-timeline.visual.spec.ts/`. Numbers are rounded
to one decimal place. It runs only in the Docker visual project, because flight paths
depend on layout and fonts.

Use it as the safety net for refactoring `code-loupe.ts` or the visual animation
modules. A failure names the lesson, and the diff shows the step and animation that
changed. Regenerate with `npm run test:visual:update` only for an intentional change
to animation timing, targets, or paths, and review the JSON diff. Adding or editing a
canonical lesson also needs a new or updated baseline.

## Rendered-DOM baselines

`tests/browser/rendered-dom.visual.spec.ts` complements the screenshots, which sample only
a few states. For each canonical lesson it loads the sample page with each starter preset,
and switches a loaded player to a regular Shiki theme, then hashes the full shadow DOM and
palette style at the first and last step. The baselines are one JSON file per lesson in
`tests/browser/__screenshots__/rendered-dom.visual.spec.ts/`. Layout decimals are rounded
to one place so the hash is stable.

Use it when refactoring loading, highlighting, theme application, or any rendering. The
normalized HTML of every state is written to `test-results/rendered-dom/` (git-ignored) so
a failure can be inspected: regenerate the same files from the parent commit and diff them.
Regenerate baselines with `npm run test:visual:update` only for an intentional rendering
change, and review which hashes moved. Adding or editing a canonical lesson needs a new or
updated baseline.
