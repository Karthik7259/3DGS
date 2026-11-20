# PyTorch/CUDA Compatibility Diagnostic

**Diagnostic date:** 2026-11-20  
**Project:** `D:\3DGS-Research`  
**Repository:** `D:\3DGS-Research\gaussian-splatting`  
**Extension:** `D:\3DGS-Research\gaussian-splatting\submodules\diff-gaussian-rasterization`  
**Scope:** Read-only diagnosis. No source or package changes, no compilation, and no installation actions were performed.

## Error summary

The build reaches real source compilation and fails while compiling `rasterize_points.cu`:

```text
D:\Miniconda\envs\3dgs\Lib\site-packages\torch\include\torch\csrc\dynamo\compiled_autograd.h(1143):
error C2872: 'std': ambiguous symbol
```

MSVC reports both candidates:

1. `std` from MSVC's standard library, evidenced by `fstream(20)`
2. `std` in `torch/csrc/dynamo/compiled_autograd.h`

The template instantiation context starts in `IValuePacker<__int64>::packed_type()` and then instantiates `IValuePacker<unsigned __int64>`.

This is a PyTorch Windows/CUDA-extension header issue exposed while nvcc sends the source through MSVC. It is not evidence of an unsupported CUDA architecture or a missing CUDA compiler.

## Exact source line

The failing expression is line 1143:

```cpp
} else if constexpr (::std::is_same_v<T, ::std::string>) {
  return at::StringType::get();
```

The primary template contains:

```cpp
static at::TypePtr packed_type() {
  // On windows CPU is support compiled autograd.
#if defined(_WIN32) && (defined(USE_CUDA) || defined(USE_ROCM))
  TORCH_CHECK_NOT_IMPLEMENTED(
      false, "torch.compile not supported on Windows");
#else
  if constexpr (::std::is_same_v<T, at::Tensor>) {
    return at::TensorType::get();
  } else if constexpr (::std::is_same_v<T, int64_t>) {
    return at::IntType::get();
  } else if constexpr (::std::is_same_v<T, c10::SymInt>) {
    return at::SymIntType::get();
  } else if constexpr (::std::is_same_v<T, bool>) {
    return at::BoolType::get();
  } else if constexpr (::std::is_same_v<T, double>) {
    return at::FloatType::get();
  } else if constexpr (::std::is_same_v<T, c10::SymFloat>) {
    return at::SymFloatType::get();
  } else if constexpr (::std::is_same_v<T, c10::SymBool>) {
    return at::SymBoolType::get();
  } else if constexpr (::std::is_same_v<T, c10::Layout>) {
    return at::LayoutType::get();
  } else if constexpr (::std::is_same_v<T, ::std::string>) {
    return at::StringType::get();
  } else if constexpr (::std::is_same_v<T, at::Device>) {
    return at::DeviceObjType::get();
  } else {
    return at::StringType::get();
  }
#endif
}
```

The header is instantiated for `IValuePacker<__int64>` and `IValuePacker<unsigned __int64>` even though this extension is not using compiled autograd. The Windows guard is intended to stop the `if constexpr` chain from compiling, but it depends on `USE_CUDA` or `USE_ROCM` being defined.

## Header include context

At the top of `compiled_autograd.h`, the relevant includes are:

```cpp
#include <ATen/TensorGeometry.h>
#include <ATen/core/ivalue.h>
#include <c10/core/impl/TorchDispatchModeTLS.h>
#include <c10/util/flat_hash_map.h>
#include <torch/csrc/autograd/function.h>
#include <torch/csrc/autograd/input_metadata.h>
#include <torch/csrc/autograd/saved_variable.h>
#include <torch/csrc/autograd/variable_info.h>
#include <torch/csrc/utils/python_stub.h>
#include <torch/csrc/utils/torch_dispatch_mode.h>
#include <typeindex>
#include <vector>
```

The header defines:

```cpp
namespace torch::dynamo::autograd {
using namespace torch::autograd;
```

It does not explicitly include `<string>` in the inspected header preamble, although other included headers may expose it.

The trigger is not missing inclusion of `std::string` alone: upstream discussion records that adding `<type_traits>` or `<string>` did not eliminate this specific nvcc/MSVC ambiguity.

## Extension source context

`rasterize_points.cu` includes:

```cpp
#include <math.h>
#include <torch/extension.h>
#include <cstdio>
#include <sstream>
#include <iostream>
#include <tuple>
#include <stdio.h>
#include <cuda_runtime_api.h>
#include <memory>
#include "cuda_rasterizer/config.h"
#include "cuda_rasterizer/rasterizer.h"
#include <fstream>
#include <string>
#include <functional>
```

The include order first loads `torch/extension.h`, then the CUDA/runtime/rasterizer headers, and later loads `<fstream>` and `<string>`. This is not a normal repository-level namespace declaration; the issue appears while instantiating a PyTorch template.

The repository source contains no `using namespace std` declaration that explains the conflict. The GLM submodule does contain namespace-related declarations in `glm/detail/setup.hpp`, but those are scoped under `glm::std` or use explicit `std` imports and do not create an observed global namespace named `std`.

The source also does not define `USE_CUDA`.

## Complete compiler context

The failing Ninja command was:

```text
nvcc -MD -MF rasterize_points.obj.d
  -std=c++17
  -Xcompiler /MD
  -Xcompiler /EHsc
  --use-local-env
  -Xcudafe --diag_suppress=...
  -ID:\Miniconda\envs\3dgs\Lib\site-packages\torch\include
  -ID:\Miniconda\envs\3dgs\Lib\site-packages\torch\include\torch\csrc\api\include
  -IC:\Program Files\NVIDIA GPU Computing Toolkit\CUDA\v12.8\include
  -ID:\Miniconda\envs\3dgs\include
  -IC:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Tools\MSVC\14.43.34808\include
  -I<Windows 10.0.22621.0 SDK include directories>
  -ID:\3DGS-Research\gaussian-splatting\submodules\diff-gaussian-rasterization\third_party\glm
  -DTORCH_API_INCLUDE_EXTENSION_H
  -DTORCH_EXTENSION_NAME=_C
  -c rasterize_points.cu
  -o rasterize_points.obj
```

The generated command:

- Uses C++17
- Uses x64 MSVC through nvcc
- Includes PyTorch and CUDA 12.8 headers
- Includes the extension GLM headers
- Does not contain `--allow-unsupported-compiler`
- Does not contain `-DUSE_CUDA`
- Does not contain a source-level namespace workaround

The relevant error context is:

```text
candidate: MSVC fstream's namespace std
candidate: std in torch/csrc/dynamo/compiled_autograd.h
instantiated from IValuePacker<__int64>
instantiated from IValuePacker<unsigned __int64>
ninja: build stopped: subcommand failed
```

## Root-cause assessment

### Most likely: PyTorch 2.11 Windows CUDA-header interaction

Evidence favors a PyTorch header/Windows nvcc interaction:

- The source location is a PyTorch template, not a rasterizer implementation.
- The error is C2872 on `::std::string`/`std::is_same_v`.
- The header guard intended to avoid this code on Windows CUDA builds is false unless `USE_CUDA` or `USE_ROCM` is defined.
- The generated extension build command does not define `USE_CUDA`.
- The same `C2872` pattern has been reported against PyTorch Windows CUDA extension builds.
- It has also been reproduced in simple-knn, another Graphdeco 3DGS submodule.

This is therefore a concrete upstream/packaging compatibility defect or nvcc/MSVC interaction, not a random include problem.

### MSVC 19.43

MSVC may expose the ambiguity, but it is not the only trigger. It is consistent with reports against recent MSVC 14.43/14.42 toolsets and is especially triggered while nvcc instantiates PyTorch templates.

CUDA 12.8's host compiler range includes this MSVC toolset; the compiler check is not showing an unsupported-MSVC-VS2022 error.

### CUDA 12.8 / PyTorch interaction

CUDA 12.8 and this PyTorch CUDA 12.8 wheel interact through the generated nvcc/MSVC command. The failing header is from PyTorch, not from CUDA 12.8.

There is no evidence that compute capability 8.6 or the RTX 3050 is involved.

### Include order

Include order is potentially relevant to how nvcc sees namespace declarations, but it does not explain the underlying defect:

- The problematic branch exists in a PyTorch header.
- It is always-instantiated under the generated extension macros.
- Removing or adding an isolated standard header was not reported as a reliable fix.

### Known upstream issue

Evidence was found for PyTorch issues:

- PyTorch issue #148317, reported March 2025, has the same C2872 pattern in `compiled_autograd.h` under Windows + CUDA.
- PyTorch issue #173232, opened January 2026, specifically reports the same `std::string` branch while compiling Graphdeco `simple-knn`.

Issue #173232 identifies the exact installed branch and reproduces it with PyTorch 2.11.0+cu128. It is open/under investigation; no confirmed fixed packaged wheel was established.

## Graphdeco repository compatibility

The repository's official `environment.yml` pins:

- Python 3.7.13
- PyTorch 1.12.1
- TorchVision 0.13.1
- TorchAudio 0.12.1
- Conda `cudatoolkit=11.6`
- pip 22.3.1

The README says the repository was developed with CUDA 11 and lists CUDA SDK 11.8 as its known working configuration, with Visual Studio 2019.

The same README says limited experiments suggest:

- Python 3.8
- PyTorch 2.0.0
- CUDA 12

may work, but this is explicitly described as limited and not a Windows guarantee.

Conclusion:

- PyTorch 2.11.0 is newer than the repository's supported/tested project environment.
- The repository does not document PyTorch 2.11 or CUDA 12.8 as an officially supported build configuration.
- CUDA 12.8/Python 3.11/MSVC 2022 are viable in principle, but the current PyTorch 2.11 header is demonstrably problematic on this Windows nvcc/MSVC path.
- A PyTorch version/change to align closer with the repository is likely necessary unless a downstream build macro/workaround is confirmed.

## Possible solutions ranked by safety

### 1. Create a repository-compatible environment and use PyTorch 2.0 or 2.1 with CUDA 12

Safest project-level route:

- Use Python 3.8 or another repository-compatible Python version.
- Use PyTorch 2.0.x with CUDA 12.x or PyTorch 2.1.x with CUDA 12.1, if available for Windows/Python 3.11.
- Keep one CUDA runtime/SDK major version aligned with PyTorch.
- Reuse Visual Studio 2022 and CUDA 12.8 only if the selected PyTorch wheel and extension build are mutually compatible.

Avoid the original Conda environment file's Python/PyTorch/CUDA 11.6 combination in the existing environment because it would replace the verified setup.

### 2. Use the official Graphdeco CUDA 11.8 / PyTorch 1.12 environment

Very well aligned with the repository:

- Python 3.7 or 3.8
- PyTorch 1.12.x
- CUDA 11.8
- Visual Studio 2019

This is likely the most reproducible historical environment but is not the current environment and would require new versions, a separate environment, or a system Toolkit change.

It is a safer compatibility match than patching PyTorch or the extension source.

### 3. Define `USE_CUDA` in the downstream extension build

This is a plausible targeted workaround supported by upstream issue discussion:

- It would make the Windows guard fire:

```cpp
#if defined(_WIN32) && (defined(USE_CUDA) || defined(USE_ROCM))
```

- It would prevent the problematic `if constexpr (::std::is_same_v<T, ::std::string>)` branch from being compiled.

It has not been established as the Graphdeco-supported build configuration, and it would require a build-flags or setup configuration change. It should not be applied until an exact build test plan is approved.

### 4. Use an older, already-known PyTorch CUDA 12 wheel

A tested PyTorch 2.0 wheel matching CUDA 12.1 could reduce header risk, but it also requires package and runtime alignment.

It is safer than modifying headers, but less reproducible than the repository's original pinned versions.

### 5. Patch PyTorch headers or add a specialization

Not recommended:

- Modifies installed third-party headers.
- The official upstream issue describes workarounds but no complete confirmed fix.
- An explicit specialization or removing the `std::string` branch can alter template behavior or only move the failure.
- It would also need to be repeated across environments and package reinstalls.

### 6. Downgrade MSVC or CUDA 12.8

Lower risk than source/header patching, but uncertain:

- MSVC 2019 is repository-aligned.
- CUDA 11.8 is repository-aligned.
- A VS2022/MSVC-only downgrade would still leave PyTorch 2.11 and may not address the header bug.

### 7. `--allow-unsupported-compiler`

Not recommended and explicitly excluded.

- It bypasses compiler support checks.
- It does not address the namespace ambiguity.
- It can allow link/runtime defects or incorrect code generation.

## Recommended next step

The safest evidence-based next step is to prepare a separate repository-compatible environment rather than patching the PyTorch installation or extension source.

Preferred order:

1. Use PyTorch 2.0.x/CUDA 12.1 or 2.1.x/CUDA 12.1 in a dedicated environment if a compatible Python 3.11 build is required.
2. If CUDA 12.1 compatibility is not required, use the repository's historical Python 3.7/PyTorch 1.12.1/CUDA 11.8/VS2019 combination in a separate environment.
3. Before changing packages, confirm that a selected PyTorch wheel has CUDA headers without this exact `compiled_autograd.h` branch or reproduce only the upstream macro behavior in a diagnostic build.

The current PyTorch 2.11.0+cu128 setup is not confirmed compatible with this Windows extension build. A PyTorch version change is likely necessary unless the targeted `USE_CUDA` build-macro workaround is verified.
