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

set(COMMON_EMSCRIPTEN_COMPILE_FLAGS
  "-O1"
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

function(add_compile_and_link_flags target)
  foreach(flag IN LISTS ARGN)
    target_compile_options(${target} PRIVATE "SHELL:${flag}")
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
  target_compile_options(${cmake_target} PRIVATE ${COMMON_EMSCRIPTEN_COMPILE_FLAGS})
  set_target_properties(${cmake_target} PROPERTIES
    OUTPUT_NAME "main"
    RUNTIME_OUTPUT_DIRECTORY "${output_dir}"
  )

  if(target_name STREQUAL "A")
    add_link_flags(${cmake_target}
      "-sASYNCIFY=1"
    )
    add_compile_and_link_flags(${cmake_target}
      "-sDISABLE_EXCEPTION_CATCHING=0"
    )
  elseif(target_name STREQUAL "B")
    add_link_flags(${cmake_target}
      "-sASYNCIFY=1"
    )
    add_compile_and_link_flags(${cmake_target}
      "-fwasm-exceptions"
    )
  elseif(target_name STREQUAL "C")
    add_link_flags(${cmake_target}
      "-sASYNCIFY=2"
    )
    add_compile_and_link_flags(${cmake_target}
      "-sDISABLE_EXCEPTION_CATCHING=0"
    )
  elseif(target_name STREQUAL "D")
    add_link_flags(${cmake_target}
      "-sASYNCIFY=2"
    )
    add_compile_and_link_flags(${cmake_target}
      "-fwasm-exceptions"
    )
  elseif(target_name STREQUAL "E")
    add_compile_and_link_flags(${cmake_target}
      "-sDISABLE_EXCEPTION_CATCHING=0"
    )
  elseif(target_name STREQUAL "Ep")
    add_compile_and_link_flags(${cmake_target}
      "-fwasm-exceptions"
    )
  else()
    message(FATAL_ERROR "Unknown experiment target: ${target_name}")
  endif()
endfunction()

add_experiment_example(A s1)
add_experiment_example(A s2)
add_experiment_example(A s3)
add_experiment_example(A s4)
add_experiment_example(A s5)
add_experiment_example(A s6)
add_experiment_example(A s7)
add_experiment_example(A s8)

add_experiment_example(B s1)
add_experiment_example(B s2)
add_experiment_example(B s3)
add_experiment_example(B s4)
add_experiment_example(B s5)
add_experiment_example(B s6)
add_experiment_example(B s7)
add_experiment_example(B s8)

add_experiment_example(C s1)
add_experiment_example(C s2)
add_experiment_example(C s3)
add_experiment_example(C s4)

add_experiment_example(D s1)
add_experiment_example(D s2)
add_experiment_example(D s3)
add_experiment_example(D s4)
add_experiment_example(D s5)
add_experiment_example(D s6)
add_experiment_example(D s7)
add_experiment_example(D s8)

add_experiment_example(E s1)
add_experiment_example(E s2)
add_experiment_example(E s3)
add_experiment_example(E s4)

add_experiment_example(Ep s1)
add_experiment_example(Ep s2)
add_experiment_example(Ep s3)
add_experiment_example(Ep s4)
