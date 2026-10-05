#!/usr/bin/env python3
"""Restore the complete audit snapshot using only Python's standard library."""
import argparse
import hashlib
import io
import json
import tarfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--destination', type=Path, default=HERE.parents[2],
                    help='Repository-shaped destination; defaults to this checkout.')
args = parser.parse_args()
destination = args.destination.resolve()
manifest = json.loads((HERE / 'evidence-manifest.json').read_text())
digest = lambda value: hashlib.sha256(value).hexdigest()
parts = []
for part in manifest['parts']:
    content = (HERE / part['path']).read_bytes()
    if digest(content) != part['sha256'] or len(content) != part['bytes']:
        raise SystemExit(f"Evidence part failed verification: {part['path']}")
    parts.append(content)
archive = b''.join(parts)
if digest(archive) != manifest['archiveSha256']:
    raise SystemExit('Complete archive failed verification')
expected = {f['path']: f for f in manifest['files']}
restored = {}
with tarfile.open(fileobj=io.BytesIO(archive), mode='r:gz') as tar:
    for member in tar:
        if not member.isfile() or member.name not in expected or member.name in restored:
            raise SystemExit(f'Unexpected archive entry: {member.name}')
        target = (destination / member.name).resolve()
        if not target.is_relative_to(destination):
            raise SystemExit(f'Invalid archive path: {member.name}')
        content = tar.extractfile(member).read()
        record = expected[member.name]
        if digest(content) != record['sha256'] or len(content) != record['bytes']:
            raise SystemExit(f'File failed verification: {member.name}')
        if target.exists() and target.read_bytes() != content:
            raise SystemExit(f'Refusing to overwrite a changed file: {target}; use --destination.')
        restored[member.name] = (target, content)
if set(restored) != set(expected):
    raise SystemExit('Archive does not contain every manifest file')
for target, content in restored.values():
    target.parent.mkdir(parents=True, exist_ok=True)
    if not target.exists():
        target.write_bytes(content)
print(f'Verified and restored {len(restored)} files to {destination}')
