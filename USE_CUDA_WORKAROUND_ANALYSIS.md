# USE_CUDA Workaround Analysis

**Analysis date:** 2026-11-20  
**Project:** `D:\3DGS-Research`  
**Environment:** `D:\Miniconda\envs\3dgs`  
**Extension:** `D:\3DGS-Research\gaussian-splatting\submodules\diff-gaussian-rasterization`  

**Scope:** Read-only analysis. No compilation, installation, source modification, package modification, PyTorch-header modification, or permanent environment-variable modification was performed.

## Exact PyTorch header guard

In:

```text
D:\Miniconda\envs\3dgs\Lib\site-packages\torch\include\torch\csrc\dynamo\compiled_autograd.h
```

the relevant code is:

```cpp
static at::TypePtr packed_type() {
#if defined(_WIN32) && (defined(USE_CUDA) || defined(USE_ROCM))
  TORCH_CHECK_NOT_IMPLEMENTED(
      false, "torch.compile not supported on Windows");
#else
  if constexpr (::std::is_same_v<T, at::Tensor>) {
    // tensor, integer, boolean, float, and string type checks
  } else if constexpr (::std::is_same_v<T, ::std::string>) {
    return at::StringType::get();
  } else if constexpr (::std::is_same_v<T, at::Device>) {
    return at::DeviceObjType::get();
  } else if constexpr (::std::is_same_v<T, at::Scalar>) {
    return at::NumberType::get();
  } else {
    static_assert(
        false,
        "IValue types containing std::string are not supported yet");
  }
#endif
}
```

The comment above the guard says compiled autograd is intentionally unsupported on Windows under CUDA/ROCm. The guard is intended to replace the `if constexpr` chain with `TORCH_CHECK_NOT_IMPLEMENTED(...)` for Windows CUDA/ROCm builds.

## Why the current build misses the guard

The generated Ninja command passed:

- `-DTORCH_API_INCLUDE_EXTENSION_H`
- `-DTORCH_EXTENSION_NAME=_C`
- CUDA and PyTorch include directories

It did not pass `USE_CUDA`.

The macro probe in upstream PyTorch issue #173232 also found:

```text
_WIN32       = defined
__CUDACC__   = defined
USE_CUDA     = undefined
USE_ROCM     = undefined
```

Therefore, for downstream PyTorch CUDA extensions on Windows:

```cpp
defined(_WIN32) && (defined(USE_CUDA) || defined(USE_ROCM))
```

was false in the observed build. The compiler then processed the `if constexpr` chain and attempted to resolve `::std::string`, which triggers C2872 under nvcc/MSVC template instantiation.

## Effect of defining `USE_CUDA`

Defining `USE_CUDA=1` for both the CUDA and C++ compilation units would make the guard true on Windows:

```cpp
#if defined(_WIN32) && (defined(USE_CUDA) || defined(USE_ROCM))
```

This removes the `if constexpr` chain from the branch and returns `TORCH_CHECK_NOT_IMPLEMENTED(...)` instead.

For this specific header, the effect is:

- `IValuePacker<T>::packed_type()` does not compile the problematic `::std::string` specialization branch.
- The ambiguous namespace expression is bypassed by preprocessing.
- The compiled-autograd path may report the existing “torch.compile not supported on Windows” runtime check if called.

It does not install CUDA or alter the CUDA runtime.

## Safest extension-only implementation if approved

The safest mechanism is a build macro scoped to this extension rather than a process-wide permanent environment variable.

Recommended setup form:

```python
CUDAExtension(
    name="diff_gaussian_rasterization._C",
    sources=[...],
    define_macros=[("USE_CUDA", "1")],
    extra_compile_args={
        "nvcc": ["-I" + os.path.join(...)]
    }
)
```

Setuptools forwards `define_macros` to both host and CUDA compilation. In this build, nvcc should receive a CUDA-side macro such as `-DUSE_CUDA=1`, and MSVC should receive its corresponding `/DUSE_CUDA=1`.

An environment-only equivalent for a child build shell would be:

```text
set USE_CUDA=1
```

but that is not the most targeted mechanism. An environment variable named `USE_CUDA` is inherited broadly and could affect all processes in that child shell. `define_macros` is better scoped to the rasterizer's `CUDAExtension`.

No source modification is necessary, but `setup.py` would have to receive this temporary build-specific macro. The current task explicitly forbids modifying it during this analysis.

## Effects on Graphdeco

### CUDA compilation

Defining `USE_CUDA` should not change the CUDA compute architecture or reduce support for the RTX 3050. It is a preprocessor macro affecting PyTorch headers and potentially other CUDA-header branches.

### PyTorch extension behavior

The macro tells headers to use the CUDA configuration branch in code guarded by `USE_CUDA`. Many PyTorch C10/CUDA headers already use this macro, but the macro is ordinarily associated with a CUDA build.

The current wheel's `caffe2/core/macros.h` records the installed wheel as:

```text
USE_CUDA = ON
USE_ROCM = OFF
CUDA_VERSION = 12.8
```

This makes `USE_CUDA=1` semantically consistent with the installed PyTorch wheel.

### Rasterizer functionality

The diff-gaussian-rasterizer does not use `torch.compile` or PyTorch compiled-autograd's `IValuePacker` behavior. The `TORCH_CHECK_NOT_IMPLEMENTED` branch is inside the header's compiled-autograd support code.

Likely runtime impact on rasterization is therefore:

- No direct effect on the Gaussian forward/backward CUDA kernels
- No direct effect on GLM or rasterizer buffers
- No direct effect on Gaussian rasterization settings or rendering
- No direct effect on the normal tensor APIs used by the extension

However, this must be treated as a build workaround until it is verified. `USE_CUDA` is broad enough to affect unrelated PyTorch headers; it is not guaranteed to be inert outside the exact guard.

### Other source files

The macro would be passed to all source files in this one `CUDAExtension`, including:

- `ext.cpp`
- `rasterize_points.cu`
- `forward.cu`
- `backward.cu`
- `rasterizer_impl.cu`

It should not change Graphdeco kernels unless one of the included headers changes behavior based on `USE_CUDA`.

### Runtime behavior

No direct expected runtime change was found for the rasterizer itself. The only explicit runtime branch found in `compiled_autograd.h` disables compiled autograd on Windows CUDA builds.

Graphdeco 3DGS training does not depend on compiled autograd by inspection of the extension and repository setup.

## Evidence from upstream reports

### PyTorch issue #173232

PyTorch issue #173232 is specifically about:

- Graphdeco `simple-knn`
- PyTorch 2.11.0+cu128
- Windows
- `compiled_autograd.h`
- C2872 on `::std::string`

The issue analysis explicitly identifies downstream users passing `-DUSE_CUDA` as a workaround.

The issue remains open and no official patched PyTorch release or merge was confirmed by this analysis.

### PyTorch issue #148317

PyTorch issue #148317 reports the same C2872 pattern in PyTorch CUDA extensions on Windows.

The upstream comments point to using `USE_CUDA` for CUDA extensions to avoid compiling the problematic branch.

### PyTorch `extension-cpp` pull request #128

An open downstream PR for `pytorch/extension-cpp` explicitly states:

> “I followed the suggestion ... and added flag `-DUSE_CUDA=1` to nvcc.”

It reports that this fixes the C2872 build issue for:

- Windows 11
- PyTorch 2.11
- CUDA extension compilation

This is direct evidence that `-DUSE_CUDA=1` resolves the same header pattern in a downstream CUDA extension. It is not an official PyTorch mainline fix, and the PR itself is for the sample extension repository.

### Official upstream fix status

No confirmed official patched PyTorch wheel or merged upstream fix was identified by the available issue and PR evidence.

The upstream issue discussion also contains a proposed source fix:

- Remove the primary-template `else if constexpr (::std::is_same_v<T, ::std::string>)` branch
- Add an explicit `IValuePacker<std::string>` specialization

That fix is more semantically explicit but requires modifying the installed PyTorch header or waiting for an upstream fix.

No official release containing that fix could be verified.

## Safety classification

| Classification | Assessment |
|---|---|
| Legitimacy | **Legitimate targeted build workaround** |
| Scope | Temporary and extension-build specific |
| Rasterizer risk | **Low for this source**, because the guard addresses compiled-autograd support |
| PyTorch-header risk | Moderate, because `USE_CUDA` can activate other CUDA branches |
| Official support status | Unsupported upstream workaround unless maintained by a future PyTorch build fix |
| Likelihood of resolving C2872 | **High** for the exact reproduced branch |
| Recommended as first change | Reasonable temporary workaround, lower-risk than editing headers or downgrading PyTorch |

## Alternative approaches

1. **Upstream-patched PyTorch wheel**

   Wait for or verify a PyTorch release whose `compiled_autograd.h` contains the string specialization fix and does not require downstream macros.

2. **Environment-aligned PyTorch 2.0/PyTorch 2.1 build**

   Use a repository-compatible PyTorch 2.0 or 2.1 CUDA 12 build, but only after verifying a compatible Windows wheel and C++ extension ABI.

3. **Repository historical environment**

   Use Python 3.7/PyTorch 1.12.1/CUDA 11.8/Visual Studio 2019 in a separate environment. This is historically closer to the repository but not the current environment.

4. **PyTorch-header patch**

   Modify or replace the installed header with the upstream proposed specialization fix. It is more direct but changes third-party installed code and should not be used as the first action.

5. **Compiler downgrade or permissive workaround**

   No confirmed fix and no existing evidence that `/permissive` or another compiler flag is safer than `USE_CUDA`.

## Recommended implementation

If a build-specific workaround is accepted:

1. Add `define_macros=[("USE_CUDA", "1")]` only to the rasterizer `CUDAExtension`.
2. Keep `DISTUTILS_USE_SDK=1`.
3. Keep `TORCH_CUDA_ARCH_LIST=8.6`.
4. Keep `CUDA_PATH` pointed to CUDA Toolkit 12.8.
5. Do not use `--allow-unsupported-compiler`.
6. Compile only `diff-gaussian-rasterization`.

The recommended form is safer than a permanent `USE_CUDA` environment variable because it scopes the macro to the extension build.

No build was run and no code was changed by this analysis.

## Final assessment

Defining `USE_CUDA` is a **legitimate, targeted temporary workaround** with direct upstream/downstream evidence for the same C2872 error.

It is likely to prevent the problematic branch from reaching nvcc/MSVC template instantiation and has low direct risk to Graphdeco rasterizer kernels. It is not an official upstream fix, and the macro can affect other PyTorch CUDA-header branches.

Before changing the repository setup, verify the exact upstream fix status and build implementation policy. If no official fixed PyTorch wheel is available, `USE_CUDA=1` through `define_macros` is the safer temporary workaround than modifying PyTorch headers or changing CUDA/MSVC versions.
