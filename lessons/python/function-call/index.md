---
title: Following an argument and return value
language: python
languageLabel: Python
summary: Follow an argument into a function, inspect its locals, and return a value to the caller.
objective: Distinguish global variables from function locals and explain how a returned value reaches an assignment.
prerequisites:
  - Variables and assignment
  - Basic arithmetic
topics: [Functions, Scope, Expressions, Input and output]
mode: authored
order: 4
---

## Teaching notes

Start on line 5: the function has already been defined, and its body runs only
when called. Pause as the new frame appears. The parameter `value` belongs to
`add_one()`, even though a global variable has the same name.

After `result` is assigned, compare the Variables panel with the function frame.
The global scope still holds `value = 10`; `result = 11` is local to the call.

On return, the frame disappears and the returned number appears over the call
expression. Only the following assignment creates `answer`. Step backward across
the return to inspect the completed function's locals again.

## Try a variation

Assign a different number to the local parameter before the addition. The global
`value` should remain unchanged. Update the authored expression values, return,
and printed output to match your change.

Calls and returns are authored transitions, not Python execution. This first
model supports local variables, global lookup, and nested frames. Closures,
nonlocal/global assignment declarations, exceptions, and implicit returns need
further design.
