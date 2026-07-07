# 발견 사항

> 한국어판은 원문의 phase 구조와 결론을 유지하되, 반복되는 raw console trace 전문은 핵심 trace와 해석 중심으로 축약했다. 원문 전체 로그는 `findings.md`와 각 Playwright snapshot에 보존되어 있다.

## 최종 요약

이 프로젝트는 좁은 질문에서 시작했다. Emscripten의 Asyncify coroutine emulation과 C++ exception support가 async boundary에서 만나면 무슨 일이 생기는가?

완성된 matrix가 주는 답은 더 선명하다.

- async import에서 발생한 JS Promise rejection은 자동으로 C++ `catch`가 볼 수 있는 exception이 되지 않는다.
- 런타임 축 하나 또는 둘을 JSPI/Wasm EH로 바꾸면 code size와 일부 failure surface는 달라지지만, rejected JS Promise에 대한 C++ exception boundary가 저절로 정의되지는 않는다.
- Asyncify + Wasm EH는 안전한 중간 migration path가 아니다. Resolution-only C++ exception stress scenario S5-S7/S9-S12는 B에서 실패하고 A/D에서는 통과한다. S8/S14/S17은 failure boundary를 좁힌다. B는 ordinary resolved yield 이후 C++ throw를 catch할 수 있고, 이후 suspend를 건너지 않는 `exception_ptr`도 사용할 수 있다. 하지만 live 또는 captured Wasm EH exception state가 suspend boundary를 건너야 하면 실패한다. S13/S15/S16은 `PASS:done`까지 도달하지만 B에서 post-done `unreachable` pageerror를 낸다. 이 결과는 stable semantic contract가 아니라 unsupported combination의 관찰로 읽어야 한다. B의 통과 케이스는 Asyncify가 live/captured Wasm EH state를 suspend 너머로 보존하지 않아도 되는 shape가 우연히 안전하게 남은 경우다.
- C++20 coroutine glue는 JS settlement를 데이터로 받고, C++을 resume한 뒤 `await_resume()`에서 C++ throw를 시작하므로 S1-S4를 모두 통과한다.

실용 규칙은 다음과 같다.

> JS async 작업 이후 C++ `catch` semantics가 필요하다면, rejected Promise가 Wasm boundary를 exception처럼 건너오기를 기대하지 말라. JS settlement를 명시적 result/status로 변환하고, C++로 resume한 뒤 C++에서 throw하라.

## Target-level result

| Target | Result | Interpretation |
|---|---|---|
| A — Asyncify + JS EH | S2와 S5-S17 통과, S3/S4 실패 | C++에서 시작한 exception/suspend path는 동작한다. JS rejection은 새어 나간다. |
| B — Asyncify + Wasm EH | S1/S2/S8/S14/S17 통과, S3/S4와 S5-S7/S9-S12 실패, S13/S15/S16 warn | Wasm EH는 rejected JS Promise를 C++ catchable하게 만들지 않는다. 또한 live/captured exception state가 suspend를 건너면 실패하고, payload-only control 이후에도 trap이 남을 수 있다. |
| C — JSPI + JS EH | 이 harness에서는 모든 시나리오 실패 | JS EH가 이 JSPI frame shape와 여전히 맞지 않는다. |
| D — JSPI + Wasm EH | S1/S2와 S5-S17 통과, S3/S4 실패 | 런타임 표준 조합은 C++-initiated stress path를 처리하지만, JS rejection 경계는 여전히 새어 나간다. |
| E — C++20 coroutine + JS EH | 모든 기본 시나리오 통과 | Developer-owned settlement conversion이 C++ control flow를 복구한다. |
| E' — C++20 coroutine + Wasm EH | 모든 기본 시나리오 통과 | 동작 결과는 E와 같고, Wasm EH는 주로 generated code shape를 바꾼다. |

## 비용과 표면 증거

`docs/metrics.md`는 artifact size, load-to-completion timing, 대표 pageerror surface를 기록한다. 요약하면 다음과 같다.

- Asyncify 행 A/B는 suspend scenario에서 가장 큰 combined artifact footprint를 가진다.
- JSPI 행 C/D는 generated code size를 줄이지만, JS rejection에 대해서는 명시적 settlement boundary가 여전히 필요하다.
- B의 S5-S7/S9-S12 실패는 "Wasm EH만 켜고 Asyncify는 유지"하는 경로가 JS rejection 문제의 불완전한 해결책일 뿐 아니라, C++ exception state가 active/captured 상태로 suspend를 건널 때 새 failure를 만들 수 있음을 보여준다.
- B/S13/S15/S16은 copied payload data만 건너도 post-done trap warning이 남을 수 있음을 보여준다.
- B/S8, B/S14, B/S17 통과는 claim을 좁힌다. ordinary multi-yield restoration 이후 C++ throw, 또는 resume 이후 local `exception_ptr` 사용 자체는 동작할 수 있다. 하지만 이것을 "Asyncify + Wasm EH가 대체로 안전하다"로 일반화해서는 안 된다. 이들은 unsupported state-preservation path를 피한 좁은 케이스다.
- E/E'은 rejected async settlement를 coroutine resume 이후 C++ throw로 바꾸므로 S3/S4에서 failure-timeout path를 피한다.

## 상세 Phase Log

아래는 관찰을 얻은 순서대로 정리한 phase별 요약이다. 원문 `findings.md`는 각 phase의 raw trace를 더 길게 보존한다.

---

# Phase 1 — target A pitfall reproduction

Phase 1은 Asyncify + JS exception emulation 경로(target A)를 다룬다.

## A / S1 — synchronous throw baseline

관찰:

```text
S1:before-throw
PASS:s1-catch-reached
S1
PASS:s1-done
```

의미: suspend가 없을 때 A는 기본 C++ throw/catch를 처리한다. 이후 실패는 "C++ exception 자체가 전혀 안 된다"가 아니라 async boundary와 결합된 문제다.

## A / S2 — suspend then throw

관찰:

```text
S2:before-suspend
S2:after-resume
PASS:s2-catch-reached
S2
PASS:s2-done
```

의미: Promise resolve 이후 C++이 resume되고, 그 다음 C++ 코드에서 직접 throw하면 catch가 동작한다.

## A / S3 — suspend that rejects

관찰:

```text
S3:before-suspend
[pageerror] S3
```

의미: rejected Promise는 C++ catch로 들어오지 않고 JS pageerror로 새어 나간다. 이것이 첫 핵심 pitfall이다.

## A / S4 — catch then re-suspend

관찰:

```text
S4:before-suspend
[pageerror] S4
```

의미: 첫 await rejection이 C++ catch에 들어오지 않으므로, catch block 안의 두 번째 await 자체가 등록되지 않는다.

## Phase 1 요약

- A는 synchronous throw와 "resume 이후 C++에서 시작한 throw"를 처리한다.
- A는 suspended import의 rejected Promise를 C++ exception으로 변환하지 않는다.
- 따라서 "async rejection을 C++ catch로 받겠다"는 의도는 별도 settlement bridge 없이는 성립하지 않는다.

---

# Phase 2 — One axis at a time: B와 C

Phase 2는 한 축만 표준으로 바꾸면 무엇이 개선되고 무엇이 남는지 본다.

## B — Asyncify + Wasm EH

B/S1과 B/S2는 통과한다. synchronous C++ throw와 resolve 후 C++ throw는 Wasm EH로도 처리된다.

B/S3와 B/S4는 실패한다. JS Promise rejection은 Wasm EH를 켜도 C++ catchable exception이 되지 않는다.

핵심:

- Wasm EH는 C++에서 시작한 throw/catch machinery를 바꾼다.
- JS Promise rejection을 C++ exception semantics로 자동 변환하지는 않는다.

## C — JSPI + JS EH

C는 이 harness에서 S1부터 실패한다.

대표 표면:

```text
[pageerror] trying to suspend JS frames
```

의미: JSPI만 켜고 JS exception emulation을 유지한 조합은 이 frame shape와 맞지 않는다. 이 결과 때문에 "JSPI가 문제인가, JS EH가 남아서 문제인가"를 가르기 위해 Phase 3의 target D가 중요해진다.

## Phase 2 요약

- B는 EH 축만 표준화해도 JS rejection 경계를 해결하지 못한다.
- C는 coroutine 축만 표준화해도 이 harness에서 깨진다.
- 한 축만 바꾸는 것은 충분한 migration story가 아니다.

---

# Phase 3 — Both runtime standards: D

D는 JSPI + Wasm EH 조합이다.

## D / S1, S2

S1과 S2는 통과한다. D는 synchronous C++ throw와 resolve 이후 C++ throw를 처리한다.

## D / S3, S4

S3와 S4는 실패한다.

대표 관찰:

```text
S3:before-suspend
[pageerror] S3
[timeout] no s3-done
```

의미: JSPI + Wasm EH를 둘 다 켜도 rejected JS Promise가 C++ catch로 자동 변환되지는 않는다.

## JSPI + Wasm EH checklist

- synchronous C++ throw/catch와 successful resume 이후 C++ throw에는 Wasm EH가 유용하다.
- rejected JS Promise가 C++ catchable exception이 된다고 가정하지 말라.
- C++ catch semantics가 필요하면 async import를 status/result value로 resolve하고, resume 이후 C++에서 throw하라.
- Asyncify + Wasm EH를 안전한 halfway migration step으로 보지 말라. Phase 4의 stress test가 이 점을 더 강하게 보여준다.
- JSPI는 Emscripten 6.0.1 기준 여전히 experimental warning이 있으므로 관찰을 기록할 때 toolchain을 pin하라.

---

# Phase 2.5 — C++20 coroutine-owned settlement: E와 E'

E와 E'은 Asyncify/JSPI를 쓰지 않는다. C++20 coroutine frame이 local과 resume point를 보존하고, JS가 resume handle을 호출한다.

## E/E' / S1

synchronous throw baseline은 둘 다 통과한다.

## E/E' / S2

coroutine await가 resolve된 뒤 C++에서 throw하고, catch가 이를 잡는다. 둘 다 통과한다.

## E/E' / S3

JS async 작업이 reject되더라도 rejection 자체가 C++ exception처럼 boundary를 건너는 것이 아니다. JS가 settlement를 데이터로 저장하고 coroutine을 resume한다. `await_resume()`이 status를 보고 C++에서 throw한다. 그래서 catch에 도달한다.

## E/E' / S4

첫 await failure를 catch한 뒤 다시 await하는 staged recovery도 통과한다. JS settlement를 데이터로 다루고 C++에서 throw하기 때문에 catch block 내부의 두 번째 await가 자연스럽게 실행된다.

## Phase 2.5 요약

- E/E'은 S1-S4를 모두 통과한다.
- 핵심은 "C++20 coroutine" 자체보다 "JS settlement를 데이터로 소유하고 C++ resume 이후 throw한다"는 boundary ownership이다.
- 이 방식은 runtime emulation을 줄이지만, 개발자가 `promise_type`, awaiter, JS↔Wasm resume/destroy glue를 직접 관리해야 한다.

---

# Phase 3.5 — Cost and error-surface metrics

`docs/metrics.md`는 size와 timing을 정량화한다.

요약:

- Asyncify 행 A/B는 suspend scenario에서 artifact footprint가 크다.
- JSPI 행 C/D는 code size를 줄인다.
- 실패 행의 긴 시간은 runtime slowness가 아니라 test timeout으로 관측되는 failure surface다.
- E/E'은 S3/S4에서도 빠르게 끝난다. rejected settlement를 C++ resume 이후 throw로 바꾸기 때문이다.

---

# Phase 4 — Resolution-only C++ exception stress tests

S5-S17은 더 좁은 claim을 검증하기 위해 추가되었다. rejected JS Promise 없이도 Asyncify row에서는 실패하지만 JSPI + Wasm EH에서는 통과하는 코드를 찾을 수 있는가? 이 시나리오들은 controlled Promise를 모두 resolve하고, 모든 exception은 C++에서 시작한다.

## S5 — C++ throw, catch, then suspend inside catch

관찰:

- A: 통과.
- B: 두 번째 resume까지 간 뒤 `[pageerror] null function`, `[pageerror] unreachable`을 보고하고 `PASS:s5-done`에 도달하지 못한다.
- D: 통과.

해석: catch state가 live인 동안 suspend하면 Asyncify + Wasm EH가 깨진다.

## S6 — destructor suspends during C++ unwind

관찰:

- A: 통과.
- B: destructor suspend에서 resume한 뒤 `null function` / `unreachable`로 실패하고 catch/done sequence에 도달하지 못한다.
- D: 통과.

해석: C++ exception unwinding 중 destructor에서 suspend하는 경로는 B의 강한 stress case다.

## S7 — catch, suspend, then rethrow

관찰:

- A: 통과.
- B: inner-catch suspend 이후 resume하지만 outer catch에 도달하지 못하고 `null function` / `unreachable`로 실패한다.
- D: 통과.

해석: rethrow 준비 상태가 suspend를 건너는 경우도 B에서 실패한다.

## S8 — multi-yield call chain, inner throw, outer catch

관찰:

- A: 통과.
- B: 통과.
- D: 통과.

해석: B는 단순히 여러 call frame을 suspend/resume한 뒤 나중에 C++ throw하는 것 때문에 실패하지 않는다. S5-S7의 실패는 exception state가 이미 live인 동안 suspend한다는 점과 관련된다.

비교:

```text
S8: suspend/resume -> suspend/resume -> suspend/resume -> throw -> catch
S5: throw -> catch begins -> suspend/resume while catch state is live
S6: throw -> unwind begins -> suspend/resume inside destructor during unwind
S7: throw -> catch begins -> suspend/resume while rethrow state is live -> throw;
```

## S9 — catch calls helper chain that suspends

관찰:

- A: 통과.
- B: `PASS:s9-after-helper`까지 도달한 뒤 `null function` / `unreachable`로 실패하고 `PASS:s9-done`에 도달하지 못한다.
- D: 통과.

해석: suspend가 catch block 안에 직접 있을 필요는 없다. catch state가 outer frame에 live로 남아 있고 더 깊은 helper가 suspend해도 B는 실패한다.

## S10 — destructor calls helper chain that suspends during unwind

관찰:

- A: 통과.
- B: `PASS:s10-dtor-after-helper`까지 도달한 뒤 `null function` / `unreachable`로 실패하고 `PASS:s10-done`에 도달하지 못한다.
- D: 통과.

해석: destructor 자체가 아니라 destructor가 호출한 helper에서 suspend해도 unwind path가 깨진다.

## S11 — nested exception_ptr stored, suspend, nested rethrow

형태:

```cpp
std::exception_ptr saved;

try {
  try {
    await_controlled_promise("s11-1");
    throw std::runtime_error("S11-inner");
  } catch (...) {
    std::throw_with_nested(std::runtime_error("S11-outer"));
  }
} catch (...) {
  saved = std::current_exception();
}

await_controlled_promise("s11-2");

try {
  std::rethrow_exception(saved);
} catch (const std::exception& e) {
  std::rethrow_if_nested(e);
}
```

관찰:

- A: `S11-outer`와 `S11-inner`를 모두 로그하고 통과.
- B: `S11:after-second-resume`까지 로그한 뒤 `null function` / `unreachable`로 실패하고 `PASS:s11-done`에 도달하지 못한다.
- D: `S11-outer`와 `S11-inner`를 모두 로그하고 통과.

해석: S11은 더 풍부한 captured payload를 가진 S12처럼 동작한다. 실패는 nested exception machinery 자체가 아니라, suspend를 건넌 captured exception state를 reactivate하는 지점에 있다.

## S12 — exception_ptr stored, suspend, rethrow_exception

형태:

```cpp
std::exception_ptr saved;

try {
  await_controlled_promise("s12-1");
  throw std::runtime_error("S12");
} catch (...) {
  saved = std::current_exception();
}

await_controlled_promise("s12-2");

try {
  std::rethrow_exception(saved);
} catch (const std::exception& e) {
  ...
}
```

관찰:

- A: 통과.
- B: `S12:after-second-resume`까지 로그한 뒤 `null function` / `unreachable`로 실패하고 `PASS:s12-done`에 도달하지 못한다.
- D: 통과.

해석: S12가 Phase 4에서 가장 흥미로운 boundary case다. 두 번째 suspend는 catch handler 안에서 일어나지 않는다. stack unwinding 중에도 일어나지 않는다. catch block은 이미 끝났다. 그런데 `std::current_exception()`으로 저장한 `exception_ptr`는 단순 message copy가 아니라 runtime이 나중에 rethrow할 수 있는 captured exception handle이다. B는 suspend/resume 자체는 성공하지만 `std::rethrow_exception(saved)`로 저장된 exception을 reactivate할 때 실패한다.

따라서 Phase 4 failure model은 두 범주로 나뉜다.

- **Live exception state crossing suspend**: S5/S9는 active catch state, S6/S10은 active unwind state를 운반한다.
- **Captured exception state crossing suspend**: S11/S12는 `std::exception_ptr`를 suspend 너머로 운반하고 나중에 rethrow할 때 실패한다.

## S13 — copied exception object, suspend, payload read

형태:

```cpp
std::unique_ptr<std::runtime_error> saved;

try {
  await_controlled_promise("s13-1");
  throw std::runtime_error("S13");
} catch (const std::runtime_error& e) {
  saved = std::make_unique<std::runtime_error>(e);
}

await_controlled_promise("s13-2");
scenario_log(saved->what());
```

관찰:

- A: 통과.
- B: `PASS:s13-copied-object-readable`과 `PASS:s13-done`까지 도달한 뒤 `[pageerror] unreachable`을 보고한다.
- D: 통과.

해석: copied C++ object는 exception runtime state와 분리된다. payload는 B에서도 suspend 이후 읽힌다. 하지만 completion path에서 post-done trap이 남으므로 clean success로 보지 않고 `WARN`으로 기록한다.

## S14 — repeated normal resolved suspends, then throw

관찰:

- A: 통과.
- B: 통과.
- D: 통과.

해석: C++ throw 전에 normal suspend/resume을 여러 번 반복하는 것만으로 B가 깨지지는 않는다. 실패에는 live 또는 captured exception state가 suspend boundary를 건너야 한다.

## S15 — stable what pointer, suspend, payload read

관찰:

- A: 통과.
- B: `PASS:s15-pointer-readable`과 `PASS:s15-done`까지 도달한 뒤 `[pageerror] unreachable`을 보고한다.
- D: 통과.

해석: S15는 dangling `what()` pointer를 피하기 위해 string literal을 반환하는 custom exception을 던진다. stable pointer payload는 B에서도 읽히지만, S13과 같은 post-done trap이 나타난다.

## S16 — copied what string, suspend, payload read

관찰:

- A: 통과.
- B: `PASS:s16-string-readable`과 `PASS:s16-done`까지 도달한 뒤 `[pageerror] unreachable`을 보고한다.
- D: 통과.

해석: S16은 S15의 ordinary `std::string` payload 버전이다. 데이터는 건너지만 B completion은 clean하지 않다.

## S17 — exception_ptr created after resume and consumed before next suspend

관찰:

- A: 통과.
- B: 통과.
- D: 통과.

해석: S17은 `std::exception_ptr`를 async boundary 한쪽에만 둔 control이다. 먼저 suspend/resume한 뒤 `exception_ptr`를 만들고, 이후 suspend 없이 바로 rethrow한다. B가 통과하므로 `exception_ptr` 자체가 깨진 것은 아니다. S11/S12 실패에는 captured exception state가 Asyncify suspend boundary를 건너는 조건이 필요하다.

## Phase 4 요약

Stress test는 원래 기대했던 "Asyncify + JS exception emulation은 실패하고 JSPI + Wasm EH는 통과한다"는 claim을 지지하지 않는다. A는 S5-S17을 통과한다.

대신 더 좁은 correctness distinction을 세운다.

- Asyncify + Wasm EH(B)는 rejected JS Promise가 없어도 C++-initiated exception/suspend stress path에서 실패한다. 단, live 또는 captured Wasm EH exception state가 suspend를 건너는 shape에 한정된다. S11은 captured-state case를 nested exception까지 확장한다.
- S12는 captured-state half의 가장 단순하고 강한 증거다. catch는 이미 끝났지만 저장된 `std::exception_ptr`가 나중에 reactivate될 때 B가 실패한다.
- S17은 inverse control이다. resume 이후 `exception_ptr`를 만들고 다음 suspend 전에 소비하면 B도 통과한다.
- S13/S15/S16은 ordinary copied payload가 suspend 이후 읽힐 수 있음을 보여주지만, B는 prior catch와 later suspend 이후 post-done `unreachable`을 여전히 낸다. clean pass가 아니라 warning이다.
- JSPI + Wasm EH(D)는 같은 path를 통과한다.
- Asyncify + JS EH(A)도 이 C++-initiated path들을 통과하므로, resolved async work 이후 C++ exception에 대해서는 예상보다 강한 practical baseline이다.
- S8, S14, S17이 B에서 통과하므로 deep/repeated multi-yield call chain이나 local `exception_ptr` 사용 자체가 outer C++ catch를 깨뜨리는 것은 아니다.

B의 고르지 않은 패턴은 이런 unsupported mix에서 예상 가능한 성격이다. Asyncify는 suspended Wasm stack을 저장/복원하기 위해 call을 재작성하고, Wasm EH는 catch/unwind/rethrow를 위해 runtime-managed exception state를 사용한다. 두 메커니즘이 같은 suspend boundary 너머로 같은 exception state를 보존할 필요가 없으면 일부 예제는 완료된다. 필요해지는 순간 B는 실패하거나 완료 직후 trap을 낸다. 따라서 B의 pass case는 가까운 source change에도 유지될 보장이라기보다, 우연히 안전한 shape로 다루는 편이 맞다.

## Toolchain cross-check — emsdk 4.0.23

전체 matrix는 emsdk 4.0.23으로도 rebuild/rerun했다.

```text
emcc (Emscripten gcc/clang-like replacement + linker emulating GNU ld) 4.0.23
```

repo-local `./emsdk` environment에서 `npm test`로 예제를 rebuild했고 다음 결과를 얻었다.

```text
59 passed (2.9m)
```

당시 current matrix였던 S5-S10/S12/S14의 관찰은 6.0.1 run과 일치했다. B는 S5-S7/S9/S10/S12에서 expected `null function` / `unreachable` surface로 실패했고, B/S8과 B/S14는 통과했다. S12도 같은 captured-state boundary를 재현했다. B는 `S12:after-second-resume`까지 도달한 뒤 saved exception을 reactivate하는 동안 실패했고, D/S12는 통과했다.

JSPI import에 대해서는 source change가 필요 없었다. 프로젝트는 A-D에 이미 `-sASYNCIFY_IMPORTS=['jsAwaitControlledPromise']`를 제공한다. 4.0.23의 generated JSPI output에서는 이 목록이 import pattern을 만들고 `jsAwaitControlledPromise`를 포함한 matching import를 `WebAssembly.Suspending`으로 wrap하는 데 사용되었다.
