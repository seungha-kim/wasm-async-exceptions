# A / S5 — expectation

Target A = Asyncify + JS exception emulation. Scenario S5 resolves a first
controlled Promise, throws from C++, catches it, then suspends again inside the
catch block.

## Hypothesis under test

This removes JS Promise rejection from the experiment. If A fails while D
passes, the failure is evidence for a C++ exception/catch interaction with
Asyncify rather than the JS rejection boundary from S3/S4.
