---
title: Updating a dictionary field
language: python
languageLabel: Python
summary: Follow a dictionary reference, update one named field, and read its value.
objective: Distinguish a dictionary's identity from its field values and explain lookup by key.
prerequisites:
  - Variables and assignment
  - Strings and numbers
  - Object references
topics: [Objects, References, Assignment, Input and output]
mode: authored
order: 19
---

## Teaching notes

Build on [Two names for one list](/samples/python/list-aliasing/) and
[Copying a list](/samples/python/list-copying/). This card has named string keys
instead of numbered list indices. The variable `student` points to `student-1`;
the dictionary's fields live in that object card. The id is a teaching label,
not a Python memory address.

At Step 1, compare the string "Ada" and integer 5 and their type tags. Step 2
predicts which field changes. Step 3 replaces only score; name, keys, and object
identity stay intact. Step 4 reads the updated score into a badge, then Step 5
prints it. This is a Python dictionary, not a class instance or attribute access.

Step backward from Step 3 to restore score to 5 with the same reference. Scrub
to Step 0 to remove both the dictionary and its binding. All field values and
results are authored; the player does not execute Python.

`allocate.fields` creates a flat mapping of nonempty string keys to scalar
values. `update.key` replaces an existing field; `badge.from.key` identifies a
field as an animation origin. Nested values, adding/deleting keys, whole-dictionary
badges, and class definitions remain later work. The player rejects missing
keys as invalid authored lessons; that does not model Python's runtime KeyError.

## Try a variation

Change the new score to 9. Update the displayed assignment, its badge target
and value, the later read badge value, printed text, and captions. Keep the
initial score at 5 and both field keys unchanged. The reference stays student-1.
