# Evidence supporting the inactive font-budget proposal

This is a read-only extraction of already retained measurements, not a profiler, subsetter, browser or benchmark rerun. The proposal is not approved or active. No validator or production font/style file is changed.

Source checkout for this extraction: `3a73dffaf9fe3ff66045c08515a50714fc89060a`. Measured source: `14646bcf8f8445a7c7f8e8606c927a9ba791c87e`, [run 43665138953](https://github.com/vibegui/vibebook.dev/actions/runs/43665138953). The original run remains execution-passed and performance-failed, with twelve of sixteen budgets failed. Its four additional diagnostic trials do not enter this font cohort.

## Exact retained input

| Input | Bytes | SHA-256 |
| --- | ---: | --- |
| Original `metrics.json`, restored from the retained gzip | 4,705,064 | `0f3f523f41ea534aa27b1101d72bdb393d896991df92225b35504270e17e932e` |
| Retained `metrics.json.gz` | 354,886 | `070925152994c2f50f51e211e004c3d151fada6497e5c32c998d83dde168710c` |

Both hashes were checked against the [original provenance](../performance/2026-11-15-14646bc/provenance.json). The [audit JSON](146-font-audit.json) records that provenance file's own digest, hashes the source files used for the explanation, preserves the two original font budget rows, and includes all fourteen native measured-trial font receipts with device/profile/repetition, loaded-face descriptors and full safe network request records. These are synthetic loopback fixture URLs, not user or authentication traffic. No raw heap, private source, cookies, tokens, audio or production data is added.

For each device there are seven measured native trials. Every trial has three distinct font URLs, three completed HTTP 200 responses, zero cache hits and zero failed requests. All fourteen totals are exactly 826,876 bytes. All 42 original request records are preserved as JSON objects; no inferred per-library allocation or extrapolated network saving is introduced.

## Original assets verified against the frozen manifest

| Asset under `public/fonts/studio/` | Bytes | SHA-256 |
| --- | ---: | --- |
| `InterVariable-693b77d4f3.woff2` | 352,240 | `693b77d4f32ee9b8bfc995589b5fad5e99adf2832738661f5402f9978429a8e3` |
| `InterVariable-Italic-e564f65291.woff2` | 387,976 | `e564f652916db6c139570fefb9524a77c4d48f30c92928de9db19b6b5c7a262a` |
| `CommitMono-f342ca6c3f.woff2` | 86,768 | `f342ca6c3f2597e6c0fcd84b3f3ed64d3ce5bdb6d0af19d190d645a558b1cf29` |

The exact source URLs and license provenance remain in [font-assets.json](../font-assets.json). Frozen face registrations are in [studio-tokens.json](../studio-tokens.json). Their Inter normal/italic and CommitMono family, weight/style and display descriptors match the three registrations in `svelte/styles/tailwind.css`; the current font files match the manifest by size and digest. The frozen stylesheet also declares Switzer, whose existence alone does not make it a required role; native does not request it. No new unused font family is being removed by this proposal.

The model source at `scripts/ui-metrics-model.ts` seeds real agent Markdown containing `_emphasis_`, inline code and fenced code. `RichNodes.svelte` preserves semantic emphasis and applies the Studio mono token to code. The measurements report all three faces loaded; a body-node platform-font sample is not a per-glyph attribution for every role. A future approved run must retain the independent per-role font/fidelity checks rather than claiming that this aggregate transfer receipt alone proves every script or optical size.

## Arithmetic and limits

The original formula's limits are 292,896 bytes on desktop (vanilla 190,496 +102,400) and 293,029 on mobile (vanilla 190,629 +102,400). Native is 826,876 on both. The proposed absolute ceiling is 900 ×1024 =921,600 bytes, with 921,600 −826,876 =94,724 bytes (92.50390625 KiB) of bounded headroom. This does not authorize an extra 900 KiB on top of the baseline.

The JSON extraction checked the compressed and original metrics hashes, every original font size/digest, the fourteen-trial count, three unique successful uncached requests per trial and every summed transfer total. It did not rerun or modify measurements. It does not prove exact font usage for arbitrary user text, new derivatives, every renderer, or any pending provider/hardware gate. Prior rejected candidates remain rejected. Only two Markdown documents and this machine-readable audit are proposed for review.
