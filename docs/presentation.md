# Presentation Notes

## Title

Asyncify, JSPI, Wasm EH, and the boundary between JavaScript async work and
C++ exceptions.

## One-sentence thesis

Rejected JS Promises do not automatically become C++ exceptions; if C++
`catch` semantics matter, JS async settlement must be converted into C++
control flow explicitly. Separately, Asyncify + Wasm EH is a fragile
intermediate migration target: it fails C++-initiated exception/suspend stress
cases that both Asyncify + JS EH and JSPI + Wasm EH handle.

## 10-minute outline

### 1. Problem

WebAssembly did not start with native stack suspension or C++ exceptions.
Emscripten fills those gaps with runtime support:

- Asyncify rewrites code so a Wasm stack can be saved and restored.
- JS exception emulation carries C++ exception state through generated JS
  support.
- JSPI and Wasm EH move parts of this work into standardized runtime
  mechanisms.

The risky boundary is not "throw in C++ after an await"; that can work. The
risky boundary is "a JavaScript Promise rejects while Wasm is suspended."

### 2. Experiment

The project tests six targets:

| Target | Coroutine axis | Exception axis |
|---|---|---|
| A | Asyncify | JS EH |
| B | Asyncify | Wasm EH |
| C | JSPI | JS EH |
| D | JSPI | Wasm EH |
| E | C++20 coroutine glue | JS EH |
| E' | C++20 coroutine glue | Wasm EH |

Each target runs four scenarios:

- S1: synchronous throw baseline
- S2: suspend, resume, then throw from C++
- S3: suspended async operation rejects
- S4: catch, then await again

A second A/B/D-only stress set removes JS rejection entirely:

- S5: C++ throw, catch, then suspend inside the catch
- S6: destructor suspends during C++ exception unwind
- S7: catch, suspend, then rethrow

### 3. Key observations

S2 passes on A/B/D because the throw originates from C++ after a successful
resume. That path uses C++ exception machinery.

S3/S4 fail on A/B/D because the throw originates as a rejected JS Promise.
The rejection escapes as a page error instead of landing in C++ `catch`.

C fails in this harness because JSPI plus JS exception emulation hits the
`trying to suspend JS frames` failure surface.

E/E' pass all scenarios because they do not rely on Promise rejection crossing
the Wasm boundary. JS records settlement, resumes the coroutine handle, and
C++ throws from `await_resume()` if the settlement was rejected.

The resolution-only S5-S7 stress set gives a separate migration finding:
A and D pass, while B fails with `null function` / `unreachable`. That means
"turn on Wasm EH but keep Asyncify" is not a safe intermediate path for code
that mixes C++ exceptions with suspension.

### 4. Metrics

The metrics reinforce the control-flow finding:

- Asyncify rows have the largest combined generated-code footprint in suspend
  scenarios.
- JSPI rows reduce generated code but do not solve the rejected-Promise
  boundary on their own.
- C++20 coroutine rows add developer-owned glue, but avoid the failure-timeout
  path in S3/S4.
- B's S5-S7 failures are correctness failures, not timing artifacts; the long
  duration is the test waiting for a `PASS:*done` line that never arrives.

### 5. Recommended pattern

Use explicit async result transport at the JS/Wasm boundary:

1. JS resolves/rejects work into a status/result record.
2. Wasm/C++ is resumed intentionally.
3. C++ inspects the status.
4. C++ throws from C++ code if `catch` semantics are required.

Do not design APIs around the assumption that a rejected Promise will be
observed as a C++ exception.

### 6. Closing line

JSPI and Wasm EH are valuable because they reduce runtime emulation and code
size, but they are not a substitute for a deliberate exception boundary
between JavaScript async settlement and C++ control flow. When adopting Wasm
EH, avoid treating Asyncify + Wasm EH as a low-risk halfway house; test the
combined exception/suspend paths or move the stack-switching axis too.

## Demo commands

```sh
source ./emsdk/emsdk_env.sh
npx playwright test --workers=1
scripts/collect-size-metrics.sh
```

Representative manual demo:

```sh
cd examples/A/s3
./build.sh
./run.sh
```

Expected takeaway: A/S3 logs `S3:before-suspend` and then a page error
surface, not a C++ catch.

Counterexample with explicit settlement conversion:

```sh
cd examples/E/s3
./build.sh
./run.sh
```

Expected takeaway: E/S3 reaches `PASS:s3-catch-reached` because C++ throws
after coroutine resume.

Migration stress demo:

```sh
cd examples/B/s6
./build.sh
./run.sh

cd ../../D/s6
./build.sh
./run.sh
```

Expected takeaway: B/S6 reaches destructor resume and then fails with
`null function` / `unreachable`; D/S6 reaches `PASS:s6-done`.
