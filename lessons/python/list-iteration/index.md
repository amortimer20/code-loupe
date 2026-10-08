---
title: Iterating through a list
language: python
languageLabel: Python
summary: Follow indexed list elements into a loop variable and running total.
objective: Distinguish an element's index from its value and explain how list iteration updates an accumulator.
prerequisites:
  - Variables and assignment
  - Accumulator loops
topics: [Collections, Loops, Expressions, Input and output]
mode: authored
order: 13
---

## Teaching notes

Compare this lesson with the accumulator-loop sample: the loop now reads a list
instead of `range(3)`. Each cell displays its zero-based index above its value.
An outline and arrow mark the element being read, and its value travels into a
badge before assignment to `n`.

Pause at Steps 3, 7, and 11. Ask students for both the index and the value, then
predict `n` and the next total. The indices `0, 1, 2` differ from the values
`2, 4, 6`; Python's `for n in numbers` binds values, not indices.

The selected cell stays marked throughout that iteration. Step 15 clears it to
show exhaustion. The list never changes, and Python leaves `n` bound to `6`.
Selection is a teaching cue authored in YAML, not an executing iterator.

## Try a variation

Change the middle element to `-4`. Update the code, initial list assignment,
element-read badge, arithmetic badges, captions, and final printed total to `4`.
Keep the same zero-based indices. Editing the code alone does not recalculate
the authored outcomes.
