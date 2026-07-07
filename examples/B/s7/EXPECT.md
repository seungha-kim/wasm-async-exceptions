# B / S7 — expectation

Target B = Asyncify + Wasm exception handling. Scenario S7 resolves a first
controlled Promise, throws from C++, catches internally, suspends inside that
catch, then rethrows to an outer catch.

## Hypothesis under test

This checks saved exception/rethrow state across an Asyncify suspend with Wasm
EH handling C++ exceptions.

## Observed result

The inner catch resumes and logs `S7:after-inner-resume`, then B fails with
`[pageerror] null function`, `[pageerror] unreachable`, and never reaches the
outer catch. This shows the Asyncify + Wasm EH mix failing saved
exception/rethrow state across suspend.
