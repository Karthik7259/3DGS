import torch
import simple_knn
from simple_knn._C import distCUDA2


def main() -> None:
    print("PyTorch:", torch.__version__)
    print("CUDA:", torch.version.cuda)
    print("GPU:", torch.cuda.get_device_name(0) if torch.cuda.is_available() else "Unavailable")
    print("CUDA available:", torch.cuda.is_available())
    print("simple_knn import: PASS")
    print("simple_knn._C import: PASS")

    if not torch.cuda.is_available():
        raise RuntimeError("CUDA is not available")

    points = torch.tensor(
        [[0.0, 0.0, 0.0], [1.0, 0.0, 0.0], [0.0, 1.0, 0.0], [0.0, 0.0, 1.0]],
        dtype=torch.float32,
        device="cuda",
    )
    distances = distCUDA2(points)
    torch.cuda.synchronize()
    print("distCUDA2 call: PASS")
    print("Distance result device:", distances.device)
    print("Distance result shape:", tuple(distances.shape))


if __name__ == "__main__":
    main()
