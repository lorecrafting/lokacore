#!/bin/sh
# Rebuild a compiled known-answer fixture ({description, canonical, sha256}) from its cartridge source
# (loka-kjky): mix loka.compile, then the artifact's canonical bytes and content hash go into the
# fixture; the description is kept. Refuses a fixture of any other shape (sampler fixtures also
# carry `value`) and an artifact whose hash is not the sha256 of its canonical bytes.
#   bin/regen_hash_fixture.sh <cartridge dir> <fixture>
# LOKA_COMPILED=<artifact> skips the compile (tests).
set -eu
[ $# = 2 ] || { echo "usage: $0 <cartridge dir> <fixture>" >&2; exit 2; }
art=${LOKA_COMPILED-}
if [ -z "$art" ]; then
  art=$(mktemp) && trap 'rm -f "$art"' EXIT
  mise exec -- mix loka.compile "$1" "$art" > /dev/null
fi
python3 - "$art" "$2" <<'PY'
import hashlib, json, re, sys
raw = open(sys.argv[1], 'rb').read()
# Sliced as bytes: a JSON round trip could reorder keys or rewrite numbers and escapes.
m = re.fullmatch(rb'\{"cartridge":(.*),"content_hash":"([0-9a-f]{64})"\}\n?', raw, re.S)
if not m: sys.exit('regen_hash_fixture: artifact is not {"cartridge":...,"content_hash":"<sha256>"}')
canon, sha = m[1], m[2].decode()
if hashlib.sha256(canon).hexdigest() != sha: sys.exit('regen_hash_fixture: content_hash is not the sha256 of the canonical bytes')
fix = json.load(open(sys.argv[2], encoding='utf-8'))
if list(fix) != ['description', 'canonical', 'sha256']: sys.exit('regen_hash_fixture: fixture keys are not description, canonical, sha256')
fix.update(canonical=canon.decode('utf-8'), sha256=sha)
open(sys.argv[2], 'w', encoding='utf-8').write(json.dumps(fix, indent=2, ensure_ascii=False) + '\n')
PY
