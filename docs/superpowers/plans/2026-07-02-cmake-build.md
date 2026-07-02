# CMake Build Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move all 24 Emscripten example builds to a root CMake source of truth while keeping existing example output paths and Playwright tests stable.

**Architecture:** Add a top-level `CMakeLists.txt` that generates one executable per target/scenario pair and copies the matching browser assets after each build. Keep existing example `build.sh` entrypoints as thin CMake wrappers, and make `scripts/build-all-examples.sh` configure/build the full CMake matrix.

**Tech Stack:** CMake, Emscripten `emcc`/`emcmake`, shell scripts, Playwright repo contract tests.

---

## File Map

- Create `CMakeLists.txt`: matrix definition, Emscripten flags, output directories, asset copy rules.
- Modify `.gitignore`: add `cmake-build-emscripten/` and fix `test-results/` ignore entry.
- Modify `scripts/build-all-examples.sh`: configure and build CMake project instead of looping over 24 scripts.
- Modify `examples/*/*/build.sh`: replace direct `emcc` invocations with CMake single-target wrappers.
- Modify `tests/_repo_contract.spec.ts`: lock in CMake build contract and representative wrapper behavior.
- Optionally modify `README.md`: mention that CMake is now the build source of truth if the existing quick start needs clarification after implementation.

---

### Task 1: Add Failing Contract Tests

**Files:**
- Modify: `tests/_repo_contract.spec.ts`

- [ ] **Step 1: Extend contract tests for CMake migration**

Append these tests to `tests/_repo_contract.spec.ts`:

```ts
test('build-all script configures and builds the CMake matrix', () => {
  const script = read('scripts/build-all-examples.sh');

  expect(script).toContain('cmake -S "$ROOT" -B "$BUILD_DIR"');
  expect(script).toContain('cmake --build "$BUILD_DIR"');
  expect(script).not.toContain('for target in A B C D E Ep');
});

test('representative example build wrappers invoke CMake targets', () => {
  const aS3 = read('examples/A/s3/build.sh');
  const epS3 = read('examples/Ep/s3/build.sh');

  expect(aS3).toContain('cmake --build "$BUILD_DIR" --target example_A_s3');
  expect(epS3).toContain('cmake --build "$BUILD_DIR" --target example_Ep_s3');
  expect(aS3).not.toContain('emcc \\');
  expect(epS3).not.toContain('emcc \\');
});

test('CMake defines the full experiment matrix', () => {
  const cmake = read('CMakeLists.txt');

  expect(cmake).toContain('project(learn_asyncify_examples LANGUAGES CXX)');
  expect(cmake).toContain('add_experiment_example(A s1)');
  expect(cmake).toContain('add_experiment_example(D s4)');
  expect(cmake).toContain('add_experiment_example(Ep s3)');
});

test('generated CMake build artifacts are ignored', () => {
  const gitignore = read('.gitignore');

  expect(gitignore).toContain('cmake-build-emscripten/');
  expect(gitignore).toContain('test-results/');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```sh
npx playwright test tests/_repo_contract.spec.ts --workers=1
```

Expected: FAIL because `CMakeLists.txt` does not exist, wrappers still call `emcc`, `scripts/build-all-examples.sh` still loops over per-example scripts, and `.gitignore` does not ignore `cmake-build-emscripten/`.

- [ ] **Step 3: Commit nothing**

Do not commit after RED. Continue to Task 2.

---

### Task 2: Add CMake Source of Truth

**Files:**
- Create: `CMakeLists.txt`

- [ ] **Step 1: Create top-level CMake file**

Create `CMakeLists.txt` with this content:

```cmake
cmake_minimum_required(VERSION 3.20)
project(learn_asyncify_examples LANGUAGES CXX)

set(CMAKE_EXECUTABLE_SUFFIX ".js")

set(COMMON_EMSCRIPTEN_LINK_FLAGS
  "-O1"
  "-sMODULARIZE=1"
  "-sEXPORT_NAME=createModule"
  "-sEXPORT_ES6=1"
  "-sEXPORTED_RUNTIME_METHODS=['HEAP8']"
  "-sALLOW_MEMORY_GROWTH=1"
)

set(ASYNC_RUNTIME_LINK_FLAGS
  "-sASYNCIFY_IMPORTS=['jsAwaitControlledPromise']"
  "-sEXPORTED_FUNCTIONS=['_main']"
)

set(CORO_RUNTIME_LINK_FLAGS
  "-sEXPORTED_FUNCTIONS=['_main','_coro_settle','_coro_resume']"
)

function(add_link_flags target)
  foreach(flag IN LISTS ARGN)
    target_link_options(${target} PRIVATE "SHELL:${flag}")
  endforeach()
endfunction()

function(copy_example_asset target source_file output_name)
  add_custom_command(
    TARGET ${target}
    POST_BUILD
    COMMAND ${CMAKE_COMMAND} -E copy_if_different
      "${CMAKE_SOURCE_DIR}/${source_file}"
      "$<TARGET_FILE_DIR:${target}>/${output_name}"
  )
endfunction()

function(add_experiment_example target_name scenario_name)
  string(SUBSTRING "${scenario_name}" 1 -1 scenario_number)
  string(TOUPPER "${scenario_name}" scenario_upper)
  set(cmake_target "example_${target_name}_${scenario_name}")
  set(output_dir "${CMAKE_SOURCE_DIR}/examples/${target_name}/${scenario_name}/build")

  if(target_name STREQUAL "E" OR target_name STREQUAL "Ep")
    add_executable(${cmake_target}
      "${CMAKE_SOURCE_DIR}/src/coro_glue.cpp"
      "${CMAKE_SOURCE_DIR}/src/scenarios_coro/S${scenario_number}.cpp"
    )
    target_compile_features(${cmake_target} PRIVATE cxx_std_20)
    add_link_flags(${cmake_target}
      ${COMMON_EMSCRIPTEN_LINK_FLAGS}
      ${CORO_RUNTIME_LINK_FLAGS}
    )
    copy_example_asset(${cmake_target} "src/page_template_coro.html" "index.html")
    copy_example_asset(${cmake_target} "src/test_harness_coro.js" "test_harness_coro.js")
    copy_example_asset(${cmake_target} "src/coro_glue.js" "coro_glue.js")
  else()
    add_executable(${cmake_target}
      "${CMAKE_SOURCE_DIR}/src/runtime_helpers.cpp"
      "${CMAKE_SOURCE_DIR}/src/scenarios/S${scenario_number}.cpp"
    )
    target_compile_features(${cmake_target} PRIVATE cxx_std_17)
    add_link_flags(${cmake_target}
      ${COMMON_EMSCRIPTEN_LINK_FLAGS}
      ${ASYNC_RUNTIME_LINK_FLAGS}
    )
    if(target_name STREQUAL "C" OR target_name STREQUAL "D")
      copy_example_asset(${cmake_target} "src/page_template_jspi.html" "index.html")
    else()
      copy_example_asset(${cmake_target} "src/page_template.html" "index.html")
    endif()
    copy_example_asset(${cmake_target} "src/test_harness.js" "test_harness.js")
  endif()

  target_include_directories(${cmake_target} PRIVATE "${CMAKE_SOURCE_DIR}/src")
  set_target_properties(${cmake_target} PROPERTIES
    OUTPUT_NAME "main"
    RUNTIME_OUTPUT_DIRECTORY "${output_dir}"
  )

  if(target_name STREQUAL "A")
    add_link_flags(${cmake_target}
      "-sASYNCIFY=1"
      "-sDISABLE_EXCEPTION_CATCHING=0"
    )
  elseif(target_name STREQUAL "B")
    add_link_flags(${cmake_target}
      "-sASYNCIFY=1"
      "-fwasm-exceptions"
    )
  elseif(target_name STREQUAL "C")
    add_link_flags(${cmake_target}
      "-sASYNCIFY=2"
      "-sDISABLE_EXCEPTION_CATCHING=0"
    )
  elseif(target_name STREQUAL "D")
    add_link_flags(${cmake_target}
      "-sASYNCIFY=2"
      "-fwasm-exceptions"
    )
  elseif(target_name STREQUAL "E")
    add_link_flags(${cmake_target}
      "-sDISABLE_EXCEPTION_CATCHING=0"
    )
  elseif(target_name STREQUAL "Ep")
    add_link_flags(${cmake_target}
      "-fwasm-exceptions"
    )
  else()
    message(FATAL_ERROR "Unknown experiment target: ${target_name}")
  endif()
endfunction()

foreach(experiment_target A B C D E Ep)
  foreach(experiment_scenario s1 s2 s3 s4)
    add_experiment_example(${experiment_target} ${experiment_scenario})
  endforeach()
endforeach()
```

- [ ] **Step 2: Configure CMake manually**

Run:

```sh
emcmake cmake -S . -B cmake-build-emscripten
```

Expected: configuration completes and writes `cmake-build-emscripten/`.

- [ ] **Step 3: Build representative targets**

Run:

```sh
cmake --build cmake-build-emscripten --target example_A_s3
cmake --build cmake-build-emscripten --target example_Ep_s3
```

Expected: both commands exit 0 and write:

- `examples/A/s3/build/main.js`
- `examples/A/s3/build/main.wasm`
- `examples/A/s3/build/index.html`
- `examples/Ep/s3/build/main.js`
- `examples/Ep/s3/build/main.wasm`
- `examples/Ep/s3/build/index.html`

---

### Task 3: Convert Build Scripts to CMake Wrappers

**Files:**
- Modify: `scripts/build-all-examples.sh`
- Modify: all `examples/*/*/build.sh`

- [ ] **Step 1: Replace full build script**

Replace `scripts/build-all-examples.sh` with:

```sh
#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BUILD_DIR="${BUILD_DIR:-$ROOT/cmake-build-emscripten}"

emcmake cmake -S "$ROOT" -B "$BUILD_DIR"
cmake --build "$BUILD_DIR"
```

- [ ] **Step 2: Replace example wrapper content**

For each `examples/<target>/<scenario>/build.sh`, replace the file with:

```sh
#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"
ROOT="$(cd ../../.. && pwd)"
BUILD_DIR="${BUILD_DIR:-$ROOT/cmake-build-emscripten}"

emcmake cmake -S "$ROOT" -B "$BUILD_DIR"
cmake --build "$BUILD_DIR" --target example_<target>_<scenario>
echo "built: $(pwd)/build/main.js"
```

Use the concrete target/scenario in each file. For example, `examples/A/s3/build.sh` must contain:

```sh
cmake --build "$BUILD_DIR" --target example_A_s3
```

and `examples/Ep/s3/build.sh` must contain:

```sh
cmake --build "$BUILD_DIR" --target example_Ep_s3
```

- [ ] **Step 3: Keep permissions executable**

Run:

```sh
chmod +x scripts/build-all-examples.sh examples/*/*/build.sh
```

- [ ] **Step 4: Run contract tests**

Run:

```sh
npx playwright test tests/_repo_contract.spec.ts --workers=1
```

Expected: CMake-related tests may still fail until `.gitignore` is updated in Task 4, but wrapper and build-all script assertions should pass.

---

### Task 4: Ignore Generated CMake and Test Artifacts

**Files:**
- Modify: `.gitignore`

- [ ] **Step 1: Replace `.gitignore` with clean entries**

Use this content:

```gitignore
node_modules/
examples/*/*/build/
cmake-build-emscripten/
emsdk/
.upstream/
*.wasm.o
.DS_Store
test-results/
```

- [ ] **Step 2: Run contract tests**

Run:

```sh
npx playwright test tests/_repo_contract.spec.ts --workers=1
```

Expected: all repo contract tests pass.

- [ ] **Step 3: Commit CMake build migration core**

Run:

```sh
git add CMakeLists.txt .gitignore scripts/build-all-examples.sh examples/*/*/build.sh tests/_repo_contract.spec.ts
git commit -m "build: migrate examples to cmake"
```

---

### Task 5: Update User-Facing Build Documentation

**Files:**
- Modify: `README.md`
- Modify: `docs/design.md`

- [ ] **Step 1: Update README quick start build note**

In `README.md`, keep the existing quick start commands but add one sentence after the command block:

```md
예제 빌드는 루트 `CMakeLists.txt`가 정의하며, 각 `examples/<target>/<scenario>/build.sh`는 해당 CMake target을 호출하는 wrapper다.
```

- [ ] **Step 2: Update design project tree**

In `docs/design.md`, update the project tree section so it lists:

```md
├── CMakeLists.txt             # 24개 예제 빌드 matrix의 source of truth
```

and adjust the `examples/<target>/<scenario>/build.sh` description to:

```md
  - `build.sh`: 해당 예제의 CMake target wrapper
```

- [ ] **Step 3: Run doc contract tests**

Run:

```sh
npx playwright test tests/_repo_contract.spec.ts --workers=1
```

Expected: all repo contract tests pass.

- [ ] **Step 4: Commit docs update**

Run:

```sh
git add README.md docs/design.md
git commit -m "docs: describe cmake build flow"
```

---

### Task 6: Full Verification

**Files:**
- No source edits unless verification exposes a real bug.

- [ ] **Step 1: Check whitespace**

Run:

```sh
git diff --check
```

Expected: no output and exit 0.

- [ ] **Step 2: Verify single-example wrapper**

Run:

```sh
(cd examples/A/s3 && ./run.sh)
```

Expected: CMake config/build runs, then Playwright executes `tests/A/s3.spec.ts` and passes.

- [ ] **Step 3: Verify full suite**

Run:

```sh
npm test
```

Expected: full CMake matrix builds, then Playwright passes all tests.

- [ ] **Step 4: Check git status**

Run:

```sh
git status --short
```

Expected: only ignored/generated artifacts remain untracked. If tracked source or docs changed during verification, review and commit them.

---

## Self-Review

- Spec coverage: the plan adds root CMake, preserves output paths, converts wrappers, updates all-build script, updates repo contract tests, ignores CMake output, updates docs, and verifies single-example plus full suite.
- Placeholder scan: no `TBD`, `TODO`, or unspecified implementation steps remain.
- Scope check: metrics collection and Playwright URLs are intentionally unchanged.
