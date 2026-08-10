# NDI SDK headers (vendored)

Official NDI SDK v6 C headers, used to build `src/ndi_capture.c` on macOS
(and any host without the NDI SDK installed system-wide).

- SDK version: **v6.3.0.3** (NDI 2026-01-21, git-43259a87)
- Upstream source: NDI SDK v6 (https://ndi.video/for-developers/ndi-sdk), redistributed per-file MIT license
- Mirrored from: https://github.com/DistroAV/DistroAV/tree/master/lib/ndi

Runtime dependency: `libndi.dylib` (install via `brew install --cask libndi`),
matched to the same SDK major version (6).

To update: replace the `Processing.NDI.*.h` files from the mirror above and bump the
version line. The Docker build is unaffected — it downloads its own SDK v6 from
downloads.ndi.tv in the Dockerfile.
