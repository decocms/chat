# Inactive weight-range experiment

Source audit: `139573ac8437d9a39b054e8f6687ae6bd8e8d591`. The original production fonts remain active. This experiment does not reuse the rejected Unicode partitions or remove glyph coverage.

## Actual weights and axes

`tailwind.css` maps normal to 400, medium and semibold to 500, and bold to 600. The current native source has 6 explicit normal, 21 medium and 53 semibold utility occurrences, with no explicit bold utility. That is not the complete browser weight inventory: Tailwind preflight sets `b,strong` to `bolder`. Bare file/folder names in `Files`, side-file titles, document-App titles, and Apps catalog `strong` elements therefore request 700 from a normal 400 ancestor. Clamping to 600 would change these roles. Authored SVG can also request other weights. No role normalization was made.

Original normal Inter is 352,240 bytes, 2,937 glyphs / 2,852 nominal Unicode mappings; italic is 387,976 bytes, 2,901 glyphs / 2,816 mappings. Both have `wght` 100 / default 400 / 900 and `opsz` 14 / default 14 / 32. Original Mono is 86,768 bytes, 1,932 glyphs / 1,175 mappings, with `wght` 200 / default 200 / 700 and `ital` 0 / default 0 / 1. Terminal rendering leaves xterm's normal/bold weight defaults intact. Neither Mono nor italic was modified.

## One generated candidate

One remote FontTools 4.68.0 / Brotli 1.2.1 / CPython 3.14.9 job restricted normal Inter to `wght` 400 / default 400 / 700, preserving the full optical-size axis. It used partial instancing with `optimize=False`, no glyph subset, no font-name rewrite, and no manual table replacement. All tables in the emitted WOFF2 were decoded successfully. Full glyph order and every cmap subtable remain equal; raw cmap and raw GSUB are exact.

The private candidate is **255,300 bytes**, SHA-256 `921d1ef9ce21cd00487ce5e8ebfaf4f8b12ba54680bcc98c590966a6589410f4`: 96,940 bytes / 27.52% smaller than original normal Inter. Candidate plus unchanged Mono is already **342,068 bytes**, exceeding the existing 293,033-byte aggregate font ceiling by **49,035 bytes**, before italic or any out-of-range fallback. These are file-size sums, not integrated request measurements. The mechanism alone does not close the aggregate budget.

The job deliberately failed its strict raw-layout guard: GPOS grew from 153,994 to 155,372 bytes and its XML differs. The first structural difference is lookup 1's three subtables becoming two. The installed `instantiateOTL` implementation explicitly merges split lookup subtables and rebases/remaps variation stores. This explains why byte equality is too strong to assume for this mechanism; it does **not** establish equivalent positioning or raster output. GSUB remains 24,406 bytes and XML-equal. Full details are retained in the [unaltered inspection receipt](2026-11-14-weight-range-numeric.json).

No browser, HarfBuzz comparison, pixel/geometry comparison, weight outside 400..700 behavior, or integrated transfer test ran. This is not a font-fidelity or budget acceptance. Peak memory was not captured for the initial failed job. No 400..600 diagnostic, second generation, or production activation followed.

The private output on BugMachine is `/home/zip76/.cache/vibebook-codex-verification/reports/font-weight400-700-numeric-2026-11-14/`; it includes the candidate and original/candidate GPOS XML for bounded inspection. The reproducible recipe is `scripts/font-forensics/weight-range.py`; it now writes its failure receipt before enforcing the raw-layout guard (the initial execution asserted first, so its subsequent inspection JSON is retained separately).

## Next decision

Keep all original fonts active. If further work is authorized, first compare positioning and raw outlines across 400/450/500/550/600/650/700 with optical size 14/23/32/auto, mixed-script/combining marks and real bare-`b` controls, with exact A/A controls. Preserve original-font matching outside the candidate range; silently clamping an existing 700/900 role is not acceptable. Any broader normal/italic/Mono optimization needs an aggregate byte estimate before another generation, because this one-face saving is insufficient.
