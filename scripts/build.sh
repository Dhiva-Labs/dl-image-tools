#!/usr/bin/env bash
# Build script for DL Image Tools.
# Produces dist/dl-image-tools/ (unpacked extension) and
# dist/dl-image-tools-v<version>.zip (Chrome Web Store upload artifact).
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIST_DIR="${ROOT_DIR}/dist"
PKG_NAME="dl-image-tools"
STAGE_DIR="${DIST_DIR}/${PKG_NAME}"

cd "${ROOT_DIR}"

if [ ! -f manifest.json ]; then
  echo "error: manifest.json not found at ${ROOT_DIR}" >&2
  exit 1
fi

# Resolve the extension version straight out of manifest.json (no jq dependency assumed).
VERSION="$(
  python3 -c "import json; print(json.load(open('manifest.json'))['version'])" 2>/dev/null \
    || node -e "console.log(JSON.parse(require('fs').readFileSync('manifest.json','utf8')).version)"
)"

if [ -z "${VERSION}" ]; then
  echo "error: could not determine version from manifest.json" >&2
  exit 1
fi

echo "==> Building DL Image Tools v${VERSION}"

echo "==> Cleaning ${DIST_DIR}"
rm -rf "${DIST_DIR}"
mkdir -p "${STAGE_DIR}"

echo "==> Copying manifest.json, src/, public/"
cp manifest.json "${STAGE_DIR}/"
cp -R src "${STAGE_DIR}/src"
cp -R public "${STAGE_DIR}/public"

echo "==> Pruning dev-only files from the staged build"
# Defensive: remove anything dev/test/doc/tooling related that might have been
# nested inside src/ or public/, plus the top-level dev-only entries.
rm -rf \
  "${STAGE_DIR}/dev" \
  "${STAGE_DIR}/tests" \
  "${STAGE_DIR}/docs" \
  "${STAGE_DIR}/scripts" \
  "${STAGE_DIR}/package.json"
find "${STAGE_DIR}" -type d \( -name dev -o -name tests -o -name docs -o -name scripts -o -name '.git' \) -prune -exec rm -rf {} +
find "${STAGE_DIR}" -type f -name '*.md' -delete
find "${STAGE_DIR}" -type f -name 'package.json' -delete
find "${STAGE_DIR}" -type f -name '.DS_Store' -delete

if [ -e "${STAGE_DIR}/.git" ]; then
  echo "error: .git leaked into the staged build" >&2
  exit 1
fi

echo "==> Creating zip archive"
ZIP_NAME="${PKG_NAME}-v${VERSION}.zip"
(
  cd "${DIST_DIR}"
  rm -f "${ZIP_NAME}"
  zip -r -X "${ZIP_NAME}" "${PKG_NAME}" -x '*.DS_Store' >/dev/null
)

ZIP_PATH="${DIST_DIR}/${ZIP_NAME}"
ZIP_SIZE="$(du -h "${ZIP_PATH}" | cut -f1)"

echo "==> Build complete"
echo "    Unpacked: ${STAGE_DIR}"
echo "    Archive:  ${ZIP_PATH} (${ZIP_SIZE})"
