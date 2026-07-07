# B / S7 — expectation

Target B = Asyncify + Wasm exception handling. Scenario S7 resolves a first
controlled Promise, throws from C++, catches internally, suspends inside that
catch, then rethrows to an outer catch.

## Hypothesis under test

This checks saved exception/rethrow state across an Asyncify suspend with Wasm
EH handling C++ exceptions.
