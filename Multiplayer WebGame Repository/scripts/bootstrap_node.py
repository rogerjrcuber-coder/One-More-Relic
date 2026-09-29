"""Install a verified, project-local Node 24 LTS runtime. No system changes."""
import hashlib
import json
from pathlib import Path
import urllib.request
import zipfile

root = Path(__file__).resolve().parents[1]
target = root / '.runtime'
target.mkdir(exist_ok=True)
releases = json.load(urllib.request.urlopen('https://nodejs.org/dist/index.json', timeout=45))
release = next(r['version'] for r in releases if r['version'].startswith('v24.') and r['lts'])
filename = f'node-{release}-win-x64.zip'
base = f'https://nodejs.org/dist/{release}/'
checksums = urllib.request.urlopen(base + 'SHASUMS256.txt', timeout=45).read().decode()
expected = next(line.split()[0] for line in checksums.splitlines() if line.split()[-1] == filename)
archive = target / filename
urllib.request.urlretrieve(base + filename, archive)
actual = hashlib.file_digest(archive.open('rb'), 'sha256').hexdigest()
if actual != expected:
    raise RuntimeError('Node download checksum did not match')
with zipfile.ZipFile(archive) as z:
    for item in z.infolist():
        destination = (target / item.filename).resolve()
        if not destination.is_relative_to(target.resolve()):
            raise RuntimeError('Unsafe path in runtime archive')
    z.extractall(target)
(target / 'node-path.txt').write_text(str(target / f'node-{release}-win-x64'), encoding='utf-8')
print(f'Installed verified Node {release} into .runtime', flush=True)
