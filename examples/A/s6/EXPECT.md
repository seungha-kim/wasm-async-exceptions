# A / S6 — expectation

Target A = Asyncify + JS exception emulation. Scenario S6 resolves an initial
controlled Promise, throws from C++, and then suspends from a destructor running
during C++ stack unwind.

## Hypothesis under test

This stresses the overlap between C++ unwind cleanup and Asyncify
suspend/resume without using JS Promise rejection.
