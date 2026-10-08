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
| Lists and arrays        | Indexed cells, authored selection, update/append/remove transitions (done) |
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
- [ ] Nested objects, reference-valued returns,
      and memory lifetime/garbage-collection visuals.
- [ ] Extend module boundaries to the remaining visuals as new features need them.
- [ ] Closures, nonlocal/global assignment declarations, implicit returns, and exception unwinding.

## 5. Authoring: tutorial, playground, visual editor

1. [x] **Tutorial** ([`docs/tutorial.md`](tutorial.md)): build a lesson file from scratch, one concept at a time
2. [x] **Playground page** (`/playground/` on the sample site): YAML on the left, live player on the right,
       errors inline, browser draft persistence, and YAML download. Makes the tutorial
       interactive and is the first step toward the editor.
3. [x] **Sample library and workspace split:** independent player package plus an Astro
       static site with searchable samples, teaching notes, canonical YAML downloads,
       sample-specific playground drafts, and build-time lesson validation.
4. [ ] **Grow the comparison corpus:** add lessons as each new visual or behavior lands.
       Begins with Hello, world, simple arithmetic, naming a value, changing a value,
       and strings versus numbers, followed by input conversion,
       an accumulator loop, a conditional branch, and a
       function call, nested calls, list iteration, element updates, append, and
       indexed removal, shared-list aliasing, and a copying comparison.
       The initial five-lesson introductory sequence is complete.
5. [ ] **Visual editor**: click a line, click a piece of code to attach a badge, drag steps to
       reorder, preview while editing. It saves the same YAML format, so hand-editing still works.

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
      twenty-three reviewed screenshot references for themes, nested calls/returns,
      list selection/updates/length changes/aliasing/copying, the gallery, narrow player,
      and short-laptop Focus lesson view;
      pinned Docker environment for CI parity.
- [ ] Accessibility review: screen-reader announcements per step, keyboard-only use, focus order
- [x] GitHub Actions workflow: lockfile install, unit tests, browser types,
      production builds/corpus validation, behavioral and visual tests, and
      retained failure reports/traces. Runs on pushes and pull requests.
- [ ] Extend browser coverage to Firefox and WebKit as embedding needs grow.

---

## 9. Mathematics exploration (long-term backlog)

- [ ] Explore authored algebra lessons after the code-teaching foundations.
      Start with a small prototype displaying successive teacher-authored equations
      and captions, using LaTeX-style notation rendered by a math library such as
      KaTeX. Keep math lesson types and rendering separate from code execution state;
      assess shared playback controls and captions before extracting a common shell.
      Animated term transformations, mathematical validation, and student-entered
      solutions are later questions. This is not part of the near-term sequence.

## Suggested order

1. Name, repo, codebase walkthrough
2. Tutorial and playground page (makes authoring pleasant now)
3. Sample library, function-call visual, and nested-call lesson (complete)
4. Grow the corpus with collections and references; extend visual modules as needed
5. Design session on authored versus traced lessons, then the Python tracer proof of concept
6. Visual editor
7. Themes, more languages, Emerald

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
