# Mathematics visualization prototype

## Goal and current direction

Help teachers explain how arithmetic expressions are evaluated and algebraic
equations are transformed. Students move through explanations at their own pace,
as they do in Code Loupe. Useful explanations take precedence over a short path
to the answer. Student answer checking is outside the current scope.

Begin with fixed, teacher-authored worked examples. Automatic tracing is a later
experiment, after teachers have tried the visual approach. The first prototype
does not claim to execute mathematics or verify arbitrary authored solutions.

Code-builder trials can proceed at the user's own pace. Math work is a separate
track; it does not require completing every code-builder action first.

## First teaching scope

- Arithmetic with small whole numbers, addition, subtraction, multiplication,
  and parentheses. Use examples with nonnegative intermediate results initially.
- One-variable linear equations of the form `ax + b = c`, with positive integer
  coefficients and integer solutions. Subtract the same amount from both sides,
  simplify, divide both sides by the same nonzero coefficient, and simplify again.
- A teacher chooses every displayed intermediate state, caption, and emphasis.

Fractions, decimals, negative-number rules, distribution, powers, inequalities,
variable denominators, and equations with no or infinitely many solutions remain
future topics. This is a prototype content boundary, not a permanent limitation.

## Initial examples and teaching beats

These are review fixtures, not additions to the canonical code lesson corpus.
Colleague feedback can change them before broader lesson authoring is designed.

### Multiplication before addition

| Display | Emphasis | Explanation |
| --- | --- | --- |
| `3 + 2 × 4` | `2 × 4` | Multiply before adding. |
| `3 + 8` | `8` | Two groups of four give eight; the addition remains. |
| `11` | `11` | Now add three and eight. |

### Parentheses change the grouping

| Display | Emphasis | Explanation |
| --- | --- | --- |
| `(3 + 2) × 4` | `3 + 2` | Evaluate the sum inside the parentheses first. |
| `5 × 4` | `5` | That grouped sum is five. |
| `20` | `20` | Multiply five by four. |

Present the two arithmetic examples separately, with a teacher note comparing
their grouping and different results. A side-by-side comparison UI can wait.

### Preserve equality while solving

| Display | Emphasis | Explanation |
| --- | --- | --- |
| `2x + 3 = 11` | `+ 3` | First undo the addition of three. |
| `2x + 3 − 3 = 11 − 3` | Both `− 3` operations | Subtract three from each side to preserve equality. |
| `2x = 8` | Both simplified sides | Simplify each side. |
| `2x ÷ 2 = 8 ÷ 2` | Both divisions | Divide each side by two to isolate x. |
| `x = 4` | `x = 4` | Simplify: x is four. |

Keep operation and simplification as separate teaching moments. Avoid teaching
terms as merely moving across the equals sign and changing sign. Teachers may
omit intermediate moments later; the prototype should demonstrate them first.

## First visual prototype

An experimental page offers the three examples, a large current expression or
equation, a Variables panel, a caption, and the familiar code-loupe playback
controls. Show one expression in a stable-height stage. Step 0 shows the starting
expression without emphasis, variables, or a caption; advancing begins the
explanation. Do not add a previous/current comparison panel that changes height.

Emphasize the selected subexpression or the operation applied to both sides.
Use an outline/underline alongside color. Initially use simple transitions;
term-flight animations and automatic matching between expressions can wait.
Backward stepping restores exactly the previous authored view.

Keyboard controls, visible focus, narrow screens, and reduced motion are part
of the first slice. Provide readable mathematical text and a concise step
announcement. Actual screen-reader usefulness needs manual review with teachers
and assistive-technology users; visual highlighting alone is insufficient.

## Isolation and provisional implementation boundary

Keep the experimental route separate from the sample gallery and code playground.
Do not extend code lesson YAML, code snapshots, or code StepEvents with math keys.

Start with a small site-local math module and typed fixtures. Its pure lesson
data describes display states, captions, and explicit emphasis targets; rendering
and playback consume those states. Do not use string searching for repeated
mathematical terms: explicitly identified display parts are a possible first
implementation. The exact representation is still to be designed.

Reuse the site's layout and appearance where useful. Keep mathematical rendering
separate from the code component. Do not extract a common playback framework or
create a public math package until the prototype demonstrates a concrete need.
An independent package/app remains an option if the experiment grows.

Mathematical notation rendering and mathematical semantics are distinct. Choose
a rendering approach in the prototype slice after checking highlighting,
accessible output, and deployment requirements. A notation library does not
validate transformations. No public math authoring syntax is settled yet.

## Delivery slices

1. **Teaching scope and examples (this document).** Record the agreed purpose,
   boundaries, initial teaching beats, and separation from the code tool.
2. **Read-only visual prototype.** Implement the three fixed examples on the
   isolated route. Demonstrate emphasis, captions, reversible playback, keyboard
   access, reduced motion, and a usable short/narrow layout. No editor yet.
3. **Teacher trial and refinement.** Review operation versus simplification
   pacing, notation, highlight clarity, and explanation usefulness. Decide
   whether a small math authoring UI is the next useful slice.
4. **Limited tracing experiment.** Explore generating arithmetic evaluation steps
   for the agreed subset. Evaluate algebra transformations separately because
   valid solution paths are not unique. Generated explanations remain reviewable
   by the teacher; no automatic solver or student grading is promised.

For the prototype, test first/last boundaries, forward/backward restoration,
example switching, focus, and reduced-motion behavior. Run the repository's
normal type/build and Docker checks. Existing code screenshots must stay the
same; any new math references should be intentionally created and reviewed.

## Questions for the trial

- Does in-place replacement make the change clear without a second equation view?
- Is outlining terms enough, or should both sides of an equation also be grouped?
- Which simplifications deserve their own step for the intended classes?
- Can teachers describe the desired highlights without learning notation markup?
- Which eventual representation supports exact numbers, repeated terms, accessible
  reading, and valid transformations without burdening authors?

The experiment can remain a separate feature permanently. A shared player shell,
public file format, math editor, and automatic tracing are decisions to revisit
after the first classroom-oriented review.

## Prototype available

The isolated `/math/` route now offers the three fixed examples, explicit
display-part emphasis, one stable expression stage, authored variables, captions,
keyboard stepping, autoplay, speed, scrubbing, restart, and fullscreen. It uses ordinary text and mathematical symbols with
authored spoken labels; it does not yet render general LaTeX or expose an editor.
The math card uses the same Paper/Midnight/Terminal lesson palettes and playback
visuals as code loupes. Site appearance remains independent of the viewer palette.
The fixtures live in `apps/site/src/math/` and remain a private prototype format.

Both arithmetic examples now use measured result replacement, natural spacing,
and smooth movement of retained neighboring terms. The first replacement anchors
the unchanged prefix; subsequent results retain the original expression left edge. Step 1 introduces emphasis with a short transition.
Manual playback waits after each transition; autoplay pauses between steps and
stops at the end. Speed controls affect both pacing and animation duration.
Scrubbing/backward steps are immediate. The motion toggle shares the code
viewer's saved preference: system reduced motion supplies the default, and an
explicit viewer choice overrides it. Algebra introduces matching operations on
both sides together, shows additive cancellation through +0, and simplifies
results on each side without crossing the equals sign. Algebra variables are authored as unknown until the
solution step; backward stepping restores them without performing a calculation.

## Motion quality review

Feature expansion paused to refine one transition before propagating its design.
All three examples now use result-sized highlights, measured final positions,
and a final DOM handoff before removing the overlays. Nested display parts
identify groups for motion; they are not a symbolic algebra model.

Arithmetic retains natural spacing and moves neighboring terms into their new
positions. Algebra keeps the equals sign fixed, introduces the same operation
on both sides together, and illustrates that opposite additive terms sum to
zero before removing +0. Division simplifies both sides concurrently. Source
highlighting, results, and retained-term highlights share one treatment; glyphs
do not pop or scale during evaluation.

Frame review at 1×/0.5× and desktop/narrow sizes complements behavior checks.
Classroom feedback and continuous-motion review remain useful; passing tests
alone does not establish teaching quality. General notation rendering and broader
algebra operations remain separate future work.
