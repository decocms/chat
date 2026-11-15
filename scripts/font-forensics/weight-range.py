"""Inactive numeric experiment: full-coverage Inter, weight restriction only.

Run in a private output directory; never writes application assets. Browser and
shaping/raster fidelity are separate gates even if structural assertions pass.
"""
import gc
import hashlib
import json
from pathlib import Path
import resource
import sys
import time

import brotli
import fontTools
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

assert len(sys.argv) == 3, "Pass original normal Inter WOFF2 and private output directory"
source, output = (Path(x).resolve() for x in sys.argv[1:])
assert not any((p / '.git').exists() for p in [output, *output.parents])
output.mkdir(parents=True, exist_ok=True)
sha = lambda data: hashlib.sha256(data).hexdigest()
source_bytes = source.read_bytes()
assert sha(source_bytes) == '693b77d4f32ee9b8bfc995589b5fad5e99adf2832738661f5402f9978429a8e3'
started = time.monotonic()
original = TTFont(source, lazy=False, recalcBBoxes=False, recalcTimestamp=False)
axes = lambda font: [{"tag": a.axisTag, "min": a.minValue, "default": a.defaultValue, "max": a.maxValue} for a in font['fvar'].axes]
original_axes = axes(original)
order = original.getGlyphOrder()
cmaps = lambda font: [(t.platformID, t.platEncID, t.language, t.format, sorted(t.cmap.items())) for t in font['cmap'].tables if hasattr(t, 'cmap')]
original_cmaps = cmaps(original)
raw_layout = {tag: original.reader[tag] for tag in ('GSUB', 'GPOS')}
raw_cmap = original.reader['cmap']
# No glyph/Unicode subsetting, optical-size pinning, IUP optimization, name
# rewrite, outline overlap removal or manual table replacement.
candidate = instantiateVariableFont(original, {'wght': (400, 700)}, inplace=True, optimize=False, updateFontNames=False)
assert axes(candidate) == [a if a['tag'] != 'wght' else {**a, 'min': 400.0, 'max': 700.0} for a in original_axes]
assert candidate.getGlyphOrder() == order
assert cmaps(candidate) == original_cmaps
candidate.flavor = 'woff2'
destination = output / 'inter-normal-wght400-700.woff2'
candidate.save(destination, reorderTables=False)
candidate.close()
del candidate, original
gc.collect()
verified = TTFont(destination, lazy=False, recalcBBoxes=False, recalcTimestamp=False)
# Reload every table to catch malformed encodings, not just a valid header.
for tag in verified.reader.keys():
    verified[tag]
assert verified.getGlyphOrder() == order
assert cmaps(verified) == original_cmaps
assert verified.reader['cmap'] == raw_cmap
layout_equal = {tag: verified.reader[tag] == data for tag, data in raw_layout.items()}
result = {
    'diagnosticOnly': True, 'activated': False, 'accepted': False,
    'source': {'sha256': sha(source_bytes), 'bytes': len(source_bytes), 'axes': original_axes},
    'candidate': {'file': destination.name, 'sha256': sha(destination.read_bytes()), 'bytes': destination.stat().st_size, 'axes': axes(verified)},
    'savedBytes': len(source_bytes) - destination.stat().st_size,
    'glyphCount': len(order), 'glyphOrderExact': True,
    'unicodeMappings': len(verified.getBestCmap()), 'allCmapSubtablesExact': True,
    'rawCmapExact': True, 'rawLayoutEqual': layout_equal, 'allTablesReloaded': True,
    'candidateRawTableBytes': {tag: len(verified.reader[tag]) for tag in verified.reader.keys()},
    'tools': {'python': sys.version, 'fontTools': fontTools.__version__, 'brotli': brotli.__version__},
    'settings': {'wght': [400, 700], 'opsz': 'original full range', 'optimize': False, 'updateFontNames': False, 'glyphSubset': False},
    'elapsedSeconds': time.monotonic() - started,
    'peakRSSKiB': resource.getrusage(resource.RUSAGE_SELF).ru_maxrss,
    'gaps': ['No browser/shaping/raster acceptance', 'Normal face only; italic and Mono unchanged', 'Weights outside 400..700 unsupported by this candidate; production requires a separately proven original-font fallback or broader range', 'Aggregate transfer/readiness budget not waived'],
}
verified.close()
(output / 'results.json').write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps(result, indent=2))

assert all(layout_equal.values()), 'Raw layout changed; inspect recorded artifact before any fidelity claim'
