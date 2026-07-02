# B / S3 — expectation

Target B = Asyncify + Wasm exception handling. Scenario S3 = the suspending
Promise is *rejected* on the JS side, so the Wasm resume path must rethrow
into the suspended Wasm frame.

## Hypothesis under test (this row)

Wasm exception handling opcodes own the throw/catch dispatch (not per-call
flag checking), so even when Asyncify instrumentation restores the saved
frame, a throw initiated on JS side via Promise reject should propagate into
the Wasm `try`/`catch` handler instead of escaping to JS.

## Candidate outcomes (per design.md §1.2 + the build-time warning)

- The B/S2-style happy path runs cleanly:
  `S3:before-suspend → PASS:s3-catch-reached-ellipsis → PASS:s3-done`
  (the catch is via `catch(...)` since JS `Error` does not derive from
  `std::exception`).
- The `emcc` warning that "ASYNCIFY=1 is not compatible with
  -fwasm-exceptions" manifests at *runtime*, not just at build: the binary
  either traps (`unreachable`), hangs, or the reject escapes as JS
  pageerror exactly as in A/S3.
- Something new appears that was not in A/S3 nor on the happy path.