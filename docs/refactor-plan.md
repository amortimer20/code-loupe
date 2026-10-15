# Refactor plan

Behavior-preserving cleanup of the player and authoring site. Each slice is one
reviewable change and one commit. No slice changes the lesson format, snapshot
contents, rendered output, or screenshot references; a slice that needs to is
not a refactor and must be split out and discussed.

## Ground rules

- Run `npm test`, both type checks, `npm run build`, and `npm run test:docker`
  for every slice. Visual references must not change; never regenerate them here.
- Slice 1.0 adds a corpus snapshot fixture. Player state slices must keep it
  byte-identical.
- Keep the pure state path free of DOM imports, as `AGENTS.md` requires.
- Move code before changing it: extraction and simplification are separate
  commits when a slice does both.

## Slice 0: documentation accuracy

- `AGENTS.md` still says ordinary list values remain independent authored
  values. Since the one-list-model change, every variable-held list is a heap
  object; list values exist only in badges and literal returns.
- `docs/roadmap.md` item 6 says code selection and step organization remain
  next; picking, insertion, duplication, and moving have shipped.

## Phase 1: player state (`state.ts`, 480 lines)

**1.0 Characterization fixture (done 2026-10-14).** Serialize every canonical lesson's snapshots
to a checked-in JSON fixture and assert equality in a test. This is the safety
net for the rest of the phase. Update the fixture only in slices that
intentionally change state, which this plan has none of.

**1.1 Shared validation helpers (done 2026-10-14).** `isRecord` is defined in both `lesson.ts`
and `state.ts`; `checkKeys` and key lists live inline. Move them to one small
module. Export the address parser as `code-loupe/address` so the site can use it
(see 3.1).

**1.2 Per-action handlers (done 2026-10-14).** `buildSnapshots` is one large step callback with
an implicit action order. Split each action into a handler (`error`,
`call`/`return`, `line`, `select`, output, `badge`, `convert`, `assign`,
collection mutations, `allocate`) that receives a step context: the working
snapshot, `fail`, `checkLine`, `checkTarget`, language, and id counters.
`buildSnapshots` keeps one explicit ordered list of handlers, which documents
the processing order teachers currently have to learn from prose.

**1.3 One binding resolver (done 2026-10-14).** `readValue` (with an overload flag for list
references) and `readBinding` duplicated finding the badge and validating the value.
Instead of one function with modes, which would interleave three unrelated flows,
they now share two private steps (`sourceOf`, `finishLiteral`) behind three named
entry points: `readValue` (update/append elements), `readResult` (return, passing
list references through), and `readBinding` (assign/call parameters, allocating lists
and binding explicit references). Error messages are unchanged and covered by
`bindings.test.ts`.

## Phase 2: player component (`code-loupe.ts`, 961 lines)

**2.1 Step animations (done 2026-10-15).** `#animateStep` is 138 lines handling every event type.
Move each event's animation (badge travel, conversion, assignment, call/return,
collection change, console output) into `visuals/` functions sharing an
animation context, following the existing Call stack panel pattern.

**2.2 Loading and highlighting.** Move source reading, Shiki highlighting, and
theme refresh (`#load`, `#highlightTheme`, `#refreshTheme`, `#highlightLiterals`)
into a module with a narrow interface. Preserve the existing load-race and
theme-race guarantees; the browser suite covers them.

**2.3 Playback and keyboard.** Separate the playback/autoplay timer and key
handling from rendering so their state is in one place.

## Phase 3: authoring site

**3.1 Use the player's address grammar.** The site re-implements identifiers
and list addresses with regexes in five places (`lesson-document.ts`,
`draft-migration.ts`). Use `code-loupe/address` instead, so the two can't
disagree.

**3.2 Action registry.** Each builder action is described across several places:
`actionLabels`, the `formOf` condition chain, `addStep` defaults, `editStep`
branches, `stepSummary`, and `stepFields`. Give each action one definition
(label, recognize YAML, default form, write YAML, fields, summary). Do this
before adding dictionary, call, or instance forms; each new form then becomes
one registry entry.

**3.3 Builder rendering.** `builder.ts` builds its UI from long template strings,
with 36 lines over 200 characters (one is about 2,000), and safety depends on
remembering `escape()`. Introduce a small tagged `html` template that escapes
interpolations by default, then split rendering (per-action field renderers)
from the controller (events, pending forms, undo, moves).

**3.4 Playground wiring.** Separate draft storage and recovery from layout and
mode switching in `playground.ts`.

## Phase 4: mathematics experiment (last)

The prototype has not met expectations. Decide its direction before any
refactoring: rework the visuals, freeze it as-is, or remove it. Refactoring code
that may be replaced would be wasted effort.

## Not in scope

- Monaco's download size (a loading decision, not a refactor).
- Lesson format, schema, or player behavior changes.
- New builder forms, tracing, iframe embedding, and styling work.
