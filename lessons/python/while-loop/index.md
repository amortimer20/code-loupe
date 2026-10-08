---
title: A simple while loop
language: python
languageLabel: Python
summary: Check a condition repeatedly, change a counter, and stop when the condition becomes False.
objective: Explain why a while loop checks before each iteration and exits without running the body when the condition is False.
prerequisites:
  - Variables and reassignment
  - Addition
  - Boolean comparisons
topics: [Loops, Conditionals, Assignment, Input and output]
mode: authored
order: 9
---

## Teaching notes

Follow [Boolean comparisons](/samples/python/boolean-comparisons/) and
[Choosing a conditional branch](/samples/python/conditional/) with repeated
condition checking. Ask how many times the body will run and whether 2 will
be printed. The indented lines form the body; the last print is outside it.

Steps 2, 7, and 12 revisit the same condition with count at 0, 1, and 2. The
first two badges are True; the last is False. Steps 5–6 and 10–11 separate
addition from assignment, showing the old counter beside the new result before
the counter changes. The condition is checked three times, but the body runs
only twice. Step 13 jumps to the unindented line instead of printing 2.

Step backward from Step 7 to Step 6 to restore the increment result and line 4.
From Step 6 to Step 5, restore count to 0 while keeping result badge 1. From
Step 13 to Step 12, restore the False condition badge. Console history is
preserved until stepping back past the corresponding print.

The teacher authors every check, iteration, and result. The player neither
executes a loop nor detects an infinite one. Next, compare with
[Following an accumulator loop](/samples/python/accumulator-loop/), which uses
a for loop and retains a running total.

## Try a variation

Change the bound to 1 for a single iteration. Update the displayed condition
and both remaining condition badge targets to `count < 1`. Keep Steps 1–6,
then use a False check with count at 1, the outside-line step, and Done output.
Remove the second body iteration and update captions. The output becomes 0
followed by Done; code edits alone do not change the authored loop.
