import torch
import diff_gaussian_rasterization
from diff_gaussian_rasterization import GaussianRasterizationSettings
from diff_gaussian_rasterization import GaussianRasterizer


def main() -> None:
    print("PyTorch:", torch.__version__)
    print("CUDA:", torch.version.cuda)
    print("GPU:", torch.cuda.get_device_name(0) if torch.cuda.is_available() else "Unavailable")
    print("CUDA available:", torch.cuda.is_available())
    print("diff_gaussian_rasterization import: PASS")
    print("GaussianRasterizationSettings import: PASS")
    print("GaussianRasterizer import: PASS")

    if not torch.cuda.is_available():
        raise RuntimeError("CUDA is not available")

    left = torch.rand((128, 128), device="cuda")
    right = torch.rand((128, 128), device="cuda")
    result = left @ right
    torch.cuda.synchronize()
    print("CUDA tensor operation: PASS")
    print("Result device:", result.device)


if __name__ == "__main__":
    main()
