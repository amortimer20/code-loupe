---
title: Following nested function calls
language: python
languageLabel: Python
summary: Pause one function while another runs, then follow two returns back to the global caller.
objective: Explain how nested calls suspend and resume their callers while keeping local variables separate.
prerequisites:
  - Arguments and return values
  - Local and global variables
  - Basic arithmetic
topics: [Functions, Scope, Expressions, Input and output]
mode: authored
order: 12
---

## Teaching notes

Start with **Following an argument and return value** if students have not seen
call frames before. This lesson adds a second call while the first is still running.
Function definitions are already available; stepping starts at the global assignment.

Pause at Step 5, when both frames are visible. `add_one()` is active at the top;
`double_after_bump()` is paused below it at line 6. Both have a local `value`,
and the global scope has a third, separate `value`. Matching names and values
do not make these the same variable. Arguments are passed explicitly; the inner
function does not read the paused caller's locals.

At Step 8, only the inner frame has `result = 11`. Ask where that value will go.
Step 10 removes the inner frame and resumes line 6 with a returned badge;
Step 11 creates the outer frame's own `result`. Returning and assigning are
separate teaching moments.

The outer function doubles its result to 22. Its return at Step 16 resumes the
global caller at line 11; Step 17 creates `answer`. The global `value` remains 10
throughout, and the console eventually prints 22.

Step backward across both returns, or scrub between Steps 8, 11, and 14, to
compare which frames exist and which frame owns `result`. With animations off,
the same states remain available for inspection.

## Try a variation

Change the outer multiplier from 2 to 3. Update the authored multiplication badge,
second return's source value, final answer badge, output, captions, and these
notes to describe 33. Assignments and returns using `from: badge` inherit the
updated badge value; changing the displayed code alone does not recalculate it.

For a scope exercise, add an assignment changing the inner parameter before its
addition. Its caller's parameter and the global `value` should stay unchanged.
Update every affected authored value and caption. This is an authored walkthrough,
not live Python execution; recursion and deeper call stacks are separate examples
to explore later.
