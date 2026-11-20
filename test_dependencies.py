import importlib
import sys
from pathlib import Path


REPOSITORY = Path(r"D:\3DGS-Research\gaussian-splatting")
if str(REPOSITORY) not in sys.path:
    sys.path.insert(0, str(REPOSITORY))


PACKAGES = [
    ("torch", "torch"),
    ("torchvision", "torchvision"),
    ("torchaudio", "torchaudio"),
    ("numpy", "numpy"),
    ("Pillow", "PIL"),
    ("opencv-python", "cv2"),
    ("plyfile", "plyfile"),
    ("tqdm", "tqdm"),
    ("joblib", "joblib"),
    ("lpipsPyTorch", "lpipsPyTorch"),
]


def main() -> None:
    all_passed = True

    for package_name, import_name in PACKAGES:
        try:
            module = importlib.import_module(import_name)
            version = getattr(module, "__version__", "installed")
            print(f"{package_name}: PASS ({version})")
        except Exception as exc:
            all_passed = False
            print(f"{package_name}: FAIL ({type(exc).__name__}: {exc})")

    torch = importlib.import_module("torch")
    print(f"PyTorch: {torch.__version__}")
    cuda_available = torch.cuda.is_available()
    print(f"CUDA available: {cuda_available}")
    if cuda_available:
        print(f"GPU name: {torch.cuda.get_device_name(0)}")
    else:
        all_passed = False
        print("GPU name: unavailable")

    if all_passed:
        print("Overall dependency test: PASS")
    else:
        print("Overall dependency test: FAIL")
        raise SystemExit(1)


if __name__ == "__main__":
    main()
