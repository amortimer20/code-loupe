---
title: Strings and numbers
language: python
languageLabel: Python
summary: Compare adding numbers with joining strings that contain digits.
objective: Explain how operand types change the meaning of + and distinguish a string from a number.
prerequisites:
  - Printed output
  - Addition
topics: [Types and conversion, Expressions, Input and output]
mode: authored
order: 5
---

## Teaching notes

Compare the two expressions before stepping. The visible difference is the
quotation marks, which make the second pair of operands strings. Steps 1–3
evaluate and print integer 5; Steps 4–6 join the strings and print string "23".

Pause at Steps 2 and 5 to compare the `int` and `str` tags and the quoted string
badge. The console omits string quotation marks and is not a reliable indicator
of the value's type. This example does not convert either value or mix a string
with an integer.

Step backward from Step 6 to keep the first output and string badge while
removing only the second output. The values and outputs are authored, not
calculated by the player. Continue with
[Converting input to a number](/samples/python/numeric-input/), where input
returns a string even when the student types digits.

## Try a variation

Use 4 and 6 in both expressions. Update both code lines and badge targets,
the integer badge to `10`, the string badge to `"46"`, printed texts to
`"10"` and `"46"`, and captions. Keep the string values quoted in YAML.
