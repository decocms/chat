# Short-phone viewport failure at 587de12

Exact source/tested revision: `587de122b2adc716a9a728f57c1992744bcd69e5`.
[Complete managed browser run](https://github.com/decocms/chat/actions/runs/43642706812)
fails the independent profile audit. The earlier R2 Viewer phase now passes, as
do the other core phases, lifecycle checks and independent App authority audits.
This is a failed overall run, not final acceptance.

The twelve-profile audit completed all combinations of English/Portuguese,
light/dark and 1440/768/390 widths. Eight profiles pass. All four 390px profiles
fail the new 420px-height geometry assertion: chat height is zero and the composer
bottom is 497px in English or 769px in Portuguese, outside the 420px viewport.
The unbounded mobile notice row is being fixed with a scrollable height limit;
the original assertions remain in place for the next run.

Six original safe JSON artifacts are retained. Larger files use gzip, restoring
exact original bytes on decompression. `provenance.json` records source/run,
individual phase status, profile failures and original/stored SHA-256 hashes.
Screenshots and raw logs are not included. A separate repository workflow at
this source passes Linux/macOS source gates and generated-asset consistency.

These local Worker/browser results do not establish the later Fire port, real
speech hardware/providers, production, performance or full migration acceptance.
