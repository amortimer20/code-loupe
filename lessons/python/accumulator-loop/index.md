---
title: Following an accumulator loop
language: python
languageLabel: Python
summary: Track three iterations as a loop variable and running total change.
objective: Explain how an accumulator retains its value between loop iterations.
prerequisites:
  - Variables and assignment
  - Addition
topics: [Loops, Expressions, Input and output]
mode: authored
order: 10
---

## Teaching notes

Compare with [A simple while loop](/samples/python/while-loop/): that lesson
changes a counter and checks a condition, while this for loop supplies each
value of `n` from `range(3)` and retains a running total.

Before each addition, ask students to predict the new total. The execution arrow
returns to the loop header while `total` keeps its value.

`range(3)` supplies `0`, `1`, and `2`. The first iteration changes `n` but leaves
the total at zero; this is a useful moment to separate iteration from accumulation.

The final visit to the header explains exhaustion before moving to `print()`.
There is no separate loop-counter panel yet: captions and variable updates carry
the explanation.

## Try a variation

Add an authored fourth iteration for `range(4)`. Update the displayed code,
the new iteration's steps, and the final printed result to `6`.
