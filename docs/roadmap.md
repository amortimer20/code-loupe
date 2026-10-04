# Roadmap

> **Code Loupe**: a loupe is a jeweler's magnifying glass for close inspection, and a nod to Emerald.
> Repo: https://github.com/amortimer20/code-loupe. The code still says "code-animator" until the rename (section 1).

The goal: let teachers turn a code snippet into a step-through animation that shows what
students can't normally see, such as the current line, variables changing, return values,
type conversions and console I/O. Students step through it at their own pace. It embeds
in any site, including Reveal.js decks, and other teachers can use it too.

## Where we are

Phase 1 (proof of concept) is done:

- `<code-animator>` web component that embeds anywhere with a `<script>` tag
- Hand-written YAML lessons with readable error messages for mistakes
- Shiki syntax highlighting (VS Code grammars, 200+ languages)
- Variables panel, console, execution arrow, value badges, type tags
- Tweens: values fly between the console, the code and the Variables panel
- Step, scrub, autoplay, keyboard controls, speed menu, animations toggle
- Example lesson: `public/lessons/numeric-input.yaml` (casting input in Python)

---

## 1. Name and repository

- [x] Choose a name: **Code Loupe** (see the naming notes at the end of this file)
- [x] Create the GitHub repo: [amortimer20/code-loupe](https://github.com/amortimer20/code-loupe)
- [ ] First commit and push
- [ ] Rename the package (`code-loupe`), element tag (`<code-animator>` → `<code-loupe>`), class, storage keys and docs
- [ ] Choose a license (MIT is typical for embeddable teaching tools)

## 2. Codebase walkthrough (pair session)

Walk through the code together before building more on it:

- `src/lesson.ts`: the lesson format and its validation
- `src/state.ts`: turns steps into **snapshots**, the full picture at each step. This is
  why stepping backward and scrubbing are free.
- `src/code-animator.ts`: rendering, animation and playback
- `src/values.ts`: per-language literals and type names (`True`/`None`, `str`/`int`)

From now on, build features as pair-programming sessions instead of in large solo batches.

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

Today the visuals are hard-coded into the component. As the set grows, each visual should
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
| Lists and arrays        | Indexed cells, an index pointer, append/remove animations         |
| Strings                 | Characters with indices, slicing                                   |
| Objects and references  | Heap boxes with arrows; two variables pointing to one object       |
| Errors                  | Exception badge, stack unwinding                                   |

## 5. Authoring: tutorial, playground, visual editor

1. [ ] **Tutorial** (`docs/tutorial.md`): build a lesson file from scratch, one concept at a time
2. [ ] **Playground page**: YAML on the left, live player on the right, errors inline. This is
       cheap to build, makes the tutorial interactive, and is the first step toward the editor.
3. [ ] **Visual editor**: click a line, click a piece of code to attach a badge, drag steps to
       reorder, preview while editing. It saves the same YAML format, so hand-editing still works.

## 6. Themes and colors

- Today: `theme` attribute sets any Shiki theme, and the panel colors follow it
- [ ] Teacher sets a default theme and accent color per lesson or per page
- [ ] Viewer theme menu (like the speed menu), remembered per viewer
- [ ] Automatic light/dark following the viewer's system setting
- [ ] A few curated themes with checked contrast; never rely on color alone to tell types apart (type tags already help)

## 7. Embedding and distribution

- [ ] **Reveal.js adapter**: steps become fragments, so the clicker advances the animation
- [ ] Publish to npm and a CDN so teachers can use one `<script>` tag
- [ ] Smaller bundle: load only the languages and themes actually used
- [ ] Emerald grammar for Shiki (from its VS Code extension, if it has a TextMate grammar)

## 8. Quality

- [ ] Unit tests for the step-to-snapshot logic (`state.ts`)
- [ ] Visual tests with Playwright, **including reduced motion**
- [ ] Accessibility review: screen-reader announcements per step, keyboard-only use, focus order
- [ ] CI on GitHub

---

## Suggested order

1. Name, repo, codebase walkthrough
2. Tutorial and playground page (makes authoring pleasant now)
3. Reveal.js adapter (puts it into your real lessons)
4. Visual module structure, then functions and the call stack as the first new visual
5. Design session on authored versus traced lessons, then the Python tracer proof of concept
6. Visual editor
7. Themes, more languages, Emerald

## Naming notes

**Code Loupe** was chosen on 2026-10-03. Runners-up: Onionskin, Dry Run, Glassbox, Playhead.

- **Why "Code Loupe" and not plain "Loupe":** npm `loupe` is taken (an object-inspection utility
  from Chai), and [latentflip/loupe](https://github.com/latentflip/loupe) is an older JavaScript
  event-loop visualizer in the same space. "Code Loupe" avoids both.
- **npm:** `code-loupe` was available when checked on 2026-10-03, so no scope is needed.
- **Element:** `<code-loupe>` (custom element names need a hyphen, and this one already has it).
- **Tagline idea:** *"Code Loupe: step-through code animations for teaching."*
- **Possible mode names:** *Dry Run* (authored lessons) and *Live Run* (traced lessons).
