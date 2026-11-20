import torch
import torchaudio
import torchvision


def main() -> None:
    print(f"PyTorch version: {torch.__version__}")
    print(f"PyTorch CUDA version: {torch.version.cuda}")
    print(f"CUDA available: {torch.cuda.is_available()}")

    if not torch.cuda.is_available():
        raise RuntimeError("CUDA is not available")

    device = torch.device("cuda")
    print(f"GPU name: {torch.cuda.get_device_name(0)}")
    print(f"GPU capability: {torch.cuda.get_device_capability(0)}")

    left = torch.rand((256, 256), device=device)
    right = torch.rand((256, 256), device=device)
    result = left @ right
    print(f"Matrix result device: {result.device}")
    torch.cuda.synchronize()
    print("CUDA tensor matrix multiplication: successful")

    properties = torch.cuda.get_device_properties(0)
    print(f"Total GPU memory: {properties.total_memory} bytes")
    print(f"Allocated GPU memory: {torch.cuda.memory_allocated(0)} bytes")
    print(f"Reserved GPU memory: {torch.cuda.memory_reserved(0)} bytes")
    print(f"TorchVision version: {torchvision.__version__}")
    print(f"TorchAudio version: {torchaudio.__version__}")


if __name__ == "__main__":
    main()
