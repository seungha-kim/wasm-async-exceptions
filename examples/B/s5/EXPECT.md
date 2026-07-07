# B / S5 — expectation

Target B = Asyncify + Wasm exception handling. Scenario S5 resolves a first
controlled Promise, throws from C++, catches it, then suspends again inside the
catch block.

## Hypothesis under test

This checks whether replacing JS exception emulation with Wasm EH changes the
catch-then-resuspend behavior while keeping Asyncify as the suspend mechanism.
