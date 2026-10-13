# Authoring implementation plan

## Goal

A teacher can build a short code explanation without learning the lesson syntax.

Improve the existing playground first, then add a small visual builder beside
the YAML editor. YAML remains the saved/shared format; both views edit the same
lesson. The player continues to consume authored outcomes.

This is the current near-term direction. Tracing, new lesson content, iframe
delivery, and broader styling work stay in the backlog while we test authoring.

## What a teacher will do

1. Create a lesson or adapt a sample.
2. Enter the displayed code.
3. Add teaching steps: highlight a line, show a value, store it, or print it.
4. Write captions and preview the explanation.
5. Adjust the steps and download the lesson.

The builder supplies the syntax. Teachers still choose the values and pacing;
the displayed program does not execute.

## Delivery slices

| Slice | Result | Completion check |
| --- | --- | --- |
| 1. Better YAML editor | Highlighting, indentation, undo, completion, hover help, and useful errors | Edit and repair a lesson without losing the draft or leaving the playground |
| 2. Small lesson builder | Lesson details, step list, and forms for introductory actions | Build the naming-value and simple-arithmetic examples without typing YAML |
| 3. Select code and organize steps | Code-target selection, duplicate/reorder/delete, and preview navigation | Attach a badge to the intended occurrence and revise an explanation comfortably |
| 4. Teacher trial and refinement | Improvements based on using the first three slices | Complete a short lesson, identify friction, and choose the next supported action |

Deliver each slice in reviewable changes. A slice can be useful before the next
one is built. Review the authoring experience after each slice, rather than
extending the format or implementing every action at once.

## Slice 1: improve the YAML editor

Implemented with Monaco and monaco-yaml, using the checked-in lesson schema.
Browser checks cover worker loading with Astro/Vite, schema-driven completion,
hover, validation, keyboard exit, theme switching, and saved drafts. The editor
loads only on the playground; a plain textarea remains available if it cannot load.
Monaco is pinned to 0.52.2 for worker compatibility. The editor and workers cost
roughly 1.1 MB gzipped; see [testing notes](testing.md) for maintenance details.

CodeMirror's YAML package supplies highlighting and indentation, but a schema
service needs a separate integration. It remains an alternative if loading cost
or teacher trials favor it; choosing an editor should not turn into writing a
general YAML language service ourselves. Editor dependencies belong to the site
and load on the playground route, keeping the embeddable player independent.

Split delivery into:

- Editor integration: highlighting, line numbers, indentation, search, undo/redo,
  accessible name/help, and a documented keyboard route out of the editor.
- Schema integration: completion of action keys and allowed values, hover
  descriptions, YAML/structural diagnostics, and navigation to errors.
- Preview integration: preserve debounced updates, revision checks, sample-specific
  draft keys, exact-source downloads, storage failure behavior, and all three themes.

Use the checked-in schema locally; routine editing should not require fetching
it from GitHub. Configure YAML 1.2 to match the existing parser. State-dependent
errors still come from parseLesson/buildSnapshots through preview loading:
for example, a badge value contradicting its source or a missing code target.
Map errors to source locations when available; keep an accessible error list
when an error has no reliable text range. A syntax-highlighted editor alone does
not complete this slice.

Acceptance:

- Completion suggests an assignment's fields and from: badge; hover explains them.
- Unknown action keys, invalid types, and incomplete YAML show useful diagnostics.
- Semantic source mismatches still appear through runtime validation.
- Reload, rapid editing, theme changes, and invalid drafts preserve the exact text.
- Download works for incomplete/invalid drafts as it does today.
- Keyboard use, error navigation, and narrow laptop layouts remain usable.

## Slice 2: add a small builder

The first implementation provides lesson details, introductory action forms,
step cards, new lessons, and a shared source/undo history. Save lesson details/step
commits one form transaction and updates the real preview. Pending entries survive
view switching; stale forms require an explicit reload rather than overwriting YAML.
Pending entries are not persisted across page reloads. Advanced captions are
editable while their actions remain source-editable. Read-only preservation is
used for documents with anchors, aliases, or unsupported tags/keys.

Agreed first-screen layout (2026-10-13): **Step cards**, as reviewed in the
interactive mockup.

- Keep the existing two panes: authoring on the left, live preview on the right.
  Builder/YAML tabs change the authoring view. Stack the panes on narrow screens.
- Put title, language, and displayed code in a collapsible lesson-details section.
- Present steps as compact cards, expanding only the selected card. Summaries
  describe the teaching action, such as "Store the latest badge in score."
  Keep square corners, thin dividers, and the existing site typography/palettes.
- Offer Highlight a line, Show a value, Store a value, and Print as introductory
  step choices. Every card can include a caption.
- Use Number/Text/Boolean/None value controls. A latest-badge choice shows the
  badge's current contents where the authored state is valid.
- Selecting a card previews its completed state. Field errors stay beside the
  form without losing incomplete entries. Advanced steps retain a YAML-edit option.

The Step cards layout is the implementation target; the alternative Focused step
layout remains a comparison idea. The mockup demonstrates interaction and visual
direction, not a completed lesson editor. Use the real player for the implementation's
preview and preserve its existing validation rules.

Clicking code to select a line/expression and richer organization remain the
following slice. Duplicate, move, and delete controls shown in the mockup belong
to that slice; their presence does not expand the first delivery. The first review
should author the existing naming-value and simple-arithmetic examples through forms.

Add Builder and YAML views to the playground, with one shared preview.
The builder has lesson details, an ordered step list, and a selected-step form.
Show the selected step in the preview after a successful rebuild; source typing
can retain today's restart-at-Step-0 behavior.

Initial controls:

- Lesson title, language, and displayed code.
- A step's line and caption.
- Show a value: target text, occurrence, scalar value, and optional type tag.
  Include whole-scalar variable sources where the authored prefix state is valid.
- Store a value: binding name and either a scalar literal or the latest badge.
- Print: text, with an optional link to the latest badge.
- Add a line/caption-only step.

Use labelled value controls to distinguish a number, string, Boolean, and None.
Preserve explicit float tags for values such as 5.0. Keep values teacher-authored.
For a variable source, a value can be filled from the already-authored prefix
snapshot; make clear that this reads lesson state, rather than executing code.

Create simple new steps with one primary action plus optional line/caption.
Imported multi-action steps retain their combinations and order. Present advanced
actions or unsupported fields as preserved cards with a YAML-edit option; do not
silently drop them or simplify them into a supported form. Support for collections,
calls, conversions, and errors in builder forms comes after the introductory trial.

Acceptance:

- Create naming-value and simple-arithmetic from a blank lesson using forms.
- Exported YAML passes the schema and snapshot validation and plays correctly.
- Boolean true, numeric 1, and string "1" remain distinct after saving/reloading.
- Opening an advanced sample and editing a supported part preserves every other
  action and field; invalid source stays available for repair and download.
- Form errors identify the step/field and preserve incomplete input.

## Slice 3: code selection and step organization

Provide line selection and text selection in the displayed-source editor.
Selecting text can populate a badge target, including line and nth occurrence.
Constrain the first implementation to a nonempty selection within one line;
cross-line badge targets are not supported by the current player.

Allow explicit target-text/occurrence entry as a keyboard-accessible alternative.
If editing the code invalidates a target, show the error and let the teacher
repair it; do not silently move the badge to a different occurrence.

Add duplicate, delete, Move up, and Move down controls. Dragging can follow later;
keyboard reordering is part of the initial delivery. Keep the selected card and
preview step aligned after edits/reordering, and provide undo for builder edits.

Acceptance:

- Select the second x in x = x + 1 and generate the correct nth target.
- Backward preview stepping and repeated-line loop steps remain independent.
- Reordering an advanced lesson reports invalid transitions without losing data.
- Undo restores the lesson, selection, and valid preview destination.
- The workflow works with keyboard controls and at narrow widths.

## Shared document and validation rules

Keep the YAML source text as the saved draft. Derive the form view from a YAML
Document, and apply builder edits as transactions back to that source. Preserve
comments, quoted strings, code block content, untouched actions, and explicit
type tags. GUI serialization may adjust formatting when an edit is applied;
merely opening or switching views must leave the original source bytes unchanged.

Do not reconstruct the editable document from parseLesson's returned Lesson:
that parser normalizes code text and discards data outside its playback model.
Use the existing yaml package's document API for editing. Treat aliases, anchors,
or other constructs the builder cannot safely edit as source-editable content.

Use one undo history across source and builder edits. Keep UI-only step identities
out of exported YAML. Incomplete source must never be replaced by an older parsed
lesson when switching modes; the builder can wait for syntax repair while the
source editor and exact-source download remain available. Structural/semantic
errors should be repairable where the builder understands the relevant fields.

Keep syntax/schema diagnostics separate from execution-state validation internally.
Build a small editor adapter so persistence, preview, and download do not depend
on textarea-specific events or a particular editor library. Keep new authoring
modules in apps/site; retain the player's pure state/rendering boundary.

## Verification and review

Add meaningful tests for:

- Editor completion/hover/diagnostics and the existing draft/download behaviors.
- Typed form values, YAML document edits, comments, and untouched advanced fields.
- All 24 canonical lessons through no-edit view switching and semantic round trips.
- One shared undo history, incomplete source, and stale preview/validation responses.
- Keyboard navigation, code targeting, ordering, themes, and responsive layout.

Run unit tests, both type checks, full build/corpus validation, and the pinned
Docker browser/visual pipeline for implementation slices. Existing references
must remain unchanged unless an intended visual change is explicitly reviewed.
Add authoring screenshots when the new UI is ready for visual review.

Manual teacher and assistive-technology trials remain part of reviewing usability.
The first trial uses the existing introductory examples; adding more canonical
content is paused. Choose subsequent action forms from observed authoring needs.

## Sources for the integration check

- [Monaco YAML integration](https://github.com/remcohaszing/monaco-yaml):
  browser YAML support, schema features, and worker configuration.
- [CodeMirror YAML language support](https://github.com/codemirror/lang-yaml):
  highlighting/indentation, with the current repository linked from its README.
- [YAML document API](https://eemeli.org/yaml/#documents):
  document/node editing and comments.


### Current polish slice

Step deletion is undoable. Save/Discard labels distinguish pending form entries
from the shared draft history. Invalid YAML offers an explicit last-working
restore, persisted separately from the draft. Forms gain stronger control borders
and selected-card separation. Reordering stays deferred; later steps may depend
on earlier steps, including after deletion. Next, test these controls during real
lesson editing before expanding actions or adding drag handles.
