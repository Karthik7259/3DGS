# Download Speed Diagnostic

**Diagnostic date:** 2026-11-20  
**Target:** Tanks and Temples — Truck

## Original download URL

The previous and still-valid official Graphdeco URL was:

```text
https://repo-sam.inria.fr/fungraph/3d-gaussian-splatting/datasets/input/tandt_db.zip
```

Server:

```text
Apache
Content-Type: application/zip
Content-Length: 682628995 bytes
Last-Modified: 2023-07-04
Accept-Ranges: bytes
```

The URL is HTTP 200 and valid. It identifies the Graphdeco combined `tandt_db.zip`, not an individual Truck-only ZIP.

## Range and parallel support

HTTP HEAD confirms:

```text
Accept-Ranges: bytes
Content-Length: 682628995
```

A 1024-byte ranged request returned:

```text
HTTP/1.1 206 Partial Content
Content-Range: bytes 0-1023/682628995
Content-Length: 1024
```

Range requests are supported and the server can resume interrupted downloads.

A lightweight 8-way range probe completed successfully:

- 8 concurrent 1 MiB range requests
- 8 successes
- 0 failures
- Aggregate throughput: approximately 0.27 MiB/s

Single-request probes measured approximately:

- 0.093 MiB/s (1 MiB range)
- 0.040–0.065 MiB/s across four independent ranges

These checks show that parallel range requests can add some throughput, but the server is currently a limiting factor. They do not indicate a safe reliable full-download speed above roughly 0.27 MiB/s.

## Partial file state

The previous partial archive remains at:

```text
D:\3DGS-Research\downloads\graphdeco_tandt_db.zip
```

Current partial size:

```text
55,647,645 bytes
53.07 MiB
```

No active curl or aria2 process was found.

The partial file is not a complete ZIP and must not be extracted.

## Download tools

| Tool | Status |
|---|---|
| curl.exe 8.22.0 | Installed |
| aria2c | Not installed |
| wget | Not found |
| winget | Installed |
| Chocolatey | Not found |

WinGet reports the package:

```text
aria2 aria2.aria2 1.37.0
```

aria2 was not installed and no package installation was performed.

## Official dataset alternatives

The official Tanks and Temples website provides a Python downloader that:

- Downloads image sets or videos
- Supports status and MD5 checking
- Uses Google Drive IDs for individual image-set ZIPs
- Includes Truck in the training image-set list

The official Graphdeco aggregate archive remains preferable for this project because it is already preprocessed for 3DGS and avoids separate COLMAP reconstruction.

The browser download and official script both rely on Google Drive or the individual image archive. Browser and official-script methods are less suitable for a direct, verified, resumable aggregate download than curl or aria2.

## Method comparison

### curl

Advantages:

- Installed
- Range/resume supported
- Simple Windows command
- HTTP server is already reached successfully

Disadvantages:

- Probe throughput remains low
- A reset may require retry/resume

### aria2

Advantages:

- Multi-connection range downloads
- Resume support
- Automatic file splitting
- Most appropriate tool for an HTTP server with range support

Disadvantages:

- Not currently installed
- Parallelism did not demonstrate a large aggregate increase in lightweight probes

### Browser

Advantages:

- Usually easy for Graphdeco or Tanks & Temples downloads
- May support a managed client connection

Disadvantages:

- Less auditable
- Resume behavior varies
- Harder to verify exact file and range state

### Official dataset downloader

Advantages:

- Official source
- Downloads the Truck image set only
- Calculates and compares MD5

Disadvantages:

- Uses Google Drive for individual files
- May require browser confirmation
- More complex on Windows
- It would not provide the Graphdeco aggregate `tandt_db.zip`

## Recommended method

Recommended: `aria2c` with 8–16 connections.

This is the best balance of resumability and parallel range support. The probes show range support and modest parallel scaling, but aria2 can automatically retry and preserve resume state.

Installing aria2 itself would not modify Python, Conda, PyTorch, CUDA, or the existing 3DGS environment. It is a separate Windows command-line utility.

No installation was performed.

## Exact future command

After aria2 is installed and explicit approval is given, resume or restart from the intended destination:

```powershell
aria2c `
  --continue=true `
  --max-connection-per-server=8 `
  --split=8 `
  --min-split-size=1M `
  --max-tries=20 `
  --retry-wait=5 `
  --allow-overwrite=true `
  --dir="D:\3DGS-Research\downloads" `
  --out="graphdeco_tandt_db.zip" `
  "https://repo-sam.inria.fr/fungraph/3d-gaussian-splatting/datasets/input/tandt_db.zip"
```

Do not use this command yet.

## Storage

D: free space:

```text
19.51 GB
```

The archive is 651 MiB and enough free space exists for archive plus extraction planning reserve.

## Restrictions respected

No dataset download was started during this diagnostic.

No package was installed.

No source file or dataset directory was modified.

No partial archive was deleted or renamed.

No extraction was performed.
