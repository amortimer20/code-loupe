---
title: Two instances with independent state
language: python
languageLabel: Python
summary: Construct two Students, follow each initializer's self, and change one instance without changing the other.
objective: Explain why two instances of the same class can hold independent values for an attribute with the same name.
prerequisites:
  - Class-instance construction and initialization
  - Object references and scalar attributes
topics: [Objects, References, Functions, Assignment, Input and output]
mode: authored
order: 21
---

## Teaching notes

Build on [Creating a class instance](/samples/python/class-instance/).
The definition is already available; Step 1 is context rather than a trace of
class definition. Repeat the complete construction sequence so learners can
compare the two initializer calls. Object ids are teaching labels, not memory
addresses. There is one class and two instances; the player models the instances,
not the runtime class object.

Compare Steps 4 and 11: each call has its own local self and name. In the first
call self refers to student-1; in the second it refers to student-2. The first
frame is removed before the second is created, and ada remains bound to the
first instance throughout the second construction. Steps 7 and 14 show the
constructor reference results after each initializer finishes with None.

At Step 15, both global names are bound and both instance cards have their own
name attribute. Ask which card will change before advancing from Step 16 to 17.
Only ada's attribute changes. Step backward to restore "Ada" while retaining
"Grace" on the other card. Steps 19 and 21 print the contrasting values.
Compare with [Shared-list aliasing](/samples/python/list-aliasing/): independence
comes from two separate allocations, not merely from having two variable names.
Two variables can also refer to the same instance, although this lesson does not
introduce that additional alias.

This lesson uses existing scalar attribute operations. Instance-method calls,
class attributes, inheritance, and nested attribute values are later topics.
The code is displayed for explanation; changing it does not execute Python or
recalculate the authored steps.

## Try a variation

Update grace.name instead of ada.name. Change the assignment line, update target,
replacement badge and value, both attribute-read values, printed outputs, and
captions to agree. Keep the two allocation ids, constructor bindings, and global
references unchanged. Predict which card will retain its original name.
