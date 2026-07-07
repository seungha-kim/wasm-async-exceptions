# Asyncify, JSPI, Wasm EH, 그리고 async boundary를 건너는 C++ 예외

## 논지

Rejected JavaScript Promise는 Wasm boundary에서 자동으로 C++ 예외가 되지 않는다. JS async 작업 이후에도 C++ `catch` 의미론이 중요하다면, settlement는 데이터로 boundary를 건너야 하고, C++은 resume 이후 throw할지 직접 결정해야 한다.

뒤의 stress test들은 두 번째, 더 구체적인 migration finding을 추가한다. `Asyncify + Wasm EH`는 안전한 halfway path가 아니다. 일반적인 multi-yield-then-throw 경로는 통과하지만, live 또는 captured Wasm EH exception state가 Asyncify suspend boundary를 건너면 실패한다.

## Wasm에서 왜 까다로운가

Wasm은 원래 이 프로젝트가 의도적으로 섞는 두 런타임 동작을 제공하지 않았다.

- JavaScript async 작업이 완료되는 동안 suspended stack을 저장하고 복원하는 동작
- 생성된 Wasm과 JS support를 통해 C++ exception semantics를 전달하는 동작

Emscripten은 이 동작들을 에뮬레이션할 수 있다. Asyncify는 Wasm stack을 unwind/rewind할 수 있도록 코드를 다시 쓴다. JS exception emulation은 생성된 JavaScript support로 C++ exception state를 표현한다. JSPI와 Wasm exception handling은 이 작업 일부를 표준화된 runtime mechanism으로 옮긴다.

따라서 여러 migration path가 그럴듯해 보인다. 질문은 단순히 "C++ throw가 여전히 동작하는가?"가 아니다. 많은 경우 동작한다. 흥미로운 boundary는 JavaScript async settlement와 C++ exception semantics가 만날 때 무슨 일이 일어나는가다.

## 실험 구성

첫 matrix는 여섯 target을 테스트한다.

| Target | Stack/async axis | Exception axis |
|---|---|---|
| A | Asyncify | JS exception emulation |
| B | Asyncify | Wasm EH |
| C | JSPI | JS exception emulation |
| D | JSPI | Wasm EH |
| E | C++20 coroutine glue | JS exception emulation |
| E' | C++20 coroutine glue | Wasm EH |

각 target은 네 기본 시나리오를 실행한다.

- S1: synchronous C++ throw baseline
- S2: suspend, resolve, resume, then throw from C++
- S3: suspended async operation rejects
- S4: catch a failed async operation, then await again

상세 결과 matrix는 [`docs/matrix.md`](matrix.md)에 있다. phase-by-phase 근거는 [`docs/findings.md`](findings.md)에 있다.

## 첫 번째 발견: rejected Promise는 C++ 예외가 아니다

S2는 A, B, D에서 통과한다. controlled Promise가 resolve된 뒤 C++이 resume되고 C++ 코드에서 throw한다. 이 throw는 C++ exception machinery가 처리한다.

S3와 S4는 A, B, D에서 다른 이유로 실패한다. 실패는 Wasm이 suspend되어 있는 동안 rejected JavaScript Promise로 시작된다. 이 rejection은 C++ `catch`로 들어가지 않고 JavaScript page error로 표면화된다.

이 구분이 첫 번째 실용 규칙이다.

> 성공적인 async resume 이후의 C++ throw와, rejected Promise가 C++로 exception처럼 건너오는 것은 같은 일이 아니다.

Asyncify에서 JSPI로 바꾸거나, JS exception emulation에서 Wasm EH로 바꾸거나, 두 표준 축을 모두 켜도 그 semantic bridge가 자동으로 생기지는 않는다.

## Explicit-settlement 패턴

Target E와 E'는 다른 모양을 쓴다. imported Promise rejection이 C++ 예외가 되기를 기대하지 않고, JavaScript가 async settlement를 데이터로 기록한 뒤 C++20 coroutine을 resume한다. coroutine의 `await_resume()`이 값을 반환할지 C++에서 throw할지 결정한다.

개념적으로 bridge는 다음과 같다.

```text
JS async work settles
  -> JS stores { status, value_or_error }
  -> JS resumes C++ coroutine
  -> C++ await_resume() inspects status
  -> C++ throws if C++ catch semantics are required
```

이 패턴은 E와 E'에서 S1-S4를 모두 통과한다. 중요한 부분은 단순히 "C++20 coroutine을 쓴다"가 아니다. 중요한 것은 boundary의 소유권이다. JS settlement는 데이터이고, C++ exception control flow는 C++ 코드에서 시작한다.

## 두 번째 발견: Asyncify + Wasm EH는 fragile halfway path다

첫 matrix는 처음 기대했던 "`Asyncify + JS EH`가 실패하고 `JSPI + Wasm EH`가 단순히 문제를 해결한다"는 이야기를 만들지 못했다. JS Promise rejection을 실험에서 완전히 제거한 뒤 더 흥미로운 문제가 나타났다.

Resolution-only stress scenario S5-S17은 A, B, D에서만 실행한다. 모든 controlled Promise는 resolve된다. 모든 exception은 C++에서 시작한다. 이렇게 해서 C++ exception state와 suspend/resume의 상호작용만 격리한다.

결과는 다음과 같다.

- A(`Asyncify + JS EH`)는 S5-S17을 통과한다.
- D(`JSPI + Wasm EH`)는 S5-S17을 통과한다.
- B(`Asyncify + Wasm EH`)는 S5-S7/S9-S12에서 `null function`과 `unreachable`로 실패하고, S8/S14/S17은 통과한다. S13/S15/S16은 `PASS:done`에 도달하지만 이후 post-done `unreachable`을 보고한다.

따라서 unsafe migration path는 exception과 suspension을 섞는 코드에서 구체적으로 "Asyncify를 유지한 채 Wasm EH를 켜는 것"이다.

## Boundary: live state와 captured state

B가 S8, S14, S17을 통과한다는 사실은 B가 S5-S7/S9-S12에서 실패한다는 사실만큼 중요하다.

S8과 S14는 먼저 일반 call frame을 통해 suspend/resume한 뒤, 나중에 새 C++ exception을 throw한다. B는 이 경로를 처리한다. 따라서 "throw 전에 yield가 많으면 Asyncify + Wasm EH가 깨진다"는 넓은 설명은 배제된다.

Hard-failing scenario들은 exception state를 suspend boundary 너머로 운반한다.

- S5와 S9는 suspend가 일어나는 동안 catch state를 live 상태로 유지한다.
- S6와 S10은 destructor path에서 C++ unwinding 중 suspend한다.
- S7은 나중에 rethrow하는 catch path에서 suspend한다.
- S11과 S12는 저장된 `std::exception_ptr`를 suspend 너머로 운반하고 나중에 reactivate한다.

S13/S15/S16은 payload-only control이다. suspend 이후 copied object, stable pointer, copied string을 읽고 `PASS:done`에 도달하지만, B는 여전히 post-done `unreachable`을 낸다. S17은 반대 방향의 `exception_ptr` control이다. resume 이후 만들고 다른 suspend 전에 rethrow하면 B도 통과한다.

좁혀진 규칙은 다음과 같다.

> B는 live 또는 captured Wasm EH exception state가 Asyncify suspend/resume boundary를 살아남아야 할 때 실패한다.

## S12가 중요한 이유

S12는 결론을 더 날카롭게 만드는 edge case다.

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

두 번째 suspend는 catch block 안에서 일어나지 않는다. active stack unwinding 중에도 일어나지 않는다. catch는 이미 끝났다.

하지만 `std::exception_ptr`는 단순히 복사된 message가 아니다. C++ runtime이 나중에 `std::rethrow_exception`으로 reactivate할 수 있는 captured exception handle이다. B에서는 trace가 `S12:after-second-resume`까지 도달한 뒤 `PASS:s12-done` 전에 `null function` / `unreachable`로 실패한다.

즉 unsafe state는 active catch frame이 boundary를 건너는 경우보다 넓다. Captured Wasm EH exception state도 Asyncify suspend/resume 이후 사용할 수 없게 될 수 있다.

## 가져갈 점

두 가지 교훈이 있다.

첫째, JavaScript async failure와 C++ exception handling은 같은 control-flow system이 아니다. boundary에서는 JS Promise settlement를 데이터로 다루고, 원하는 추상화가 C++ `catch`라면 C++에서 throw하라.

둘째, stack-switching 축이 Asyncify로 남아 있다면 Wasm EH는 drop-in safety upgrade가 아니다. 이 harness에서 `Asyncify + Wasm EH`는 exception state가 suspend를 건너는 C++-initiated stress case에서 `Asyncify + JS EH`나 `JSPI + Wasm EH`보다 나쁘다.

JSPI와 Wasm EH는 여전히 가치가 있다. 에뮬레이션과 generated-code cost를 줄인다. 하지만 migration path는 exception 축과 stack-switching 축을 조심스럽게 옮겨야 하며, async/exception boundary는 여전히 명시적이어야 한다.

## 관찰 재현

전체 suite 실행:

```sh
source ./emsdk/emsdk_env.sh
npm test
```

크기 지표 실행:

```sh
scripts/collect-size-metrics.sh
```

대표 rejected-Promise pitfall:

```sh
cd examples/A/s3
./run.sh
```

Expected takeaway: A/S3는 `S3:before-suspend`를 로그한 뒤, rejected Promise가 C++ catch에 도달하지 않고 page error로 새어 나간다.

대표 explicit-settlement counterexample:

```sh
cd examples/E/s3
./run.sh
```

Expected takeaway: E/S3는 coroutine resume 이후 C++에서 throw하므로 `PASS:s3-catch-reached`에 도달한다.

대표 migration stress case:

```sh
cd examples/B/s12
./run.sh

cd ../../D/s12
./run.sh
```

Expected takeaway: B/S12는 두 번째 suspend에서 resume된 뒤 saved exception을 reactivate하는 동안 실패한다. D/S12는 `PASS:s12-done`에 도달한다.
