---
title: Calling an instance method
language: python
languageLabel: Python
summary: Bind a method's receiver to self, change its name attribute, and return None without undoing the change.
objective: Explain how an instance-method call binds self to the receiver and keeps attribute changes after the method's locals disappear.
prerequisites:
  - Function calls and local parameters
  - Class-instance construction and independent state
topics: [Objects, References, Functions, Scope, Assignment, Input and output]
mode: authored
order: 22
---

## Teaching notes

Build on [Two instances with independent state](/samples/python/two-instances/).
The class definition is already available. Steps 1–2 summarize construction by
allocating initialized instances and binding the global names; they deliberately
omit the initializer frames covered in the preceding lessons. The displayed code
still shows where those instances come from. Object ids are teaching labels,
not memory addresses.

Ask learners which instance will change at Step 3. At Step 4, compare the global
ada reference with the method's local self reference: both identify student-1.
Python supplies the receiver as self in this ordinary instance-method call;
the call site explicitly supplies only the new_name argument. The YAML author
models that binding with `args: [{ var: self, ref: student-1 }, ...]`. The player
does not resolve method lookup or infer the receiver from the displayed code.

Compare Steps 5 and 6 for the attribute write, and Step 7 for the return. The
local new_name parameter and self disappear when the frame is removed. The heap
object remains changed because self and ada referred to the same instance;
grace's instance remains unchanged throughout. Step backward from Step 7 to
restore the frame while retaining the changed attribute, then from Step 6 to
Step 5 to restore "Ada". Scrubbing directly to Step 4 restores both the old
attribute and the method's locals.

`return: { value: null }` explicitly authors the method's implicit None result.
This ordinary call has no `construct`: its result badge is None, unlike the
instance reference produced by the constructor lesson. Step 8 moves to the next
line and discards that unused result; no assignment or console output occurs
for None. Steps 9 and 11 print Lovelace and Grace.

Method lookup, descriptors, class/static methods, inheritance, reference-valued
ordinary returns, and automatic execution remain outside this lesson's scope.

## Try a variation

Call grace.rename("Hopper") instead. Update the call line and target, the local
self reference to student-2, argument and parameter badges, both attribute-read
values, printed outputs, and captions. Keep the two setup objects and global
references unchanged. Predict why ada's name will now remain "Ada".
