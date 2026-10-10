"""Validate the standalone page and its dynamically loaded Beidou assets."""
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit
import json
import subprocess

root = Path(__file__).resolve().parents[1] / "site"


class References(HTMLParser):
    def __init__(self, path):
        super().__init__()
        self.path = path

    def handle_starttag(self, tag, attrs):
        for name, value in attrs:
            if name not in {"src", "href"} or not value:
                continue
            url = urlsplit(value)
            if url.scheme or url.netloc or not url.path:
                continue
            path = root / unquote(url.path).lstrip("/") if url.path.startswith("/") else self.path.parent / unquote(url.path)
            assert path.is_file(), f"Missing asset referenced by {self.path}: {value}"


assert (root / "index.html").is_file(), "Missing standalone entry point"
for html in root.rglob("*.html"):
    References(html).feed(html.read_text(encoding="utf-8"))
for script in root.rglob("*.js"):
    subprocess.run(["node", "--check", str(script)], check=True)

# Read the engine and asset map to include images loaded by game.js at runtime.
asset_files = subprocess.check_output(
    ["node", "-e", """
global.window = {};
require('./assets/asset-map.js');
const engine = require('./engine.js');
console.log(JSON.stringify(engine.PARTS.map(part =>
  window.BEIDOU_ASSET_FILES[part.file] || `${part.file}.svg`
)));
"""], cwd=root, text=True,
)
for filename in [*json.loads(asset_files), "earth-sphere.png", "earth-texture.jpg", "clock.svg"]:
    assert (root / "assets" / filename).is_file(), f"Missing runtime asset: {filename}"
print("All JavaScript syntax checks, HTML references, and Beidou runtime assets passed.")
