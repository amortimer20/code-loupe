---
title: Removing a list element
language: python
languageLabel: Python
summary: Delete an indexed cell and watch later elements shift forward.
objective: Explain how indexed deletion changes list length and the positions of surviving elements.
prerequisites:
  - Variables and assignment
  - Zero-based list indices
topics: [Collections, Input and output]
mode: authored
order: 16
---

## Teaching notes

This lesson uses `del numbers[1]` to delete by index. Python's `numbers.remove(4)`
would instead search for a matching value. The authored `remove` action represents
indexed deletion, not Python's method with that name.

Pause at Step 2 and ask which value disappears and where `6` will end up. Step 3
shows the selected cell disappearing and the later cell moving forward. The
surviving values stay the same; indices describe current positions rather than
permanent element identities. Step 4 selects the new cell at index `1`.

Step backward from Step 3 to restore all three elements. Reduced motion and
scrubbing render the same final states without movement. Removing the last
remaining element displays `[]`; invalid or negative indices are rejected.

## Try a variation

Delete index `0`. Update the displayed code, removal index, and first selection.
The result becomes `[4, 6]`; `4` moves to index `0` and `6` moves to index `1`.
Update the follow-up selection, whole-list badge, console output, and captions
to explain the new positions.
