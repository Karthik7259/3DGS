# Diff Gaussian Rasterizer Build Test

**Test date:** 2026-11-20  
**Environment:** `3dgs`, `D:\Miniconda\envs\3dgs`  
**Project:** `D:\3DGS-Research\gaussian-splatting`  
**Extension:** `D:\3DGS-Research\gaussian-splatting\submodules\diff-gaussian-rasterization`

## Previous Git status

Before modification:

- Parent repository: `main` tracked `origin/main`
- Parent repository: no uncommitted changes
- Rasterizer submodule: detached at `9c5c2028f6fbee2be239bc4c9421ff894fe4fbe0`
- Rasterizer submodule: no uncommitted changes

No pre-existing user modifications were present.

## Controlled setup.py change

One line was added to the rasterizer `CUDAExtension`:

```python
define_macros=[("USE_CUDA", "1")],
```

The relevant section is now:

```python
CUDAExtension(
    name="diff_gaussian_rasterization._C",
    sources=[
        "cuda_rasterizer/rasterizer_impl.cu",
        "cuda_rasterizer/forward.cu",
        "cuda_rasterizer/backward.cu",
        "rasterize_points.cu",
        "ext.cpp"],
    define_macros=[("USE_CUDA", "1")],
    extra_compile_args={"nvcc": ["-I" + ...]})
```

No CUDA/C++ source file, PyTorch header, other submodule, permanent environment variable, or repository configuration was changed.

## Build environment

The build used:

- Visual Studio 2022 x64 developer environment
- MSVC 19.43.34810
- CUDA Toolkit 12.8.93
- nvcc from `C:\Program Files\NVIDIA GPU Computing Toolkit\CUDA\v12.8\bin\nvcc.exe`
- Windows SDK 10.0.22621.0
- Python `D:\Miniconda\envs\3dgs\python.exe`
- PyTorch 2.11.0+cu128
- `torch.version.cuda == "12.8"`
- `TORCH_CUDA_ARCH_LIST=8.6`
- `DISTUTILS_USE_SDK=1`
- `CUDA_PATH=C:\Program Files\NVIDIA GPU Computing Toolkit\CUDA\v12.8`

The environment variables were set only in the child build process.

## Exact build command

Run from:

```text
D:\3DGS-Research\gaussian-splatting\submodules\diff-gaussian-rasterization
```

```text
python -m pip install --no-build-isolation .
```

## Build result

The build succeeded with process exit code 0.

Pip reported:

```text
Successfully built diff_gaussian_rasterization
Successfully installed diff_gaussian_rasterization-0.0.0
```

Wheel SHA-256:

```text
c9bf52e1e5658038708f634dddb52419974645dc3191b5e54515db4da4c82a11
```

### C2872 resolution

The `C2872: 'std': ambiguous symbol` error **did not recur**. The build reached and completed all extension compilation stages.

## Generated extension

The installed extension binary is:

```text
D:\Miniconda\envs\3dgs\Lib\site-packages\diff_gaussian_rasterization\_C.cp311-win_amd64.pyd
```

The `.pyd` file size is 1,189,888 bytes (1.13 MB).

The package is registered in pip as version `0.0.0`.

## Import and CUDA verification

The reusable test script is:

`D:\3DGS-Research\test_diff_gaussian_rasterization.py`

Test output:

```text
PyTorch: 2.11.0+cu128
CUDA: 12.8
GPU: NVIDIA GeForce RTX 3050 6GB Laptop GPU
CUDA available: True
diff_gaussian_rasterization import: PASS
GaussianRasterizationSettings import: PASS
GaussianRasterizer import: PASS
CUDA tensor operation: PASS
Result device: cuda:0
```

The test exited with code 0.

`python -m pip check` also reported:

```text
No broken requirements found.
```

## Remaining warnings/errors

No build error or C2872 error remains.

The successful build output did not show a source-level warning summary in the captured console output. Earlier failed builds showed:

- nvcc warning about deprecated offline compilation targets earlier than compute/sm/lto_75
- a non-fatal `p_proj` unused-variable warning in `auxiliary.h`

These are retained as previously observed warnings, not newly introduced build failures.

## Git state after test

The rasterizer submodule now has:

```text
M setup.py
```

The only diff is the one-line `USE_CUDA` macro. The parent repository reports the rasterizer submodule as modified.

## Whether the change should remain or be reverted

**Recommended: remain temporarily.**

The macro resolved the concrete C2872 build failure and the extension imported and performed a CUDA tensor operation successfully.

Because this is a downstream workaround rather than a confirmed official upstream fix, the macro should remain only until a patched PyTorch/header or a repository-specific validated alternative is selected.

No changes were made to `simple-knn`, `fused-ssim`, datasets, training code, or unrelated packages.
