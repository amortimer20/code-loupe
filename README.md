# Code Loupe

Step-through animations of code for teaching. Students step forward and back through a
program and watch the current line, variables, return values, type conversions and console
I/O change. It's a web component, so it embeds in any page.

Lessons currently play teacher-authored steps; the player does not execute the code.
See the [roadmap](docs/roadmap.md) for planned features, the [project journal](docs/journal.md)
for design decisions, and [AGENTS.md](AGENTS.md) for development conventions.

## Run the sample site

Use Node.js 22.12 or newer and npm 9.6.5 or newer.

```sh
npm install
npm run dev          # http://localhost:5173
npm run build        # player library + static Astro site
npm run build:player # packages/player/dist/code-loupe.js and accompanying assets
npm run build:site   # apps/site/dist/ — deploy this folder to a static host
npm run typecheck    # check both workspaces
npm test             # snapshot and call-frame tests
npm run test:e2e      # build + behavioral Chromium checks (full and reduced motion)
npm run test:docker   # complete pipeline, including visual comparisons, in Docker
```

The home page is a searchable sample library. Each lesson has a player, teaching
notes, a YAML download, and an **Edit in playground** link. Open
[the playground](http://localhost:5173/playground/) to author a lesson locally.
Edits restart the preview at Step 0 after a short pause; errors appear below the
editor and in the player. Drafts are saved in browser storage when available,
with separate drafts for each sample. Download preserves the exact YAML, even
for incomplete lessons. There is no account or backend.

On a sample page, the four-corner **Enter fullscreen** icon at the top right of
the player fills the viewport. It preserves your step; click the **Exit fullscreen**
icon or press Escape to return.
The code follows the active line, while code and variable/call-stack panes scroll
internally as needed. Captions, console, and playback controls remain available.

## Repository structure

```text
packages/player/  Embeddable web component and pure lesson/snapshot logic
apps/site/        Static Astro gallery, sample pages, guide, and playground
lessons/          Canonical YAML lessons plus Markdown metadata and teaching notes
docs/             Tutorial, contribution guide, roadmap, and journal
```

The corpus includes Python input conversion, an accumulator loop, a conditional
branch, a function call, and nested calls with separate locals and return values.
See [Adding samples](docs/samples.md) to contribute another
lesson without editing the site routes. The site validates every lesson during
its build and generates download files from the canonical YAML.

The player builds independently of Astro. `npm run build:playground` is retained
as an alias for the site build. The workspaces are private while distribution
is still being designed.

## Verification pipeline

GitHub Actions runs unit tests, browser-test type checking, production builds
(including player/site type checks and corpus validation), and Playwright checks
on pushes and pull requests. Chromium behavioral tests cover full and reduced
motion; visual references cover the three themes, nested calls and returns, the
gallery, and a narrow player. Failures retain an HTML report, traces, and screenshots.

Run `npm run test:docker` for the complete CI-matched pipeline. For browser checks
without visual comparisons, install Chromium with `npx playwright install chromium`
and run `npm run test:e2e`. See [Testing](docs/testing.md) for setup, focused runs,
baseline review, and current coverage limits.

## Embed it

```html
<script type="module" src="code-loupe.js"></script>

<code-loupe src="lessons/numeric-input.yaml"></code-loupe>

<!-- or inline -->
<code-loupe>
  <script type="text/yaml">
    language: python
    code: |
      x = 5
    steps:
      - line: 1
        assign: { var: x, value: 5 }
  </script>
</code-loupe>
```

| Attribute     | Meaning                                                      |
| ------------- | ------------------------------------------------------------ |
| `src`         | URL of a YAML lesson                                         |
| `theme`       | Starter preset `paper`, `midnight`, or `terminal`, or any [Shiki theme](https://shiki.style/themes); default `dark-plus` |
| `speed`       | Default playback speed, e.g. `0.75`. A viewer's own choice from the speed menu is remembered and wins. |
| `motion`      | `full` animates even when the OS asks for reduced motion (Windows "Animation effects" off); `reduced` starts with animations off. Viewers can always flip the animations button, and their choice is remembered. |
| `no-keyboard` | Don't handle ← → Home End Space (e.g. when a host page does) |
| `fit`         | Fit a definite height supplied by the host (e.g. `style="height: 70dvh"`). Keep captions, console, and controls below scrollable code/data panes; follow the active line. |

JavaScript API: `next()`, `prev()`, `goTo(n)`, `play()`, `pause()`, `step`, `total`, and a
`stepchange` event with `{ step, total }`.

For live authoring, `await player.loadLesson(yaml)` loads YAML directly and returns
`true` on success or `false` if loading fails or a newer load supersedes it. Successful
loads restart at Step 0 and emit `stepchange`; failed loads show an error and emit
`lessonerror` with `{ message }`. Event payloads are in `event.detail`.
Direct loads don't change the `src` attribute. Changing `src` or reconnecting the
element loads its configured URL or inline lesson again. Changing `theme` pauses
playback and recolors the current lesson, preserving its step and directly loaded draft.

## Starter themes

```html
<code-loupe src="lesson.yaml" theme="paper"></code-loupe>
<code-loupe src="lesson.yaml" theme="midnight"></code-loupe>
<code-loupe src="lesson.yaml" theme="terminal"></code-loupe>
```

Paper uses warm surfaces and inky colors; Midnight uses navy surfaces and bright
syntax colors; Terminal uses charcoal-green surfaces with green accents. Each
preset coordinates code, runtime values, panels, badges, console input, errors,
and controls. Corners are square throughout, and code ligatures are disabled.

The sample site's header picker changes the site and its players together. Its
choice is remembered in this browser when storage is available; Midnight is the
site default. Independent embeds keep their own `theme` attribute and do not use
the site's saved preference. There is no automatic system-theme switching yet.

The site's square panes, thin dividers, and typography take their direction from
[Phosphor](https://github.com/amortimer20/phosphor). The presets are a starting point;
a host-provided token API, font controls, and lesson-aware resizing remain future
work. See the [styling notes](docs/styling.md) for the current boundaries.

## Lesson format

Start with the [lesson-writing tutorial](docs/tutorial.md) for a guided example.
The tables below provide a quick reference.

```yaml
title: Converting user input to a number   # optional
language: python                           # any Shiki language id
code: |
  text = input("Enter your age: ")
  age = int(text)
steps:
  - line: 1
    caption: Text shown under the code for this step.
```

Ordinary steps can combine actions. They animate in this order: console → badge →
convert → assign → update. `call` and `return` each require their own step, with an optional caption.

| Key       | Example                                         | What it does |
| --------- | ----------------------------------------------- | ------------ |
| `line`    | `line: 2`                                       | Move the arrow to a line. Clears badges from the previous line. |
| `caption` | `caption: int() converts...`                    | Explanation for this step. |
| `write`   | `write: "Enter your age: "`                     | Output text with no newline. |
| `print`   | `print: Hello!`                                 | Output a line. `print: { text: ..., from: badge }` flies the latest badge's value into the printed text. |
| `input`   | `input: "30"`                                   | The user types this and presses Enter. |
| `badge`   | `badge: { over: int(text), value: 30 }`         | Float a value above code on the current line (`line:` and `nth:` pick another spot). Add `from: console` to fly it up from the user's input, or `from: { var: text }` to fly it from a variable. |
| `convert` | `convert: { over: int(text), value: 30 }`       | Turn the latest badge into a new value, optionally moving it. |
| `assign`  | `assign: { var: age, from: badge }`             | Store a value in a variable. `from: badge` flies the latest badge into it; or give `value:`. |
| `select` | `select: { var: numbers, index: 0 }` | Mark a zero-based list cell. The selection persists across steps; `select: null` clears it. |
| `update` | `update: { var: numbers, index: 1, value: 10 }` | Replace an existing list element. `from: badge` transfers the latest badge's scalar value into that cell. |
| `call` | `call: { name: add_one, line: 1, over: add_one(value), args: [{ var: value, from: badge }] }` | Save the current caller line and call target, enter a function frame at `line`, and bind its parameters. |
| `return` | `return: { from: badge }` | Leave the active function, restore its caller, and show the result over the saved call target. Alternatively supply `value` and optional `type`. |

Values: `"30"` (quoted) is a string, `30` is a number, `true`/`false`/`null` are written in the
lesson language's style (`True`/`None` in Python). Types like `str`/`int` are inferred per
language; add `type: float` etc. to override.

Flat lists of these scalar values are supported, including empty lists:
`assign: { var: numbers, value: [2, 4, 6] }`. Python infers `list`; JavaScript
infers `array`. Variable lists display indexed cells; list badges display a literal.
Nested lists, objects, length-changing operations, and shared-reference identity are not modeled yet.

See the [list-iteration lesson](lessons/python/list-iteration/lesson.yaml). An
indexed source such as `badge: { over: numbers, value: 2, from: { var: numbers, index: 0 } }`
flies the authored badge value from that cell. The teacher still supplies the
value: sources identify animation origins, not computed reads. Indices must be
integers within an existing list. Both `select` and indexed sources look up locals
then globals; `scope: global` selects a shadowed global explicitly.
Selection is applied before badge animation and remains through the loop body.
Reassigning the selected list or returning from its owning frame clears it.
Lists are snapshot values, not a model of Python object identity or aliasing.

The [element-update lesson](lessons/python/list-update/lesson.yaml) replaces one
cell while preserving its neighbors and list length. `update` requires an existing
list, a valid zero-based `index`, and a scalar `value` or `from: badge`. It resolves
locals then globals; `scope: global` explicitly updates a shadowed global. Selection
is separate: use `select` to mark a cell and `select: null` to clear it. A forward
update briefly highlights the changed cell; reduced motion and backward stepping
show the stored state immediately. Negative indices and append/remove are not supported.

Mistakes in a lesson (unknown keys, code that isn't on the line, missing values) show up as
a readable error inside the player.

## Function calls and scope

See the [function-call sample](lessons/python/function-call/lesson.yaml) for a complete lesson.
Follow it with the [nested-call sample](lessons/python/nested-function-call/lesson.yaml)
to see one caller pause while another runs and two returns resume their callers.
Highlight the caller line before a `call` step. Its `over` identifies the exact call
text on that active line; `nth` chooses an occurrence. The call's `line` is the
function entry line. `args` is an optional list of parameter bindings, each using
`var` with either `value` or `from: badge` (the latest caller badge).

Assignments inside a function update its own locals. A badge source such as
`from: { var: value }` looks in the active frame, then globals. Use
`from: { var: value, scope: global }` to explicitly select a shadowed global.
Suspended callers' locals are not visible to another function.

`return` supplies an authored result; it does not evaluate code. It restores the
saved caller line and replaces badges inside the call expression with a result
badge. Badges outside that expression survive. Assign the returned badge in the
next step to store it in the caller's scope. Nested calls have separate frames,
including repeated calls with the same function name.

The Call stack panel appears only in lessons containing `call`. Globals remain
in the Variables panel; each function frame owns its local variables. Stepping
backward across a return restores that frame and its locals from the snapshot.
Closures, nonlocal/global assignment declarations, exceptions, and implicit returns
are not modeled yet. An authored no-value return can use `return: { value: null }`.

## License

Code Loupe is available under the [MIT License](LICENSE).
