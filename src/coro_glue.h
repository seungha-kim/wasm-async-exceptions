#ifndef LEARN_ASYNCIFY_CORO_GLUE_H
#define LEARN_ASYNCIFY_CORO_GLUE_H

#include <coroutine>
#include <cstdint>

void scenario_log(const char* msg);

class ScenarioTask {
public:
  struct promise_type;
  using handle_type = std::coroutine_handle<promise_type>;

  explicit ScenarioTask(handle_type handle) : handle_(handle) {}
  ScenarioTask(const ScenarioTask&) = delete;
  ScenarioTask& operator=(const ScenarioTask&) = delete;
  ScenarioTask(ScenarioTask&& other) noexcept : handle_(other.handle_) {
    other.handle_ = nullptr;
  }
  ~ScenarioTask() = default;

  void start();

  struct promise_type {
    ScenarioTask get_return_object() {
      return ScenarioTask(handle_type::from_promise(*this));
    }
    std::suspend_always initial_suspend() noexcept { return {}; }
    std::suspend_always final_suspend() noexcept { return {}; }
    void return_void() noexcept {}
    void unhandled_exception();
  };

private:
  handle_type handle_;
};

struct ControlledAwaitable {
  explicit ControlledAwaitable(const char* id) : id(id) {}

  struct Awaiter {
    const char* id;
    std::uintptr_t handle = 0;

    bool await_ready() const noexcept { return false; }
    void await_suspend(std::coroutine_handle<> coroutine_handle);
    void await_resume() const;
  };

  Awaiter operator co_await() const { return Awaiter{id}; }

private:
  const char* id;
};

ControlledAwaitable await_controlled_promise(const char* id);

#endif
