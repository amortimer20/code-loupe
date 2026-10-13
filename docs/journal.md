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

## 2026-10-08 — Appending and removing list elements

Added authored `append` and indexed `remove` actions, each with a focused lesson.
Append adds a scalar at the old list length and can transfer it from a badge.
Removal uses `del numbers[1]` in the displayed Python: it deletes by index rather
than modeling Python's value-searching `remove()` method or a `pop()` return value.

Keep length changes in pure snapshots and allow one collection mutation per
step. Append preserves existing selection; removal clears it for the deleted
element or shifts its index to follow a surviving element. Forward removal
captures the old cell layout, fades out the removed cell in an overlay, and moves
survivors to their new positions. Reduced motion, backward stepping, and
scrubbing show snapshot values directly. Empty lists remain valid, while negative
indices and nested values are rejected. Shared references remain future work.

## 2026-10-08 — Explicit shared-list identity

Added `allocate: { id, value }` and reference bindings through `assign.ref`.
Variables store an object identity; contents live once in a snapshot's heap.
Clone each heap object per snapshot, keeping its id stable, so alias mutations
and backward stepping restore both sharing and contents. Existing flat list
values and badge illustrations retain their independent value semantics.

The first lesson binds `numbers` and `other` to one list, appends through `other`,
then prints through `numbers`. Render one Shared lists card and name-to-id arrows;
author-chosen ids are teaching labels, not runtime addresses. Existing collection
actions, scoped sources, and selection resolve references consistently. Rebinding
a variable changes its arrow, while mutation changes the shared object. Function
parameters can use explicit references too; return badges remain values.

A narrow-screen check exposed that shared objects could be below the visible
data pane. Bounded viewing now follows the selected cell or relevant shared-list
card within that pane without moving the host page. Objects with no remaining
bindings stay visible; garbage collection, nested references, and a copying
comparison are separate future work.

## 2026-10-08 — Comparing copying with aliasing

Added a separate flat-list copying lesson beside the aliasing lesson. Reuse
explicit allocation and reference bindings: `numbers.copy()` is represented by
a second allocated list with authored starting contents. Two cards make equal
values versus shared identity visible, and printing both lists shows that only
the copy changed. No copy action or execution inference is needed in the player.
Keep the example to numbers; nested objects and shallow-versus-deep-copy behavior
remain future lessons.

The panel is labeled List objects consistently for both lessons. Sharing is a
relationship between variable references and an object, not a property required
of every list card. Keep the layout and reference labels; one card versus two
cards explains aliasing versus copying without changing the panel's name.

## 2026-10-08 — A gentler starting sequence

Put Hello, world and simple arithmetic before input conversion. The first uses
two moments for one print statement; the second adds an expression-result badge
before printing. Neither needs variables or new player actions. Preserve sample
ids and relative ordering of the existing corpus while shifting gallery order.
Build the remaining introductory lessons in later focused batches.

Completed the starting sequence with naming a value, changing a value, and
strings versus numbers. Keep evaluation and assignment as separate authored
moments so students see the old binding while the new result is available.
Use numeric addition versus string concatenation to prepare for input conversion;
console text alone does not identify the value's original type.

## 2026-10-08 — Mathematics stays in the long-term backlog

An authored algebra renderer is a possible future extension, with separate math
lesson types and rendering and potentially shared playback and captions. Record
it as an exploration, not a settled architecture or a solver commitment. Finish
the introductory code sequence first; no math dependencies or renderer changes
are part of this work.

## 2026-10-08 — Comparisons before control flow

Added Boolean comparisons and a simple while loop with existing authored actions.
Place comparisons before the conditional lesson, then the while loop before the
for-loop accumulator. The while lesson checks its condition three times but
runs its body twice, making the final False result and skipped body explicit.
Keep counter evaluation separate from assignment, and preserve all intermediate
states when stepping backward. No automatic loop execution or new loop-specific
player state is introduced.

## 2026-10-08 — Flat dictionaries before classes

Extend explicit allocation with `fields` for flat, string-keyed dictionaries.
Variables still hold object references; field contents live once in the heap and
are copied per snapshot. Reuse `update` with a `key` selector for existing fields
and `badge.from.key` for authored reads. Index actions stay list-only, and scalar
badge values remain teacher-authored. Field validation and mutation live in a
pure dictionary helper, separate from the object-card renderer and animations.

Use the stable heading Objects now that cards can represent lists or dictionaries.
Retain named reference labels and one card per identity. Field rows show their
scalar types, update independently, and become visible within bounded data panes
when read or changed. The first lesson changes score without changing name.
Adding/deleting fields, nested values, whole-dictionary badges, class instances,
and methods remain future work.

## 2026-10-08 — Initialization versus construction

Represent class instances as named-field objects with an authored class label.
An empty allocation precedes the initializer frame; self refers to that instance
and attribute writes can create scalar attributes. Keep dictionary keys and
instance attributes separate in the lesson format and renderer.

Add `call.construct` to distinguish initializer completion from the enclosing
constructor expression. The initializer must finish with null (Python None),
then the constructor produces a reference badge that can be assigned to a name.
This avoids presenting __init__ as returning its instance. Reference badges are
limited to authored constructor results; ordinary return values remain scalar
or list values. Definition execution, __new__, inheritance, and nested attributes
are not modeled. Shared field storage stays pure, with separate dictionary and
instance validation helpers. Two-instance and method lessons remain next steps.

## 2026-10-08 — Independent instance state

Repeat the full construction sequence for two Students before changing one name
attribute. Showing each initializer's self binding makes the shared definition
and separate instance identities explicit. Contrast with list aliasing: two
variable names alone do not establish independence; separate allocations do.
Reuse the existing constructor and scalar attribute format without extending the
player. Ordinary instance-method calls remain the next lesson.

## 2026-10-08 — An ordinary method call

Model Student.rename with the existing call format: explicitly bind self to the
receiver's instance, pass the scalar new_name parameter, and write the attribute
through self. Omit construct so the authored null completion produces None
instead of an instance reference. Removing the frame removes its locals while
preserving the object mutation and global references.

Summarize the two constructions in setup steps, with initialized objects, to
focus this lesson on receiver binding and method completion. The prior lessons
retain the detailed initializer sequence. This adds a canonical lesson without
new schema or execution behavior; method lookup and implicit completion remain
teacher-authored rather than inferred.

## 2026-10-08 — Authored program diagnostics

Add an explicit terminal error action with a syntax/runtime kind, error name,
message, location, and optional text target. Keep diagnostics separate from
value badges, console output, and invalid-lesson loading. The marker identifies
the error location rather than an executed line. Runtime errors replace the
expression badges while retaining earlier variables, objects, frames, and output;
syntax errors must precede execution. Autoplay pauses, and prior snapshots remain
available for inspection.

Use a missing colon and failed integer conversion as the first comparison pair.
Messages are concise teacher-authored explanations rather than captured Python
diagnostics. Do not infer failures from code or invent frame unwinding. Caught
exceptions, traceback details, and failures across calls need later lessons and
explicit pacing decisions.

## 2026-10-08 — Pause corpus expansion

Keep the current 24 lessons as the working comparison corpus. Pause new content
and deeper language behavior to avoid growing complexity at this stage. Use the
existing examples to assess the player and authoring experience; future topics
remain in the backlog rather than becoming automatic next tasks.

## 2026-10-08 — Validate authored source consistency

Add validation rules requiring variable-source badges to match current source
values and badge-linked output to contain the badge's printed form. Mismatches
are hard lesson errors. Reject badge-linked print/write combined with badge
creation or conversion, preserving the existing action order and valid combined
badge/conversion/assignment steps. These checks validate authored data; they do
not execute code or infer expression results.

Console-source consistency, Python lists-of-strings printing (the current
formatter uses JSON-style double quotes), and a unified address syntax remain
open items. This change does not resolve them.

## 2026-10-09 — One authored address grammar

Use Python-shaped addresses for existing locations: a name with at most one
list index, quoted dictionary key, or instance attribute. Normalize them into
the existing internal selectors so snapshots, events, and visuals stay unchanged.
Remove old location mappings without aliases; saved drafts receive migration hints.
Keep var for bindings being created or rebound, and target/from for addressing
existing values. Use the address mapping form for explicit global scope, or to
disambiguate a variable named console from console input. Quote every address:
YAML requires it for brackets inside flow mappings, and one rule is easier to teach.
Badge, convert, and output mappings now reject unknown keys like other actions.

Nested accessors remain open. Unifying ordinary list values and heap-backed
list references into one list model is separate future work, not part of this
authoring syntax change.

## 2026-10-09 — One list model

Every variable-held list now lives in the heap. Literal bindings allocate objects;
whole-list reads and return passthrough preserve identity. This makes aliasing and
function-argument mutation truthful to Python, matches the model a future tracer
will emit, and replaces two list models with one. Explicit allocation still allows
chosen labels, and unreferenced objects remain visible. Orphaned objects and
garbage-collection visuals, and nested lists, remain open.

## 2026-10-12 — Authoring assistance before tracing

Keep YAML as the saved format and add an editor-facing JSON Schema without changing
player validation. Maintain the schema explicitly so it can capture structural
rules beyond the current TypeScript interfaces; tests cover authored property sets,
the canonical corpus, and invalid action combinations. State-dependent meaning
remains in snapshot generation. Ajv is a development dependency only.

Next take a focused accessibility slice, then explore fixed-input Python tracing
into an editable authored lesson before live student tracing. This should reduce
manual value calculation while retaining teacher control. Input constraints,
execution limits, caption anchors/templates, and a permanent traced-file format
still need design. Iframe embedding can proceed independently; styling remains
deferred.

## 2026-10-12 — Accessible execution context

Use one polite, atomic status region for step/line, relevant values, output,
program diagnostics, and the teacher's caption. Keep visual badges hidden from
the accessibility tree and supply their values through the status text.
Cosmetic renders do not repeat unchanged messages, and announcements do not
move focus. Preserve native keyboard handling on form controls and editable
slotted content. When a navigation button becomes disabled at a lesson boundary,
return focus to the player without scrolling the host page.

Name list cells through a current highlighted or relevant action binding, then
active locals/globals, with function/frame labels for locals. Keep the object id and
alias list on the card; orphaned lists retain their id as an accessible fallback.
Combined steps announce every affected binding, deduplicating repeated list
locations. Source events must still point through a current binding before their
name labels an object. Automated checks cover both motion modes. Real
screen-reader testing and the usefulness of announcement verbosity remain open.

## 2026-10-12 — Prioritize the authoring workflow

Shift the near-term direction from tracing to using the existing authored tool
comfortably. Improve the playground's YAML editor first, then build introductory
action forms, code-target selection, and step organization. Builder and source
views share one saved lesson and preserve advanced content. Teachers still supply
outcomes and explanations; the builder supplies syntax.

The implementation plan defines small reviewable slices and acceptance examples.
Tracing may later populate this workflow, but is deferred while we test it.
Editor/library adoption is subject to a browser integration check; broader action
forms follow teacher trials. The 24-lesson corpus remains paused.

## 2026-10-13 — Source assistance in the playground

Use Monaco with the checked-in lesson schema for YAML highlighting, indentation,
completion, hover descriptions, and source diagnostics. The preview still checks
state-dependent rules. Preserve raw drafts/downloads and undo; load the editor only
on the playground, with a plain textarea fallback. The player stays independent.

Pin Monaco to 0.52.2 for the YAML integration's older worker API and replace its
embedded sanitizer with maintained DOMPurify. The editor and workers add roughly
1.1 MB gzipped; this loading cost and real assistive-technology testing remain
considerations. GUI action forms are the next slice, not part of this change.

## 2026-10-13 — Agree on the builder's Step cards design

Adopt the reviewed Step cards layout: expandable teaching steps on the left,
live preview on the right, collapsible lesson details, and Builder/YAML views
sharing one draft. Preserve square corners and the existing palettes. Selecting
a card previews its completed state; typed value controls keep numbers, text,
Booleans, and None distinct. This keeps the explanation's sequence visible while
limiting the form detail shown at once.

Begin with highlight, show-value, store-value, and print forms, reviewed against
the naming-value and simple-arithmetic lessons. The mockup is a design reference;
implementation must use the real player and preserve advanced YAML. Code selection
and richer step organization remain the following slice. The builder is not yet
implemented.

## 2026-10-13 — First builder forms share the source document

Implement Step cards with lesson details, introductory scalar actions, captions,
and a separate new-lesson draft. Edit YAML nodes directly so the builder preserves
advanced actions and comments; viewing alone never serializes the draft. Both
views use the source editor's undo history. Keep state/rendering unchanged and
preview selected cards through the real player.

Apply details/step commits a form transaction. Incomplete entries survive view
switching; a form changed underneath by YAML needs an explicit reload. Only applied
changes persist across reloads or downloads. Anchors, aliases, and unsupported
constructs remain source-editable. Code selection and step reordering are still
the following slice, not implemented here.

## 2026-10-13 — Recover saved drafts with removed address syntax

Older browser drafts are restored verbatim and can fail the current address rules.
Offer an explicit, undoable Update draft syntax action in the playground. Convert
only the removed location mappings; preserve code, values, captions, and comments.
Refuse ambiguous/unsafe conversions and keep the original source available. The
player's strict format and migration errors remain unchanged; this is draft recovery,
not support for old aliases in lesson playback.


## 2026-10-13 — Recoverable builder edits

Use Save and Discard labels for form transactions, reserving Undo for changes
already in the draft. Step deletion uses that same undo history. Keep a separate
last successfully previewed source in browser storage so a malformed saved draft
can recover after reload without silently replacing it. Restoring is undoable.
Strengthen form boundaries and selected-card contrast using the existing palettes.
Drag reordering remains deferred; authored dependencies need clear feedback first.


## 2026-10-13 — Smaller forms and unfinished cards

Keep new teaching cards in form state until a validated Save adds them as one
undoable source edit. Invalid candidates leave the shared YAML and working preview
unchanged. Allow one unfinished card, with explicit Cancel; it survives view
switching but is not exported or persisted. Move number display to optional
settings and show occurrence only for repeated targets or existing overrides.


## 2026-10-13 — Keep the authoring preview in view

Use a viewport-bounded desktop workspace with an independently scrolling editor
and the existing player's fit layout. Reveal selected and new card headers with
minimal scrolling; respect reduced motion and keep tabs/history outside the pane.
Compact the playground heading. Narrow screens retain the existing stacked flow;
an Edit/Preview switch remains separate future work.


## 2026-10-13 — Pick code into a form

Use an explicit preview-picking mode so ordinary viewing does not change forms.
Click a line or drag a single-line badge expression; derive occurrence from the
selected offsets using the player's matching rules. Keep the value and caption
teacher-authored, and leave picking as an unsaved edit. Manual controls remain the
keyboard alternative; advanced targets stay in YAML. The preview adapter lives
in the site, leaving snapshot generation and student players unchanged.


## 2026-10-13 — Picker cues and preview following

Highlight hovered code only during explicit picking. Follow preview step indices
in the Builder without moving keyboard focus or writing the draft; keep pending
forms/new cards and pause autoplay when a form is focused. Use the installed
highlighter's language catalog for a dropdown, prioritizing common languages and
preserving imported aliases or unknown names. This is syntax-highlighting support,
not execution support for each language.


## 2026-10-13 — Separate site and lesson themes

Replace the Phosphor-inspired site palettes with Light/Dark appearances and
stronger separation between page, panels, form controls, and selected steps.
Keep square corners. Site appearance follows the system initially; its saved
choice is independent of the Paper/Midnight/Terminal lesson preference. Existing
preferences migrate, and YAML highlighting follows site appearance. This keeps
website readability separate from the palette a teacher chooses for code.
