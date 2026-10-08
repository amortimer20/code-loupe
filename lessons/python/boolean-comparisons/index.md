---
title: Boolean comparisons
language: python
languageLabel: Python
summary: Ask two comparison questions and follow their True and False results.
objective: Explain that comparisons produce Boolean values and distinguish == from assignment.
prerequisites:
  - Printed output
  - Numbers and expressions
topics: [Expressions, Conditionals, Input and output]
mode: authored
order: 7
---

## Teaching notes

At Steps 1 and 4, ask students to answer each comparison before revealing the
badge. Steps 2 and 5 show Python's `True` and `False` with `bool` tags. These are
Boolean values, not the strings "True" and "False" or numeric arithmetic results.
YAML writes the badge values as unquoted `true` and `false`.

Contrast `==` with the `=` in
[Naming a value](/samples/python/naming-value/): comparison asks whether values
are equal; assignment binds a name to a value. Neither expression here assigns
a variable. Continue with
[Choosing a conditional branch](/samples/python/conditional/) to see a Boolean
result select a branch, then [A simple while loop](/samples/python/while-loop/)
to see repeated condition checks.

Step backward from Step 6 to remove only the second output while retaining its
False badge. Returning to Step 2 restores the True badge and empty console.
These outcomes are authored; the player does not evaluate the comparisons.

## Try a variation

Change the second expression to `2 == 2`. Update the code, second badge target,
its value to `true`, second printed text to `"True"`, and captions. Both outputs
then show True, while the first expression stays unchanged.
