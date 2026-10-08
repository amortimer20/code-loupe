---
title: Two names for one list
language: python
languageLabel: Python
summary: Follow two variable references to one list and mutate it through either name.
objective: Explain why appending through an alias changes the list seen through the original name.
prerequisites:
  - Variables and assignment
  - Appending to a list
topics: [Collections, References, Assignment, Input and output]
mode: authored
order: 17
---

## Teaching notes

The Variables panel shows `numbers → list-1` and `other → list-1`. The Objects
panel shows the indexed contents once. The repeated label identifies the
same object; it is an author-chosen teaching label, not a Python memory address.

At Step 2, ask students how many lists exist. Both names point to the single
card. At Step 3, ask what `print(numbers)` will show after the append through
`other`. Step 4 updates the shared object while both reference arrows stay intact.
Step 5 reads the new cell through the original name.

Step backward from Step 4 to restore `[2, 4]` without changing either reference.
Step backward from Step 2 to remove only the `other` binding. This is an authored
model of identity and sharing; the player still does not run Python.

`allocate` creates the list and `assign.ref` binds each name to its identity.
Earlier value-based list lessons remain useful for index and length concepts,
but do not imply Python copying semantics. Compare with
[Copying a list](/samples/python/list-copying/) to see two separate objects with
equal starting contents. Nested objects, reference-valued returns, and garbage collection
are outside this first reference lesson.

## Try a variation

Append through `numbers` instead. Change the displayed append and its authored
`var`, then select/read through `other` and print that name. Update the print
badge target, its source variable, and the captions. The one shared list and final
output stay `[2, 4, 6]`; neither name is a special owner.
