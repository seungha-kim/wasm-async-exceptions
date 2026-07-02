# E / S3 — expectation

Target E does not let JS Promise rejection cross the Wasm boundary as an
exception. JS records a rejected settlement, resumes the coroutine, and
`await_resume()` throws `std::runtime_error("s3-1")` inside C++.
