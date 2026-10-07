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

Open `/playground/` at the local URL Astro prints. Replace the editor contents
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
the animation. Similarly, `from: { var: text }` below describes where a badge
travels from, rather than calculating its value.

The quotes around `"30"` matter: YAML reads it as a string. An unquoted `30`
would be a number. Python's inferred type tag is therefore `str` here.

After four steps, the Variables panel should contain `text = "30"`.

## 5. Explain the conversion

Append:

```yaml
  - line: 2
    badge: { over: text, value: "30", from: { var: text } }
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
the badge in an earlier step, because console actions happen first.

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
