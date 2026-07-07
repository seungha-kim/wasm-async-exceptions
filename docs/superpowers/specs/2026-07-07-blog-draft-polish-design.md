# Blog Draft Polish Design

## Goal

Turn `docs/presentation.md` from presentation notes into a readable blog draft
that explains the project's final findings without changing code, tests, or
experimental behavior.

## Primary Audience

The draft is for readers who understand C++ and JavaScript async concepts, but
may not already know the details of Asyncify, JSPI, or Wasm exception handling.
It should explain the experiment's motivation, not just list matrix results.

## Main Story

The article should preserve the project's important shift in conclusion:

1. The original question was whether JSPI + Wasm EH gives a cleaner answer than
   Asyncify + JS exception emulation for C++ exceptions around async work.
2. The first matrix shows a broader rule: rejected JS Promises do not
   automatically become C++ exceptions in any runtime-axis combination.
3. The C++20 coroutine rows show the practical pattern: carry JS settlement as
   data, resume C++, and throw from C++ if `catch` semantics are required.
4. The later stress matrix finds a separate migration risk: Asyncify + Wasm EH
   is fragile when live or captured Wasm EH exception state crosses an Asyncify
   suspend boundary.
5. S12 should be highlighted as the clearest captured-state case because the
   catch block has ended before the second suspend, yet `std::exception_ptr`
   fails when reactivated after resume on B.

## Document Scope

Primary file:

- `docs/presentation.md`

Optional small follow-up file:

- `README.md`, only if the document label or reading-order wording needs to
  reflect that `presentation.md` is now a blog-style draft.

No C++ sources, tests, snapshots, build scripts, or CMake files should change.

## Proposed Structure

`docs/presentation.md` should become a blog draft with these sections:

1. Title
2. Short thesis
3. Why this is tricky in Wasm
4. Experiment setup
5. First finding: rejected Promise is not a C++ exception
6. Practical pattern: convert JS settlement into C++ control flow
7. Second finding: Asyncify + Wasm EH is not a safe halfway path
8. The boundary: live vs captured exception state
9. S12 as the interesting edge case
10. What to take away
11. Reproduction commands

## Writing Constraints

- Keep the draft technical and evidence-driven.
- Avoid overstating JSPI + Wasm EH as a complete fix.
- Make the "A passes, B fails, D passes" stress result explicit.
- Use short code snippets and console traces only where they clarify the
  argument.
- Preserve links to `docs/findings.md`, `docs/matrix.md`, and relevant examples
  instead of duplicating every raw observation.

## Verification

Because this is documentation-only:

- Run `git diff --check`.
- Run a targeted text scan for stale phrasing such as "10-minute outline" if it
  no longer matches the document.
- Check `git status --short` before committing and leave existing unrelated
  untracked files untouched.

## Out of Scope

- C++ scenario refactoring.
- Template generation for examples or tests.
- New experiments.
- Re-running the full Playwright suite unless non-document files change.

## Self-Review

- No placeholder sections.
- Scope is limited to blog-draft documentation.
- The final thesis includes both major findings: rejected Promise boundary and
  Asyncify + Wasm EH exception-state fragility.
