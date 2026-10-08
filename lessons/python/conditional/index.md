---
title: Choosing a conditional branch
language: python
languageLabel: Python
summary: Evaluate a Boolean condition and follow the branch that executes.
objective: Explain how a condition's Boolean result selects one branch and skips the other.
prerequisites:
  - Variables and assignment
  - Numeric comparison
topics: [Conditionals, Expressions, Input and output]
mode: authored
order: 8
---

## Teaching notes

Ask students to predict `age >= 18` before revealing its Boolean badge. Separate
evaluating the condition from executing the selected branch.

The arrow jumps directly to line 5 when the condition is false. The player does
not yet dim skipped branches, so the caption explicitly names the skipped line.

## Try a variation

Change the authored age to `20`, the condition's result to `true`, the next active
line to `3`, and the output to `Adult`. YAML's `true` renders as Python's `True`.
These outcomes are authored; changing the code does not select a branch automatically.
