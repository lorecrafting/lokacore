#!/usr/bin/env python3
"""The sound manifest (effects-and-sound-plan.md section 14). A push fails if a bundled audio file
has no row, a row has no file, a required field is empty, or a licence is one we may not ship.
--report lists the placeholders by use. --release also fails while any placeholder remains."""
import json
import sys
from pathlib import Path

ROOT = Path(sys.argv[sys.argv.index("--root") + 1]) if "--root" in sys.argv else Path(__file__).parent.parent
SOUNDS = ROOT / "mobile/app/book/sounds"
AUDIO = {".m4a", ".mp3", ".wav", ".ogg", ".aac", ".caf", ".flac", ".opus"}
REQUIRED = ("file", "status", "used_for", "author", "source_url", "licence", "human_made_evidence", "edited")

rows = json.loads((SOUNDS / "manifest.json").read_text())
problems = []
for row in rows:
    name = row.get("file") or "(a row with no file)"
    problems += [f"{name}: empty {field}" for field in REQUIRED if not row.get(field)]
    if row.get("status") not in ("placeholder", "final"):
        problems.append(f"{name}: status must be placeholder or final")
    if row.get("status") == "placeholder" and not row.get("replace_note"):
        problems.append(f"{name}: empty replace_note")
    if row.get("licence") not in ("CC0", "CC BY 4.0"):
        problems.append(f"{name}: licence must be CC0 or CC BY 4.0")
    if row.get("licence") == "CC BY 4.0" and not row.get("credit"):
        problems.append(f"{name}: CC BY needs a credit")

listed = [row.get("file") for row in rows]
on_disk = {p.name for p in SOUNDS.rglob("*") if p.suffix.lower() in AUDIO}
problems += [f"{name}: no row in manifest.json" for name in sorted(on_disk - set(listed))]
problems += [f"{name}: row has no file" for name in sorted(set(filter(None, listed)) - on_disk)]
problems += [f"{name}: two rows" for name in sorted({n for n in listed if n and listed.count(n) > 1})]

placeholders = [row for row in rows if row.get("status") == "placeholder"]
if "--report" in sys.argv:
    for row in sorted(placeholders, key=lambda r: str(r.get("used_for"))):
        print(f"{row.get('used_for')}: {row.get('file')}")
if "--release" in sys.argv:
    problems += [f"{row.get('file')}: still a placeholder" for row in placeholders]
for problem in problems:
    print(f"check_sounds: {problem}", file=sys.stderr)
sys.exit(1 if problems else 0)
