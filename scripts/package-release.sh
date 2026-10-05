#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DIST_DIR="$ROOT_DIR/dist"
RELEASE_DIR="$DIST_DIR/release"
ZIP_PATH="$DIST_DIR/GarageTycoon-v1.0.0.zip"

rm -rf "$DIST_DIR"
mkdir -p "$RELEASE_DIR/assets"

cp "$ROOT_DIR/index.html" "$ROOT_DIR/game.js" "$ROOT_DIR/style.css" "$RELEASE_DIR/"
cp -R "$ROOT_DIR/assets/." "$RELEASE_DIR/assets/"
rm -f "$RELEASE_DIR/assets/ASSET_GUIDE.md" "$RELEASE_DIR/assets/cars/.gitkeep" "$RELEASE_DIR/assets/garages/.gitkeep"

if [[ ! -f "$RELEASE_DIR/index.html" || ! -f "$RELEASE_DIR/game.js" || ! -f "$RELEASE_DIR/style.css" ]]; then
  echo "Release package is missing a required root file."
  exit 1
fi

if find "$RELEASE_DIR" -type f | grep -Eq '/[^/]*[[:space:][:cntrl:]]|/[^/]*[А-Яа-яЁё]'; then
  echo "Release package contains an invalid filename."
  exit 1
fi

if find "$RELEASE_DIR" -type f \( -name '.DS_Store' -o -name 'Thumbs.db' \) | grep -q .; then
  echo "Release package contains an OS metadata file."
  exit 1
fi

(
  cd "$RELEASE_DIR"
  zip -qr "$ZIP_PATH" .
)

SIZE_BYTES="$(stat -c '%s' "$ZIP_PATH")"
echo "Release ZIP: $ZIP_PATH"
echo "Compressed size: $SIZE_BYTES bytes"

if (( SIZE_BYTES > 100000000 )); then
  echo "Release ZIP exceeds Yandex Games archive limit."
  exit 1
fi

unzip -tq "$ZIP_PATH"
if ! unzip -l "$ZIP_PATH" | awk '{print $4}' | grep -qx 'index.html'; then
  echo "index.html is not at the ZIP root."
  exit 1
fi

echo "Release package validation passed."
