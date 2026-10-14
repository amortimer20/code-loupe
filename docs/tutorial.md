# Write your first Code Loupe lesson

A lesson contains the code students see and the steps you want them to follow.
You choose the values, explanations, and pacing. Code Loupe plays those steps;
it does not run the code or ask students to enter input.

We'll start with a variable assignment, then build an explanation of why Python
input needs converting before arithmetic. The finished example is
[`numeric-input/lesson.yaml`](../lessons/python/numeric-input/lesson.yaml).

## 1. Preview a lesson locally

From the repository directory, install dependencies and start the sample site:

```sh
npm install
npm run dev
```

Open `/playground/` at the local URL Astro prints and choose the **YAML** tab.
Replace the editor contents
with this complete lesson:

```yaml
title: Storing a number
language: python
code: |
  x = 5
steps:
  - line: 1
    caption: We are about to store a number in x.
```

The preview updates automatically after you pause typing. Use **Download YAML**
to save your draft as a file. To add a permanent sample to the library, follow
[the sample contribution guide](samples.md).

The player begins at **Step 0**, before any authored steps have happened. Click
Next to highlight the first code line and show your caption.

Use spaces for YAML indentation. `code: |` starts a block of text whose line
breaks are preserved. Code line numbers start at 1 and refer to lines inside
that block, not to lines in the YAML file. `language` chooses syntax highlighting
and value formatting; `title` is optional.

### Editor assistance

The **Builder** tab offers introductory step forms: Highlight a line, Show a value,
Store a value, Print, Show a prompt, Show entered text, Convert a value, Select a list element, and Update a list element. Use **New lesson** and save lesson details to start from
blank code. Save each step and inspect the real player at that point.
Number/Text/Boolean/None controls distinguish values such as `1`, `"1"`, and `True`;
Number display can explicitly preserve a float such as `5.0`.

Scalar-variable badge sources fill their values from already-authored earlier
steps. Teachers still supply expression results and captions; no code executes.
**Show a prompt** writes without a newline; preserve any trailing space you want.
**Show entered text** is the teacher's scripted response, always text, including
empty input or digits. Choose **Latest console input** on a badge to fill that
value from the most recent earlier response. After changing entered text, Save
the console-source badge again to refresh its read. Variable-source badges also
refresh from the authored binding on explicit Save.

**Convert a value** changes the latest badge to the typed result you supply.
Choose Number/Text/Boolean/None, and optionally enter or pick a new result
expression. Leaving it blank keeps the badge in place. A conversion needs a badge
on the current line; moving to another code line clears badges. Neither input
changes nor conversion forms execute code or recompute later steps. Review later
values and captions when changing an example.

Choose **List** in Store a value or Show a value to edit typed item rows. Use
**Add list item** and **Remove item**; numbering starts at 0. Each item can be a
Number, Text, Boolean, or None. Empty lists work; nested lists are unsupported.
Storing a list allocates an object automatically. A badge can read a whole list
or an indexed element from **Value source**; Save fills its current authored
contents. Binding a whole-list badge shares the object.

**Select a list element** highlights an existing cell or clears selection. Show a
value also has **List selection**, allowing a highlight alongside a badge.
**Update a list element** accepts a scalar literal or the latest badge. Later
source badges and printed text may need explicit repair after a mutation changes.
**Append an item** chooses an existing list and accepts a scalar value or the
latest badge. Empty lists can receive their first item. **Remove a list element**
chooses an indexed cell, as Python `del` does; later indices shift down and no
result badge is produced. Global-scope mappings remain in YAML for now.

Print text remains explicit, allowing a badge's value inside a longer sentence.
Badges and printing still require separate steps.

Builder and YAML share undo/redo. Advanced actions remain available through YAML
and their captions can be edited in Builder. Unsaved form entries remain visible
when switching views, but only saved edits are saved/downloaded. Discard stale form edits if its step changed in YAML. Syntax errors and documents using anchors/aliases
stay available in YAML. The pending-forms count includes changed steps, lesson details, and an unsaved
new card. Reverting controls to their saved values clears their pending state.
Reloading or navigating away with pending entries triggers the browser's leave
warning; choosing to leave still discards those entries. Save puts them in the
shared YAML draft and Undo history. Switching Builder/YAML keeps pending forms.

Invalid lessons show a problem banner above the editor. **Go to step** opens
and focuses the failing card, which is marked **Needs attention**; unrelated
pending edits remain intact. Syntax and untargeted errors offer **Open YAML**.
Source choices display values from earlier authored steps, including list
contents and element values. Headers describe saved outcomes, helping the
collapsed overview read as a sequence of teaching steps.

Click the selected step header to collapse or reopen its form without losing edits.
The selected header stays highlighted; preview navigation preserves a collapsed
overview. Clicking another header opens that step. The circle-and-dot picker beside
**Code line** selects a line or expression from the preview; Escape cancels picking.
**Save step** and **Discard edits** sit together; the red **Delete step** button
sits at the right of the same action row. Discard drops pending form edits;
Delete removes the saved card, and Undo restores it.
If a draft stops previewing, **Restore last working lesson** explicitly recovers
the last successful preview (or the starting lesson when no checkpoint exists).
Working copies persist across reloads when storage is available, and restoring
can itself be undone. Nothing replaces a broken draft automatically.

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

A saved card's **Organize step** section offers **Move up**, **Move down**,
**Insert after this step**, and **Duplicate step**. Insertion stays outside YAML until Save passes whole-lesson
validation. Cancel drops it. Duplicate copies the saved step rather than pending
form edits, preserving comments and advanced actions. Both saved operations use
shared Undo. A duplicated call, allocation, or error may make the sequence invalid;
repair the preserved draft in YAML or Undo the copy. If steps change while an
inserted card is pending, cancel it and choose its position again.

Moves use the saved actions while keeping pending form entries with their cards.
Selection and the preview destination follow the move and Undo/Redo. The first
card cannot move up; the last cannot move down. Save or cancel an unsaved new card
before moving saved cards. If two saved cards are identical,
save their edits before swapping them. Reordering can put a read before its assignment or a
return before its call: the preview explains the error, and YAML/Undo remain
available for repair.

Picking highlights the hovered line. Preview stepping, scrubbing and autoplay
select and reveal the matching saved card without moving keyboard focus. Pending
edits and new cards are kept; focusing a form pauses autoplay. Lesson details
uses a language dropdown from the installed syntax-highlighting catalog, with
common languages first and imported aliases preserved until explicitly changed.

The playground highlights YAML and supplies schema completion, hover descriptions,
and source errors. Press Ctrl+Space for suggestions. Select a problem below the
editor to jump to its location. Ctrl+M toggles whether Tab moves out of the editor;
Escape closes suggestions. Preview errors remain visible alongside source checks.

If you edit YAML in VS Code with the Red Hat YAML extension, the
[lesson schema](../packages/player/lesson.schema.json) supplies completion,
hover descriptions, and errors for malformed actions. Add a schema comment
pointing to that file relative to your lesson:

```yaml
# yaml-language-server: $schema=../../../packages/player/lesson.schema.json
```

That path works inside `lessons/python/<slug>/`; use a different relative
path for a draft elsewhere. Keep checking the playground preview: a schema
cannot tell whether a badge value matches the variable's current contents or
whether its code target exists. The preview checks those rules separately.

## 2. Show a value, then assign it

Replace the `steps` section with:

```yaml
steps:
  - line: 1
    badge: { over: "5", value: 5 }
    caption: The expression on the right gives us the integer 5.

  - assign: { var: x, from: badge }
    caption: That value is stored in x.
```

A **badge** floats a value above a piece of code. `over: "5"` selects the text
to attach it to; `value: 5` supplies the number to display. The first must be
text, while the second is a number.

The second step copies the latest badge's value into the Variables panel. It
inherits the active line, so you don't need to repeat `line: 1`.

After the preview updates, advance twice. You should see a badge containing `5` with an `int`
tag, followed by `x = 5` in the Variables panel. Step backward to see the state
before the assignment.

You can also assign without a badge:

```yaml
- assign: { var: x, value: 5 }
```

Use a badge when you want students to follow where the value comes from; use a
direct assignment when that extra explanation isn't needed. Assigning to the
same variable again updates its value.

## 3. Introduce console input

Now replace your file with this starting point for the larger lesson:

```yaml
title: Converting user input to a number
language: python
code: |
  text = input("Enter your age: ")
  age = int(text)
  print(f"You will be 100 in {100 - age} years!")

steps:
  - line: 1
    write: "Enter your age: "
    caption: input() shows its prompt and waits for the user to type something.

  - input: "30"
    caption: The user types 30 and presses Enter.
```

`write` adds console output without a newline. `input` depicts the input you
authored, including an Enter indicator. It is a fixed part of the explanation.

After the preview updates, advance through both steps. The prompt and the input should appear
on the same console line.

## 4. Make the returned string visible

Append these steps to the existing `steps` list, keeping the same indentation:

```yaml
  - badge: { over: 'input("Enter your age: ")', value: "30", from: console }
    caption: input() always gives back a string, even when the user types digits.

  - assign: { var: text, from: badge }
    caption: The string "30" is stored in the variable text.
```

`from: console` makes the value travel from the most recent authored input to
the badge. The badge's `value` is still supplied by you; its source describes
the animation. Similarly, `from: 'text'` below describes where a badge
travels from, rather than calculating its value.
Variable-source badges must nevertheless match the source's current value,
including selected list elements and named fields. A number and a string with
the same digits are different values; a mismatch is a hard lesson error.
Console-source consistency is not checked yet.

An address mirrors the displayed Python: `text` is a binding, `numbers[1]` is a
list element, `report["score"]` is a dictionary field, and `ada.name` is an
instance attribute. Use at most one accessor, without whitespace, and quote
bracket addresses inside `{ ... }`, for example `from: 'numbers[1]'`.
`var` names a binding being created or rebound; `target` and badge `from` address
an existing location. For an explicitly global read, use
`from: { target: text, scope: global }`. `from: console` means console input;
`from: { target: 'console' }` reads a variable named console.

Use `select: 'numbers[1]'` or `remove: 'numbers[1]'` for indexed selection/removal,
`update: { target: 'numbers[1]', value: 5 }` for a change, and
`append: { target: 'numbers', value: 6 }` for growth. Update requires an accessor
and append requires a bare name. Select/remove also accept `{ target, scope: global }`;
update/append put scope beside target. Scope is accepted only in address mappings.
Old location mappings with var/index/key/attribute are rejected with migration hints.

The quotes around `"30"` matter: YAML reads it as a string. An unquoted `30`
would be a number. Python's inferred type tag is therefore `str` here.

After four steps, the Variables panel should contain `text = "30"`.

## 5. Explain the conversion

Append:

```yaml
  - line: 2
    badge: { over: text, value: "30", from: 'text' }
    caption: Python looks up text and finds the string "30".

  - convert: { over: int(text), value: 30 }
    caption: int() converts the string "30" into the integer 30.

  - assign: { var: age, from: badge }
    caption: Now age holds a number, so we can do math with it.
```

Moving to a different line clears the existing badges. The new badge starts
above `text`, then `convert` changes that latest badge's value and moves it
above `int(text)`. Finally, the number is assigned to `age`.

You supplied the conversion's result, `30`; Code Loupe doesn't call `int()`.
After the preview updates, reach Step 7. Both variables should be present: `text` is a `str`,
and `age` is an `int`.

Type names are inferred from values and the lesson language. You can override
one with `type`, for example `badge: { over: "5", value: 5, type: float }` in
the first lesson. That displays `5.0` with a `float` tag.

## 6. Show arithmetic and output

Append the final two steps:

```yaml
  - line: 3
    badge: { over: 100 - age, value: 70 }
    caption: Because age is an int, 100 - age works out to 70.

  - print: { text: "You will be 100 in 70 years!", from: badge }
    caption: The f-string fills in 70 and print() shows the message.
```

`print` adds a newline after its text. `from: badge` animates the latest badge's
value into the output; you still write the complete output text yourself.
That text must contain the badge's printed form: strings print raw, while Python
booleans and null print as True/False and None. Containment lets the message above
include 70 inside a longer sentence. Unrelated output text is a hard lesson error.

Your lesson now has nine steps. Compare it with the
[complete example](../lessons/python/numeric-input/lesson.yaml), then try backward
stepping, the scrubber, and autoplay. Turn animations off to check that the
lesson still makes sense when each step appears immediately.

## 7. Choose your teaching pace

A step is a teaching moment, not necessarily a whole line of execution.
Separate the returned value, conversion, and assignment when students need
time to distinguish them. Combine actions when one explanation is enough:

```yaml
- line: 1
  badge: { over: "5", value: 5 }
  assign: { var: x, from: badge }
  caption: The integer 5 is stored in x.
```

Within a step, actions happen in a fixed order: line change, console activity,
badge creation, conversion, then assignment. Their order in the YAML mapping
doesn't change that sequence. To print a newly created badge's value, create
the badge in an earlier step, because console actions happen first. A `print` or
`write` with `from: badge` cannot share a step with `badge` or `convert`; validation
rejects that combination. Combining them with `assign: { from: badge }` is valid
because assignment happens afterward.

Every list a variable holds is an object in the Objects card. For example,
`assign: { var: numbers, value: [2, 4] }` allocates a list with the lowest
unused `list-N` label; the Variables panel shows a reference arrow.
A whole-list badge with `from: 'numbers'` retains that reference, so binding
`from: badge` shares it (also for call arguments and return passthrough).
A literal badge stays a value and allocates a separate object each time it is
bound. Use `allocate` with `ref` for chosen labels. Unreferenced objects
remain visible.

Variables and console history persist across steps. Captions do not: a step
without a caption clears the previous one.

## When a lesson won't load

The player displays load and lesson errors inside its frame. Common fixes are:

| Problem | What to check |
| --- | --- |
| Invalid YAML | Indentation, balanced quotes, and punctuation. Quote captions containing `: `, or use a text block. |
| Unknown step key | Check spelling against the [lesson reference](../README.md#lesson-format). |
| Line doesn't exist | Count lines in the `code` block starting at 1. |
| Badge target can't be found | `over` must match the code text exactly, including spaces. |
| No badge to convert, assign, or print | Create a badge first and check that a line change hasn't cleared it. |
| Missing source variable or input | Assign the variable or add an `input` step before using it as a source. |

If a target occurs twice on one line, add `nth: 2` to select the second occurrence.
If a badge needs a different line from the active one, add `line` inside its
specification, for example `badge: { line: 2, over: text, value: "30" }`.

## Embed your lesson

Run `npm run build:player` to produce `packages/player/dist/code-loupe.js`. Host
the contents of that build directory,
including any accompanying assets, alongside your lesson file. On the host page:

```html
<script type="module" src="code-loupe.js"></script>
<code-loupe src="lessons/first-lesson.yaml"></code-loupe>
```

The lesson URL is resolved relative to the page. See the
[embedding reference](../README.md#embed-it) for inline lessons, themes, speed,
motion preferences, and the JavaScript API.

## Next: functions and local variables

Explore the [function-call sample](../lessons/python/function-call/lesson.yaml)
and its [teaching notes](../lessons/python/function-call/index.md). It adds a
Call stack panel, local parameter binding, and a returned value. The
[function and scope reference](../README.md#function-calls-and-scope) explains
the new `call` and `return` actions.
