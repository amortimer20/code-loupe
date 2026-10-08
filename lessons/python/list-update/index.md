---
title: Updating a list element
language: python
languageLabel: Python
summary: Replace one indexed element while preserving the rest of the list.
objective: Explain how an indexed assignment changes one element without changing the list's length.
prerequisites:
  - Variables and assignment
  - Zero-based list indices
topics: [Collections, Assignment, Input and output]
mode: authored
order: 7
---

## Teaching notes

Follow the list-iteration sample with this lesson. At Step 2, ask which cell
`numbers[1]` selects and what its current value is. Index 1 is the second position;
the new value, `10`, is separate from the index.

Step 3 moves the value into that cell and briefly highlights it. With reduced
motion the updated state appears immediately. Compare Steps 2 and 3 by stepping
backward and forward: the other cells stay `2` and `6`, and there are always three
cells. Step 4 clears the teacher's selection cue.

This demonstrates one indexed update. List length changes, negative indices,
nested lists, and shared references are separate future work. The authored player
does not execute this Python code or model object identity.

## Try a variation

Update index 0 instead. Change the displayed assignment to `numbers[0] = 10`,
both authored indices to `0`, the final list badge and console output to
`[10, 4, 6]`, and the captions. The original list assignment stays `[2, 4, 6]`.
