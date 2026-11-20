import importlib
import sys
from pathlib import Path


REPOSITORY = Path(r"D:\3DGS-Research\gaussian-splatting")
if str(REPOSITORY) not in sys.path:
    sys.path.insert(0, str(REPOSITORY))


def report(name: str, passed: bool, detail: str = "") -> bool:
    status = "PASS" if passed else "FAIL"
    suffix = f" - {detail}" if detail else ""
    print(f"[{status}] {name}{suffix}")
    return passed


def main() -> int:
    overall_passed = True

    try:
        import torch
        import torchvision
        overall_passed &= report("Python/PyTorch environment", True,
                                  f"Python {sys.version.split()[0]}, PyTorch {torch.__version__}")
        overall_passed &= report("TorchVision", True, torchvision.__version__)
    except Exception as exc:
        overall_passed &= report("Python/PyTorch environment", False, f"{type(exc).__name__}: {exc}")
        return 1

    overall_passed &= report("CUDA availability", torch.cuda.is_available(),
                             f"runtime {torch.version.cuda}")
    if torch.cuda.is_available():
        gpu_name = torch.cuda.get_device_name(0)
        capability = torch.cuda.get_device_capability(0)
        total_memory = torch.cuda.get_device_properties(0).total_memory
        overall_passed &= report("GPU detection", True,
                                 f"{gpu_name}, capability {capability}, "
                                 f"{total_memory / (1024 ** 3):.2f} GiB")

        try:
            left = torch.rand((256, 256), device="cuda")
            right = torch.rand((256, 256), device="cuda")
            tensor_result = left @ right
            torch.cuda.synchronize()
            overall_passed &= report("Basic CUDA tensor operation", True,
                                     f"device={tensor_result.device}")
        except Exception as exc:
            overall_passed &= report("Basic CUDA tensor operation", False,
                                     f"{type(exc).__name__}: {exc}")

    package_checks = [
        ("numpy", "numpy"),
        ("Pillow", "PIL"),
        ("opencv-python", "cv2"),
        ("plyfile", "plyfile"),
        ("tqdm", "tqdm"),
        ("joblib", "joblib"),
    ]
    for package_name, import_name in package_checks:
        try:
            module = importlib.import_module(import_name)
            version = getattr(module, "__version__", "installed")
            overall_passed &= report(package_name, True, str(version))
        except Exception as exc:
            overall_passed &= report(package_name, False,
                                     f"{type(exc).__name__}: {exc}")

    try:
        import matplotlib
        report("matplotlib (optional)", True, matplotlib.__version__)
    except Exception:
        report("matplotlib (optional)", True, "not installed; not required by core 3DGS")

    try:
        import diff_gaussian_rasterization
        from diff_gaussian_rasterization import (
            GaussianRasterizationSettings,
            GaussianRasterizer,
        )
        importlib.import_module("diff_gaussian_rasterization._C")
        overall_passed &= report("diff-gaussian-rasterization imports", True)
    except Exception as exc:
        overall_passed &= report("diff-gaussian-rasterization imports", False,
                                 f"{type(exc).__name__}: {exc}")

    try:
        import simple_knn
        from simple_knn._C import distCUDA2
        points = torch.tensor(
            [[0.0, 0.0, 0.0], [1.0, 0.0, 0.0],
             [0.0, 1.0, 0.0], [0.0, 0.0, 1.0]],
            dtype=torch.float32,
            device="cuda",
        )
        knn_distances = distCUDA2(points)
        torch.cuda.synchronize()
        overall_passed &= report("simple-knn CUDA operation", True,
                                 f"device={knn_distances.device}, "
                                 f"shape={tuple(knn_distances.shape)}")
    except Exception as exc:
        overall_passed &= report("simple-knn CUDA operation", False,
                                 f"{type(exc).__name__}: {exc}")

    try:
        import fused_ssim
        import fused_ssim_cuda
        image1 = torch.rand((1, 3, 32, 32), dtype=torch.float32,
                            device="cuda", requires_grad=True)
        image2 = image1.detach().clone().requires_grad_(True)
        identical = fused_ssim.fused_ssim(image1, image2, train=False)
        train_score = fused_ssim.fused_ssim(image1, image2, train=True)
        train_score.backward()
        torch.cuda.synchronize()
        finite = torch.isfinite(train_score).item()
        overall_passed &= report("fused-ssim forward/backward", True,
                                 f"identical={identical.item():.6f}, "
                                 f"device={train_score.device}, finite={finite}")
    except Exception as exc:
        overall_passed &= report("fused-ssim forward/backward", False,
                                 f"{type(exc).__name__}: {exc}")

    main_modules = [
        "gaussian_renderer",
        "scene",
        "scene.gaussian_model",
        "scene.cameras",
        "scene.dataset_readers",
        "arguments",
        "utils",
        "utils.loss_utils",
        "utils.general_utils",
        "utils.graphics_utils",
    ]
    for module_name in main_modules:
        try:
            importlib.import_module(module_name)
            overall_passed &= report(module_name, True)
        except Exception as exc:
            overall_passed &= report(module_name, False,
                                     f"{type(exc).__name__}: {exc}")

    print("FINAL:", "PASS" if overall_passed else "FAIL")
    return 0 if overall_passed else 1


if __name__ == "__main__":
    raise SystemExit(main())
