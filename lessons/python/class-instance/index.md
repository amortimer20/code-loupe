---
title: Creating a class instance
language: python
languageLabel: Python
summary: Follow construction through __init__, self, attribute initialization, and a returned instance reference.
objective: Explain how self identifies a new instance and distinguish an initializer's None result from the constructor expression's instance result.
prerequisites:
  - Function calls and local parameters
  - Object references
  - Named dictionary fields
topics: [Objects, References, Functions, Scope, Assignment, Input and output]
mode: authored
order: 20
---

## Teaching notes

Build on [Updating a dictionary field](/samples/python/dictionary-fields/).
The card now carries the class label Student and an unquoted attribute name.
`student.name` is attribute access; it is not the dictionary lookup
`student["name"]`. The object id is a teaching label, not a memory address.

Like the function-call lessons, this lesson assumes the definition is already
available. Step 1 pauses on the class for context, emphasizing that no instance
exists yet; it does not trace class definition or model the class itself as a
runtime object. Steps 2–3 evaluate the argument and allocate an empty instance; no global
student binding exists yet. Step 4 enters the initializer with self pointing to
that instance and name holding "Ada". Step 5 reads the second occurrence of
name on line 3, the local parameter. Step 6 creates the instance attribute.

Python's `__init__` initializes an already allocated instance and must finish
with None. It does not return the instance. At Step 7, `return: { value: null }`
models that implicit completion; `call.construct` makes the enclosing
`Student("Ada")` expression produce an instance reference badge instead of a
None badge. Step 8 binds that result to student. Steps 9–10 read and print its
attribute. Allocation and initialization are simplified authored teaching events;
the player does not execute Python or model `__new__`.

Step backward from Step 7 to restore the initializer's locals and self reference.
From Step 6 to Step 5, remove the attribute while keeping its incoming badge.
From Step 8 to Step 7, remove the global binding while retaining the initialized
object and constructor result. Scrubbing to Step 0 removes everything.

Class labels, scalar attribute writes, and constructor completion are explicit.
The player does not inspect class definitions, run methods, implement inheritance,
or infer which attributes a class should have. Two independent instances and
ordinary instance-method calls are later lessons.

## Try a variation

Construct `Student("Grace")` instead. Update the code, argument badge target and
value, constructor call target, local-parameter read badge, attribute-read badge,
printed text, and captions. Keep the class label, object id, self reference,
attribute name, and null initializer completion unchanged.
