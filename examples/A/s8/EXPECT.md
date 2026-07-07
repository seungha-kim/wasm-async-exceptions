# A / S8 — expectation

Target A = Asyncify + JS exception emulation. Scenario S8 resolves three
controlled Promises across a nested call chain, then throws from the innermost
C++ function and expects the outer `main()` catch to observe it.

## Hypothesis under test

This removes JS Promise rejection from the experiment and keeps the catch
outside the nested call chain. It checks whether Asyncify can restore several
yielded frames and still unwind a C++ throw from the innermost function to the
outer catch.

## Observed result

A reaches `PASS:s8-outer-catch-reached` and `PASS:s8-done`.
