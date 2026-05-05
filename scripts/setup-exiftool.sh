#!/usr/bin/env bash
# scripts/setup-exiftool.sh
# Downloads ExifTool binary for bundling with the Electron app.
# Run once before building: bash scripts/setup-exiftool.sh

set -e

DEST="public/exiftool"
mkdir -p "$DEST"

OS="$(uname -s)"

if [ "$OS" = "Darwin" ]; then
  echo "→ macOS detected. Installing ExifTool via Homebrew..."
  if ! command -v exiftool &>/dev/null; then
    brew install exiftool
  fi
  EXIF_PATH="$(which exiftool)"
  cp "$EXIF_PATH" "$DEST/exiftool"
  chmod +x "$DEST/exiftool"
  echo "✓ Copied exiftool to $DEST/exiftool"

elif [ "$OS" = "Linux" ]; then
  echo "→ Linux detected. Installing via apt..."
  sudo apt-get install -y libimage-exiftool-perl
  EXIF_PATH="$(which exiftool)"
  cp "$EXIF_PATH" "$DEST/exiftool"
  chmod +x "$DEST/exiftool"
  echo "✓ Copied exiftool to $DEST/exiftool"

else
  echo "→ Windows: Please download ExifTool from https://exiftool.org"
  echo "  Rename exiftool(-k).exe to exiftool.exe"
  echo "  Place it in: public/exiftool/exiftool.exe"
fi

echo ""
echo "Done. ExifTool is ready for bundling."
