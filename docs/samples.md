# Adding a sample to the library

Samples are both teaching material and a comparison corpus for player development.
Give each one a focused learning objective and use its notes to explain what it
demonstrates, where to pause, and any current visual limitations.

## Folder and source files

Create `lessons/<language>/<slug>/` with two files:

- `lesson.yaml`: the authored lesson consumed by the player.
- `index.md`: gallery metadata followed by Markdown teaching notes.

Use lowercase letters, numbers, and hyphens in both folder names. The folder path
becomes the stable sample ID and URL, such as `/samples/python/accumulator-loop/`.
Keep an existing ID when changing a sample so links and browser drafts stay useful.

Start by copying a similar lesson folder and editing both files. Keep only one
canonical YAML source; the site generates its downloadable copy automatically.

## Metadata

Every `index.md` begins with this frontmatter structure:

```yaml
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
order: 2
---
```

All fields are required. `language` must match the lesson's highlighting language;
`languageLabel` is the human-readable gallery label. Use existing topic labels
when appropriate so filtering remains consistent. `order` is a nonnegative integer
for gallery ordering; samples with equal order sort by ID. Only authored mode is
supported today.

After the frontmatter, add **Teaching notes** and **Try a variation** sections.
Describe actual supported behavior, especially when captions explain something
the player cannot yet visualize. In variations, name all authored outcomes that
need updating; code edits do not recalculate them.

## Preview and check

1. Run `npm run dev` and open the library at the printed URL.
2. Open the new sample and walk through every step. Check the displayed values
   against the code yourself; the build validates structure, not execution truth.
3. Step backward and scrub to intermediate states. Check reduced motion too.
4. Download YAML and check that it matches your canonical source.
5. Open **Edit in playground** and verify that it starts the correct sample or
   restores the saved draft for that sample. Editing doesn't change corpus files.
6. Run `npm run build:site`. Invalid metadata, missing source files, mismatched
   languages, and invalid steps fail the build.

The new page, gallery card, topic filters, playground source list, and YAML download
are generated from the folder. No route edits or registration list are needed.

## Comparing behavior

Keep examples small enough that their important states can be checked manually.
Use a focused sample for each new visual or language behavior. Existing numeric
input, accumulator-loop, and conditional samples cover strings and numbers,
conversion, repeated assignments, backward line movement, Boolean evaluation,
skipped branches, and console output.

When a change affects an existing sample, compare both the final result and the
intermediate states. Teaching order and animation origins matter even when final
values are identical. The corpus supplies snapshot-test fixtures and can also
support future visual regression tests.

The function-call sample adds parameter binding, separate global/local scope,
return-to-caller behavior, and a frame that can be restored by backward stepping.
Snapshot regression tests now cover these foundations and the earlier corpus
outcomes; visual regression tests remain future work. Run `npm test` after changing
the state model or updating a tested sample's authored outcomes.
