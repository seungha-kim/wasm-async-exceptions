# E' / S3 — expectation

Target E' records a rejected JS settlement, resumes the coroutine, and throws
inside C++ from `await_resume()`, with Wasm EH handling the catch.
