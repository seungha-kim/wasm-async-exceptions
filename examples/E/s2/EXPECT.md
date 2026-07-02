# E / S2 — expectation

Target E resolves JS settlement explicitly through C++20 coroutine glue.
Resolving `s2-1` should resume the coroutine, then the C++ throw should be
caught by the local catch block.
