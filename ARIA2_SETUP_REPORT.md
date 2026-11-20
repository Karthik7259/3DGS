# aria2 Portable Setup Report

**Setup date:** 2026-11-20  
**Project:** `D:\3DGS-Research`

## Download source

Official source:

```text
https://github.com/aria2/aria2/releases/tag/release-1.37.0
```

Official asset:

```text
https://github.com/aria2/aria2/releases/download/release-1.37.0/aria2-1.37.0-win-64bit-build1.zip
```

The package was downloaded directly from the official aria2 GitHub release.

## Package details

- Package: 64-bit Windows portable ZIP
- Version: 1.37.0
- Downloaded package:
  `D:\3DGS-Research\downloads\aria2-1.37.0-win-64bit-build1.zip`
- Package size: 2.36 MB
- ZIP SHA-256:
  `67D015301EEF0B612191212D564C5BB0A14B5B9C4796B76454276A4D28D9B288`
- ZIP integrity: Passed `zipfile.testzip()` with no bad entries

The official package SHA-256 matches the archive hash recorded during setup.

## Installation location

Portable extraction location:

```text
D:\3DGS-Research\tools\aria2
```

Executable:

```text
D:\3DGS-Research\tools\aria2\aria2-1.37.0-win-64bit-build1\aria2c.exe
```

Executable size:

```text
5.39 MB
5649408 bytes
```

No system-wide installer was used and no Windows PATH entry was created.

## Verification

Command:

```text
aria2c.exe --version
```

Verified output:

```text
aria2 version 1.37.0
Copyright (C) 2006, 2019 Tatsuhiro Tsujikawa

** Configuration **
Enabled Features: Async DNS, BitTorrent, Firefox3 Cookie, GZip, HTTPS, Message Digest, Metalink, XML-RPC, SFTP
Hash Algorithms: sha-1, sha-224, sha-256, sha-384, sha-512, md5, adler32
Compiler: mingw-w64 8.0.0 (alpha) / gcc 10-win32 20220113
  built by  x86_64-pc-linux-gnu
  targeting x86_64-w64-mingw32
  on Nov 15 2023 11:17:47
System: Windows 6.2 (x86_64)
```

Verification exit code: 0

## Existing dataset file

The partial dataset file was not modified:

```text
D:\3DGS-Research\downloads\graphdeco_tandt_db.zip
```

Observed file state:

- Size: 53.07 MiB
- Length: 55,647,645 bytes
- Last modified: 2026-11-20 15:33:35

Partial-file SHA-256:

```text
ECAD19EB3E978292F68CB9A2F955707121CBD59FFA6939744E6DAE8FB357220E
```

The partial archive is incomplete and was not extracted.

## Environment integrity

The setup did not modify:

- Python
- Conda
- CUDA
- PyTorch
- TorchVision
- TorchAudio
- Existing Conda environments
- System PATH
- System environment variables

No dataset download was started.
