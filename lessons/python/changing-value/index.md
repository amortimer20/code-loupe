---
title: Changing a value
language: python
languageLabel: Python
summary: Read a variable's old value, add to it, then store the new result.
objective: Explain why the right-hand side uses the old value before assignment replaces it.
prerequisites:
  - Variables and assignment
  - Addition
topics: [Assignment, Expressions, Input and output]
mode: authored
order: 4
---

## Teaching notes

Follow [Naming a value](/samples/python/naming-value/) with this lesson. The
line `score = score + 2` is a useful place to distinguish programming assignment
from mathematical equality.

Step 2 reads the second occurrence of `score`, on the right-hand side. Step 3
shows the addition result 7 while the Variables panel still shows 5. Pause here
to ask whether assignment has happened yet. Step 4 stores 7 under the same
name; it does not create a second variable. Steps 5–6 read and print that value.

Step backward from Step 4 to restore `score = 5` while retaining the result
badge 7. These separate authored moments make evaluation and assignment
visible; the player does not execute Python. The `convert` action changes the
badge to the expression result here; no Python type conversion occurs.

Continue with [Strings and numbers](/samples/python/strings-and-numbers/) to
compare how + behaves with different operand types.

## Try a variation

Change the increment to 3. Update the displayed expression, the `convert.over`
target, its result to 8, the later read badge, printed text, and captions.
Keep the initial assignment and old-value read at 5, with `nth: 2` selecting
the right-hand occurrence of `score`.
