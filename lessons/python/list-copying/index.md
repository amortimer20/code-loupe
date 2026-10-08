---
title: Copying a list
language: python
languageLabel: Python
summary: Create a separate list with copy() and change it without changing the original.
objective: Distinguish equal list contents from shared identity by comparing copying with aliasing.
prerequisites:
  - Variables and assignment
  - Appending to a list
  - Shared list references
topics: [Collections, References, Assignment, Input and output]
mode: authored
order: 18
---

## Teaching notes

Compare this lesson with [Two names for one list](/samples/python/list-aliasing/).
The starting values and append are the same; `numbers.copy()` creates a separate
list instead of binding another name to the original.

At Step 2, ask how many lists exist. The List objects panel has two cards with
equal contents, while the variable arrows point to different object labels.
At Step 3, predict both console lines. Step 4 changes only `list-2`, and Step 5
selects the new element in the copy. Steps 6–9 read each object through its own
name and print `[2, 4]` followed by `[2, 4, 6]`.

Step backward from Step 4 to restore the copy's contents while preserving both
references. Return to Step 1 to remove the second object and its binding.
The ids are author-chosen teaching labels, not Python memory addresses.

The player does not execute `copy()`: the teacher authors the second allocation
and its initial contents explicitly. Python's `list.copy()` is a shallow copy.
This flat list of numbers demonstrates independent list containers; it does not
demonstrate copying nested objects or deep copying.

## Try a variation

Append through `numbers` instead, keeping `other = numbers.copy()`. Change the
displayed append and authored append/selection `var` to `numbers`. Update both
read badges, printed texts, and captions so the outputs become `[2, 4, 6]` and
`[2, 4]`. The original and copy remain separate objects.
