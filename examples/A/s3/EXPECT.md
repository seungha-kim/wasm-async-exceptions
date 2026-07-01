# A / S3 — expectation

Target A = Asyncify + JS exception emulation; scenario S3 = the suspending
Promise is *rejected* on the JS side, so the Wasm resume path must rethrow
into the suspended Wasm frame.

## Hypothesis under test (design.md §1.2 conflicts #1 + #3)

- JS exception emulation writes "threw=true" into the global. When the
  Asyncify instrumentation tries to *resume* the saved Wasm frame, the
  interceptor wants to load PC/locals from the buffer and re-enter Wasm at
  the suspend-resume point — but the threw-flag means the runtime wants to
  propagate upwards via the *caller's* return path instead. These two
  "where do I return to" assertions collide.
- Candidate observed outcomes:
  - `unreachable` trap during resume (`abort: unreachable`);
  - the catch is missed entirely and a JS `Error("S3")` arrives in
    `pageerror`;
  - the Wasm frame prints `S3:before-suspend` only and then hangs;
  - or — pathological — the `PASS:s3-after-resume-non-throw` path fires
    (the rejection was silently swallowed by Asyncify resume), showing
    the exception was lost.

## What this scenario does NOT expect

A clean catch of `Error("S3")` by `catch(const std::exception&)`. JS Errors
do not derive from `std::exception`; if any catch fires, expect the
ellipsis branch `PASS:s3-catch-reached-ellipsis`.