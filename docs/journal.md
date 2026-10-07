# Project journal

This journal records decisions and their reasons. Planned work and open questions
belong in [the roadmap](roadmap.md); current usage belongs in [the README](../README.md).

## 2026-10-03 — Name: Code Loupe

The roadmap records the choice of **Code Loupe**: a loupe suggests close inspection
of code and nods to Emerald. The full name also distinguishes the project from
existing tools called Loupe. The package and custom element use `code-loupe`.

## 2026-10-07 — Working conventions and naming

Added [AGENTS.md](../AGENTS.md) to document the architecture and the expectation of
focused pair-programming sessions. The roadmap remains the place for future work;
this journal keeps decision history separate from task status.

Renamed the implementation from Code Animator to Code Loupe, including the public
class (`CodeLoupe`), element (`<code-loupe>`), bundle (`code-loupe.js`), and viewer
preference keys. Existing embeds must use the new names; preferences saved under
the old keys do not carry over. This makes the proof of concept consistent with
the chosen project name before distribution work begins.

The current architectural foundation is retained: authored YAML steps become full
snapshots, which the player renders and animates. Live tracing is still planned,
not implemented. The detailed pair walkthrough remains a next step.

## 2026-10-07 — License: MIT

Selected the MIT License so other teachers can use, adapt, and distribute Code
Loupe with few restrictions. Added the license text and package metadata.

## 2026-10-07 — Live authoring playground

Added a separate playground page with a plain YAML textarea and the existing
player. Preview updates are delayed briefly while typing and restart at Step 0;
the editor retains invalid drafts and allows downloading them. Drafts are saved
locally when browser storage is available, with no backend or account required.

Added `loadLesson(yaml)` and `lessonerror` to the component so authoring tools can
reuse a player directly. The embeddable library build remains separate from the
demo/playground site build. A richer code editor can follow once we understand
which editing aids teachers need.
