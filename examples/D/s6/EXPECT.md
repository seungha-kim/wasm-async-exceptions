# D / S6 — expectation

Target D = JSPI + Wasm exception handling. Scenario S6 resolves an initial
controlled Promise, throws from C++, and then suspends from a destructor running
during C++ stack unwind.

## Hypothesis under test

This is the standard-path comparison point for A/B S6. If D handles unwind
cleanup suspension where Asyncify rows fail, it gives the desired correctness
example.
