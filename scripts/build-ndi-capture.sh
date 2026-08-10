#!/bin/sh
# Builds src/ndi_capture.c against the local NDI SDK (libndi.dylib).
# Usage: ./scripts/build-ndi-capture.sh
set -e

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
INCLUDE_DIR="$ROOT_DIR/vendor/ndi"
OUT_BIN="${NDI_CAPTURE_OUT:-$ROOT_DIR/bin/ndi_capture}"

if [ -n "$NDI_LIB" ]; then
  NDI_LIB_PATH="$NDI_LIB"
elif [ -n "$(command -v brew)" ] && [ -f "$(brew --prefix 2>/dev/null)/lib/libndi.dylib" ]; then
  NDI_LIB_PATH="$(brew --prefix)/lib/libndi.dylib"
elif [ -f "/usr/local/lib/libndi.dylib" ]; then
  NDI_LIB_PATH="/usr/local/lib/libndi.dylib"
elif [ -f "/usr/local/lib/libndi.so" ]; then
  NDI_LIB_PATH="/usr/local/lib/libndi.so"
elif [ -f "/usr/lib/libndi.so" ]; then
  NDI_LIB_PATH="/usr/lib/libndi.so"
else
  NDI_LIB_PATH="/usr/local/lib/libndi.dylib"
fi

CC="${CC:-clang}"

if [ ! -f "$NDI_LIB_PATH" ]; then
  echo "NDI SDK library not found at $NDI_LIB_PATH (install via: brew install --cask libndi)" >&2
  exit 1
fi

mkdir -p "$(dirname "$OUT_BIN")"

$CC -O2 -I"$INCLUDE_DIR" "$ROOT_DIR/src/ndi_capture.c" "$NDI_LIB_PATH" -Wl,-rpath,"$(dirname "$NDI_LIB_PATH")" -o "$OUT_BIN"
echo "Built $OUT_BIN"
