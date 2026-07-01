# A / S1 — expectation

Target A = Asyncify instrumentation + JS exception emulation; scenario S1 =
synchronous throw inside `main`'s try block, caught by the same `main`.

## Expected observation

Console (in order):
1. `S1:before-throw`
2. `PASS:s1-catch-reached`
3. `S1`                      # what() of the caught exception
4. `PASS:s1-done`

## Why

S1 has no suspend; only throw/catch on an instrumented binary. JS exception
emulation propagates the throw via the normal return path of `main` itself;
the catch branch is taken. This is the clean baseline that every later
scenario on every target is compared against.