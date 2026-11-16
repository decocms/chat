# Managed application and HMR evidence at 9f58378

Exact source and tested revision: `9f583789bf24f8ce5b2737059eb8ab9b9cb1eacf`.

- [Integrated application browser run](https://github.com/decocms/chat/actions/runs/43639334636): passed, including actual local Worker/Book/D1/R2/DocRoom flows, twenty lifecycle cycles, eight language/theme/device profiles, native/default collaboration and independent inline App consent/navigation checks.
- [Complete source HMR run](https://github.com/decocms/chat/actions/runs/43639335097): passed with the explicit local Worker fix, all source-edit stages and owned cleanup. This replaces the earlier published-head HMR failure as the latest managed HMR evidence.
- [App transport security run](https://github.com/decocms/chat/actions/runs/43639333298): passed separately; its artifacts are not included in this directory.
- [Repository workflow](https://github.com/decocms/chat/actions/runs/43639335182): failed on checked-in preview freshness on Linux and macOS. Source checks and the separate layout job passed. The committed preview must be rebuilt from the combined source before acceptance.

Eight original safe JSON artifact files are retained. Large JSON files use gzip;
decompression restores the exact original bytes. `provenance.json` records run,
artifact, original/stored sizes and SHA-256 hashes. Raw logs and screenshots are
not part of this retained set. Navigation diagnostic status fields are subsidiary
records, not substitutes for the complete result and runner status.

These managed local tests do not prove production deployment, live AI or speech
hardware, final revised-source parity, or performance acceptance. The latest
complete performance cohort still fails 11 of 16 unchanged budgets. Vanilla
remains the default; the migration remains unaccepted.
