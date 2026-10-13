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
npm test             # player state and site document-editing tests
npm run test:e2e      # build + behavioral Chromium checks (full and reduced motion)
npm run test:docker   # complete pipeline, including visual comparisons, in Docker
```

The home page is a searchable sample library. Each lesson has a player, teaching
notes, a YAML download, and an **Edit in playground** link. Open
[the playground](http://localhost:5173/playground/) to author a lesson locally.
Builder opens with expandable step cards beside the live player. Use **Lesson
details** for title, language, and code, then add a line highlight, value badge,
assignment, or print step. Choose Number, Text, Boolean, or None explicitly.
**Save step** saves a form edit and previews that step's completed state; unsaved
entries stay in the form while switching views, but are not saved across reloads.
**New lesson** has a separate browser draft from the samples.

The **YAML** tab edits the same draft. Source edits restart the preview at Step 0
after a short pause; errors appear below the editor and in the player. Undo/Redo
share one history between both views. Advanced actions retain their YAML and have
editable captions; anchors, aliases, and unsupported tags stay in the source editor.
Drafts are saved in browser storage when available,
with separate drafts for each sample. Download preserves the exact YAML, even
for incomplete lessons. Switching views without edits preserves the original text;
saving forms can adjust YAML formatting while preserving untouched fields and
comments. If a pending form's step changes in YAML, discard its form edits before saving.
There is no account or backend.

In the playground, **Save step** and **Save lesson details** put form edits into
this browser's draft. **Discard step edits** and **Discard details edits** drop
unsaved form entries; **Undo** reverses edits already saved. **Delete step** is
undoable. Deleting a step can leave later steps needing repair if they use its value.
If YAML becomes invalid, **Restore last working lesson** recovers the most recent
successful preview, including after reloading when browser storage is available.
Restore is itself undoable. Older drafts without a checkpoint can recover the
starting sample (or the blank new lesson); that fallback is not your earlier edits.
Download YAML to keep a copy outside this browser.

New Builder cards stay outside the YAML until **Save step** validates and adds
them. The working preview remains available while you fill them in; **Cancel new
step** drops the unsaved card. One new card can be open at a time, and its entries
survive switching views but are not persisted across reloads or exported.
Number display lives under **Optional settings**. Occurrence appears for repeated
expression text or an existing explicit occurrence; hidden settings are preserved.

On desktop, the editor scrolls independently beside a bounded preview. Selecting
or adding a card reveals its header and first fields without moving the page.
Tabs and Undo/Redo remain above the editor. Card scrolling respects reduced motion;
narrow screens keep the stacked layout and ordinary page scrolling.

Use **Pick from preview** in a supported step to click a code line. For **Show a
value**, drag across an expression within one line to fill its text and occurrence.
Picking changes only the unsaved form; it preserves the authored value and caption.
Escape or **Cancel picking** stops the picker. Manual line/text/occurrence fields
remain available for keyboard use. Advanced targets remain editable in YAML.

Picking highlights the hovered line. Preview stepping, scrubbing and autoplay
select and reveal the matching saved card without moving keyboard focus. Pending
edits and new cards are kept; focusing a form pauses autoplay. Lesson details
uses a language dropdown from the installed syntax-highlighting catalog, with
common languages first and imported aliases preserved until explicitly changed.

Saved drafts from before the address-format change may show a migration error.
Choose **Update draft syntax** to convert their old location mappings while keeping
the authored code, values, and captions. The update shares Undo/Redo with other
edits. It never runs automatically; unsafe or ambiguous drafts remain available
in YAML for repair. The player still rejects the removed syntax.

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

Start with [Hello, world](lessons/python/hello-world/lesson.yaml) and
[Simple arithmetic](lessons/python/simple-arithmetic/lesson.yaml), then naming
and changing a value and comparing strings with numbers. The corpus
continues with Python input conversion, Boolean comparisons, a conditional
branch, while and accumulator loops, functions with separate locals and return
values, and list operations,
aliasing, and copying.
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

When the player itself is focused, ←/→ step, Home/End jump, and Space
plays or pauses. Form controls and editable slotted content keep their native
keyboard behavior; `no-keyboard` disables player shortcuts while leaving
buttons and the step slider usable. The slider exposes its current step in words. When a navigation button becomes
disabled at a lesson boundary, focus returns to the player so shortcuts remain usable.

A polite status region announces the displayed step, line, relevant values,
output/errors, and caption without moving focus. Theme/resize renders do not
repeat unchanged announcements. List cells use the relevant binding name; local
names include the function/frame, and orphaned lists use their object label.
The object card retains its identity label and alias list. This is an initial
accessibility improvement; manual screen-reader and cross-browser audits remain open.

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

The site's **Appearance** picker offers Light/Dark modes with distinct page,
panel, field, and selected-step surfaces. It initially follows the system preference
and remembers your choice. The separate **Lesson theme** picker controls player
palettes, defaults to Midnight, and preserves the current step and draft. The YAML
editor follows site appearance. Independent embeds keep their own `theme` attribute.

Square corners remain, with monospace headings and code and sans-serif forms. A host-provided token API, font controls, and lesson-aware resizing remain
future work. See the [styling notes](docs/styling.md) for the current boundaries.

## Lesson format

Start with the [lesson-writing tutorial](docs/tutorial.md) for a guided example.
The tables below provide a quick reference.

The [lesson JSON Schema](packages/player/lesson.schema.json) provides editor
completion, hover descriptions, and structural checks. With the Red Hat YAML
extension in VS Code, put this comment at the top of a canonical lesson:

```yaml
# yaml-language-server: $schema=../../../packages/player/lesson.schema.json
```

The path is relative to the YAML file; adjust it for files outside
`lessons/<language>/<slug>/`. Consumers of the player package can use
`code-loupe/lesson.schema.json`. Schema checks cover action shapes, addresses,
and step combinations. The playground uses the same schema for completion,
hover descriptions, and source diagnostics, with YAML highlighting and two-space
indentation. Select a source problem to go to its location. Ctrl+Space opens
suggestions; Ctrl+M lets Tab leave the editor. Its preview and the site build
also validate source values, object identity, scope, and code targets.

The enhanced editor loads only on the playground; if it cannot load, a plain
textarea remains available. Draft storage and downloads keep your YAML text,
including comments and incomplete work. The player package has no editor dependency.


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
convert → assign → collection mutation. Use at most one `update`, `append`, or
`remove` per step. `call`, `return`, and `error` each require their own step, with an optional caption.
Allocation precedes these value actions, so a step can allocate an object and bind
a name to it.

A badge with an address in `from` must match that source's current value,
including an indexed element, named field, or whole list. Types are compared
strictly: `5` and `"5"` differ. With `print` or `write` using `from: badge`, the
authored text must contain the badge's printed form (strings print raw), allowing
values embedded in messages. Mismatches are hard lesson errors. Such output
cannot share a step with `badge` or `convert`; put it in a separate later step.
Combining badge/conversion with `assign: { from: badge }` remains valid.

| Key       | Example                                         | What it does |
| --------- | ----------------------------------------------- | ------------ |
| `line`    | `line: 2`                                       | Move the arrow to a line. Clears badges from the previous line. |
| `caption` | `caption: int() converts...`                    | Explanation for this step. |
| `write`   | `write: "Enter your age: "`                     | Output text with no newline. |
| `print`   | `print: Hello!`                                 | Output a line. `print: { text: ..., from: badge }` flies the latest badge's value into the printed text. |
| `input`   | `input: "30"`                                   | The user types this and presses Enter. |
| `badge`   | `badge: { over: int(text), value: 30 }`         | Float a value above code on the current line (`line:` and `nth:` pick another spot). Add `from: console` to fly it up from the user's input, or `from: 'text'` to fly it from a variable. |
| `convert` | `convert: { over: int(text), value: 30 }`       | Turn the latest badge into a new value, optionally moving it. |
| `assign`  | `assign: { var: age, from: badge }`             | Store a value in a variable. `from: badge` flies the latest badge into it; or give `value:`. |
| `allocate` | `allocate: { id: list-1, value: [2, 4] }` | Create a list, or use `fields: { name: Ada, score: 5 }` for a flat dictionary. `assign: { var: numbers, ref: list-1 }` binds a name to its identity. |
| `select` | `select: 'numbers[0]'` | Mark a zero-based list cell. The selection persists across steps; `select: null` clears it. |
| `update` | `update: { target: 'numbers[1]', value: 10 }` | Change a list element, dictionary field (`student["score"]`), or instance attribute (`self.name`). `from: badge` transfers the latest badge's scalar value. |
| `append` | `append: { target: 'numbers', value: 6 }` | Add a scalar at the end of a list, including an empty one. Alternatively use `from: badge`. |
| `remove` | `remove: 'numbers[1]'` | Delete an element by zero-based index; later elements shift forward. |
| `call` | `call: { name: add_one, line: 1, over: add_one(value), args: [{ var: value, from: badge }] }` | Save the current caller line and call target, enter a function frame at `line`, and bind its parameters. |
| `return` | `return: { from: badge }` | Leave the active function, restore its caller, and show the result over the saved call target. Alternatively supply `value` and optional `type`. |
| `error` | `error: { kind: runtime, name: ValueError, message: Cannot convert., line: 3, over: int(age) }` | End execution with an authored diagnostic, preserving earlier state/output. A syntax error must be the first step. |

### Addresses

`var` names a binding being created or rebound (assignments and call parameters).
`target` and badge `from` address an existing location. Use a name such as
`numbers`, one list index (`numbers[1]`), one quoted dictionary key
(`report["score"]` or `report['score']`), or one instance attribute (`ada.name`).
Names use letters, digits, and underscores and cannot start with a digit.
Addresses have no whitespace and at most one accessor. Indices must be
nonnegative integers. Keys must be nonempty; double-quoted keys use JSON escapes,
while single-quoted keys cannot contain a single quote or backslash.

`select` and `remove` require an index. `update.target` requires an accessor;
use `assign` to rebind a bare name. `append.target` requires a bare name.
Accessors must match the object kind: integer brackets select a list,
quoted brackets select a dictionary, and dot notation selects an instance.

Lookup uses locals, then globals. To bypass a shadowing local, use an address
mapping: `from: { target: 'numbers[1]', scope: global }`,
`select: { target: 'numbers[1]', scope: global }`, or the same mapping for remove.
Update and append put `scope: global` beside their existing `target`.
Scope is accepted only in address mappings. `from: console` still reads console
input; use `from: { target: 'console' }` for a variable named console.

Quote every address, as the sample lessons do: `from: 'score'`, `target: 'ada.name'`,
`select: 'numbers[1]'`. Inside YAML flow mappings (`{ ... }`), addresses containing
brackets must be quoted, and quoting all of them keeps one rule to remember.
The old `var`/`index`/`key`/`attribute` location mappings are removed; saved drafts
using them receive migration hints. Nested accessors are not supported.

Values: `"30"` (quoted) is a string, `30` is a number, `true`/`false`/`null` are written in the
lesson language's style (`True`/`None` in Python). Types like `str`/`int` are inferred per
language; add `type: float` etc. to override.

Flat lists of these scalar values are supported, including empty lists:
`assign: { var: numbers, value: [2, 4, 6] }`. Python infers `list`; JavaScript
infers `array`. Every list held by a variable is an object: this assignment
allocates the lowest unused `list-N` label and stores a reference. Variables
display arrows; indexed cells live in the Objects card. List badges display
contents with a list tag. Nested collections are not modeled yet.

See the [list-iteration lesson](lessons/python/list-iteration/lesson.yaml). An
indexed source such as `badge: { over: numbers, value: 2, from: 'numbers[0]' }`
flies the authored badge value from that cell. The teacher still supplies the
value: sources identify animation origins, not computed reads. Indices must be
integers within an existing list. Both `select` and indexed sources look up locals
then globals; an address mapping with `scope: global` selects a shadowed global explicitly.
Selection is applied before badge animation and remains through the loop body.
Reassigning the selected list or returning from its owning frame clears it.
A whole-list read (`from: 'numbers'`) keeps that object's identity. Binding
from its badge shares the list, including function arguments and return
passthrough. Separate literal bindings allocate separate objects; a literal
return allocates only when bound. Literal badges remain independent values.

The [element-update lesson](lessons/python/list-update/lesson.yaml) replaces one
cell while preserving its neighbors and list length. `update` requires an existing
list, a target such as `numbers[1]`, and a scalar `value` or `from: badge`. It resolves
locals then globals; `scope: global` explicitly updates a shadowed global. Selection
is separate: use `select` to mark a cell and `select: null` to clear it. A forward
update briefly highlights the changed cell; reduced motion and backward stepping
show the stored state immediately. Negative indices are not supported.

The [append lesson](lessons/python/list-append/lesson.yaml) adds a new cell at the
old list length; existing elements keep their indices. The
[removal lesson](lessons/python/list-removal/lesson.yaml) deletes by index and
shows later elements shifting forward. `remove` models indexed deletion such as
Python's `del numbers[1]`, not its value-searching `list.remove()` method. It does
not produce a return badge. Deleting the only element leaves an empty list.

Both actions resolve locals then globals and support `scope: global`. Append
preserves selection. Removal clears selection on the deleted element or adjusts
its index when a selected surviving element shifts. Use a later `select` step to
mark a newly appended cell. One mutation per step keeps transitions unambiguous;
backward stepping and scrubbing restore the complete earlier list.

## Objects and references

See [Two names for one list](lessons/python/list-aliasing/lesson.yaml):

```yaml
- line: 1
  allocate: { id: list-1, value: [2, 4] }
  assign: { var: numbers, ref: list-1 }
- line: 2
  assign: { var: other, ref: list-1 }
- line: 3
  append: { target: 'other', value: 6 }
```

Both names point to one list in the Objects panel. Mutation through either
name changes that object; assigning another value or reference to a name changes
the binding instead. Each snapshot stores the list contents once and preserves
its identity, so backward stepping restores sharing as well as values.

Compare [Copying a list](lessons/python/list-copying/lesson.yaml): a second
allocation represents `numbers.copy()`, with its own reference and the same
starting contents. Appending through the copy leaves the original unchanged.
Both allocations and their contents are authored explicitly.

`allocate` accepts a flat list and a unique nonempty `id`. These labels are
teaching identifiers, not memory addresses. Reference bindings require an already
allocated id and cannot combine `ref` with `value`, `from`, or `type`. Function
parameters can also use `ref`. Selection and indexed badge sources resolve the
same shared object through either alias, including local/global scope lookup.
Badge values are still authored and validated against the source's current
contents. Whole-list badges retain the reference and display/print its contents;
they cannot be converted. Instance references remain unprintable.

`allocate` remains available for chosen teaching labels instead of automatic
ones. An explicit allocation cannot reuse an automatically allocated id.
Unreferenced objects remain visible; garbage-collection visuals and nested lists
remain open.
Bounded players reveal the selected cell or relevant shared list inside the data
pane, while preserving the host page's position.

### Flat dictionaries

See [Updating a dictionary field](lessons/python/dictionary-fields/lesson.yaml):

```yaml
- line: 1
  allocate: { id: student-1, fields: { name: Ada, score: 5 } }
  assign: { var: student, ref: student-1 }
- line: 2
  update: { target: 'student["score"]', value: 7 }
- line: 3
  badge: { over: 'student["score"]', value: 7, from: 'student["score"]' }
```

Use exactly one of `allocate.value` (a flat list) or `allocate.fields` (a mapping
of nonempty string keys to scalar values). Empty mappings are valid. Reference
bindings and scoped lookup work for either object kind; Python dictionary
references have a `dict` tag. Each named field shows its value and scalar type.

`update: { target: 'student["score"]', value: 7 }` replaces an existing field,
directly or with `from: badge`. `from: 'student["score"]'` identifies a field
as the source of a matching teacher-authored badge. Address mappings accept
`scope: global` to bypass a same-named local. Each address has one accessor.
List indexing, append, remove, and selection remain list-only.
Bounded players reveal a field when it is updated or read.

Adding/deleting keys, non-string keys, nested values/references, whole-dictionary
badges, and executable class definitions are not supported. A missing key is an invalid
authored step; the player does not execute Python or produce a runtime KeyError.

### Class instances and initialization

See [Creating a class instance](lessons/python/class-instance/lesson.yaml).
Allocate a labeled instance with `class: Student` and `fields: {}`; its type tag
is Student, and attribute names appear without dictionary-key quotation marks.

```yaml
- line: 5
  allocate: { id: student-1, class: Student, fields: {} }
- call:
    name: Student.__init__
    line: 2
    over: 'Student("Ada")'
    construct: student-1
    args: [{ var: self, ref: student-1 }, { var: name, value: Ada }]
- line: 3
  update: { target: 'self.name', value: Ada }
- return: { value: null }
- assign: { var: student, from: badge }
```

`call.construct` names the already allocated instance. Bind `self` to that same
id explicitly. The initializer must finish with null (Python None), while the
enclosing constructor expression produces a reference badge to the instance.
`assign.from: badge` can bind that result without copying the object. Reference
bindings cannot override the object's type.

For an ordinary instance method, use `call` without `construct` and explicitly
bind `self` with `ref` to the receiver's instance. Author its parameters and
attribute writes using the same call and update actions. A method that reaches
the end without returning a value can be modeled with `return: { value: null }`;
this produces a None badge, not a constructor reference. See the
[instance-method sample](lessons/python/instance-method/lesson.yaml). Receiver
binding and method lookup are authored, rather than inferred from the code.

`update: { target: 'self.name', value: Ada }` creates or replaces a scalar instance
attribute; it accepts `value` or `from: badge`. `from: 'self.name'` reads an existing
attribute as an animation origin, with a matching teacher-authored scalar badge
value. Both support address mappings with `scope: global`. Each address has one accessor, and
dictionary keys and instance attributes remain distinct operations.

Class names are authored labels: the player does not interpret class definitions,
infer attributes, execute `__init__` or `__new__`, or model inheritance. Constructor
references cannot be converted or printed as value badges; read a scalar
attribute for output. General reference-valued function returns, nested instance
references, and automatic implicit returns remain future work.

## Authored program errors

An `error` step shows an unhandled program failure while retaining the player,
earlier variables, objects, call frames, and console output. The diagnostic is
separate from Console and value badges; it is not an expression result.

```yaml
- error:
    kind: runtime
    name: ValueError
    message: 'Cannot convert "abc" to an integer.'
    line: 3
    over: int(age)
  caption: Conversion failed before years could be assigned.
```

`kind` is `syntax` or `runtime`; `name`, `message`, and `line` are required.
`over` optionally identifies text to underline; `nth` chooses its occurrence
and requires `over`. Runtime targets also receive an error-type annotation.
A line-only diagnostic still has its location marker and diagnostic strip.
Syntax errors must be the first step, because execution never starts. An error
must occupy its own step, with an optional caption, and be the final step.
Autoplay pauses immediately; backward stepping and scrubbing remain available.
The step removes expression-value badges and preserves earlier program state;
it does not create an assignment result or unwind frames.

See the [syntax-error](lessons/python/syntax-error/lesson.yaml) and
[runtime-error](lessons/python/runtime-error/lesson.yaml) samples. Messages and
locations are teacher-authored, not interpreter output. The player does not
detect or execute errors from code edits. Caught exceptions, tracebacks, and
stack unwinding remain future work. Invalid lesson YAML still uses the separate
load-error display and `lessonerror` event; authored program errors do not emit it.

Mistakes in a lesson (unknown keys, code that isn't on the line, missing values) show up as
a readable error inside the player.

## Function calls and scope

See the [function-call sample](lessons/python/function-call/lesson.yaml) for a complete lesson.
Follow it with the [nested-call sample](lessons/python/nested-function-call/lesson.yaml)
to see one caller pause while another runs and two returns resume their callers.
Highlight the caller line before a `call` step. Its `over` identifies the exact call
text on that active line; `nth` chooses an occurrence. The call's `line` is the
function entry line. `args` is an optional list of parameter bindings, each using
`var` with `value`, `from: badge` (the latest caller badge), or `ref` (an allocated object).

Assignments inside a function update its own locals. A badge source such as
`from: 'value'` looks in the active frame, then globals. Use
`from: { target: 'value', scope: global }` to explicitly select a shadowed global.
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
