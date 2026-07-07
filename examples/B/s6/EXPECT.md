# B / S6 — expectation

Target B = Asyncify + Wasm exception handling. Scenario S6 resolves an initial
controlled Promise, throws from C++, and then suspends from a destructor running
during C++ stack unwind.

## Hypothesis under test

This checks whether Wasm EH changes destructor-cleanup suspend behavior while
Asyncify still owns suspend/resume.
