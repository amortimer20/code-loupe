# Testing Code Loupe

The pipeline tests the authored model and the built browser outputs. It does not
execute the Python displayed in a lesson.

## Checks

| Layer | Coverage |
| --- | --- |
| Node tests | Snapshot generation, invalid transitions, scope/shadowing, nested calls, list values/selection/indices, shared-list identity/rebinding, preserved earlier snapshots, and corpus outcomes |
| Theme tests | Text/syntax contrast on preset surfaces and real Python/JavaScript/literal highlighting |
| Type checks and builds | Player and site code, browser tests/configuration, canonical lesson metadata and semantic validation, independent player bundle and static site |
| Playwright behavior | Gallery filters, all samples' outcomes and downloads, draft restoration/isolation, invalid draft recovery/download, nested frames, both returns, backward stepping, scrubbing, keyboard navigation, autoplay, animations, theme/draft/load races, storage failure, and narrow layouts |
| Screenshot comparisons | Paper/Midnight/Terminal at nested locals, both return destinations, indexed list selection, and shared-list aliasing; Midnight gallery, narrow nested-call player, and focused player on a short laptop |

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

The set contains twenty-nine PNGs, including indexed list selection, aliasing,
and dictionary fields in all three presets
and element update, list print badge, append, removal, separate copies, and a
false while-loop condition, initializer self binding, and constructor reference
result in Midnight.
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
