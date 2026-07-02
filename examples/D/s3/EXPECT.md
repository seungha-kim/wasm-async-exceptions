# D / S3 — expectation

Target D = JSPI + Wasm exception handling. Scenario S3 rejects the controlled
Promise that the Wasm side is awaiting.

## Hypothesis under test

With both stack switching and exception handling owned by the Wasm runtime,
the JS-initiated rejection should no longer leak past the C++ catch boundary
the way it did on A/B. If this still fails, D is not the predicted complete
standard-path escape.
