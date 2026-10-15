# Roadmap

> **Code Loupe**: a loupe is a jeweler's magnifying glass for close inspection, and a nod to Emerald.
> Repo: https://github.com/amortimer20/code-loupe. The package and web component are named `code-loupe`.

The goal: let teachers turn a code snippet into a step-through animation that shows what
students can't normally see, such as the current line, variables changing, return values,
type conversions and console I/O. Students step through it at their own pace. It embeds
in any site, including Reveal.js decks, and other teachers can use it too.

## Where we are

Phase 1 (proof of concept) is done:

- `<code-loupe>` web component that embeds anywhere with a `<script>` tag
- Hand-written YAML lessons with readable error messages for mistakes
- Shiki syntax highlighting (VS Code grammars, 200+ languages)
- Variables panel, console, execution arrow, value badges, type tags
- Tweens: values fly between the console, the code and the Variables panel
- Step, scrub, autoplay, keyboard controls, speed menu, animations toggle
- Example lesson: `lessons/python/numeric-input/lesson.yaml` (casting input in Python)

The corpus now contains 24 lessons. Pause content expansion here and use these
examples to evaluate the existing player and authoring experience. More advanced
lesson topics remain backlog items; they are not the current implementation focus.

---

## 1. Name and repository

- [x] Choose a name: **Code Loupe** (see the naming notes at the end of this file)
- [x] Create the GitHub repo: [amortimer20/code-loupe](https://github.com/amortimer20/code-loupe)
- [x] First commit and push
- [x] Rename the package (`code-loupe`), element tag (`<code-loupe>`), class, storage keys and docs
- [x] Choose a license: MIT (see [`LICENSE`](../LICENSE))

## 2. Codebase walkthrough (pair session)

The pair walkthrough is complete. We followed the example lesson through parsing,
snapshot generation, rendering, animation, playback, and language-specific values:

- `packages/player/src/lesson.ts`: the lesson format and its validation
- `packages/player/src/state.ts`: turns steps into **snapshots**, the full picture at each step. This is
  why stepping backward and scrubbing are free.
- `packages/player/src/code-loupe.ts`: rendering, animation and playback
- `packages/player/src/values.ts`: per-language literals and type names (`True`/`None`, `str`/`int`)

From now on, build features as pair-programming sessions instead of in large solo batches.

Working conventions live in [`AGENTS.md`](../AGENTS.md); decisions and their reasons live in
[`docs/journal.md`](journal.md). The roadmap tracks planned work, rather than decision history.

## 3. Two ways to make a lesson: authored and traced

The renderer only knows about **steps**. It doesn't care where they come from. That lets us
offer two separate features that share one player:

|                      | **Authored** (static)                         | **Traced** (live)                               |
| -------------------- | --------------------------------------------- | ----------------------------------------------- |
| Where steps come from | The teacher writes them                       | Running the real code                           |
| Languages            | Any, today                                    | One tracer per language                         |
| Student input        | Fixed by the teacher                          | Students can change inputs and see the result   |
| Errors               | Only if the teacher authors them              | Real ones (`int("abc")` → `ValueError`)         |
| Teacher control      | Total: pacing, emphasis, simplifications      | Shows everything, so needs filtering             |
| Good for             | Concept explanations, misconceptions          | Exploration, "what if?", checking predictions   |

### A third, bridging feature: record a trace into an authored lesson

Run the code once with the tracer, then turn the result into an editable authored
lesson. The teacher deletes noise, adds captions and adjusts pacing. This gives teachers
a fast start without needing the live tracer to make perfect teaching decisions on its own.

### The hard design problem: captions that survive changed input

In a traced lesson the steps change when the input changes, so a caption can't be pinned
to "step 6". Ideas to explore:

- Attach annotations to **events** instead of step numbers: "when `age` is first assigned",
  "the first time line 2 runs", "when `int()` returns".
- Mark **focus regions** (only animate these lines; run the rest silently).
- Choose the **detail level** per lesson: lines only, expressions, or every sub-expression.

### Open questions

- [ ] Is "traced" a mode of the same lesson file, or a different kind of file?
- [ ] What can students change: only inputs, or the code too?
- [ ] How do we stop runaway programs (infinite loops) in a traced lesson? Step limits?
- [ ] Which tracer-generated events map onto which visuals?

### Current direction (2026-10-12)

Prioritize making the existing authored tool understandable and pleasant to use.
Follow the [authoring implementation plan](authoring-plan.md): improve the YAML
editor, add a small GUI builder for introductory actions, then add code selection
and step organization. Both views edit the same saved lesson; teachers retain
control of values, captions, and pacing. The schema and focused accessibility
work provide foundations for these authoring improvements.

Keep the corpus paused at 24 lessons. Tracing is deferred while we evaluate this
workflow. A future fixed-input trace-to-authored experiment may populate the
builder, but it is not the next implementation task. Iframe embedding and the
host styling API remain independent backlog items.

Before new builder forms, work through the behavior-preserving
[refactor plan](refactor-plan.md) (2026-10-14).

Ideas still to design, rather than settled API:

- Optional author-defined input constraints, including unrestricted text for error lessons.
- Independent execution-step and time limits, even when inputs are constrained.
- Event-anchored captions and live-value templates, with conditional captions considered later.
- Hosted iframe embeds and share links; hosting, sizing, and cross-origin loading need decisions.

### Tracers, language by language

All tracers rewrite the code to record each expression's value, because the usual
line-by-line debugging hooks don't show what a single call like `input()` returned.

| Language   | Approach                                                        | Difficulty |
| ---------- | --------------------------------------------------------------- | ---------- |
| Python     | Pyodide (Python compiled to WebAssembly) plus a code rewriter. This is the proof of concept. | Medium |
| JavaScript | Parse with Acorn or Babel, rewrite, run in a sandboxed iframe or worker | Easy |
| Emerald    | Compile the Zig interpreter to WebAssembly and have it **emit steps itself** | Medium; we control the interpreter |
| GDScript   | No browser runtime. Options: author only, or a teaching subset interpreter | Hard |
| C#         | Roslyn (the C# compiler) in .NET WebAssembly, with a syntax rewriter | Hard |

## 4. Visuals: how to organize them

The first extracted visual is the Call stack panel, with pure scope helpers,
panel rendering/animations, and shared variable rows in `packages/player/src/visuals/`.
Other visuals still live in the main component. As the set grows, each visual should
become a self-contained **module**:

- **Panel:** a region of the player (Variables, Console, Call stack, Memory/heap)
- **Actions:** the step keys it understands (`assign`, `call`, `return`, ...)
- **State:** how its actions change the snapshot (pure functions, which keeps
  back-stepping free)
- **Render + animate:** how it draws a snapshot and how it tweens to the next one

The player assembles only the modules a lesson uses, so a simple lesson stays simple.
Tweens between panels (such as a value flying from the console into a variable) work
through a shared "where is this value on screen?" lookup.

### Candidate visuals, by curriculum topic

| Topic                   | Visual idea                                                       |
| ----------------------- | ----------------------------------------------------------------- |
| Expressions             | Evaluate an expression piece by piece (`100 - age` → `100 - 30` → `70`) |
| Types and casting       | Type tags, convert morph (done); failed conversions raise an error |
| Conditionals            | The condition evaluates to `True`/`False`; the skipped branch dims |
| Loops                   | Iteration counter, loop variable history, the arrow jumping back   |
| Functions               | Call stack frames, arguments flying in, the return value flying out |
| Scope                   | Frames that own variables; shadowing                              |
| Lists and arrays        | Heap objects with indexed cells, authored selection, update/append/remove transitions (done) |
| Strings                 | Characters with indices, slicing                                   |
| Objects and references  | Heap boxes with arrows; two variables pointing to one object       |
| Errors                  | Exception badge, stack unwinding                                   |

- [x] First function-call lesson: parameter binding, local assignment, authored return,
      and a Call stack panel with argument/return animations.
- [x] Scope foundations: separate globals and locals, shadowing, and nested call frames.
- [x] Nested-call teaching lesson: a paused caller, independent same-named locals,
      and two returns back to global scope.
- [x] List-iteration lesson: flat list values, indexed cells, authored selection,
      element-to-badge transfers, and an accumulator with explicit exhaustion.
- [x] List element-update lesson: replace one indexed cell, transfer a badge into it,
      highlight the change, and restore the previous value when stepping backward.
- [x] Append and indexed-removal lessons: growing/shrinking lists, newly created
      cells, shifted indices, selection adjustment, and reversible snapshots.
- [x] Shared-list identity and aliasing lesson: explicit allocation/reference
      bindings, one object card, mutation through either name, and reversible sharing.
- [x] Copying versus aliasing lesson: two separate list cards with equal starting
      contents, mutation of only the copy, and outputs compared with aliasing.
- [x] Flat dictionary fields: one referenced object with named scalar fields,
      an existing-field update, a field read, and reversible snapshots.
- [x] First class-instance lesson: authored allocation, a constructor initializer
      frame with self, scalar attribute initialization, and a constructor reference
      result distinct from the initializer's None completion.
- [x] Two-instance lesson: separate initializer self bindings, independent scalar
      attributes, one-instance mutation, and contrasting outputs.
- [x] Instance-method lesson: a receiver bound to self, attribute mutation inside
      a method, and return to the caller.
- [ ] Nested objects, reference-valued returns,
      and memory lifetime/garbage-collection visuals.
- [ ] Extend module boundaries to the remaining visuals as new features need them.
- [ ] Closures, nonlocal/global assignment declarations, implicit returns, and exception unwinding.
- [x] **First syntax and runtime error lessons:** authored terminal diagnostics,
      a location marker/underline, runtime error-type annotation, and a separate
      diagnostic strip. Syntax failures precede execution; runtime failures retain
      earlier state/output. Backward stepping restores the pre-error view and
      autoplay stops. Program errors remain distinct from lesson-YAML failures.
- [ ] Extend error lessons to failures inside calls, expandable tracebacks,
      stack unwinding, and caught exceptions; design pacing and recovery semantics.

## 5. Authoring: tutorial, playground, visual editor

- [x] **Lesson JSON Schema:** editor completion/descriptions, structural validation,
      corpus checks, and property coverage against authored TypeScript declarations.
      Runtime state validation remains separate; the playground uses the same schema.

1. [x] **Tutorial** ([`docs/tutorial.md`](tutorial.md)): build a lesson file from scratch, one concept at a time
2. [x] **Playground page** (`/playground/` on the sample site): YAML on the left, live player on the right,
       errors inline, browser draft persistence, and YAML download. Makes the tutorial
       interactive and is the first step toward the editor.
3. [x] **Sample library and workspace split:** independent player package plus an Astro
       static site with searchable samples, teaching notes, canonical YAML downloads,
       sample-specific playground drafts, and build-time lesson validation.
4. [ ] **Grow the comparison corpus:** add lessons as each new visual or behavior lands.
       Begins with Hello, world, simple arithmetic, naming a value, changing a value,
       and strings versus numbers, followed by input conversion, Boolean comparisons,
       a conditional branch, a simple while loop, an accumulator loop, and a
       function call, nested calls, list iteration, element updates, append, and
       indexed removal, shared-list aliasing, a copying comparison, and named
       dictionary fields, class-instance initialization, two independent instances,
       an instance-method call, and syntax/runtime errors.
       The initial five-lesson introductory sequence is complete.
5. [x] **Improved source editor:** YAML highlighting/indentation plus schema completion,
       hover help, and diagnostics in the playground. Preserve saved drafts and downloads.
6. [ ] **Small GUI builder:** introductory action forms, code-target selection,
       keyboard step organization, and shared preview/undo with the source editor.
       Use the agreed Step cards layout: expandable cards beside the live preview.
       Lesson details, introductory scalar, input/conversion, and list action forms,
       caption editing, new drafts, shared undo/redo, preview code picking, and step
       insertion, duplication, and keyboard moves are implemented. Teacher trials,
       drag reordering, and dictionary/call/instance forms remain.
       Follow [the implementation plan](authoring-plan.md); advanced content is preserved
       while its dedicated forms remain future work.

## 6. Styling Code Loupes

- Today: `theme` selects Paper, Midnight, Terminal, or any Shiki theme. Starter
  presets coordinate syntax and player colors, with square corners. The sample
  site's remembered theme picker applies its choice to the site and its players.
  Theme changes preserve the current lesson and step. See [styling notes](styling.md).
  The player uses Shadow DOM; a supported host styling API is still needed.
- [x] Three starter presets and a Phosphor-inspired demo site with square panes,
      thin borders, coordinated surfaces, and monospace headings/labels.
- [ ] **Host-page styling API:** documented CSS custom properties for fonts, sizes,
      colors, spacing, borders, and corner radii, so teachers can match a website or slide deck.
      Support page-wide defaults and overrides for individual `<code-loupe>` instances.
      Define a small, stable set of CSS `::part` hooks for customization beyond those properties.
- [ ] **Typography:** separate code/console and interface/caption fonts; font size,
      line height, and badge/type-tag sizing. Reposition badges and arrows when custom fonts load.
- [ ] **Shape and layout:** player, panel, badge, and control corner radii; border width
      and color; padding and gaps; variable-panel width and a compact presentation for slides.
      Keep code targets aligned and the player usable at narrow widths.
- [ ] **Colors and states:** accent, active-line highlight, variable names, console input,
      errors, and keyboard-focus styling. Define how explicit color overrides interact with
      colors derived from the syntax-highlighting theme.
- [ ] Teacher sets a default theme and accent color per lesson or per page
- [ ] Viewer theme menu (like the speed menu), remembered per viewer
- [ ] Automatic light/dark following the viewer's system setting
- [ ] A few curated themes with checked contrast; never rely on color alone to tell types apart (type tags already help)
- [ ] **Styling guide and examples:** demonstrate a site-matched player and a compact
      slide player; verify light/dark themes, keyboard focus, reduced motion, and custom fonts.
- [ ] **Lesson-aware responsive layouts (backlog):** explore constrained embed sizes,
      long code, deep stacks, collections, resizable panes, and teacher-selected layouts.
      Narrow-width stacking and bounded-height viewing are the baseline;
      lesson-specific layout choices remain to be designed.
- [x] First short-screen improvement: sample-page fullscreen icon/view and opt-in
      bounded-height player (`fit`), preserving steps with internally scrollable
      panes and active-line following. Compact spacing remains a next iteration.

## 7. Embedding and distribution

- [ ] **Reveal.js adapter (backlog, not a current priority)**: steps become fragments,
      so the clicker advances the animation
- [ ] Publish to npm and a CDN so teachers can use one `<script>` tag
- [ ] Smaller bundle: load only the languages and themes actually used
- [ ] Emerald grammar for Shiki (from its VS Code extension, if it has a TextMate grammar)

## 8. Quality

- [x] Initial unit tests for step-to-snapshot logic: call/return, nested frames,
      shadowing, preserved snapshots, invalid transitions, and existing corpus outcomes.
- [x] Checked-in Playwright behavior tests with full and reduced motion, plus
      thirty-eight reviewed screenshot references for themes, nested calls/returns,
      list selection/updates/length changes/aliasing/copying, the gallery, narrow player,
      short-laptop Focus lesson view, the final false while-loop condition, and
      dictionary fields in all three presets, instance initialization/results,
      two instances with independent attributes, a method's self binding/None result,
      and syntax/runtime diagnostics in all three presets;
      pinned Docker environment for CI parity.
- [x] First focused accessibility slice: binding-based list-cell labels, concise
      step announcements, native form-control keys, and automated focus checks.
- [ ] Manual accessibility review: real screen-reader announcements, keyboard-only
      use across browsers, focus order, and autoplay verbosity.
- [x] GitHub Actions workflow: lockfile install, unit tests, browser types,
      production builds/corpus validation, behavioral and visual tests, and
      retained failure reports/traces. Runs on pushes and pull requests.
- [ ] Extend browser coverage to Firefox and WebKit as embedding needs grow.

---

## 9. Mathematics (removed)

A small experiment with authored arithmetic and algebra walkthroughs lived at `/math/` from
2026-10-14 and was removed on 2026-10-15 because it did not meet expectations. It was isolated
from the code player and lesson format. It can be recovered from git history (commit `a1c16e2`),
but any future mathematics work should start from a fresh design discussion.

## Suggested order

1. Name, repo, codebase walkthrough
2. Tutorial and playground page (makes authoring pleasant now)
3. Sample library, function-call visual, and nested-call lesson (complete)
4. Grow the corpus with collections and references; currently paused at 24 lessons
5. Improve the YAML editor, then build and trial a small GUI lesson builder
6. Reassess trace-to-authored recording after the authoring workflow is usable
7. Further embedding, styling, languages, and Emerald as needs emerge

The Reveal.js adapter remains in the embedding backlog; it is not part of the
near-term sequence.

## Naming notes

**Code Loupe** was chosen on 2026-10-03. Runners-up: Onionskin, Dry Run, Glassbox, Playhead.

- **Why "Code Loupe" and not plain "Loupe":** npm `loupe` is taken (an object-inspection utility
  from Chai), and [latentflip/loupe](https://github.com/latentflip/loupe) is an older JavaScript
  event-loop visualizer in the same space. "Code Loupe" avoids both.
- **npm:** `code-loupe` was available when checked on 2026-10-03, so no scope is needed.
- **Element:** `<code-loupe>` (custom element names need a hyphen, and this one already has it).
- **Tagline idea:** *"Code Loupe: step-through code animations for teaching."*
- **Possible mode names:** *Dry Run* (authored lessons) and *Live Run* (traced lessons).
