# Code Animator

Step-through animations of code for teaching. Students step forward and back through a
program and watch the current line, variables, return values, type conversions and console
I/O change. It's a web component, so it embeds in any page.

## Run the demo

```sh
npm install
npm run dev        # http://localhost:5173
npm run build      # dist/code-animator.js for embedding
```

## Embed it

```html
<script type="module" src="code-animator.js"></script>

<code-animator src="lessons/numeric-input.yaml"></code-animator>

<!-- or inline -->
<code-animator>
  <script type="text/yaml">
    language: python
    code: |
      x = 5
    steps:
      - line: 1
        assign: { var: x, value: 5 }
  </script>
</code-animator>
```

| Attribute     | Meaning                                                      |
| ------------- | ------------------------------------------------------------ |
| `src`         | URL of a YAML lesson                                         |
| `theme`       | Any [Shiki theme](https://shiki.style/themes); default `dark-plus` |
| `speed`       | Default playback speed, e.g. `0.75`. A viewer's own choice from the speed menu is remembered and wins. |
| `motion`      | `full` animates even when the OS asks for reduced motion (Windows "Animation effects" off); `reduced` starts with animations off. Viewers can always flip the animations button, and their choice is remembered. |
| `no-keyboard` | Don't handle ← → Home End Space (e.g. when a host page does) |

JavaScript API: `next()`, `prev()`, `goTo(n)`, `play()`, `pause()`, `step`, `total`, and a
`stepchange` event with `{ step, total }`.

## Lesson format

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

Each step can combine any of these keys. They animate in this order: console → badge → convert → assign.

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

Values: `"30"` (quoted) is a string, `30` is a number, `true`/`false`/`null` are written in the
lesson language's style (`True`/`None` in Python). Types like `str`/`int` are inferred per
language; add `type: float` etc. to override.

Mistakes in a lesson (unknown keys, code that isn't on the line, missing values) show up as
a readable error inside the player.
