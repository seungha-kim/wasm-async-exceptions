# 배경: Wasm 런타임 한계와 Emscripten의 에뮬레이션 계층

이 문서는 `docs/design.md` 1장의 긴 설명판이다. 이후 `docs/matrix.md`의 관찰 노트가 매번 다시 설명하지 않고도 Emscripten이 *무엇을* 그리고 *왜* 에뮬레이션하는지 안정적으로 참조할 수 있도록 둔다.

## 1. Wasm MVP와 빠져 있는 것

WebAssembly 1.0(2017)은 의도적으로 작은 연산 집합을 가진 스택 머신을 정의한다. 정수/부동소수점 연산, 메모리 load/store, call, branch 정도가 핵심이다. C++ 런타임 기능 중 두 가지는 MVP에 없다.

- *협력적 suspend/resume* — Wasm 함수는 현재 프레임 중간에서 멈춘 뒤 unwind 없이 caller에게 제어권을 돌려줄 수 없다. `await`가 없다.
- *예외* — `try`/`catch` opcode가 없고, `throw`를 직접 인코딩할 수 없다.

## 2. Emscripten이 하는 일

Emscripten은 Wasm 위에 *JS + 바이너리 계측* 계층을 얹어 두 기능을 구현한다.

### 2.1 Asyncify

`-sASYNCIFY`로 컴파일하면 suspend import에서 도달 가능한 모든 함수가 계측된다. 함수 진입 시 `asyncify.state`를 확인하고, suspend 시 런타임이 살아 있는 스택(local + program counter)을 보조 버퍼로 복사한 뒤 JS로 돌아간다. resume 시에는 버퍼를 다시 복사해 호출이 떠난 적이 없는 것처럼 실행을 계속한다. 기본적으로 계측 범위는 넓고, `ASYNCIFY_ONLY` / `ASYNCIFY_REMOVE`로 조정할 수 있다.

### 2.2 JS 예외 에뮬레이션

Wasm exception handling이 없으면 C++ `throw`가 Wasm 프레임을 직접 멈출 수 없다. Emscripten은 이를 에뮬레이션한다. throw하는 함수는 예외 객체를 전역에 쓰고, "threw" 플래그와 함께 정상 return 경로로 빠져나온다. 모든 caller는 호출 뒤 그 플래그를 확인하고, 설정되어 있으면 같은 방식으로 위로 전파한다. `catch` 블록은 그 플래그를 검사하는 조건 분기로 바뀐다.

## 3. 왜 충돌하는가

두 메커니즘 모두 관련 call chain의 모든 함수에서 **return path**를 점유한다. 설계 문서 1.2절은 여기서 생기는 세 가지 충돌을 나열한다. 이들은 프로젝트가 검증하려는 *가설*이지, 미리 확정된 사실이 아니다.

## 4. 표준 기능이 바꾸는 것

- **JSPI**(JS Promise Integration) — Wasm export가 Promise를 반환할 수 있고, 런타임이 이를 await하며 Wasm 스택을 실제로 중단한다. 모든 함수를 계측할 필요가 없다.
- **Wasm exception handling** — `try`/`catch`/`throw`가 opcode가 되고, unwind는 per-call flag check가 아니라 런타임이 수행한다.

이 저장소의 중요한 관찰 중 하나는 exception 축만 표준으로 바꾸는 것이 안전한 중간 단계가 아니라는 점이다. Asyncify + Wasm EH 행(target B)은 여전히 suspension에 Asyncify를 쓴다. S5-S7/S9-S12는 모든 JS async 작업이 resolve되고 모든 예외가 C++ 내부에서 시작해도 실패할 수 있음을 보여준다. 반면 S8/S14/S17은 일반적인 반복 multi-yield 복원 뒤 나중에 C++ throw가 발생하거나, resume 이후 만들어져 바로 소비되는 `exception_ptr`는 의도한 C++ catch 경로에 도달할 수 있음을 보여준다. S13/S15/S16은 payload-only control 이후 더 약한 post-done `unreachable` 표면도 보여준다.

## 5. 세 번째 경로: C++20 코루틴

C++20 코루틴은 local을 heap에 할당된 프레임에 저장하고, suspend 시 caller에게 *return*한다. Wasm은 "얼어붙지" 않는다. 이미 프레임을 pop한 상태다. JS는 resume handle을 들고 있다가 awaited event가 settle되면 Wasm에 다시 진입한다. 이 경로에서는 코루틴 에뮬레이션 계층이 전혀 필요 없다. 예외 에뮬레이션 계층 또는 Wasm EH만 남는다.

## 6. 작성 시점의 상태

JSPI와 Wasm EH는 모두 stable Chrome에 shipped 상태다(`chromestatus.com/feature/5675224515231744`). Emscripten도 둘 다 지원한다. 다만 Chrome 밖의 serious use는 아직 고르지 않으므로, 이 프로젝트는 Asyncify + JS EH 조합을 *실용적 기본값*으로 두고 JSPI + Wasm EH와 C++20 coroutine을 비교 대상인 *표준화된 출구*로 다룬다. Asyncify + Wasm EH는 안전한 stepping-stone으로 보지 않는다. 현재 관찰에서 이 조합은 가장 fragile한 행이다.
