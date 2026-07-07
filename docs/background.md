# Background: Wasm runtime limits and Emscripten's emulation layer

This file is the long-form companion to `docs/design.md` §1. It exists so that
later observation notes in `docs/matrix.md` can reference a stable write-up of
*what* Emscripten is emulating and *why*, without re-deriving it every time.

## 1. The Wasm MVP and what it lacks

WebAssembly 1.0 (2017) defines a stack machine with a deliberately small set
of operations: integer/float arithmetic, memory load/store, calls, branches.
Two C++ runtime features are absent from the MVP:

- *Cooperative suspend/resume* — a Wasm function cannot pause mid-frame and
  return control to its caller without unwinding. There is no `await`.
- *Exceptions* — there is no `try`/`catch` opcode; `throw` cannot be encoded.

## 2. What Emscripten does about it

Emscripten implements both via a *JS + binary instrumentation* layer atop Wasm:

### 2.1 Asyncify

Compiled with `-sASYNCIFY`, every function reachable from a suspend import
gets instrumented: on entry it checks an `asyncify.state`; on suspend the
runtime copies the live stack (locals + program counter) into a side buffer
and returns to JS; on resume the buffer is copied back and execution continues
as if the call never left. The set of instrumented functions is wide by
default and can be tuned with `ASYNCIFY_ONLY` / `ASYNCIFY_REMOVE`.

### 2.2 JS exception emulation

Without Wasm exception handling, C++ `throw` cannot directly stop a Wasm
frame. Emscripten emulates it: the throwing function writes the exception
object to a global and returns via the normal return path with a "threw"
flag; every caller checks that flag after each call and, if set, propagates
up the same way. `catch` blocks become conditional branches on that flag.

## 3. Why they collide

Both mechanisms occupy the **return path** of every function on the relevant
call chain. The design doc §1.2 lists three conflicts this produces; those
are *hypotheses* for this project to verify, not pre-established facts.

## 4. What the standards change

- **JSPI** (JS Promise Integration) — Wasm exports may return a Promise that
  the runtime awaits, with the Wasm stack genuinely suspended by the runtime
  itself. No instrumentation of every function is required.
- **Wasm exception handling** — `try`/`catch`/`throw` become opcodes; the
  unwind is performed by the runtime, not by per-call flag checks.

One important observation from this repository is that standardizing only the
exception axis is not necessarily a safe intermediate step. The Asyncify +
Wasm EH row (target B) still uses Asyncify for suspension. S5-S7/S9-S12 show
it can fail even when every JS async operation resolves and every exception
starts inside C++, while S8/S14/S17 show that ordinary repeated multi-yield
restoration followed by a later C++ throw, or an `exception_ptr` created and
consumed after resume, can still reach the intended C++ catch path. S13/S15/S16
also show a milder post-done `unreachable` surface after payload-only controls.

## 5. The third path: C++20 coroutines

A C++20 coroutine stores its locals in a heap-allocated frame and *returns*
to the caller when it suspends. Wasm never "freezes" — it has already popped
the frame. JS holds the resume handle and re-enters Wasm when the awaited
event settles. The coroutine-emulation layer is not needed at all; only the
exception-emulation layer (or Wasm EH) is on this path.

## 6. Status as of this writing

JSPI and Wasm EH are both shipped in stable Chrome
(`chromestatus.com/feature/5675224515231744`). Emscripten supports both;
serious use outside Chrome is still uneven, so this project treats the
Asyncify + JS EH combination as the *practical default* and JSPI + Wasm EH
and C++20 coroutine as the *standardized exits* to compare against. It does
not treat Asyncify + Wasm EH as a safe stepping-stone; in the current
observations that mix is the fragile row.
