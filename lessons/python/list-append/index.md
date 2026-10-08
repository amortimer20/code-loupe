---
title: Appending to a list
language: python
languageLabel: Python
summary: Add a new element at the end without changing existing cells.
objective: Explain how append changes a list's length and determines the new element's index.
prerequisites:
  - Variables and assignment
  - Zero-based list indices
topics: [Collections, Input and output]
mode: authored
order: 8
---

## Teaching notes

Compare this with the list-update lesson. Replacing a cell keeps the length the
same; appending creates a new cell after the existing ones. Pause at Step 2 and
ask for the new element's index: it is `2`, the old list length.

Step 3 transfers `6` from the badge into the new cell. Step 4 selects that cell
after it exists. The values and indices of the original elements stay unchanged.
Step backward from Step 3 to see the list shrink back to `[2, 4]`.

Python's `append()` changes the list and returns `None`. The badge over `6`
shows the argument, not the result of the call. No return-value badge is authored.
Shared references and nested lists are outside this lesson's model.

## Try a variation

Start with an empty list. Change the code and first assignment to `[]`, select
index `0` after appending, and update the final badge, output, and captions to
show `[6]`. Appending does not require an existing index.
