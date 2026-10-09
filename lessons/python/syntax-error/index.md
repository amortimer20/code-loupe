---
title: A syntax error before execution
language: python
languageLabel: Python
summary: Locate a missing colon and see why no statements run, including the earlier assignment.
objective: Distinguish a syntax-error location from an executed line and explain why the program has no variables or output.
prerequisites:
  - Variables and assignment
  - Conditional syntax
topics: [Errors, Conditionals, Assignment]
mode: authored
order: 23
---

## Teaching notes

This lesson has one diagnostic step. At Step 0 the code is available for inspection;
Step 1 reveals a teacher-authored SyntaxError at the incomplete if statement.
The underline marks the statement that needs a colon, rather than an exact parser
caret position. The marker locates the problem; it is not an execution arrow.

Ask whether age should appear in Variables because its assignment is on an
earlier line. It should not: this complete snippet fails before execution starts.
No statements run and nothing is printed. The diagnostic is separate from Console
because it is not program output. The concise message is an authored explanation,
not a captured interpreter diagnostic, and can differ from a Python version's
wording. The player does not parse Python.

An unhandled error ends this lesson. Restart or step backward to hide the
diagnostic and inspect the snippet again. Fixing the code does not clear the
authored error; the corresponding YAML steps must also be updated.

## Try a variation

Add the missing colon, replace the error step with an assignment of age to 20,
an authored True condition badge, and the print step for Adult. Update captions
and metadata to describe the corrected program. The player will not compute
the condition automatically.
