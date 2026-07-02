# 연구 프로젝트 설계 문서
## Emscripten Asyncify × Exception: Pitfalls과 JSPI/Wasm EH로의 진화

> 본 문서는 `learn-asyncify` 저장소의 연구 방향과 예제 구성을 정의하는 설계 문서다.
> 목적은 (1) Emscripten이 단순한 C++→Wasm 트랜스파일러가 아니라 Wasm이 본래 지원하지 않는
> C++ 런타임 기능을 “에뮬레이션 레이어"로 직접 구축하고 있다는 사실을 보이고,
> (2) 현재 브라우저 호환성 때문에 피할 수 없는 `Asyncify + JS exception emulation` 조합이
> 갖는 함정을 재현 가능한 코드로 드러내며,
> (3) `JSPI + Wasm exceptions` 표준 조합이 이 함정들을 어떻게 거둬내는지 비교·제시하는 것이다.
> (4) **에뮬레이션에 기대지 않고 C++20 코루틴으로 suspend를 직접 구현하는 fallback 경로**도
> 함께 두어, “에뮬레이션이 없으면 개발자는 무엇을 직접 짜야 하는가"를 비교한다.

---

## 1. 연구 배경 및 핵심 주장

### 1.1 Wasm의 태생적 한계와 Emscripten의 에뮬레이션
WebAssembly MVP(2017)는 스택 머신 기반의 최소한의 연산만 정의했다.

- **스택 점프/일시정지(suspend/resume)** 불가: 하나의 Wasm 스택 프레임은 호출자에게
  반환(return)하지 않고서는 제어를 넘길 수 없다. 즉 `await`-style 코루틴이 원칙적으로 불가.
- **예외(Exception)** 미지원: try/catch 연산자가 없어 C++의 `throw`/`catch`를 직접 표현 못 함.

Emscripten은 이 두 가지를 **JS+바이너리 계측**으로 에뮬레이션한다.
즉 단순 번역이 아니라, 컴파일 시점에 모든 함수에 상태머신/저장복원 코드를 주입하고
런타임에 JS 글루코드가 협력하는 **에뮬레이션 레이어**를 Wasm 위에 얹는다.
이 점이 “Emscripten은 그냥 컴파일러가 아니라 Wasm 런타임 구현체"라는 주장의 근거다.

### 1.2 두 에뮬레이션이 충돌한다 (핵심 pitfall 가설)
> 본 절의 세 충돌은 메커니즘 분석에서 도출한 **연구 가설**이다. Phase 1에서 예제로
> 재현·확인하기 전까지는 확정된 사실이 아니다. 본 프로젝트는 이 가설이 성립하는지를
> 검증하는 것 자체가 목표의 하나다.

- **Asyncify**는 suspend 가능 경로상의 함수에 `asyncify.state` 체크와 함께
  스택/지역변수 저장·복원 코드를 끼워넣는다(기본 광범위; `ASYNCIFY_ONLY`/
  `ASYNCIFY_REMOVE`로 조절). suspend가 일어나면 스택을 통째로 버퍼로 빼고 JS로
  점프하고, 이후 복원(resume)해 다시 Wasm으로 들어온다.
- **JS exception emulation**은 throw 발생 시 예외 객체를 글로벌에 세팅하고,
  호출자(caller)가 반환값/플래그를 통해 throw 여부를 검사해 “정상 스택”을 따라 위로
  전파하는 방식이다(throw한 함수는 곧바로 return 경로를 탄다).

두 방식 모두 **“함수 반환 경로(return path)”를 후킹**한다는 점에서 다음 충돌이
*발생할 것으로 예상된다*:

1. **suspend 중 예외 전파 불가/손상**: Asyncify가 스택을 버퍼로 빼고 있는 도중, 또는
   resume으로 가짜 반환 경로를 따라 복원되는 도중에 throw가 일어나면, throw 전파는
   실제 존재하지 않거나 재구성 중인 프레임을 대상으로 동작해야 한다.
   JS exception emulation은 “호출자가 검사해 위로 올린다"는 *방향성* 전파이므로
   resume 도중의 가짜 반환 경로를 따라 정상 catch 블록을 놓칠 수 있다.
2. **catch 복구 지점의 비대칭**: Asyncify resume은 “suspend 지점 바로 다음”으로
   돌아와야 하지만, throw 직후 catch는 “catch한 함수 내부”로 가야 한다.
   두 “어디로 복귀할 것인가” 상태 머신이 각자 자기 길을 주장하면서 깨지거나,
   이중 저장/복원으로 인해 크기/성능이 폭발한다.
3. **C++ destructors 및 unwind table**: 스택 unwind 중 실행돼야 하는 소멸자가
   Asyncify instrumented 코드와 겹쳐, 의도치 않은 `asyncify_stop_runtime` 호출이나
   로컬 버퍼 덮어쓰기를 유발할 수 있다.

→ 이 가설들이 성립함을 재현하는 것이 본 프로젝트가 “pitfall 보여주기"라고
이름붙인 단계의 목표다.

### 1.3 JSPI와 Wasm exceptions가 바꾸는 것
두 Wasm 표준화 proposal은 위 에뮬레이션을 Wasm 안으로 끌어들여 충돌의 근원을 지운다.

| 항목 | 현재 (에뮬레이션) | 표준화 이후 (네이티브) |
|---|---|---|
| 코루틴/suspend | Asyncify (전체 함수 계측) | **JSPI** (stack switching by Wasm runtime) |
| 예외 | JS exception emulation | **Wasm exception handling** (try/catch 옵코드) |

- **JSPI**: Wasm 런타임이 스택 전환을 직접 수행한다. 더 이상 모든 함수에 저장/복원
  코드를 끼워넣지 않는다. suspend는 단지 Wasm이 멈춰 서 있는 상태이므로 throw 전파와
  별개다. 계측 비용(바이너리/실행시간) 사라짐.
- **Wasm EH**: throw/catch가 옵코드 단위로 정의되므로, stack switch 중 throw path도
  Wasm runtime이 일관적으로 처리한다. catch 복귀 지점도 Wasm이 정의.
- 결과적으로 1.2의 충돌 세 가지가 모두 *구조적으로* 소거된다(에뮬레이션 자체가 없어지므로).

> 단, 현재 시점에서 가장 안정적인 브라우저 지원 조합은 Asyncify+JS EH이며,
> 실사용은 에뮬레이션 경로를 쓸 수밖에 없다. JSPI와 Wasm EH는 이미 stable Chrome에
> 정식 shipped (`chromestatus.com/feature/5675224515231744`)하지만 다른 브라우저
> 지원과 Emscripten 컴파일러 측 대응은 여전히 진행 중이라, 본 프로젝트는 “현재의
> 페인(A)”과 “표준(D/E')”을 나란히 보여준다.

### 1.4 세 번째 탈출구: C++20 코루틴으로 “코루틴 에뮬레이션 자체”를 피하기
Asyncify와 JSPI는 “Wasm이 멈춰야(cooperative suspend) 한다”는 전제 위에서 동작한다.
그러나 C++20 coroutine은 *다른 길*을 쓴다:

- 코루틴은 **suspend 시 Wasm 호출 스택을 멈추지 않는다**. 코루틴 프레임(지역변수 +
  resume 지점)을 힙에 할당한 뒤, Wasm 함수는 **정상적으로 caller에게 반환**한다.
- Wasm 스택은 그 순간 비어 있고, JS 측에서 프레임의 `resume()`/`destroy()` 핸들을
  들고 있다가 이벤트가 settled 되면 다시 Wasm을 *새 호출*로 들어간다.
- 즉 Wasm 런타임 관점에서는 “멈춰 있는 스택”이란 게 존재하지 않는다. suspend는 단지
  “한 번 return하고 나중에 다시 부름”일 뿐이다.

이 전략은 **코루틴 에뮬레이션 레이어(Asyncify 계측/JSPI) 자체를 가져오지 않는다**.
따라서 1.2의 충돌 중 (1),(2),(3) 중 *코루틴*쪽에서 오는 부분은 원천적으로 사라진다.
**예외 에뮬레이션(JS/Wasm EH) 축은 여전히 별개**이므로, C++20 코루틴 target은
“코루틴은 C++ 표준으로 직접 구현하되, 예외는 여전히 EH 에뮬레이션/표준을 타는” 경로다.

> 장단점: 별도 계측/런타임 기능 없이 **순수 C++20 + 현재 브라우저**로 동작하지만,
> (a) 개발자가 직접 `promise_type`/`awaiter`를 짜야 하고, (b) 모든 suspend를
> “JS로 빠져나갔다가 새 호출로 복귀”로 모델링해야 하므로 **상호운용 패턴이 다르다**는
> 비용이 있다. 이 점이 본 프로젝트의 “러타임 에뮬/표준 코루틴을 쓰는 쪽(A–D)과
> C++20으로 직접 짜는 쪽(E/E')의 코드 차이” 비교 지점이 된다.

### 1.5 매트릭스의 두 축 정리
이제 본 프로젝트의 target은 **2개의 독립 축**의 곱으로 정리된다:

| | JS EH emulation (현재) | Wasm EH (표준) |
|---|---|---|
| **Asyncify** (계측 에뮬) | A | B |
| **JSPI** (표준 코루틴) | C | D |
| **C++20 coroutine** (직접 구현, 에뮬 없음) | E | E' |

- 행(코루틴 축): Wasm 런타임이 suspend를 *어떻게 제공하는가* (런타임 에뮬 / 런타임 표준 / C++ 표준으로 우회)
- 열(예외 축): Wasm 런타임이 throw/catch를 *어떻게 제공하는가* (런타임 에뮬 / 런타임 표준)
- 모든 셀이 정식 target이다(6 target × 4 scenario = 24 예제). 본 문서의 target ID는
  이 2D 매트릭스를 따른다.

---

## 2. 예제 매트릭스

총 6개의 build target × 4개의 시나리오 = 24개의 예제를 정식으로 다룬다. 각 예제는
`examples/<id>/<scenario>/`에 독립 디렉토리를 갖는다. target 명명은 §1.5의 2D 매트릭스를
따른다.

### 2.1 Build target 매트릭스

| ID | 코루틴 방식 | 예외 방식 | Emscripten 플래그(예상) | 한 줄 목적 |
|----|---|---|---|---|
| **A** | Asyncify (`ASYNCIFY=1`) | JS exception emulation | `-sASYNCIFY -sASYNCIFY_IMPORTS=[...]`<br>`-sDISABLE_EXCEPTION_CATCHING=0` | **pitfall 재현** (현재 실사용 경로) |
| **B** | Asyncify | Wasm EH | `-sASYNCIFY -fwasm-exceptions` | EH만 표준으로 바꿨을 때 부분 개선 |
| **C** | JSPI | JS exception emulation | `-sASYNCIFY=2`(JSPI) | 코루틴만 표준으로 바꿨을 때 |
| **D** | JSPI | Wasm EH | `-sASYNCIFY=2 -fwasm-exceptions` | 두 런타임 표준 모두 |
| **E** | **C++20 coroutine** | JS exception emulation | `-std=c++20`<br>`ASYNCIFY` *없음*, `-fwasm-exceptions` *없음* | 코루틴 에뮬 쓰지 않는 fallback (현재 브라우저) |
| **E'** | **C++20 coroutine** | Wasm EH | `-std=c++20 -fwasm-exceptions`<br>`ASYNCIFY` *없음* | 코루틴 직접 구현 + 예외 표준 |

> ⚠ **target E/E'의 “suspend”는 의미가 다르다**: Wasm 스택이 멈춰 서 있는 게
> 아니라 코루틴 프레임이 힙에 있으면서 Wasm은 이미 return한 상태. JS가 `resume()`으로
> 새 Wasm 호출을 시작한다. 따라서 S2~S4의 “suspend 지점에서 깨지는가" 질문은
> E/E'에서는 **“`co_await` 직후 return 경로에서 throw가 caller(JS)로 새어 나가지
> 않는가 / resume 재진입 시 catch 지점을 찾는가"**로 번역된다 (2.2 시나리오 각주 참조).

> 플래그는 Emscripten 버전/브라우저에 따라 변하므로 각 예제 디렉토리에
> `Makefile`/`build.sh`와 함께 `HOW_THIS_WAS_BUILT.md`로 정확한 버전·호환 브라우저 범위를 명시한다.

### 2.2 시나리오 매트릭스
각 target 마다 아래 시나리오를 모두 빌드한다.

- **S1 — 기본**: suspend 없이 동기적으로 throw만 (정상 동작 베이스라인)
- **S2 — suspend 후 throw**: await 이벤트 대기 중 settled 직후 throw → catch가
  있을 때 catch가 동작하는지/손상되는지 관찰
- **S3 — suspend 중 throw 유발**: suspend itself가 throw하는 import(예: rejected
  Promise) → catch 없이 계속 위로 올라가는지 / Asyncify 상태가 깨지는지
- **S4 — catch 후 다시 suspend**: catch 블록 안에서 또 await → 상태머신 중첩이
  처리되는지

> **target E/E'에서의 재정의**: E와 E'은 Asyncify/JSPI를 쓰지 않으므로 “suspend”를
> “Wasm이 멈춰 서 있는 것"이 아니라 **“코루틴이 `co_await`로 caller에게 return하고,
> JS가 프레임의 `resume()`을 다시 호출해 Wasm을 새로 진입시키는 것"**으로 읽어야 한다.
> 따라서 S2/S3/S4의 “suspend 지점에서 깨지는가" 질문은 E/E'에서는 **“`co_await` 직후
> return 경로에서 throw가 caller(JS)로 새어 나가지 않는가 / resume 재진입 시 catch
> 지점을 찾는가"**로 번역된다. S1(동기 throw)은 변함없이 베이스라인.

### 2.3 소스 구조와 예제 명명 규칙
시나리오는 **소스 공유 모델**을 따른다. 핵심 시나리오 로직은 한 곳에 두고,
target/scenario 디렉토리는 같은 소스를 다른 플래그/런타임으로 빌드한다.

- `src/scenarios/S{1,2,3,4}.cpp` — Asyncify/JSPI용 시나리오 본체. **target A–D가 공유**.
- `src/scenarios_coro/S{1,2,3,4}.cpp` — C++20 코루틴용 시나리오 본체. **target E/E'이 공유**.
- `src/runtime_helpers.{cpp,h}` — A–D 공통 `await`/`throw` 유틸, asyncify import thunk.
- `src/coro_glue.{cpp,h}` + `src/coro_glue.js` — E/E' 공통 `promise_type`/awaiter +
  JS↔Wasm `resume_handle(idx)`/`destroy_handle(idx)` 글루.
- `src/test_harness.js` — 페이지 로드 시 Wasm 인스턴스화 + Promise 제어 신호 주입.
- `examples/<target>/<scenario>/` — 예: `examples/A/s2/`. 각 디렉토리는 다음만 갖는다:
  - `build.sh`: emcc 커맨드 (해당 target의 `src/scenarios[/_coro]/S<n>.cpp`를 빌드)
  - `run.sh`: `npm run serve` + Playwright spec 실행 진입
  - `EXPECT.md`: 예상 결과 vs 실제 관찰 결과, 그리고 *왜* 그런지 한 단락 설명
- `tests/<target>/<scenario>.spec.ts` — `@playwright/test` spec. 페이지 console 수집 → assert.

> 이 구조는 (a) A–D 비교가 “같은 소스 + 다른 플래그”로 binary size/perf 정량 비교를
> 가능하게 하고, (b) E vs E'도 같은 코루틴 소스 + EH 플래그 차이로 비교되도록 한다.

### 2.4 재현 메커니즘 상세 (실험 설계의 구체적 결정)
8개의 구현 결정이 디자인 브레인스토밍을 통해 확정되었다 — 본 절은 재현의 재현성을
담보한다.

| # | 결정 | 내용 |
|---|---|---|
| 1 | **suspend의 구체적 형태** | 커스텀 asyncify import가 `Asyncify.handleAsync(() => controlledPromise)`를 호출. JS harness가 Promise를 결정론적으로 resolve/reject 시켜 S2(settled 직후 throw)와 S3(reject 자체) 타이밍 통제. |
| 2 | **호출 스택 형태** | `main()`이 try/catch로 감싸고 → `async_func()`이 suspend 후 throw. **caller-catch 형태**. catch 도달 여부가 핵심 관측. |
| 3 | **관측 환경** | Playwright (channel: 'chrome', stable) 에서 실행. 모든 target을 동일 런타임에서 비교. |
| 4 | **C++20 코루틴 JS 인터페이스** | `await_suspend`가 `std::coroutine_handle<>::address()`(uintptr_t)를 JS import로 전달 → JS가 Map에 저장 → Promise settled 시 Wasm export `resume_handle(idx)`/`destroy_handle(idx)` 호출. |
| 5 | **소스 공유 모델** | §2.3 참조. A–D는 같은 `src/scenarios/S<n>.cpp`, E/E'은 같은 `src/scenarios_coro/S<n>.cpp` 공유. |
| 6 | **테스트 harness** | `@playwright/test` 공식 runner. 각 시나리오별 `.spec.ts`에서 페이지 console 이벤트 수집 → assert. |
| 7 | **핀 전략** | emsdk 최신 안정 tag + Playwright `channel:'chrome'` (stable). JSPI와 Wasm EH는 stable Chrome에 이미 정식 shipped (`chromestatus.com/feature/5675224515231744`). 별도 feature flag 불필요 (Phase 0에서 재확인). |
| 8 | **E/E' 가설** | S1–S4 모두 C++ 의미대로 통과 예상 — “코루틴 에뮬레이션이 없으면 1.2의 충돌 자체가 소멸한다”는 가설 검증. 관측으로 반박되면 findings.md에 명시. |

**시나리오 ↔ Promise 통제 매핑** (결정 #1, #2 구체화):
- **S1 — 기본 throw**: `Asyncify.handleAsync` 호출 없이 `throw std::runtime_error("S1")` (정상 catch 베이스라인).
- **S2 — settled 직후 throw**: `controlledPromise` resolve → resume 후 `throw std::runtime_error("S2")` → caller catch 도달 관측.
- **S3 — suspend가 reject**: `controlledPromise` reject → Emscripten이 suspend import에서 throw 유발 → caller catch 도달 관측 (or unhandled).
- **S4 — catch 후 재 suspend**: catch 블록 안에서 두 번째 `Asyncify.handleAsync` 호출 → 두 번째 Promise settled 후 정상 종료 관측.

> 모든 target이 같은 시나리오 의미(S1..S4)로 실행되지만, target E/E'에서는 결정 #4에
> 따라 “handle을 JS로 전달하고 별도 Wasm 호출로 resume”되므로 같은 시나리오가 다른
> 제어흐름으로 재현된다. 이_diff가 `docs/matrix.md`의 관측 비교 지점이다.

---

## 3. 관측 지표 (Pitfall을 어떻게 증명할 것인가)

pitfall은 “실행이 단순히 느린"것이 아니라 **“잘못되거나 정의되지 않은 행동"이다**.
`@playwright/test` spec (`tests/<target>/<scenario>.spec.ts`)이 페이지 console 라인을
수집해 다음을 관측 가능한 신호로 삼는다.

1. **Correctness (주 신호)**: Wasm 측에서 `console.log("PASS:<condition>")` /
   `console.log("FAIL:<reason>")` 형식으로 찍는 신호. catch 도달, 멈춤(hang →
   Playwright timeout), throw가 잡히지 않고 JS `uncaughtException`로 새어나가는지,
   Asyncify `unreachable` 트랩. spec은 이 라인들을 순서·시점 기준으로 assert.
2. **Binary size / instru overhead (A–D)**: A–D는 같은 C++ 소스를 다른 플래그로
   빌드할 수 있으므로, 동일 소스 기준으로 wasm 바이트 수를 비교해 에뮬레이션 주입
   코드 양의 차이를 정량화. E/E'은 `promise_type`/awaiter boilerplate가 소스에
   추가되므로 *별도의 baseline*(`asyncify` 없는 동기 버전)과 비교해 coroutine 프레임
   + EH 코드 overhead를 측정한다.
3. **Perf micro-bench**: suspend 1회 + throw 1회 오버헤드를 ms 단위 비교. A에서는
   이중 계측, D에서는 거의 0이라는 가설 검증.
4. **Stack trace 현황**: throw 시점 stack trace가 A에서는 비정상/잘린 형태,
   D에서는 정상 프레임인지.

`docs/matrix.md`에 target×scenario 표로 모아 비교하고, `docs/findings.md`에
관측에서 끌어낸 일반화된 결론을 쓴다.

---

## 4. 저장소 구조

```
learn-asyncify/
├── README.md                 # 한글 안내 + 빠른 시작
├── docs/
│   ├── design.md             # 본 문서
│   ├── background.md         # Wasm 런타임 한계 + Emscripten 에뮬레이션 해설 (총론)
│   ├── matrix.md             # target×scenario 관측 결과 표 (살아있는 문서)
│   ├── metrics.md            # 빌드 크기/실행 시간/에러 표면 정량 지표
│   └── findings.md           # 결론 + JSPI/Wasm EH 마이그레이션 가이드
├── src/
│   ├── scenarios/S{1..4}.cpp     # A–D 공유 시나리오 본체
│   ├── scenarios_coro/S{1..4}.cpp # E/E' 공유 코루틴 시나리오 본체
│   ├── runtime_helpers.{cpp,h}   # A–D 공통 await/throw 유틸, asyncify import thunk
│   ├── coro_glue.{cpp,h}         # E/E' 공통 promise_type/awaiter
│   ├── coro_glue.js              # E/E' 공통 JS resume/destroy 핸들 글루
│   └── test_harness.js           # Wasm 인스턴스화 + Promise 제어 신호 주입
├── examples/
│   └── <target>/<scenario>/      # build.sh + run.sh + EXPECT.md
├── tests/
│   └── <target>/<scenario>.spec.ts  # @playwright/test spec
├── playwright.config.ts       # channel:'chrome', launch args
└── scripts/
    ├── toolchain.sh          # emsdk 버전 핀, Wasm EH/JSPI stable Chrome 점검
    └── collect-size-metrics.sh # 예제 빌드 산출물 크기 수집
```

---

## 5. 단계별 로드맵

1. **Phase 0 — 툴체인 & 베이스라인** (`docs/background.md`, `scripts/toolchain.sh`):
   emsdk 최신 안정 tag 고정, stable Chrome에서 JSPI/Wasm EH 정식 지원 여부 재확인
   (`chromestatus.com/feature/5675224515231744`), Playwright `channel:'chrome'`로
   S1 베이스라인 빌드·실행. `src/coro_glue.js`와 `resume_handle`/`destroy_handle`
   export도 이 단계에서 smoke-test.
2. **Phase 1 — Pitfall 재현 (target A)**: S2, S3, S4를 A로 돌려 깨지는 지점을 기록.
   `docs/matrix.md`의 A열 전부 작성. *이것이 본 연구의 핵심 결과물이다.*
3. **Phase 2 — 부분 개선 (target B, C)**: 한 쪽만 표준으로 바꿨을 때 어디까지,
   그리고 어디서 다시 막히는지를 관측. 이 단계에서 “에뮬레이션 한 쪽이 남아 있으면
   구조적 불완전함이 남는다"는 점을 부연.
4. **Phase 3 — 완전 해소 검증 (target D)**: 런타임 표준 둘 다 켰을 때 (JSPI+Wasm EH)
   어느 시나리오까지 통과하는지 관측. Phase 2에서 JSPI+JS EH가 S1부터 깨졌으므로, D는 “JSPI 자체가
   문제인가, JS EH가 남아서 문제인가"를 먼저 가르는 결정적 실험이다.
   `docs/findings.md`에 정리 + JSPI/Wasm EH 도입 체크리스트.
5. **Phase 2.5 — 코루틴 에뮬레이션 회피 (target E, E')**: C++20 coroutine으로
     suspend를 직접 구현. E는 JS EH를, E'은 Wasm EH를 타서 “코루틴 에뮬은 없앴지만
     예외 에뮬이 남아 있을/없을 때 차이"를 분리 관찰. 주 관찰은 “코루틴 에뮬레이션이
     빠진 상태에서 throw/catch가 C++ 의미대로 동작하는가"와 “개발자가 직접 짜야 하는
     boilerplate(`promise_type`, `awaiter`, JS↔Wasm resume 핸들)의 무게" 양측.
     *핵심 비교 pivot: D(런타임이 다 해줌) vs E'(개발자+표준) vs E(개발자+에뮬) —
     겉보기엔 같은 코루틴 코드라도 구현 부담이 어디에 있는가.*
6. **Phase 3.5 — 지표 보강**: correctness 관측이 끝난 뒤, 비용과 표면 증거를
   같은 예제 산출물에서 수집한다. 1차 범위는 `main.wasm`/`main.js` 크기,
   Playwright load-to-completion 시간, 대표 실패 케이스의 pageerror/stack 표면이다.
   결과는 `docs/metrics.md`에 표로 기록하고, `docs/findings.md`에는 해석만 짧게
   연결한다. 성능 수치는 브라우저/머신 영향이 크므로 절대값보다 target 간 상대 비교와
   반복 가능한 수집 명령을 우선한다.
7. **Phase 4 — 발표 산출물**: `README.md` 데모 링크, 아주 간단한 글/슬라이드 노트.

---

## 6. 비목표 (Out of scope)

- Emscripten 없이 raw Wasm에 직접 계측 붙이는 시도.
- Asyncify 관련 성능 최적화 튜닝(`ASYNCIFY_IGNORE_INDIRECT` 등) 자체가 주제가 됨.
- 브라우저 엔진/벤더 내부 구현 버그 재현이나 패치 제안.
- SAFE_HEAP 등 예외와 무관한 다른 에뮬레이션을 본 프로젝트에 두루 담기.

---

## 7. 예상 리스크 & 대응

- **JSPI/Wasm EH stable Chrome 지원**: JSPI와 Wasm EH는 stable Chrome에 정식
  shipped 상태. Phase 0에서 `navigator.userAgent`/feature detect로 Chrome 버전과
  지원 여부를 재확인. 만약 특정 Emscripten 버전이 JSPI 빌드를 지원하지 않으면,
  design.md §2.1 매트릭스와 §2.4 결정 #7를 그 시점의 사실에 맞춰 갱신한다.
- **E/E'의 C++20 coroutine 빌드**: Emscripten의 C++20 coroutine 지원(코루틴 프레임
  힙 할당 + `resume`/`destroy` ABI)이 안정적인지 사전 점검이 필요. Emscripten
  LLVM/aggressive 버전에 따라 `<coroutine>` 헤더/라이브러리 빠짐 이슈가 있을 수 있어
  `scripts/toolchain.sh`가 코루틴 최소 예제를 빌드해 smoke-test 한다.
  JS↔Wasm `resume()` 핸들 밀어주기는 `src/coro_glue.{cpp,js}` 헬퍼로 템플릿화.
  E'은 추가로 `-fwasm-exceptions`와 C++20 coroutine이 같이 빌드되는지(코루틴
  프레임 안의 예외 상태/소멸자 unwind 경로가 Wasm EH에서 올바로 잡히는지)를 별도
  smoke-test로 검증한다.
- **Emscripten 버전 drift**: `scripts/toolchain.sh`가 emsdk commit 고정; 예제 빌드
  스크립트에 `emcc --version`을 찍어 산출물 보존.
- **pitfall이 보통 알아채기 어려운 silent mis-behavior 일 수 있음**: 관측은
  correctness 위주로 assert-driven으로 만든다(`EXPECT.md`에 PASS/FAIL 명시).

---

## 8. 완료 정의 (Definition of Done)

- target A의 S2/S3/S4에서 적어도 하나 이상 “예상과 다른 동작(깨짐/uncaught/hang)”을
  안정적으로 재현한다.
- target B, C에서 “한 쪽만 표준으로 바꿨을 때 어디까지 개선되고 어디서 다시 막히는지”를
  관측하고, 잔존 한계를 기록한다.
- target D의 같은 시나리오가 C++ 의미에 맞는 결과로 동작하는지 검증하고, 반례가 있으면 기록한다.
- target E, E'의 S1~S4를 통해 “코루틴 에뮬레이션 없이 catch가 의미대로 동작하는지”를
  관찰하고, D vs E vs E'의 코드 diff(특히 `promise_type`/awaiter boilerplate의 양과
  Wasm EH 적용 여부의 차이)를 한 장으로 정리한다.
- `docs/matrix.md`의 표가 6 target×4 scenario 셀을 모두 채운다.
- `docs/findings.md`가 “JSPI+Wasm EH로 마이그레이션할 때 실용 체크리스트”를 포함한다.
- `README.md`에서 5분 이내에 첫 pitfall 예제를 빌드+재현하고 볼 수 있다.
