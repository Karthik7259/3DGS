import torch
import fused_ssim
import fused_ssim_cuda


def main() -> None:
    print("PyTorch:", torch.__version__)
    print("CUDA:", torch.version.cuda)
    print("GPU:", torch.cuda.get_device_name(0) if torch.cuda.is_available() else "Unavailable")
    print("CUDA available:", torch.cuda.is_available())
    print("fused_ssim import: PASS")
    print("fused_ssim_cuda import: PASS")

    if not torch.cuda.is_available():
        raise RuntimeError("CUDA is not available")

    image1 = torch.rand((1, 3, 64, 64), dtype=torch.float32, device="cuda", requires_grad=True)
    image2 = image1.detach().clone().requires_grad_(True)

    identical_score = fused_ssim.fused_ssim(image1, image2, train=False)
    print("Identical SSIM:", identical_score.item())

    score = fused_ssim.fused_ssim(image1, image2, train=True)
    score.backward()
    torch.cuda.synchronize()

    print("SSIM result device:", score.device)
    print("SSIM finite:", torch.isfinite(score).item())
    print("SSIM range 0-to-1:", bool((score >= -1e-5).item() and (score <= 1.00001).item()))
    print("Backward pass: PASS")
    print("Gradient finite:", torch.isfinite(image1.grad).all().item())


if __name__ == "__main__":
    main()
