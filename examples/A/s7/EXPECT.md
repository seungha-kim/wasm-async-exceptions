# A / S7 — expectation

Target A = Asyncify + JS exception emulation. Scenario S7 resolves a first
controlled Promise, throws from C++, catches internally, suspends inside that
catch, then rethrows to an outer catch.

## Hypothesis under test

This stresses saved exception/rethrow state across an Asyncify suspend without
using JS Promise rejection.
