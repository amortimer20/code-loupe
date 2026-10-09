---
title: A runtime error during conversion
language: python
languageLabel: Python
summary: Fail an integer conversion after earlier output and assignment, keeping the state that existed before the failure.
objective: Explain why a failed right-hand expression leaves earlier state intact and does not create its assignment's variable.
prerequisites:
  - Strings and integer conversion
  - Assignment and console output
topics: [Errors, Types and conversion, Assignment, Input and output]
mode: authored
order: 24
---

## Teaching notes

Contrast with [A syntax error before execution](/samples/python/syntax-error/).
This program starts: Step 2 prints Starting and Step 3 binds age to "abc".
Step 4 reads that string; Step 5 replaces the value badge with a diagnostic
annotation over int(age). The error annotation is not a returned value.

Ask whether years becomes None or keeps "abc". Neither occurs: evaluating the
right-hand expression fails before the assignment, so years is absent. Earlier
state survives: age remains bound and the console still contains Starting.
The marker identifies the failing line; the final print is not executed.
The diagnostic stays separate from ordinary console output.

Step backward from Step 5 to recover the argument badge and the execution arrow.
The variable and output remain. Scrub to Step 0 to remove all state. Autoplay
pauses when the error is revealed. This models an unhandled failure, so no later
steps follow it; caught errors and stack unwinding are future topics.

The type, location, and concise message are teacher-authored. The player does
not execute int or generate an interpreter traceback. It validates the lesson's
structure and targets, not whether Python would actually produce this error.

## Try a variation

Change "abc" to "30" and replace the error step with conversion to 30,
assignment to years from that badge, then a read and print of years on line 4.
Update the stored string, argument badge, captions, metadata, and expected output
to match. Code changes alone do not recalculate any authored values.
