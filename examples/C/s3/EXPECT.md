# C / S3 — expectation

Target C = JSPI + JS exception emulation. Scenario S3 = the suspending
Promise is *rejected* on the JS side, so the Wasm resume path must rethrow
into the suspended Wasm frame.

## Hypothesis under test (this row)

JSPI switches stack-switching from binary instrumentation to the Wasm
runtime itself (no save/restore buffer). The §1.2 conflict #1 hypothesis was
that "the Asyncify save-buffer return path traverses the wrong frame for JS
exception emulation to propagate through." If that diagnosis was correct,
JSPI alone (no EH upgrade) should *repair* the A/S3 catch-miss: the Wasm
frame is a *real, live* frame under JSPI, so JS exception emulation's
"threw" propagation can walk back into it and hit the catch the same way
A/S2's C++ throw after resume did.

## Candidate outcomes

- **Conflict #1 repaired by JSPI alone**: clean staged flow
  `S3:before-suspend → PASS:s3-catch-reached-ellipsis → PASS:s3-done`
  (catch via `catch(...)` since JS Error ≠ std::exception).
- **Still broken (conflict #1 is not about Asyncify)**: same as A/S3 —
  `S3:before-suspend → [pageerror] S3`.
- A third failure mode not seen in Phase 1.