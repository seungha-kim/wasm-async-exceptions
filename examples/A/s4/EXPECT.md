# A / S4 — expectation

Target A = Asyncify + JS exception emulation; S4 = the catch handler
*itself* contains a second suspend point.

## Hypothesis under test (design.md §1.2 conflict #2)

Asyncify's resume state machine expects to restore the frame so execution
continues immediately after the await — but when an exception unwind
restored the frame to the catch-block entry, the "where do I go next"
table has two equally valid targets:

- "just past `await_controlled_promise("s4-1")`" (Asyncify resume),
- "into the catch handler body" (exception unwind).

We expect either:
- the second suspend never completes (`FAIL:s4-after-resume-not-thrown`
  appears, or `uncaught`);
- the catch fires but the second `await_controlled_promise("s4-2")`
  crashes or traps because Asyncify's state was not properly reset
  after the catch unwind;
- in the worst case a "double unwind" causes a `unreachable` trap.

## Happy-path sequence (NOT expected)

1. `S4:before-suspend`
2. `PASS:s4-catch-reached`, some exception text, `PASS:s4-after-second-resume`, `PASS:s4-done`